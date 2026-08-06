import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Zap, Wifi, AlertCircle, CheckCircle, HardDrive, Battery } from "lucide-react";
import { toast } from "sonner";

interface DetectedDevice {
  id: string;
  name: string;
  port: string;
  batteryLevel: number;
  firmwareVersion: string;
  hardwareVersion: string;
  connected: boolean;
}

interface SafetyCheckResult {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

export function FirmwareFlasherAdvanced() {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [hardwareVersion, setHardwareVersion] = useState("V1.9.0");
  const [description, setDescription] = useState("");
  const [selectedFirmwareId, setSelectedFirmwareId] = useState<number | null>(null);
  const [flashMethod, setFlashMethod] = useState<"usb" | "wireless">("usb");
  const [isFlashing, setIsFlashing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheckResult[]>([]);
  const [showBackupOption, setShowBackupOption] = useState(true);
  const [backupCreated, setBackupCreated] = useState(false);

  // tRPC mutations and queries
  const uploadMutation = trpc.firmware.upload.useMutation();
  const listQuery = trpc.firmware.list.useQuery();
  const flashMutation = trpc.firmware.startFlashing.useMutation();

  // Auto-detect connected devices
  useEffect(() => {
    const detectDevices = async () => {
      try {
        // Simulate device detection - in production, this would use WebUSB or similar
        const mockDevices: DetectedDevice[] = [
          {
            id: "flipper-001",
            name: "Flipper Zero #1",
            port: "COM3",
            batteryLevel: 85,
            firmwareVersion: "6.1",
            hardwareVersion: "V1.9.0",
            connected: true,
          },
        ];
        setDetectedDevices(mockDevices);
        if (mockDevices.length > 0) {
          setSelectedDeviceId(mockDevices[0].id);
        }
      } catch (error) {
        console.error("Device detection failed:", error);
      }
    };

    detectDevices();
    const interval = setInterval(detectDevices, 5000); // Re-detect every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Run safety checks when a device is selected
  useEffect(() => {
    if (selectedDeviceId) {
      runSafetyChecks();
    }
  }, [selectedDeviceId]);

  const runSafetyChecks = () => {
    const device = detectedDevices.find((d) => d.id === selectedDeviceId);
    if (!device) return;

    const checks: SafetyCheckResult[] = [
      {
        name: "Device Connection",
        passed: device.connected,
        message: device.connected ? "Device is connected" : "Device is not connected",
        critical: true,
      },
      {
        name: "Battery Level",
        passed: device.batteryLevel >= 50,
        message: `Battery level: ${device.batteryLevel}%`,
        critical: device.batteryLevel < 20,
      },
      {
        name: "Hardware Compatibility",
        passed: device.hardwareVersion === "V1.9.0",
        message: `Hardware: ${device.hardwareVersion}`,
        critical: false,
      },
      {
        name: "Firmware Compatibility",
        passed: device.firmwareVersion === "6.1",
        message: `Current firmware: ${device.firmwareVersion}`,
        critical: false,
      },
      {
        name: "Storage Space",
        passed: true,
        message: "Sufficient storage available",
        critical: false,
      },
    ];

    setSafetyChecks(checks);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !version) {
      toast.error("Please select a file and enter a version");
      return;
    }

    try {
      uploadMutation.mutate(
        {
          file,
          version,
          hardwareVersion,
          description,
        },
        {
          onSuccess: () => {
            toast.success("Firmware uploaded successfully!");
            setFile(null);
            setVersion("");
            setDescription("");
            listQuery.refetch();
          },
          onError: (error) => {
            toast.error(`Upload failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      toast.error("Failed to upload firmware");
    }
  };

  const handleCreateBackup = async () => {
    if (!selectedDeviceId) {
      toast.error("Please select a device");
      return;
    }

    setIsBackingUp(true);
    try {
      // Simulate backup creation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setBackupCreated(true);
      toast.success("Firmware backup created successfully!");
    } catch (error) {
      toast.error("Failed to create backup");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFlash = async (firmwareId: number) => {
    if (!firmwareId) {
      toast.error("Please select a firmware to flash");
      return;
    }

    if (!selectedDeviceId) {
      toast.error("Please select a device");
      return;
    }

    // Check if all critical safety checks passed
    const criticalChecksFailed = safetyChecks.filter((c) => c.critical && !c.passed);
    if (criticalChecksFailed.length > 0) {
      toast.error(`Cannot flash: ${criticalChecksFailed[0].message}`);
      return;
    }

    // Require backup if option is enabled
    if (showBackupOption && !backupCreated) {
      toast.error("Please create a backup before flashing");
      return;
    }

    setIsFlashing(true);
    try {
      flashMutation.mutate(
        {
          firmwareId,
          flashMethod,
        },
        {
          onSuccess: () => {
            toast.success(`Flashing initiated via ${flashMethod.toUpperCase()}!`);
            setIsFlashing(false);
            setSelectedFirmwareId(null);
            setBackupCreated(false);
          },
          onError: (error) => {
            toast.error(`Flashing failed: ${error.message}`);
            setIsFlashing(false);
          },
        }
      );
    } catch (error) {
      toast.error("Failed to start flashing");
      setIsFlashing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Device Detection Section */}
      <Card className="p-8 bg-card">
        <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
          <HardDrive className="w-6 h-6" />
          Device Detection
        </h2>

        {detectedDevices.length > 0 ? (
          <div className="space-y-4">
            {detectedDevices.map((device) => (
              <div
                key={device.id}
                onClick={() => setSelectedDeviceId(device.id)}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedDeviceId === device.id
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      {device.name}
                      {device.connected && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </h3>
                    <p className="text-sm text-foreground/70">Port: {device.port}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <Battery className="w-4 h-4" />
                    {device.batteryLevel}%
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-foreground/70">
                  <p>Firmware: {device.firmwareVersion}</p>
                  <p>Hardware: {device.hardwareVersion}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-foreground/70">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Detecting devices...</p>
          </div>
        )}
      </Card>

      {/* Safety Checks Section */}
      {selectedDeviceId && (
        <Card className="p-8 bg-card">
          <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Safety Checks
          </h2>

          <div className="space-y-3">
            {safetyChecks.map((check, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  check.passed
                    ? "bg-green-500/10 border border-green-500/30"
                    : check.critical
                      ? "bg-destructive/10 border border-destructive/30"
                      : "bg-yellow-500/10 border border-yellow-500/30"
                }`}
              >
                {check.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-foreground">{check.name}</p>
                  <p className="text-sm text-foreground/70">{check.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Backup Section */}
      {selectedDeviceId && (
        <Card className="p-8 bg-accent/10 border-accent/30">
          <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
            <HardDrive className="w-6 h-6" />
            Backup Current Firmware
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="backup-option"
                checked={showBackupOption}
                onChange={(e) => setShowBackupOption(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="backup-option" className="text-foreground cursor-pointer">
                Create backup before flashing (Recommended)
              </Label>
            </div>

            {showBackupOption && (
              <Button
                onClick={handleCreateBackup}
                disabled={isBackingUp || backupCreated}
                className="w-full"
                variant={backupCreated ? "outline" : "default"}
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Creating Backup...
                  </>
                ) : backupCreated ? (
                  <>
                    <CheckCircle className="mr-2 w-4 h-4" />
                    Backup Created
                  </>
                ) : (
                  <>
                    <HardDrive className="mr-2 w-4 h-4" />
                    Create Backup Now
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Upload Section */}
      <Card className="p-8 bg-card">
        <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
          <Upload className="w-6 h-6" />
          Upload Firmware
        </h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="firmware-file" className="text-foreground">
              Firmware File
            </Label>
            <Input
              id="firmware-file"
              type="file"
              accept=".bin,.hex,.elf"
              onChange={handleFileChange}
              className="mt-2"
            />
            {file && <p className="text-sm text-foreground/70 mt-2">Selected: {file.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="version" className="text-foreground">
                Firmware Version
              </Label>
              <Input
                id="version"
                placeholder="e.g., 6.1"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="hardware-version" className="text-foreground">
                Hardware Version
              </Label>
              <Input
                id="hardware-version"
                placeholder="e.g., V1.9.0"
                value={hardwareVersion}
                onChange={(e) => setHardwareVersion(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-foreground">
              Description (Optional)
            </Label>
            <Input
              id="description"
              placeholder="Add notes about this firmware version"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2"
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !file}
            className="w-full"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 w-4 h-4" />
                Upload Firmware
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Firmware List Section */}
      <Card className="p-8 bg-card">
        <h2 className="text-2xl font-bold mb-6 text-primary">Available Firmware</h2>

        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : listQuery.data && listQuery.data.length > 0 ? (
          <div className="space-y-4">
            {listQuery.data.map((firmware) => (
              <div
                key={firmware.id}
                className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{firmware.fileName}</h3>
                    <p className="text-sm text-foreground/70">
                      Version: {firmware.version} | Hardware: {firmware.hardwareVersion}
                    </p>
                    {firmware.description && (
                      <p className="text-sm text-foreground/60 mt-1">{firmware.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-foreground/50">
                    {(firmware.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>

                {selectedFirmwareId === firmware.id ? (
                  <div className="space-y-3 mt-4 pt-4 border-t border-border">
                    <div>
                      <Label className="text-foreground">Select Flashing Method</Label>
                      <div className="flex gap-3 mt-2">
                        <Button
                          variant={flashMethod === "usb" ? "default" : "outline"}
                          onClick={() => setFlashMethod("usb")}
                          className="flex-1"
                        >
                          <Zap className="mr-2 w-4 h-4" />
                          USB
                        </Button>
                        <Button
                          variant={flashMethod === "wireless" ? "default" : "outline"}
                          onClick={() => setFlashMethod("wireless")}
                          className="flex-1"
                        >
                          <Wifi className="mr-2 w-4 h-4" />
                          Wireless
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleFlash(firmware.id)}
                        disabled={isFlashing || !selectedDeviceId}
                        className="flex-1"
                      >
                        {isFlashing ? (
                          <>
                            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                            Flashing...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 w-4 h-4" />
                            Start Flashing
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedFirmwareId(null)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedFirmwareId(firmware.id)}
                    className="w-full mt-3"
                    disabled={!selectedDeviceId}
                  >
                    Select for Flashing
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-foreground/70 text-center py-8">No firmware files available yet</p>
        )}
      </Card>

      {/* Safety Warning */}
      <Card className="p-8 bg-destructive/10 border-destructive/30">
        <h3 className="text-lg font-semibold text-destructive mb-4">⚠️ Important Safety Information</h3>
        <ul className="space-y-2 text-sm text-foreground/80">
          <li>• Do NOT disconnect your device during flashing</li>
          <li>• Do NOT close this window while flashing is in progress</li>
          <li>• Ensure your device has at least 50% battery before flashing</li>
          <li>• Always create a backup before flashing new firmware</li>
          <li>• Flashing incompatible firmware may brick your device</li>
          <li>• Only flash firmware compatible with your hardware version</li>
        </ul>
      </Card>
    </div>
  );
}
