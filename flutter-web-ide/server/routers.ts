import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createProject,
  getProjectById,
  getAllProjects,
  updateProjectStatus,
  deleteProject,
  getBuildLogs,
} from "./db";
import {
  runBuildPipeline,
  getFileTree,
  readProjectFile,
  writeProjectFile,
  getProjectDir,
} from "./buildPipeline";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  project: router({
    list: publicProcedure.query(async () => {
      return getAllProjects();
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const project = await getProjectById(input.id);
        if (!project) return null;
        return project;
      }),

    getLogs: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) return [];
        return getBuildLogs(input.projectId);
      }),

    getFiles: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) return [];
        const projectDir = project.localPath || getProjectDir(input.projectId);
        return getFileTree(projectDir);
      }),

    readFile: publicProcedure
      .input(z.object({ projectId: z.number(), filePath: z.string() }))
      .query(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) return null;
        const projectDir = project.localPath || getProjectDir(input.projectId);
        return readProjectFile(projectDir, input.filePath);
      }),

    saveFile: publicProcedure
      .input(z.object({ projectId: z.number(), filePath: z.string(), content: z.string() }))
      .mutation(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) return { success: false };
        const projectDir = project.localPath || getProjectDir(input.projectId);
        const ok = writeProjectFile(projectDir, input.filePath, input.content);
        return { success: ok };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const project = await getProjectById(input.id);
        if (!project) return { success: false };
        await deleteProject(input.id);
        return { success: true };
      }),

    rebuild: publicProcedure
      .input(z.object({ projectId: z.number(), buildType: z.enum(["web", "apk"]) }))
      .mutation(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) return { success: false };
        if (!project.localPath) return { success: false };
        await updateProjectStatus(input.projectId, "building");
        runBuildPipeline(input.projectId, "", input.buildType).catch(() => {});
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
