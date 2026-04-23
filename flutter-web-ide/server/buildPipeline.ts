import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { addBuildLog, updateProjectStatus, getProjectById } from "./db";
import { storageGetSignedUrl } from "./storage";

const FLUTTER_SDK_DIR = "/home/ubuntu/flutter-sdk";
const FLUTTER_BIN = path.join(FLUTTER_SDK_DIR, "bin", "flutter");
const PROJECTS_DIR = "/home/ubuntu/flutter-projects";
const ANDROID_SDK_DIR = "/home/ubuntu/android-sdk";
const JAVA_HOME = "/home/ubuntu/java-17";
const ANDROID_DEPS_REPO = `https://${process.env.GITHUB_TOKEN}@github.com/helenamartins-pixel/Android-Studio.git`;
const ANDROID_DEPS_LOCAL = "/home/ubuntu/Android-Studio";

// In-memory event emitter for SSE
type LogListener = (data: { step: string; message: string }) => void;
const listeners = new Map<number, Set<LogListener>>();

export function subscribeToLogs(projectId: number, listener: LogListener) {
  if (!listeners.has(projectId)) {
    listeners.set(projectId, new Set());
  }
  listeners.get(projectId)!.add(listener);
  return () => {
    listeners.get(projectId)?.delete(listener);
    if (listeners.get(projectId)?.size === 0) {
      listeners.delete(projectId);
    }
  };
}

function emitLog(projectId: number, step: string, message: string) {
  const subs = listeners.get(projectId);
  if (subs) {
    subs.forEach((listener) => {
      listener({ step, message });
    });
  }
  // Also persist to DB (fire and forget)
  addBuildLog({ projectId, step: step as any, message }).catch(() => {});
}

/**
 * Determine the actual Java home path.
 * First checks /home/ubuntu/java-17 (extracted from Git), then falls back to system Java.
 */
function getJavaHome(): string {
  if (fs.existsSync(path.join(JAVA_HOME, "bin", "java"))) {
    return JAVA_HOME;
  }
  // Fallback: system-installed Java 17
  const systemJava = "/usr/lib/jvm/java-17-openjdk-amd64";
  if (fs.existsSync(path.join(systemJava, "bin", "java"))) {
    return systemJava;
  }
  return JAVA_HOME; // will fail later with a clear error
}

/** Build environment with Flutter SDK, Android SDK, Java 17 */
function getBuildEnv(): Record<string, string> {
  const javaHome = getJavaHome();
  return {
    ...process.env as Record<string, string>,
    PATH: `${FLUTTER_SDK_DIR}/bin:${javaHome}/bin:${ANDROID_SDK_DIR}/cmdline-tools/latest/bin:${ANDROID_SDK_DIR}/platform-tools:${process.env.PATH}`,
    PUB_CACHE: "/home/ubuntu/.pub-cache",
    FLUTTER_ROOT: FLUTTER_SDK_DIR,
    ANDROID_HOME: ANDROID_SDK_DIR,
    ANDROID_SDK_ROOT: ANDROID_SDK_DIR,
    JAVA_HOME: javaHome,
    // Limit Gradle JVM memory to prevent OOM daemon crashes
    GRADLE_OPTS: "-Xmx1536m -Dorg.gradle.daemon=false -Dorg.gradle.workers.max=2 -Dkotlin.daemon.jvm.options=-Xmx512m",
  };
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  projectId: number,
  step: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    emitLog(projectId, step, `$ ${cmd} ${args.join(" ")}\n`);

    const proc = spawn(cmd, args, {
      cwd,
      env: getBuildEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      emitLog(projectId, step, text);
    });

    proc.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      emitLog(projectId, step, text);
    });

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      emitLog(projectId, step, `Error: ${err.message}\n`);
      reject(err);
    });
  });
}

export function getProjectDir(projectId: number): string {
  return path.join(PROJECTS_DIR, `project_${projectId}`);
}

/**
 * Clone the dependencies repository if not already present.
 * Pulls LFS files so all .tar.gz archives are available.
 */
