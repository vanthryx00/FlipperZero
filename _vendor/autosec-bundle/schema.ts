import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

// Firmware files table
export const firmwareFiles = mysqlTable("firmware_files", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull().unique(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: int("fileSize").notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  hardwareVersion: varchar("hardwareVersion", { length: 64 }).notNull(),
  description: text("description"),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FirmwareFile = typeof firmwareFiles.$inferSelect;
export type InsertFirmwareFile = typeof firmwareFiles.$inferInsert;

// Flashing history table
export const flashingHistory = mysqlTable("flashing_history", {
  id: int("id").autoincrement().primaryKey(),
  firmwareId: int("firmwareId").notNull(),
  userId: int("userId").notNull(),
  flashMethod: mysqlEnum("flashMethod", ["usb", "wireless"]).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "success", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  deviceInfo: text("deviceInfo"),
  flashedAt: timestamp("flashedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FlashingHistory = typeof flashingHistory.$inferSelect;
export type InsertFlashingHistory = typeof flashingHistory.$inferInsert;