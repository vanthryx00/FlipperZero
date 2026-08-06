import { useState, useEffect, useCallback } from "react";
import { webUSBService, FlipperZeroDevice, WebUSBService } from "@/lib/webusb";

export function useWebUSB() {
  const [devices, setDevices] = useState<FlipperZeroDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check WebUSB support
    const supported = webUSBService.constructor === WebUSBService && WebUSBService.isSupported();
    setIsSupported(supported);

    // Get initially granted devices
    const initializeDevices = async () => {
      try {
        setIsLoading(true);
        const grantedDevices = await webUSBService.getGrantedDevices();
        setDevices(grantedDevices);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize devices");
      } finally {
        setIsLoading(false);
      }
    };

    if (supported) {
      initializeDevices();
      webUSBService.startMonitoring();

      // Subscribe to device changes
      const unsubscribe = webUSBService.onDevicesChanged((updatedDevices) => {
        setDevices(updatedDevices);
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  const requestDevice = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const device = await webUSBService.requestDevice();
      if (device) {
        setDevices((prev) => [...prev, device]);
        return device;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to request device";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const readFirmware = useCallback(async (deviceId: string) => {
    try {
      setError(null);
      return await webUSBService.readFirmware(deviceId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to read firmware";
      setError(errorMessage);
      throw err;
    }
  }, []);

  const writeFirmware = useCallback(
    async (deviceId: string, firmwareData: Uint8Array, onProgress?: (progress: number) => void) => {
      try {
        setError(null);
        await webUSBService.writeFirmware(deviceId, firmwareData, onProgress);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to write firmware";
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const rebootDevice = useCallback(async (deviceId: string) => {
    try {
      setError(null);
      await webUSBService.rebootDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reboot device";
      setError(errorMessage);
      throw err;
    }
  }, []);

  const closeDevice = useCallback(async (deviceId: string) => {
    try {
      setError(null);
      await webUSBService.closeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to close device";
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    devices,
    isSupported,
    isLoading,
    error,
    requestDevice,
    readFirmware,
    writeFirmware,
    rebootDevice,
    closeDevice,
  };
}
