import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { uploadFirmwareFile, getFirmwareFiles, recordFlashingAttempt } from "../db";
import { storagePut } from "../storage";

export const firmwareRouter = router({
  // Upload a new firmware file
  upload: protectedProcedure
    .input(
      z.object({
        file: z.instanceof(File),
        version: z.string().min(1),
        hardwareVersion: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Convert file to buffer
        const buffer = await input.file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // Upload to storage
        const fileKey = `firmware/${ctx.user.id}/${Date.now()}-${input.file.name}`;
        const { url } = await storagePut(fileKey, uint8Array, input.file.type);

        // Record in database
        await uploadFirmwareFile({
          fileName: input.file.name,
          fileKey,
          fileUrl: url,
          fileSize: input.file.size,
          version: input.version,
          hardwareVersion: input.hardwareVersion,
          description: input.description,
          uploadedBy: ctx.user.id,
        });

        return {
          success: true,
          message: "Firmware uploaded successfully",
          fileKey,
          url,
        };
      } catch (error) {
        console.error("[Firmware] Upload failed:", error);
        throw new Error("Failed to upload firmware file");
      }
    }),

  // List all available firmware files
  list: protectedProcedure.query(async () => {
    try {
      const files = await getFirmwareFiles();
      return files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        version: file.version,
        hardwareVersion: file.hardwareVersion,
        description: file.description,
        fileSize: file.fileSize,
        uploadedAt: file.uploadedAt,
        uploadedBy: file.uploadedBy,
      }));
    } catch (error) {
      console.error("[Firmware] List failed:", error);
      throw new Error("Failed to list firmware files");
    }
  }),

  // Start a flashing operation
  startFlashing: protectedProcedure
    .input(
      z.object({
        firmwareId: z.number(),
        flashMethod: z.enum(["usb", "wireless"]),
        deviceInfo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Record the flashing attempt
        await recordFlashingAttempt({
          firmwareId: input.firmwareId,
          userId: ctx.user.id,
          flashMethod: input.flashMethod,
          deviceInfo: input.deviceInfo,
          status: "pending",
        });

        return {
          success: true,
          message: `Flashing initiated via ${input.flashMethod}`,
        };
      } catch (error) {
        console.error("[Firmware] Flashing failed:", error);
        throw new Error("Failed to start flashing operation");
      }
    }),

  // Get flashing history for the current user
  getFlashingHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      // This would require a database query to get history
      // For now, return a placeholder
      return {
        history: [],
        message: "Flashing history retrieved",
      };
    } catch (error) {
      console.error("[Firmware] History retrieval failed:", error);
      throw new Error("Failed to retrieve flashing history");
    }
  }),
});