async function ensureDepsRepo(projectId: number): Promise<void> {
  if (fs.existsSync(path.join(ANDROID_DEPS_LOCAL, ".git"))) {
    // Already cloned — pull latest
    emitLog(projectId, "build", "Checking for dependency updates from GitHub...\n");
    try {
      execSync("git pull --ff-only 2>&1 || true", {
        cwd: ANDROID_DEPS_LOCAL,
        timeout: 30000,
      });
    } catch {
      // Ignore pull errors
    }
  } else {
    emitLog(projectId, "build", "Cloning dependencies repository from GitHub...\n");
    emitLog(projectId, "build", `Repository: ${ANDROID_DEPS_REPO}\n`);

    const cloneCode = await runCommand(
      "git",
      ["clone", ANDROID_DEPS_REPO, ANDROID_DEPS_LOCAL],
      "/home/ubuntu",
      projectId,
      "build"
    );

    if (cloneCode !== 0) {
      throw new Error("Failed to clone dependencies repository from GitHub");
    }
  }

  // Pull LFS files if any are missing or are pointer files (< 1KB)
  const archives = ["sdk-essential.tar.gz", "sdk-ndk.tar.gz", "flutter-sdk.tar.gz", "java17-jdk.tar.gz"];
  const needLfs = archives.some((name) => {
    const p = path.join(ANDROID_DEPS_LOCAL, name);
    return !fs.existsSync(p) || fs.statSync(p).size < 1000;
  });

  if (needLfs) {
    emitLog(projectId, "build", "Pulling LFS files (Flutter SDK, Java 17, Android SDK, NDK)...\n");

    // Ensure the remote URL has the correct token (in case it was cloned with a different token)
    try {
      execSync(`git remote set-url origin ${ANDROID_DEPS_REPO}`, {
        cwd: ANDROID_DEPS_LOCAL,
        timeout: 10000,
      });
    } catch {
      // Ignore errors setting remote URL
    }

    // Use --include to pull only the tarball files, avoiding index errors with project files
    const lfsCode = await runCommand(
      "git",
      ["lfs", "pull", "--include", "*.tar.gz", "--exclude", ""],
      ANDROID_DEPS_LOCAL,
      projectId,
      "build"
    );

    if (lfsCode !== 0) {
      // Try individual file downloads as fallback
      emitLog(projectId, "build", "git lfs pull had issues, trying individual file fetch...\n");
      for (const archive of archives) {
        const archivePath = path.join(ANDROID_DEPS_LOCAL, archive);
        if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size < 1000) {
          await runCommand(
            "git",
            ["lfs", "pull", "--include", archive],
            ANDROID_DEPS_LOCAL,
            projectId,
            "build"
          );
        }
      }
    }
  }
}

/**
 * Ensure Java 17 JDK is installed.
 * Extracts from the Git repository if not found locally.
 */
async function ensureJava(projectId: number): Promise<void> {
  const javaHome = getJavaHome();
  if (fs.existsSync(path.join(javaHome, "bin", "java"))) {
    emitLog(projectId, "build", `Java 17 already available at ${javaHome}\n`);
    return;
  }

  const tarPath = path.join(ANDROID_DEPS_LOCAL, "java17-jdk.tar.gz");
  if (!fs.existsSync(tarPath) || fs.statSync(tarPath).size < 1000) {
    throw new Error("java17-jdk.tar.gz not found in dependencies repository");
  }

  emitLog(projectId, "build", "Installing Java 17 JDK from GitHub repository...\n");

  // The tarball contains lib/jvm/java-17-openjdk-amd64/ — extract to a temp dir then move
  const tmpDir = "/tmp/java17-extract";
  fs.mkdirSync(tmpDir, { recursive: true });

  const extractCode = await runCommand(
    "tar",
    ["-xzf", tarPath, "-C", tmpDir],
    "/home/ubuntu",
    projectId,
    "build"
  );

  if (extractCode !== 0) {
    throw new Error("Failed to extract Java 17 JDK");
  }

  // Move extracted JDK to the expected location
  const extractedPath = path.join(tmpDir, "lib", "jvm", "java-17-openjdk-amd64");
  if (fs.existsSync(extractedPath)) {
    // Copy to /home/ubuntu/java-17
    const mvCode = await runCommand(
      "cp",
      ["-r", extractedPath, JAVA_HOME],
      "/home/ubuntu",
      projectId,
      "build"
    );
    if (mvCode !== 0) {
      throw new Error("Failed to install Java 17 JDK");
    }
  } else {
    // Try system path as fallback
    const sysCode = await runCommand(
      "sudo",
      ["tar", "-xzf", tarPath, "-C", "/usr"],
      "/home/ubuntu",
      projectId,
      "build"
    );
    if (sysCode !== 0) {
      throw new Error("Failed to extract Java 17 to system path");
    }
  }

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  emitLog(projectId, "build", "Java 17 JDK installed successfully.\n");
}

