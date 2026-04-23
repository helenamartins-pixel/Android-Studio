import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", [
    "uploading",
    "extracting",
    "pub_get",
    "building",
    "completed",
    "failed",
  ]).default("uploading").notNull(),
  buildType: mysqlEnum("buildType", ["web", "apk"]).default("web").notNull(),
  zipKey: varchar("zipKey", { length: 512 }),
  buildOutputKey: varchar("buildOutputKey", { length: 512 }),
  buildOutputUrl: varchar("buildOutputUrl", { length: 1024 }),
  localPath: varchar("localPath", { length: 1024 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const buildLogs = mysqlTable("build_logs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  step: mysqlEnum("step", [
    "upload",
    "extract",
    "pub_get",
    "build",
    "complete",
    "error",
  ]).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BuildLog = typeof buildLogs.$inferSelect;
export type InsertBuildLog = typeof buildLogs.$inferInsert;
