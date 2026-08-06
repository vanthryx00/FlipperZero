import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { deviceDiscovery } from "../deployment/deviceDiscovery";
import { buildOrchestrator } from "../deployment/buildOrchestrator";
import { deviceDeployer } from "../deployment/deviceDeployer";

export const deploymentRouter = router({
  /**
   * Start device discovery
   */
  startDiscovery: protectedProcedure.mutation(() => {
    deviceDiscovery.startDiscovery(5000);
    return { success: true, message: "Device discovery started" };
  }),

  /**
   * Stop device discovery
   */
  stopDiscovery: protectedProcedure.mutation(() => {
    deviceDiscovery.stopDiscovery();
    return { success: true, message: "Device discovery stopped" };
  }),

  /**
   * Get discovered devices
   */
  getDevices: protectedProcedure.query(() => {
    return deviceDiscovery.getDevices();
  }),

  /**
   * Get devices by type
   */
  getDevicesByType: protectedProcedure
    .input(z.object({ type: z.enum(["flipper_zero", "esp32"]) }))
    .query(({ input }) => {
      return deviceDiscovery.getDevicesByType(input.type);
    }),

  /**
   * Check if all devices are ready
   */
  areDevicesReady: protectedProcedure.query(() => {
    return {
      ready: deviceDiscovery.areAllDevicesReady(),
      devices: deviceDiscovery.getDevices(),
    };
  }),

  /**
   * Queue a build job
   */
  queueBuild: protectedProcedure
    .input(z.object({ deviceType: z.enum(["flipper_zero", "esp32"]) }))
    .mutation(({ input }) => {
      const jobId = buildOrchestrator.queueBuild(input.deviceType);
      return { success: true, jobId };
    }),

  /**
   * Get build job status
   */
  getBuildJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      return buildOrchestrator.getBuildJob(input.jobId);
    }),

  /**
   * Get all build jobs
   */
  getAllBuildJobs: protectedProcedure.query(() => {
    return buildOrchestrator.getAllBuildJobs();
  }),

  /**
   * Cancel a build job
   */
  cancelBuild: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(({ input }) => {
      const cancelled = buildOrchestrator.cancelBuild(input.jobId);
      return { success: cancelled };
    }),

  /**
   * Queue a deployment job
   */
  queueDeployment: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        deviceType: z.enum(["flipper_zero", "esp32"]),
        firmwarePath: z.string(),
      })
    )
    .mutation(({ input }) => {
      const jobId = deviceDeployer.queueDeployment(
        input.deviceId,
        input.deviceType,
        input.firmwarePath
      );
      return { success: true, jobId };
    }),

  /**
   * Get deployment job status
   */
  getDeploymentJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      return deviceDeployer.getDeploymentJob(input.jobId);
    }),

  /**
   * Get all deployment jobs
   */
  getAllDeploymentJobs: protectedProcedure.query(() => {
    return deviceDeployer.getAllDeploymentJobs();
  }),

  /**
   * Cancel a deployment job
   */
  cancelDeployment: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(({ input }) => {
      const cancelled = deviceDeployer.cancelDeployment(input.jobId);
      return { success: cancelled };
    }),

  /**
   * Automated end-to-end deployment
   * Discovers devices, builds firmware, and deploys to all devices
   */
  automatedDeploy: protectedProcedure
    .input(z.object({ buildType: z.enum(["flipper_zero", "esp32", "both"]) }))
    .mutation(async ({ input }) => {
      const results = {
        deviceDiscovery: { success: false, devices: [] as any[] },
        build: { success: false, jobIds: [] as string[] },
        deployment: { success: false, jobIds: [] as string[] },
      };

      try {
        // Start discovery
        deviceDiscovery.startDiscovery(2000);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const devices = deviceDiscovery.getDevices();
        results.deviceDiscovery = { success: true, devices };

        if (devices.length === 0) {
          throw new Error("No devices discovered");
        }

        // Queue builds
        const buildJobIds: string[] = [];
        if (input.buildType === "flipper_zero" || input.buildType === "both") {
          buildJobIds.push(buildOrchestrator.queueBuild("flipper_zero"));
        }
        if (input.buildType === "esp32" || input.buildType === "both") {
          buildJobIds.push(buildOrchestrator.queueBuild("esp32"));
        }

        results.build = { success: true, jobIds: buildJobIds };

        // Wait for builds to complete
        await new Promise((resolve) => setTimeout(resolve, 30000));

        // Queue deployments
        const deploymentJobIds: string[] = [];
        for (const device of devices) {
          if (device.isVerified && device.status === "ready") {
            const buildJob = buildOrchestrator.getAllBuildJobs().find(
              (j) => j.deviceType === device.type && j.status === "completed"
            );

            if (buildJob?.artifactPath) {
              deploymentJobIds.push(
                deviceDeployer.queueDeployment(device.id, device.type, buildJob.artifactPath)
              );
            }
          }
        }

        results.deployment = { success: true, jobIds: deploymentJobIds };

        return results;
      } catch (error) {
        return {
          ...results,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
});