/**
 * Ensure Flutter SDK is installed.
 * Extracts from the Git repository if not found locally.
 */
async function ensureFlutterSdk(projectId: number): Promise<void> {
  if (fs.existsSync(FLUTTER_BIN)) {
    emitLog(projectId, "build", "Flutter SDK already available locally.\n");
    return;
  }

  const tarPath = path.join(ANDROID_DEPS_LOCAL, "flutter-sdk.tar.gz");
  if (!fs.existsSync(tarPath) || fs.statSync(tarPath).size < 1000) {
    throw new Error("flutter-sdk.tar.gz not found in dependencies repository");
  }

  emitLog(projectId, "build", "Installing Flutter SDK from GitHub repository...\n");

  const extractCode = await runCommand(
    "tar",
    ["-xzf", tarPath, "-C", "/home/ubuntu", "--strip-components=0"],
    "/home/ubuntu",
    projectId,
    "build"
  );

  if (extractCode !== 0) {
    throw new Error("Failed to extract Flutter SDK");
  }

  // Add safe.directory exception and initialize a fake git repo in the Flutter SDK directory
  // so flutter tool doesn't complain (flutter requires a git repo to check its own version)
  try {
    // Add safe.directory to avoid 'dubious ownership' errors when running as root
    execSync(`git config --global --add safe.directory ${FLUTTER_SDK_DIR}`, { timeout: 5000 });
    execSync("git config --global --add safe.directory '*'", { timeout: 5000 });
  } catch {
    // ignore — best effort
  }

  try {
    if (!fs.existsSync(path.join(FLUTTER_SDK_DIR, ".git"))) {
      emitLog(projectId, "build", "Initializing git repo in Flutter SDK directory...\n");
      execSync("git init && git commit --allow-empty -m 'init'", {
        cwd: FLUTTER_SDK_DIR,
        env: { ...process.env, GIT_AUTHOR_NAME: "flutter", GIT_AUTHOR_EMAIL: "flutter@flutter.dev", GIT_COMMITTER_NAME: "flutter", GIT_COMMITTER_EMAIL: "flutter@flutter.dev" },
        timeout: 15000,
      });
    }
  } catch (gitErr) {
    emitLog(projectId, "build", `Warning: Could not init git in Flutter SDK: ${gitErr}\n`);
  }

  // Run flutter precache to download engine artifacts (excluded from tarball to save space)
  emitLog(projectId, "build", "Running flutter precache to download engine artifacts...\n");
  const precacheCode = await runCommand(
    FLUTTER_BIN,
    ["precache", "--no-android", "--no-ios", "--no-linux", "--no-macos", "--no-windows", "--no-fuchsia", "--web"],
    "/home/ubuntu",
    projectId,
    "build"
  );

  if (precacheCode !== 0) {
    emitLog(projectId, "build", "Warning: flutter precache had issues, but continuing...\n");
  }

  emitLog(projectId, "build", "Flutter SDK installed successfully.\n");
}

/**
 * Ensure Android SDK + NDK are installed.
 * Extracts from the Git repository if not found locally.
 */
