import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers from original repo schema
vi.mock("./db", () => ({
  getAllProjects: vi.fn().mockResolvedValue([
    {
      id: 1, userId: 1, name: "My Flutter App",
      status: "completed", buildType: "web",
      zipKey: "1/app.zip", buildOutputKey: "1/build.zip",
      buildOutputUrl: "https://example.com/build.zip",
      localPath: "/tmp/projects/1",
      errorMessage: null,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getProjectById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1, userId: 1, name: "My Flutter App",
        status: "completed", buildType: "web",
        zipKey: "1/app.zip", buildOutputKey: "1/build.zip",
        buildOutputUrl: "https://example.com/build.zip",
        localPath: "/tmp/projects/1",
        errorMessage: null,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
  createProject: vi.fn().mockResolvedValue({
    id: 2, userId: 1, name: "New App", status: "uploading",
    buildType: "apk", zipKey: null, buildOutputKey: null,
    buildOutputUrl: null, localPath: null, errorMessage: null,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  updateProjectStatus: vi.fn().mockResolvedValue(undefined),
  getBuildLogs: vi.fn().mockResolvedValue([
    { id: 1, projectId: 1, step: "build", message: "Building...", createdAt: new Date() },
  ]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock buildPipeline
vi.mock("./buildPipeline", () => ({
  runBuildPipeline: vi.fn().mockResolvedValue(undefined),
  getFileTree: vi.fn().mockReturnValue([
    { name: "lib", path: "lib", type: "directory", children: [
      { name: "main.dart", path: "lib/main.dart", type: "file" }
    ]},
    { name: "pubspec.yaml", path: "pubspec.yaml", type: "file" },
  ]),
  readProjectFile: vi.fn().mockReturnValue("import 'package:flutter/material.dart';"),
  writeProjectFile: vi.fn().mockReturnValue(true),
  getProjectDir: vi.fn().mockReturnValue("/tmp/projects/1"),
}));

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("project router", () => {
  it("lists all projects", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe("My Flutter App");
  });

  it("gets a project by id", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.get({ id: 1 });
    expect(result?.id).toBe(1);
    expect(result?.status).toBe("completed");
  });

  it("returns null for non-existent project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.get({ id: 999 });
    expect(result).toBeNull();
  });

  it("gets build logs for a project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.getLogs({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].step).toBe("build");
  });

  it("returns empty logs for non-existent project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.getLogs({ projectId: 999 });
    expect(result).toEqual([]);
  });

  it("gets file tree for a project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.getFiles({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("reads a file from a project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.readFile({ projectId: 1, filePath: "lib/main.dart" });
    expect(typeof result).toBe("string");
    expect(result).toContain("flutter");
  });

  it("saves a file to a project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.saveFile({
      projectId: 1,
      filePath: "lib/main.dart",
      content: "void main() {}",
    });
    expect(result.success).toBe(true);
  });

  it("deletes a project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("returns false when deleting non-existent project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.delete({ id: 999 });
    expect(result.success).toBe(false);
  });

  it("triggers rebuild for a project", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.project.rebuild({ projectId: 1, buildType: "web" });
    expect(result.success).toBe(true);
  });
});

describe("auth router", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("clears cookie on logout", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
