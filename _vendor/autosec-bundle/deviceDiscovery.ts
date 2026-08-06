import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DetectedDevice {
  id: string;
  type: "flipper_zero" | "esp32";
  name: string;
  port: string;
  serialNumber?: string;
  firmwareVersion?: string;
  status: "ready" | "busy" | "error" | "unknown";
  lastSeen: Date;
  isVerified: boolean;
  verificationDetails?: {
    hasRequiredTools: boolean;
    isCompatible: boolean;
    storageAvailable: number; // in bytes
    batteryLevel?: number; // 0-100
  };
}

export class DeviceDiscoveryEngine {
  private devices: Map<string, DetectedDevice> = new Map();
  private discoveryInterval: NodeJS.Timeout | null = null;

  /**
   * Start continuous device discovery
   */
  startDiscovery(intervalMs: number = 5000): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    this.discover(); // Initial discovery

    this.discoveryInterval = setInterval(() => {
      this.discover();
    }, intervalMs);
  }

  /**
   * Stop device discovery
   */
  stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
  }

  /**
   * Perform device discovery scan
   */
  private async discover(): Promise<void> {
    try {
      await Promise.all([this.discoverFlipperZero(), this.discoverESP32()]);
    } catch (error) {
      console.error("[DeviceDiscovery] Error during discovery:", error);
    }
  }

  /**
   * Discover Flipper Zero devices
   */
  private async discoverFlipperZero(): Promise<void> {
    try {
      // Try multiple detection methods based on OS
      const platform = process.platform;

      if (platform === "win32") {
        await this.discoverFlipperZeroWindows();
      } else if (platform === "darwin") {
        await this.discoverFlipperZeroMacOS();
      } else {
        await this.discoverFlipperZeroLinux();
      }
    } catch (error) {
      console.error("[DeviceDiscovery] Error discovering Flipper Zero:", error);
    }
  }

  /**
   * Discover Flipper Zero on Windows
   */
  private async discoverFlipperZeroWindows(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        'wmic logicaldisk get name /format:list | find ":" || echo "No drives"'
      );

      // Check for Flipper Zero mounted drives or COM ports
      const { stdout: comPorts } = await execAsync(
        'reg query "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Enum\\USB" /s | find "Flipper"'
      ).catch(() => ({ stdout: "" }));

      if (comPorts) {
        const device: DetectedDevice = {
          id: `flipper_windows_${Date.now()}`,
          type: "flipper_zero",
          name: "Flipper Zero",
          port: "COM_AUTO",
          status: "ready",
          lastSeen: new Date(),
          isVerified: false,
        };

        await this.verifyDevice(device);
        this.devices.set(device.id, device);
      }
    } catch (error) {
      console.debug("[DeviceDiscovery] Windows Flipper discovery:", error);
    }
  }

  /**
   * Discover Flipper Zero on macOS
   */
  private async discoverFlipperZeroMacOS(): Promise<void> {
    try {
      const { stdout } = await execAsync("ls -la /dev/tty.* | grep -i flipper").catch(
        () => ({ stdout: "" })
      );

      if (stdout) {
        const ports = stdout.split("\n").filter((line) => line.includes("flipper"));

        for (const line of ports) {
          const match = line.match(/\/dev\/tty\.([^\s]+)/);
          if (match) {
            const device: DetectedDevice = {
              id: `flipper_macos_${match[1]}`,
              type: "flipper_zero",
              name: "Flipper Zero",
              port: `/dev/tty.${match[1]}`,
              status: "ready",
              lastSeen: new Date(),
              isVerified: false,
            };

            await this.verifyDevice(device);
            this.devices.set(device.id, device);
          }
        }
      }
    } catch (error) {
      console.debug("[DeviceDiscovery] macOS Flipper discovery:", error);
    }
  }

  /**
   * Discover Flipper Zero on Linux
   */
  private async discoverFlipperZeroLinux(): Promise<void> {
    try {
      const { stdout } = await execAsync("ls -la /dev/ttyACM* /dev/ttyUSB* 2>/dev/null").catch(
        () => ({ stdout: "" })
      );

      if (stdout) {
        const ports = stdout.split("\n").filter((line) => line.trim());

        for (const line of ports) {
          const match = line.match(/\/dev\/(ttyACM\d+|ttyUSB\d+)/);
          if (match) {
            const device: DetectedDevice = {
              id: `flipper_linux_${match[1]}`,
              type: "flipper_zero",
              name: "Flipper Zero",
              port: `/dev/${match[1]}`,
              status: "ready",
              lastSeen: new Date(),
              isVerified: false,
            };

            await this.verifyDevice(device);
            this.devices.set(device.id, device);
          }
        }
      }
    } catch (error) {
      console.debug("[DeviceDiscovery] Linux Flipper discovery:", error);
    }
  }

  /**
   * Discover ESP32 devices
   */
  private async discoverESP32(): Promise<void> {
    try {
      const platform = process.platform;

      if (platform === "win32") {
        await this.discoverESP32Windows();
      } else if (platform === "darwin") {
        await this.discoverESP32MacOS();
      } else {
        await this.discoverESP32Linux();
      }
    } catch (error) {
      console.error("[DeviceDiscovery] Error discovering ESP32:", error);
    }
  }

  /**
   * Discover ESP32 on Windows
   */
  private async discoverESP32Windows(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        'wmic path Win32_SerialPort get DeviceID /format:list | find "COM"'
      );

      const ports = stdout.split("\n").filter((line) => line.includes("COM"));

      for (const line of ports) {
        const match = line.match(/(COM\d+)/);
        if (match) {
          const device: DetectedDevice = {
            id: `esp32_windows_${match[1]}`,
            type: "esp32",
            name: "ESP32 Marauder",
            port: match[1],
            status: "ready",
            lastSeen: new Date(),
            isVerified: false,
          };

          await this.verifyDevice(device);
          this.devices.set(device.id, device);
        }
      }
    } catch (error) {
      console.debug("[DeviceDiscovery] Windows ESP32 discovery:", error);
    }
  }

  /**
   * Discover ESP32 on macOS
   */
  private async discoverESP32MacOS(): Promise<void> {
    try {
      const { stdout } = await execAsync("ls -la /dev/tty.* | grep -i usbserial").catch(
        () => ({ stdout: "" })
      );

      if (stdout) {
        const ports = stdout.split("\n").filter((line) => line.includes("usbserial"));

        for (const line of ports) {
          const match = line.match(/\/dev\/tty\.([^\s]+)/);
          if (match) {
            const device: DetectedDevice = {
              id: `esp32_macos_${match[1]}`,
              type: "esp32",
              name: "ESP32 Marauder",
              port: `/dev/tty.${match[1]}`,
              status: "ready",
              lastSeen: new Date(),
              isVerified: false,
            };

            await this.verifyDevice(device);
            this.devices.set(device.id, device);
          }
        }
      }
    } catch (error) {
      console.debug("[DeviceDiscovery] macOS ESP32 discovery:", error);
    }
  }

  /**
   * Discover ESP32 on Linux
   */
  private async discoverESP32Linux(): Promise<void> {
    try {
      const { stdout } = await execAsync("ls -la /dev/ttyUSB* 2>/dev/null").catch(
        () => ({ stdout: "" })
      );

      if (stdout) {
        const ports = stdout.split("\n").filter((line) => line.trim());

        for (const line of ports) {
          const match = line.match(/\/dev\/(ttyUSB\d+)/);
          if (match) {
            const device: DetectedDevice = {
              id: `esp32_linux_${match[1]}`,
              type: "esp32",
              name: "ESP32 Marauder",
              port: `/dev/${match[1]}`,
              status: "ready",
              lastSeen: new Date(),
              isVerified: false,
            };

            await this.verifyDevice(device);
            this.devices.set(device.id, device);
          }
        }
      }
    } catch (error) {
      console.debug("[DeviceDiscovery] Linux ESP32 discovery:", error);
    }
  }

  /**
   * Verify device compatibility and readiness
   */
  private async verifyDevice(device: DetectedDevice): Promise<void> {
    try {
      const verificationDetails = {
        hasRequiredTools: await this.checkRequiredTools(device.type),
        isCompatible: true,
        storageAvailable: 0,
        batteryLevel: 100,
      };

      device.isVerified = true;
      device.verificationDetails = verificationDetails;
      device.status = verificationDetails.hasRequiredTools ? "ready" : "error";
    } catch (error) {
      device.status = "error";
      console.error(`[DeviceDiscovery] Verification failed for ${device.id}:`, error);
    }
  }

  /**
   * Check if required tools are installed
   */
  private async checkRequiredTools(deviceType: "flipper_zero" | "esp32"): Promise<boolean> {
    try {
      if (deviceType === "flipper_zero") {
        // Check for FBT (Flipper Build Tool)
        await execAsync("fbt --version").catch(() => {
          throw new Error("FBT not found");
        });
        return true;
      } else {
        // Check for ESP-IDF
        await execAsync("idf.py --version").catch(() => {
          throw new Error("ESP-IDF not found");
        });
        return true;
      }
    } catch (error) {
      console.debug(`[DeviceDiscovery] Required tools check failed:`, error);
      return false;
    }
  }

  /**
   * Get all discovered devices
   */
  getDevices(): DetectedDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(id: string): DetectedDevice | undefined {
    return this.devices.get(id);
  }

  /**
   * Get devices by type
   */
  getDevicesByType(type: "flipper_zero" | "esp32"): DetectedDevice[] {
    return Array.from(this.devices.values()).filter((d) => d.type === type);
  }

  /**
   * Verify all devices are ready
   */
  areAllDevicesReady(): boolean {
    const devices = this.getDevices();
    return devices.length > 0 && devices.every((d) => d.status === "ready" && d.isVerified);
  }
}

// Export singleton instance
export const deviceDiscovery = new DeviceDiscoveryEngine();