async function ensureAndroidSdk(projectId: number): Promise<void> {
  const sdkMarker = path.join(ANDROID_SDK_DIR, "licenses");
  const ndkMarker = path.join(ANDROID_SDK_DIR, "ndk");

  fs.mkdirSync(ANDROID_SDK_DIR, { recursive: true });

  // Extract SDK essential
  if (!fs.existsSync(sdkMarker)) {
    const essentialTar = path.join(ANDROID_DEPS_LOCAL, "sdk-essential.tar.gz");
    if (!fs.existsSync(essentialTar) || fs.statSync(essentialTar).size < 1000) {
      throw new Error("sdk-essential.tar.gz not found in dependencies repository");
    }

    emitLog(projectId, "build", "Installing Android SDK from GitHub repository...\n");
    const extractCode = await runCommand(
      "tar",
      ["-xzf", essentialTar, "-C", "/home/ubuntu", "--strip-components=0"],
      "/home/ubuntu",
      projectId,
      "build"
    );
    if (extractCode !== 0) {
      throw new Error("Failed to extract Android SDK");
    }
    emitLog(projectId, "build", "Android SDK installed successfully.\n");
  } else {
    emitLog(projectId, "build", "Android SDK already available locally.\n");
  }

  // Extract NDK
  if (!fs.existsSync(ndkMarker)) {
    const ndkTar = path.join(ANDROID_DEPS_LOCAL, "sdk-ndk.tar.gz");
    if (fs.existsSync(ndkTar) && fs.statSync(ndkTar).size > 1000) {
      emitLog(projectId, "build", "Installing Android NDK from GitHub repository...\n");
      const ndkCode = await runCommand(
        "tar",
        ["-xzf", ndkTar, "-C", "/home/ubuntu", "--strip-components=0"],
        "/home/ubuntu",
        projectId,
        "build"
      );
      if (ndkCode !== 0) {
        emitLog(projectId, "build", "Warning: Failed to extract NDK. Native plugins may not compile.\n");
      } else {
        emitLog(projectId, "build", "Android NDK installed successfully.\n");
      }
    }
  } else {
    emitLog(projectId, "build", "Android NDK already available locally.\n");
  }
}

/**
 * Master function: ensures ALL dependencies are installed from the Git repository.
 * After this function completes, Flutter SDK, Java 17, Android SDK, and NDK are all ready.
 * The server only needs Git + Git LFS pre-installed.
 */
async function ensureAllDependencies(projectId: number, buildType: "web" | "apk"): Promise<void> {
  emitLog(projectId, "build", "=== Checking build dependencies ===\n");

  // Step 0: Ensure required system tools are available (curl, unzip)
  const missingTools: string[] = [];
  try { execSync("which curl", { stdio: "ignore", timeout: 3000 }); } catch { missingTools.push("curl"); }
  try { execSync("which unzip", { stdio: "ignore", timeout: 3000 }); } catch { missingTools.push("unzip"); }
  if (missingTools.length > 0) {
    emitLog(projectId, "build", `Installing missing tools: ${missingTools.join(", ")}...\n`);
    try {
      execSync(`apt-get update -qq && apt-get install -y -qq ${missingTools.join(" ")}`, {
        timeout: 120000,
        stdio: "pipe",
      });
      emitLog(projectId, "build", "System tools installed successfully.\n");
    } catch (aptErr) {
      emitLog(projectId, "build", `Warning: Could not install tools via apt: ${aptErr}\n`);
    }
  }

  // Step 1: Clone/update the dependencies repository
  await ensureDepsRepo(projectId);

  // Step 2: Ensure Java 17 (needed for APK builds, but install anyway for consistency)
  if (buildType === "apk") {
    await ensureJava(projectId);
  }

  // Step 3: Ensure Flutter SDK
  await ensureFlutterSdk(projectId);

  // Step 4: Ensure Android SDK + NDK (only for APK builds)
  if (buildType === "apk") {
    await ensureAndroidSdk(projectId);
  }

  emitLog(projectId, "build", "=== All dependencies ready ===\n\n");
}

/**
 * Prepare gradle.properties in the android/ folder to limit JVM memory
 * and disable the Gradle daemon. This prevents OOM crashes on low-memory servers.
 */
