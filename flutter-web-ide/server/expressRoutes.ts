import express, { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createProject, updateProjectStatus, getProjectById } from "./db";
import { runBuildPipeline, subscribeToLogs, getProjectDir } from "./buildPipeline";
import { spawn } from "child_process";

const UPLOAD_DIR = "/home/ubuntu/flutter-uploads";
const PROJECTS_DIR = "/home/ubuntu/flutter-projects";

// Ensure directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
});

// Default guest userId for anonymous usage
const GUEST_USER_ID = 0;

export function registerExpressRoutes(app: express.Express) {
  const apiRouter = Router();

  // Upload ZIP endpoint — no auth required
  apiRouter.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const projectName = (req.body.name as string) || req.file.originalname.replace(".zip", "");
      const buildType = (req.body.buildType as string) === "apk" ? "apk" : "web";

      // Create project in DB with guest user
      const projectId = await createProject({
        userId: GUEST_USER_ID,
        name: projectName,
        status: "uploading",
        buildType: buildType as any,
        localPath: getProjectDir(0), // placeholder
      });

      // Update with correct path
      const projectDir = getProjectDir(projectId);
      await updateProjectStatus(projectId, "uploading", { localPath: projectDir });

      res.json({
        success: true,
        projectId,
        message: "Upload received. Build pipeline starting...",
      });

      // Start build pipeline in background
      runBuildPipeline(projectId, req.file.path, buildType as "web" | "apk").catch(
        (err) => {
          console.error(`Build pipeline error for project ${projectId}:`, err);
        }
      );
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // SSE endpoint for real-time logs — no auth required
  apiRouter.get("/logs/:projectId/stream", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        res.status(400).json({ error: "Invalid project ID" });
        return;
      }

      const project = await getProjectById(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      res.write("data: " + JSON.stringify({ type: "connected", projectId }) + "\n\n");

      const unsubscribe = subscribeToLogs(projectId, (data) => {
        res.write("data: " + JSON.stringify({ type: "log", ...data }) + "\n\n");
      });

      // Send current status
      res.write(
        "data: " +
          JSON.stringify({ type: "status", status: project.status }) +
          "\n\n"
      );

      req.on("close", () => {
        unsubscribe();
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download build artifact — no auth required
  apiRouter.get("/download/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const project = await getProjectById(projectId);

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      if (project.status !== "completed") {
        res.status(400).json({ error: "Build not completed yet" });
        return;
      }

      const outputPath = project.buildOutputUrl;
      if (!outputPath) {
        res.status(404).json({ error: "Build output not found" });
        return;
      }

      if (project.buildType === "web") {
        // For web builds, create a ZIP of the build/web directory
        const zipName = `${project.name}_web_build.zip`;
        const zipPath = path.join(UPLOAD_DIR, `${projectId}_${zipName}`);

        // Create zip of web build
        await new Promise<void>((resolve, reject) => {
          const proc = spawn("zip", ["-r", zipPath, "."], { cwd: outputPath });
          proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error("Failed to create ZIP"));
          });
          proc.on("error", reject);
        });

        res.download(zipPath, zipName, (err) => {
          // Clean up temp zip
          try { fs.unlinkSync(zipPath); } catch {}
        });
      } else {
        // For APK, send the file directly
        if (fs.existsSync(outputPath)) {
          res.download(outputPath, `${project.name}.apk`);
        } else {
          res.status(404).json({ error: "APK file not found" });
        }
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use("/api/flutter", apiRouter);
}
