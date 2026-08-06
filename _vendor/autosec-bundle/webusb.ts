/**
 * WebUSB Service for Flipper Zero Communication
 * Handles USB device detection, communication, and firmware operations
 */

// Flipper Zero USB identifiers
const FLIPPER_ZERO_VENDOR_ID = 0x0483; // STMicroelectronics
const FLIPPER_ZERO_PRODUCT_ID = 0x5740; // Flipper Zero

// USB request types
const USB_REQUEST_TYPE = {
  VENDOR: 0xC0,
  DEVICE_TO_HOST: 0x80,
};

// USB request codes
const USB_REQUEST_CODE = {
  GET_DEVICE_INFO: 0x01,
  GET_FIRMWARE_VERSION: 0x02,
  READ_FIRMWARE: 0x03,
  WRITE_FIRMWARE: 0x04,
  ERASE_FIRMWARE: 0x05,
  REBOOT: 0x06,
};

export interface FlipperZeroDevice {
  id: string;
  name: string;
  serialNumber: string;
  firmwareVersion: string;
  hardwareVersion: string;
  batteryLevel: number;
  connected: boolean;
  usbDevice: USBDevice;
}

export interface DeviceInfo {
  serialNumber: string;
  firmwareVersion: string;
  hardwareVersion: string;
  batteryLevel: number;
}

export class WebUSBService {
  private devices: Map<string, FlipperZeroDevice> = new Map();
  private listeners: ((devices: FlipperZeroDevice[]) => void)[] = [];

  /**
   * Check if WebUSB is supported by the browser
   */
  static isSupported(): boolean {
    return "usb" in navigator;
  }

  /**
   * Request user to select a Flipper Zero device
   */
  async requestDevice(): Promise<FlipperZeroDevice | null> {
    if (!WebUSBService.isSupported() || !navigator.usb) {
      throw new Error("WebUSB is not supported in this browser");
    }

    try {
      const device = await navigator.usb!.requestDevice({
        filters: [
          {
            vendorId: FLIPPER_ZERO_VENDOR_ID,
            productId: FLIPPER_ZERO_PRODUCT_ID,
          },
        ],
      });

      return await this.initializeDevice(device);
    } catch (error) {
      if ((error as DOMException).name === "NotFoundError") {
        throw new Error("No Flipper Zero device selected");
      }
      throw error;
    }
  }

  /**
   * Get all previously granted Flipper Zero devices
   */
  async getGrantedDevices(): Promise<FlipperZeroDevice[]> {
    if (!WebUSBService.isSupported() || !navigator.usb) {
      return [];
    }

    try {
      const devices = await navigator.usb!.getDevices();
      const flipperDevices: FlipperZeroDevice[] = [];

      for (const device of devices) {
        if (
          device.vendorId === FLIPPER_ZERO_VENDOR_ID &&
          device.productId === FLIPPER_ZERO_PRODUCT_ID
        ) {
          const flipperDevice = await this.initializeDevice(device);
          if (flipperDevice) {
            flipperDevices.push(flipperDevice);
          }
        }
      }

      return flipperDevices;
    } catch (error) {
      console.error("Failed to get granted devices:", error);
      return [];
    }
  }

  /**
   * Initialize and connect to a USB device
   */
  private async initializeDevice(usbDevice: USBDevice): Promise<FlipperZeroDevice | null> {
    try {
      // Open the device
      if (!usbDevice.opened) {
        await usbDevice.open();
      }

      // Get device information
      const deviceInfo = await this.getDeviceInfo(usbDevice);

      const flipperDevice: FlipperZeroDevice = {
        id: usbDevice.serialNumber || `flipper-${Date.now()}`,
        name: `Flipper Zero (${usbDevice.serialNumber || "Unknown"})`,
        serialNumber: usbDevice.serialNumber || "Unknown",
        firmwareVersion: deviceInfo.firmwareVersion,
        hardwareVersion: deviceInfo.hardwareVersion,
        batteryLevel: deviceInfo.batteryLevel,
        connected: true,
        usbDevice,
      };

      this.devices.set(flipperDevice.id, flipperDevice);
      return flipperDevice;
    } catch (error) {
      console.error("Failed to initialize device:", error);
      return null;
    }
  }

  /**
   * Get device information via USB
   */
  private async getDeviceInfo(device: USBDevice): Promise<DeviceInfo> {
    try {
      // Request device info
      const result = await device.controlTransferIn(
        {
          requestType: "vendor",
          recipient: "device",
          request: USB_REQUEST_CODE.GET_DEVICE_INFO,
          value: 0,
          index: 0,
        },
        64
      );

      if (result.status !== "ok") {
        throw new Error("Failed to get device info");
      }

      // Parse the response
      const data = new Uint8Array(result.data.buffer);
      const decoder = new TextDecoder();

      // Extract information from the response
      // Format: [firmware_version_length][firmware_version][hardware_version_length][hardware_version][battery_level]
      let offset = 0;
      const fwLen = data[offset++];
      const firmwareVersion = decoder.decode(data.slice(offset, offset + fwLen));
      offset += fwLen;

      const hwLen = data[offset++];
      const hardwareVersion = decoder.decode(data.slice(offset, offset + hwLen));
      offset += hwLen;

      const batteryLevel = data[offset];

      return {
        serialNumber: device.serialNumber || "Unknown",
        firmwareVersion,
        hardwareVersion,
        batteryLevel,
      };
    } catch (error) {
      console.error("Failed to get device info:", error);
      return {
        serialNumber: device.serialNumber || "Unknown",
        firmwareVersion: "Unknown",
        hardwareVersion: "Unknown",
        batteryLevel: 0,
      };
    }
  }