function prepareGradleProperties(flutterRoot: string) {
  const androidDir = path.join(flutterRoot, "android");
  if (!fs.existsSync(androidDir)) return;

  const gradlePropsPath = path.join(androidDir, "gradle.properties");
  let existingContent = "";
  if (fs.existsSync(gradlePropsPath)) {
    existingContent = fs.readFileSync(gradlePropsPath, "utf-8");
  }

  const memorySettings: Record<string, string> = {
    "org.gradle.jvmargs": "-Xmx1536m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
    "org.gradle.daemon": "false",
    "org.gradle.parallel": "false",
    "org.gradle.workers.max": "2",
    "org.gradle.caching": "true",
    "kotlin.daemon.jvmargs": "-Xmx512m",
  };

  const lines = existingContent.split("\n");
  const existingKeys = new Set<string>();

  for (const line of lines) {
    const match = line.match(/^([^=]+)=/);
    if (match) {
      existingKeys.add(match[1].trim());
    }
  }

  let appended = "";
  for (const [key, value] of Object.entries(memorySettings)) {
    if (existingKeys.has(key)) {
      if (key === "org.gradle.jvmargs") {
        const idx = lines.findIndex((l) => l.startsWith("org.gradle.jvmargs"));
        if (idx >= 0) {
          lines[idx] = `org.gradle.jvmargs=${value}`;
        }
      }
    } else {
      appended += `${key}=${value}\n`;
    }
  }

  let finalContent = lines.join("\n");
  if (appended) {
    finalContent = finalContent.trimEnd() + "\n\n# Added by Flutter Web IDE to prevent OOM\n" + appended;
  }

  fs.writeFileSync(gradlePropsPath, finalContent, "utf-8");
}

/**
 * Kill any lingering Gradle daemons to free memory before a new build.
 */
