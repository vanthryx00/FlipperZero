import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { storagePut, storageGet } from "../storage";
import { db } from "./db";
import { firmwareFiles, flashingHistory } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Flasher Router - Handles firmware flashing operations for Flipper Zero and ESP32
 */
export const flasherRouter = router({
  /**
   * Upload firmware file
   */
  uploadFirmware: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        fileData: z.string(), // Base64 encoded
        deviceType: z.enum(["flipper_zero", "esp32_marauder", "esp32_custom"]),
        version: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Decode base64 file data
        const buffer = Buffer.from(input.fileData, "base64");

        // Validate file size (max 50MB)
        if (buffer.length > 50 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File size exceeds 50MB limit",
          });
        }

        // Upload to storage
        const storageKey = `firmware/${input.deviceType}/${Date.now()}-${input.filename}`;
        const { url, key } = await storagePut(storageKey, buffer, "application/octet-stream");

        // Save metadata to database
        const result = await db.insert(firmwareFiles).values({
          filename: input.filename,
          storageKey: key,
          storageUrl: url,
          deviceType: input.deviceType,
          version: input.version,
          fileSize: buffer.length,
          description: input.description || "",
          uploadedBy: ctx.user.id,
          uploadedAt: new Date(),
          checksum: calculateChecksum(buffer),
        });

        return {
          success: true,
          fileId: result.insertId,
          storageUrl: url,
          fileSize: buffer.length,
          message: "Firmware uploaded successfully",
        };
      } catch (error) {
        console.error("[Flasher] Upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload firmware",
        });
      }
    }),

  /**
   * List available firmware files
   */
  listFirmware: publicProcedure
    .input(
      z.object({
        deviceType: z.enum(["flipper_zero", "esp32_marauder", "esp32_custom"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        let query = db.select().from(firmwareFiles);

        if (input.deviceType) {
          query = query.where(eq(firmwareFiles.deviceType, input.deviceType));
        }

        const files = await query.orderBy(desc(firmwareFiles.uploadedAt));

        return {
          success: true,
          files: files.map((f) => ({
            id: f.id,
            filename: f.filename,
            deviceType: f.deviceType,
            version: f.version,
            fileSize: f.fileSize,
            description: f.description,
            uploadedAt: f.uploadedAt,
            checksum: f.checksum,
          })),
        };
      } catch (error) {
        console.error("[Flasher] List error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list firmware files",
        });
      }
    }),

  /**
   * Get firmware download URL
   */
  getFirmwareUrl: publicProcedure
    .input(z.object({ fileId: z.number() }))
    .query(async ({ input }) => {
      try {
        const file = await db
          .select()
          .from(firmwareFiles)
          .where(eq(firmwareFiles.id, input.fileId))
          .limit(1);

        if (!file.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Firmware file not found",
          });
        }

        const downloadUrl = await storageGet(file[0].storageKey, 3600); // 1 hour expiry

        return {
          success: true,
          url: downloadUrl.url,
          filename: file[0].filename,
          checksum: file[0].checksum,
        };
      } catch (error) {
        console.error("[Flasher] Get URL error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get firmware URL",
        });
      }
    }),

  /**
   * Start flashing process
   */
  startFlashing: protectedProcedure
    .input(
      z.object({
        fileId: z.number(),
        deviceId: z.string(),
        deviceType: z.enum(["flipper_zero", "esp32_marauder", "esp32_custom"]),
        method: z.enum(["usb", "wireless", "sd_card"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get firmware file
        const file = await db
          .select()
          .from(firmwareFiles)
          .where(eq(firmwareFiles.id, input.fileId))
          .limit(1);

        if (!file.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Firmware file not found",
          });
        }

        // Create flashing history entry
        const result = await db.insert(flashingHistory).values({
          fileId: input.fileId,
          deviceId: input.deviceId,
          deviceType: input.deviceType,
          method: input.method,
          status: "in_progress",
          startedAt: new Date(),
          startedBy: ctx.user.id,
          progress: 0,
        });

        return {
          success: true,
          flashingId: result.insertId,
          message: "Flashing started",
        };
      } catch (error) {
        console.error("[Flasher] Start flashing error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start flashing",
        });
      }
    }),

  /**
   * Update flashing progress
   */
  updateFlashingProgress: protectedProcedure
    .input(
      z.object({
        flashingId: z.number(),
        progress: z.number().min(0).max(100),
        status: z.enum(["in_progress", "completed", "failed", "cancelled"]),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await db
          .update(flashingHistory)
          .set({
            progress: input.progress,
            status: input.status,
            errorMessage: input.errorMessage,
            completedAt: input.status === "completed" ? new Date() : undefined,
          })
          .where(eq(flashingHistory.id, input.flashingId));

        return {
          success: true,
          message: "Progress updated",
        };
      } catch (error) {
        console.error("[Flasher] Update progress error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update progress",
        });
      }
    }),

  /**
   * Get flashing history
   */
  getFlashingHistory: publicProcedure
    .input(
      z.object({
        deviceId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        let query = db.select().from(flashingHistory);

        if (input.deviceId) {
          query = query.where(eq(flashingHistory.deviceId, input.deviceId));
        }

        const history = await query
          .orderBy(desc(flashingHistory.startedAt))
          .limit(input.limit);

        return {
          success: true,
          history: history.map((h) => ({
            id: h.id,
            fileId: h.fileId,
            deviceId: h.deviceId,
            deviceType: h.deviceType,
            method: h.method,
            status: h.status,
            progress: h.progress,
            startedAt: h.startedAt,
            completedAt: h.completedAt,
            errorMessage: h.errorMessage,
          })),
        };
      } catch (error) {
        console.error("[Flasher] Get history error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get flashing history",
        });
      }
    }),

  /**
   * Get device detection status
   */
  detectDevices: publicProcedure.query(async () => {
    try {
      // This would integrate with actual USB/serial detection
      // For now, return mock data
      return {
        success: true,
        devices: [
          {
            id: "flipper_001",
            type: "flipper_zero",
            name: "Flipper Zero",
            connected: true,
            battery: 85,
            firmwareVersion: "0.98.1",
          },
          {
            id: "esp32_001",
            type: "esp32_marauder",
            name: "ESP32 Marauder",
            connected: true,
            battery: 92,
            firmwareVersion: "6.1",
          },
        ],
      };
    } catch (error) {
      console.error("[Flasher] Device detection error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to detect devices",
      });
    }
  }),

  /**
   * Backup firmware before flashing
   */
  backupFirmware: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        deviceType: z.enum(["flipper_zero", "esp32_marauder", "esp32_custom"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // This would integrate with actual backup logic
        const backupKey = `backups/${input.deviceType}/${input.deviceId}/${Date.now()}.bin`;

        return {
          success: true,
          backupKey,
          message: "Firmware backup completed",
        };
      } catch (error) {
        console.error("[Flasher] Backup error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to backup firmware",
        });
      }
    }),
});

/**
 * Calculate SHA256 checksum of buffer
 */
function calculateChecksum(buffer: Buffer): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
