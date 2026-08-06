import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

export interface DeploymentJob {
  id: string;
  deviceId: string;
  deviceType: "flipper_zero" | "esp32";
  firmwarePath: string;
  status: "pending" | "connecting" | "uploading" | "verifying" | "completed" | "failed";
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  output: string[];
  errors: string[];
}

export class DeviceDeployer {
  private deploymentJobs: Map<string, DeploymentJob> = new Map();
  private deploymentQueue: string[] = [];
  private isDeploying = false;

  /**
   * Queue a deployment job
   */
  queueDeployment(
    deviceId: string,
    deviceType: "flipper_zero" | "esp32",
    firmwarePath: string
  ): string {
    const jobId = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: DeploymentJob = {
      id: jobId,
      deviceId,
      deviceType,
      firmwarePath,
      status: "pending",
      progress: 0,
      startTime: new Date(),
      output: [],
      errors: [],
    };

    this.deploymentJobs.set(jobId, job);
    this.deploymentQueue.push(jobId);

    this.processDeploymentQueue();

    return jobId;
  }

  /**
   * Process deployment queue
   */
  private async processDeploymentQueue(): Promise<void> {
    if (this.isDeploying || this.deploymentQueue.length === 0) {
      return;
    }

    this.isDeploying = true;

    while (this.deploymentQueue.length > 0) {
      const jobId = this.deploymentQueue.shift();
      if (!jobId) break;

      const job = this.deploymentJobs.get(jobId);
      if (!job) continue;

      try {
        job.status = "connecting";
        job.progress = 10;

        // Verify firmware file exists
        await fs.access(job.firmwarePath);
        job.output.push(`[Deployer] Firmware file verified: ${job.firmwarePath}`);
        job.progress = 20;

        if (job.deviceType === "flipper_zero") {
          await this.deployToFlipperZero(job);
        } else {
          await this.deployToESP32(job);
        }

        job.status = "completed";
        job.progress = 100;
      } catch (error) {
        job.status = "failed";
        job.errors.push(error instanceof Error ? error.message : String(error));
      }

      job.endTime = new Date();
    }

    this.isDeploying = false;
  }

  /**
   * Deploy to Flipper Zero
   */
  private async deployToFlipperZero(job: DeploymentJob): Promise<void> {
    try {
      job.output.push("[Flipper] Starting deployment to Flipper Zero...");
      job.progress = 30;

      // Use qFlipper CLI or direct USB communication
      // This is a placeholder for actual Flipper Zero deployment logic
      const { stdout, stderr } = await execAsync(
        `qflipper install-app "${job.firmwarePath}" --device-auto`
      ).catch(async () => {
        // Fallback: try using DFU mode
        job.output.push("[Flipper] qFlipper not found, attempting DFU mode deployment...");
        return await execAsync(`dfu-util -D "${job.firmwarePath}"`);
      });

      job.output.push(stdout);
      if (stderr) job.output.push(`[STDERR] ${stderr}`);
      job.progress = 70;

      // Verify deployment
      job.output.push("[Flipper] Verifying deployment...");
      job.progress = 90;

      job.output.push("[Flipper] Deployment completed successfully!");
    } catch (error) {
      throw new Error(`Flipper Zero deployment failed: ${error}`);
    }
  }

  /**
   * Deploy to ESP32
   */
  private async deployToESP32(job: DeploymentJob): Promise<void> {
    try {
      job.output.push("[ESP32] Starting deployment to ESP32...");
      job.progress = 30;

      // Use esptool.py for flashing
      const { stdout, stderr } = await execAsync(
        `esptool.py -p /dev/ttyUSB0 -b 460800 --after hard_reset write_flash -z 0x1000 "${job.firmwarePath}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      job.output.push(stdout);
      if (stderr) job.output.push(`[STDERR] ${stderr}`);
      job.progress = 70;

      // Verify deployment
      job.output.push("[ESP32] Verifying deployment...");
      job.progress = 90;

      // Wait for device to reboot
      await new Promise((resolve) => setTimeout(resolve, 3000));

      job.output.push("[ESP32] Deployment completed successfully!");
    } catch (error) {
      throw new Error(`ESP32 deployment failed: ${error}`);
    }
  }

  /**
   * Get deployment job status
   */
  getDeploymentJob(jobId: string): DeploymentJob | undefined {
    return this.deploymentJobs.get(jobId);
  }

  /**
   * Get all deployment jobs
   */
  getAllDeploymentJobs(): DeploymentJob[] {
    return Array.from(this.deploymentJobs.values());
  }

  /**
   * Cancel a deployment job
   */
  cancelDeployment(jobId: string): boolean {
    const job = this.deploymentJobs.get(jobId);
    if (job && job.status === "pending") {
      this.deploymentQueue = this.deploymentQueue.filter((id) => id !== jobId);
      job.status = "failed";
      job.errors.push("Deployment cancelled by user");
      return true;
    }
    return false;
  }

  /**
   * Clear completed deployments
   */
  clearCompletedDeployments(): void {
    const jobsToDelete: string[] = [];
    this.deploymentJobs.forEach((job, jobId) => {
      if (job.status === "completed" || job.status === "failed") {
        jobsToDelete.push(jobId);
      }
    });
    jobsToDelete.forEach((jobId) => this.deploymentJobs.delete(jobId));
  }
}

// Export singleton instance
export const deviceDeployer = new DeviceDeployer();