  /**
   * Read firmware from device
   */
  async readFirmware(deviceId: string): Promise<Uint8Array> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    try {
      const usbDevice = device.usbDevice;

      // Request firmware size first
      const sizeResult = await usbDevice.controlTransferIn(
        {
          requestType: "vendor",
          recipient: "device",
          request: USB_REQUEST_CODE.READ_FIRMWARE,
          value: 0,
          index: 0,
        },
        4
      );

      if (sizeResult.status !== "ok") {
        throw new Error("Failed to get firmware size");
      }

      const sizeView = new DataView(sizeResult.data.buffer);
      const firmwareSize = sizeView.getUint32(0, true);

      // Read firmware in chunks
      const firmwareData = new Uint8Array(firmwareSize);
      let offset = 0;
      const chunkSize = 4096;

      while (offset < firmwareSize) {
        const toRead = Math.min(chunkSize, firmwareSize - offset);
        const result = await usbDevice.transferIn(1, toRead);

        if (result.status !== "ok") {
          throw new Error(`Failed to read firmware chunk at offset ${offset}`);
        }

        const chunk = new Uint8Array(result.data.buffer);
        firmwareData.set(chunk, offset);
        offset += toRead;
      }

      return firmwareData;
    } catch (error) {
      console.error("Failed to read firmware:", error);
      throw error;
    }
  }

  /**
   * Write firmware to device
   */
  async writeFirmware(
    deviceId: string,
    firmwareData: Uint8Array,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    try {
      const usbDevice = device.usbDevice;

      // Erase firmware first
      await usbDevice.controlTransferOut(
        {
          requestType: "vendor",
          recipient: "device",
          request: USB_REQUEST_CODE.ERASE_FIRMWARE,
          value: 0,
          index: 0,
        },
        new Uint8Array(0)
      );

      // Write firmware in chunks
      const chunkSize = 4096;
      let offset = 0;

      while (offset < firmwareData.length) {
        const chunk = firmwareData.slice(offset, offset + chunkSize);
        const result = await usbDevice.transferOut(2, chunk);

        if (result.status !== "ok") {
          throw new Error(`Failed to write firmware chunk at offset ${offset}`);
        }

        offset += chunkSize;
        if (onProgress) {
          onProgress((offset / firmwareData.length) * 100);
        }
      }

      // Verify write
      const result = await usbDevice.controlTransferIn(
        {
          requestType: "vendor",
          recipient: "device",
          request: 0x07, // VERIFY_FIRMWARE
          value: 0,
          index: 0,
        },
        1
      );

      if (result.status !== "ok") {
        throw new Error("Firmware verification failed");
      }

      const verifyData = new Uint8Array(result.data.buffer);
      if (verifyData[0] !== 1) {
        throw new Error("Firmware write verification failed");
      }
    } catch (error) {
      console.error("Failed to write firmware:", error);
      throw error;
    }
  }

  /**
   * Reboot device
   */
  async rebootDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    try {
      const usbDevice = device.usbDevice;
      await usbDevice.controlTransferOut(
        {
          requestType: "vendor",
          recipient: "device",
          request: USB_REQUEST_CODE.REBOOT,
          value: 0,
          index: 0,
        },
        new Uint8Array(0)
      );

      // Close the device after reboot
      if (usbDevice.opened) {
        await usbDevice.close();
      }

      this.devices.delete(deviceId);
    } catch (error) {
      console.error("Failed to reboot device:", error);
      throw error;
    }
  }

  /**
   * Close device connection
   */
  async closeDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return;
    }

    try {
      if (device.usbDevice.opened) {
        await device.usbDevice.close();
      }
      this.devices.delete(deviceId);
    } catch (error) {
      console.error("Failed to close device:", error);
    }
  }

  /**
   * Get all connected devices
   */
  getDevices(): FlipperZeroDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Subscribe to device changes
   */
  onDevicesChanged(callback: (devices: FlipperZeroDevice[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Notify listeners of device changes
   */
  private notifyListeners(): void {
    const devices = Array.from(this.devices.values());
    this.listeners.forEach((listener) => listener(devices));
  }

  /**
   * Start monitoring for device connections/disconnections
   */
  startMonitoring(): void {
    if (!WebUSBService.isSupported() || !navigator.usb) {
      return;
    }

    navigator.usb!.addEventListener("connect", async (event) => {
      const device = event.device as USBDevice;
      if (
        device.vendorId === FLIPPER_ZERO_VENDOR_ID &&
        device.productId === FLIPPER_ZERO_PRODUCT_ID
      ) {
        const flipperDevice = await this.initializeDevice(device);
        if (flipperDevice) {
          this.notifyListeners();
        }
      }
    });

    navigator.usb!.addEventListener("disconnect", (event) => {
      const device = event.device as USBDevice;
      const deviceId = device.serialNumber || `flipper-${device.deviceVersionMajor}`;
      if (this.devices.has(deviceId)) {
        this.devices.delete(deviceId);
        this.notifyListeners();
      }
    });
  }
}

// Create a singleton instance
export const webUSBService = new WebUSBService();