async function killGradleDaemons() {
  try {
    await new Promise<void>((resolve) => {
      const proc = spawn("pkill", ["-f", "GradleDaemon"], {
        stdio: "ignore",
      });
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {
    // ignore — no daemons to kill
  }
}

/**
 * Download ZIP from S3 to a local path if local file doesn't exist.
 * Returns the local path to the ZIP file.
 */
async function resolveZipPath(projectId: number, localZipPath: string): Promise<string | null> {
  // If local file exists, use it directly
  if (localZipPath && fs.existsSync(localZipPath)) {
    return localZipPath;
  }

  // Try to download from S3 using the zipKey stored in DB
  try {
    const project = await getProjectById(projectId);
    if (!project?.zipKey) {
      return null;
    }

    emitLog(projectId, "build", "Downloading project ZIP from S3 storage...\n");
    const signedUrl = await storageGetSignedUrl(project.zipKey);

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ZIP from S3: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const downloadPath = path.join("/home/ubuntu/flutter-uploads", `${projectId}_downloaded.zip`);
    fs.mkdirSync("/home/ubuntu/flutter-uploads", { recursive: true });
    fs.writeFileSync(downloadPath, buffer);
    emitLog(projectId, "build", `ZIP downloaded from S3 (${(buffer.length / 1024 / 1024).toFixed(1)} MB)\n`);
    return downloadPath;
  } catch (err: any) {
    emitLog(projectId, "build", `Warning: Could not download ZIP from S3: ${err.message}\n`);
    return null;
  }
}

export async function runBuildPipeline(
  projectId: number,
  zipPath: string,
  buildType: "web" | "apk"
) {
  const projectDir = getProjectDir(projectId);
  let flutterRoot: string | null = null;

  try {
    // === STEP 0: Ensure all dependencies are installed from Git ===
    await ensureAllDependencies(projectId, buildType);

    // Resolve ZIP path — download from S3 if local file is missing
    const resolvedZipPath = await resolveZipPath(projectId, zipPath);

    // If zipPath is provided, do extraction. Otherwise skip to build (rebuild case).
    if (resolvedZipPath && fs.existsSync(resolvedZipPath)) {
      // Step 1: Extract
      await updateProjectStatus(projectId, "extracting");
      emitLog(projectId, "extract", "Extracting ZIP archive...\n");

      fs.mkdirSync(projectDir, { recursive: true });

      const extractCode = await runCommand(
        "unzip",
        ["-o", resolvedZipPath, "-d", projectDir],
        projectDir,
        projectId,
        "extract"
      );

      if (extractCode !== 0) {
        throw new Error("Failed to extract ZIP archive");
      }

      flutterRoot = findFlutterRoot(projectDir);
      if (!flutterRoot) {
        throw new Error("No pubspec.yaml found in the uploaded project. Make sure it's a valid Flutter project.");
      }

      await updateProjectStatus(projectId, "extracting", { localPath: flutterRoot });

      emitLog(projectId, "extract", `Flutter project found at: ${flutterRoot}\n`);
      emitLog(projectId, "extract", "Extraction completed successfully.\n");
    } else {
      // Rebuild case: find existing project root
      emitLog(projectId, "extract", "Rebuild mode — using existing project files.\n");
      const { getProjectById: getProj } = await import("./db");
      const proj = await getProj(projectId);
      flutterRoot = proj?.localPath || findFlutterRoot(projectDir);
      if (!flutterRoot || !fs.existsSync(flutterRoot)) {
        throw new Error("Project files not found. Please re-upload the project.");
      }
    }

    // Step 2: Flutter pub get
    await updateProjectStatus(projectId, "pub_get");
    emitLog(projectId, "pub_get", "Installing dependencies...\n");

    const pubGetCode = await runCommand(
      FLUTTER_BIN,
      ["pub", "get"],
      flutterRoot,
      projectId,
      "pub_get"
    );

    if (pubGetCode !== 0) {
      throw new Error("flutter pub get failed");
    }

    emitLog(projectId, "pub_get", "Dependencies installed successfully.\n");

    // Step 3: Build
    await updateProjectStatus(projectId, "building");
    emitLog(projectId, "build", `Starting flutter build ${buildType}...\n`);

    // For APK builds: prepare gradle.properties, kill old daemons
    if (buildType === "apk") {
      emitLog(projectId, "build", "Configuring Gradle memory limits (1.5GB max) to prevent OOM...\n");
      prepareGradleProperties(flutterRoot);
      await killGradleDaemons();
    }

    let buildArgs: string[];
    if (buildType === "web") {
      buildArgs = ["build", "web", "--release"];
    } else {
      buildArgs = ["build", "apk", "--release"];
    }

    const buildCode = await runCommand(
      FLUTTER_BIN,
      buildArgs,
      flutterRoot,
      projectId,
      "build"
    );

    if (buildCode !== 0) {
      throw new Error(`flutter build ${buildType} failed`);
    }

    emitLog(projectId, "build", `Build ${buildType} completed successfully!\n`);

    // Step 4: Complete - determine output path
    let outputPath: string;
    if (buildType === "web") {
      outputPath = path.join(flutterRoot, "build", "web");
    } else {
      outputPath = path.join(flutterRoot, "build", "app", "outputs", "flutter-apk", "app-release.apk");
    }

    await updateProjectStatus(projectId, "completed", {
      buildOutputUrl: outputPath,
      localPath: flutterRoot,
    });

    emitLog(projectId, "complete", `Build artifact available at: ${outputPath}\n`);
    emitLog(projectId, "complete", "Pipeline completed successfully!\n");

  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    emitLog(projectId, "error", `Pipeline failed: ${errorMsg}\n`);
    await updateProjectStatus(projectId, "failed", { errorMessage: errorMsg });
  }
}

function findFlutterRoot(dir: string): string | null {
  if (fs.existsSync(path.join(dir, "pubspec.yaml"))) {
    return dir;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);
        if (fs.existsSync(path.join(subDir, "pubspec.yaml"))) {
          return subDir;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function getFileTree(dirPath: string, basePath: string = ""): any[] {
  const result: any[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (["build", ".dart_tool", ".idea", ".git", "node_modules", ".pub-cache", ".packages"].includes(entry.name)) {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
          children: [],
          collapsed: true,
        });
        continue;
      }

      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
          children: getFileTree(path.join(dirPath, entry.name), relativePath),
        });
      } else {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }
  } catch {
    // ignore errors
  }
  return result;
}

export function readProjectFile(projectDir: string, filePath: string): string | null {
  try {
    const fullPath = path.join(projectDir, filePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(projectDir))) {
      return null;
    }
    return fs.readFileSync(resolved, "utf-8");
  } catch {
    return null;
  }
}

export function writeProjectFile(projectDir: string, filePath: string, content: string): boolean {
  try {
    const fullPath = path.join(projectDir, filePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(projectDir))) {
      return false;
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}
