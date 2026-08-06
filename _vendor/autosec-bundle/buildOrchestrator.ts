import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

export interface BuildJob {
  id: string;
  deviceType: "flipper_zero" | "esp32";
  status: "pending" | "building" | "completed" | "failed";
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  output: string[];
  errors: string[];
  artifactPath?: string;
}

export class BuildOrchestrator {
  private buildJobs: Map<string, BuildJob> = new Map();
  private buildQueue: string[] = [];
  private isBuilding = false;

  /**
   * Queue a build job
   */
  queueBuild(deviceType: "flipper_zero" | "esp32"): string {
    const jobId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: BuildJob = {
      id: jobId,
      deviceType,
      status: "pending",
      progress: 0,
      startTime: new Date(),
      output: [],
      errors: [],
    };

    this.buildJobs.set(jobId, job);
    this.buildQueue.push(jobId);

    this.processBuildQueue();

    return jobId;
  }

  /**
   * Process build queue
   */
  private async processBuildQueue(): Promise<void> {
    if (this.isBuilding || this.buildQueue.length === 0) {
      return;
    }

    this.isBuilding = true;

    while (this.buildQueue.length > 0) {
      const jobId = this.buildQueue.shift();
      if (!jobId) break;

      const job = this.buildJobs.get(jobId);
      if (!job) continue;

      try {
        job.status = "building";
        job.progress = 10;

        if (job.deviceType === "flipper_zero") {
          await this.buildFlipperZeroFAP(job);
        } else {
          await this.buildESP32Firmware(job);
        }

        job.status = "completed";
        job.progress = 100;
      } catch (error) {
        job.status = "failed";
        job.errors.push(error instanceof Error ? error.message : String(error));
      }

      job.endTime = new Date();
    }

    this.isBuilding = false;
  }

  /**
   * Build Flipper Zero FAP
   */
  private async buildFlipperZeroFAP(job: BuildJob): Promise<void> {
    try {
      job.output.push("[FBT] Starting Flipper Zero FAP build...");
      job.progress = 20;

      // Check if FBT is available
      const { stdout: fbtVersion } = await execAsync("fbt --version");
      job.output.push(`[FBT] Version: ${fbtVersion.trim()}`);
      job.progress = 30;

      // Build the AutoSec Tool FAP
      const { stdout, stderr } = await execAsync(
        "cd /home/ubuntu/autosec_tool && fbt fap_autosec_tool",
        { maxBuffer: 10 * 1024 * 1024 }
      );

      job.output.push(stdout);
      if (stderr) job.output.push(`[STDERR] ${stderr}`);
      job.progress = 70;

      // Locate the built FAP file
      const fapPath = await this.findFAPFile();
      if (fapPath) {
        job.artifactPath = fapPath;
        job.output.push(`[FBT] FAP built successfully: ${fapPath}`);
      } else {
        throw new Error("FAP file not found after build");
      }

      job.progress = 100;
    } catch (error) {
      throw new Error(`Flipper Zero FAP build failed: ${error}`);
    }
  }

  /**
   * Build ESP32 Firmware
   */
  private async buildESP32Firmware(job: BuildJob): Promise<void> {
    try {
      job.output.push("[ESP-IDF] Starting ESP32 firmware build...");
      job.progress = 20;

      // Check if ESP-IDF is available
      const { stdout: idfVersion } = await execAsync("idf.py --version");
      job.output.push(`[ESP-IDF] Version: ${idfVersion.trim()}`);
      job.progress = 30;

      // Set up ESP-IDF environment
      job.output.push("[ESP-IDF] Setting up environment...");

      // Build the ESP32 Marauder firmware
      const { stdout, stderr } = await execAsync(
        "cd /home/ubuntu/autosec_tool && idf.py build",
        { maxBuffer: 10 * 1024 * 1024 }
      );

      job.output.push(stdout);
      if (stderr) job.output.push(`[STDERR] ${stderr}`);
      job.progress = 70;

      // Locate the built binary
      const binPath = await this.findESP32Binary();
      if (binPath) {
        job.artifactPath = binPath;
        job.output.push(`[ESP-IDF] Firmware built successfully: ${binPath}`);
      } else {
        throw new Error("ESP32 binary not found after build");
      }

      job.progress = 100;
    } catch (error) {
      throw new Error(`ESP32 firmware build failed: ${error}`);
    }
  }

  /**
   * Find built FAP file
   */
  private async findFAPFile(): Promise<string | null> {
    try {
      const buildDir = "/home/ubuntu/autosec_tool/build";
      const files = await fs.readdir(buildDir, { recursive: true });

      const fapFile = files.find((f) => String(f).endsWith(".fap"));
      return fapFile ? path.join(buildDir, String(fapFile)) : null;
    } catch (error) {
      console.error("[BuildOrchestrator] Error finding FAP file:", error);
      return null;
    }
  }

  /**
   * Find built ESP32 binary
   */
  private async findESP32Binary(): Promise<string | null> {
    try {
      const buildDir = "/home/ubuntu/autosec_tool/build";
      const files = await fs.readdir(buildDir, { recursive: true });

      const binFile = files.find((f) => String(f).endsWith(".bin"));
      return binFile ? path.join(buildDir, String(binFile)) : null;
    } catch (error) {
      console.error("[BuildOrchestrator] Error finding ESP32 binary:", error);
      return null;
    }
  }

  /**
   * Get build job status
   */
  getBuildJob(jobId: string): BuildJob | undefined {
    return this.buildJobs.get(jobId);
  }

  /**
   * Get all build jobs
   */
  getAllBuildJobs(): BuildJob[] {
    return Array.from(this.buildJobs.values());
  }

  /**
   * Cancel a build job
   */
  cancelBuild(jobId: string): boolean {
    const job = this.buildJobs.get(jobId);
    if (job && job.status === "pending") {
      this.buildQueue = this.buildQueue.filter((id) => id !== jobId);
      job.status = "failed";
      job.errors.push("Build cancelled by user");
      return true;
    }
    return false;
  }

  /**
   * Clear completed builds
   */
  clearCompletedBuilds(): void {
    const jobsToDelete: string[] = [];
    this.buildJobs.forEach((job, jobId) => {
      if (job.status === "completed" || job.status === "failed") {
        jobsToDelete.push(jobId);
      }
    });
    jobsToDelete.forEach((jobId) => this.buildJobs.delete(jobId));
  }
}

// Export singleton instance
export const buildOrchestrator = new BuildOrchestrator();
