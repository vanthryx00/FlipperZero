import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Download, Upload, Zap, AlertTriangle } from "lucide-react";

export function InteractiveFlasher() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedFirmware, setSelectedFirmware] = useState<number | null>(null);
  const [flashingProgress, setFlashingProgress] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashingStatus, setFlashingStatus] = useState<"idle" | "backing_up" | "flashing" | "completed" | "failed">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: devices } = trpc.flasher.detectDevices.useQuery();
  const { data: firmwareList } = trpc.flasher.listFirmware.useQuery({
    deviceType: selectedDevice ? (selectedDevice.includes("flipper") ? "flipper_zero" : "esp32_marauder") : undefined,
  });

  // Mutations
  const uploadFirmware = trpc.flasher.uploadFirmware.useMutation();
  const startFlashing = trpc.flasher.startFlashing.useMutation();
  const updateProgress = trpc.flasher.updateFlashingProgress.useMutation();
  const backupFirmware = trpc.flasher.backupFirmware.useMutation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDevice) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileData = event.target?.result as string;
      const base64Data = fileData.split(",")[1];

      try {
        const result = await uploadFirmware.mutateAsync({
          filename: file.name,
          fileData: base64Data,
          deviceType: selectedDevice.includes("flipper") ? "flipper_zero" : "esp32_marauder",
          version: "1.0.0",
          description: `Uploaded on ${new Date().toLocaleString()}`,
        });

        setSelectedFirmware(result.fileId);
      } catch (error) {
        console.error("Upload failed:", error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartFlashing = async () => {
    if (!selectedDevice || !selectedFirmware) return;

    setIsFlashing(true);
    setFlashingStatus("backing_up");
    setFlashingProgress(0);

    try {
      // Step 1: Backup firmware
      await backupFirmware.mutateAsync({
        deviceId: selectedDevice,
        deviceType: selectedDevice.includes("flipper") ? "flipper_zero" : "esp32_marauder",
      });

      setFlashingStatus("flashing");

      // Step 2: Start flashing
      const flashResult = await startFlashing.mutateAsync({
        fileId: selectedFirmware,
        deviceId: selectedDevice,
        deviceType: selectedDevice.includes("flipper") ? "flipper_zero" : "esp32_marauder",
        method: "usb",
      });

      // Step 3: Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setFlashingProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 500));

        await updateProgress.mutateAsync({
          flashingId: flashResult.flashingId,
          progress: i,
          status: i === 100 ? "completed" : "in_progress",
        });
      }

      setFlashingStatus("completed");
    } catch (error) {
      console.error("Flashing failed:", error);
      setFlashingStatus("failed");
    } finally {
      setIsFlashing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">AutoSec Flasher</h1>
          <p className="text-slate-400">Interactive firmware flashing for Flipper Zero and ESP32 Marauder</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Selection */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Connected Devices
            </h2>

            <div className="space-y-3">
              {devices?.devices?.map((device) => (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedDevice === device.id
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{device.name}</span>
                    {device.connected && <CheckCircle className="w-4 h-4 text-green-400" />}
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div>Battery: {device.battery}%</div>
                    <div>Firmware: {device.firmwareVersion}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Firmware Selection */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              Firmware Files
            </h2>

            <div className="space-y-3">
              {firmwareList?.files?.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFirmware(file.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left text-sm ${
                    selectedFirmware === file.id
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                  }`}
                >
                  <div className="font-medium text-white truncate">{file.filename}</div>
                  <div className="text-xs text-slate-400 mt-1">v{file.version}</div>
                </button>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-3 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-400 transition-colors text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Firmware
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".bin,.hex,.elf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </Card>

          {/* Flashing Control */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Flash Control
            </h2>

            {/* Status Indicator */}
            <div className="mb-6 p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <div className="flex items-center gap-2 mb-2">
                {flashingStatus === "completed" && <CheckCircle className="w-5 h-5 text-green-400" />}
                {flashingStatus === "failed" && <AlertCircle className="w-5 h-5 text-red-400" />}
                {flashingStatus === "idle" && <AlertTriangle className="w-5 h-5 text-slate-400" />}
                {(flashingStatus === "backing_up" || flashingStatus === "flashing") && (
                  <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                )}
                <span className="text-sm font-medium text-white capitalize">{flashingStatus.replace("_", " ")}</span>
              </div>

              {isFlashing && (
                <div className="mt-3">
                  <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                      style={{ width: `${flashingProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-300 mt-2">{flashingProgress}%</div>
                </div>
              )}
            </div>

            {/* Safety Warnings */}
            <div className="mb-6 p-3 rounded-lg bg-amber-900/20 border border-amber-700/50 text-sm text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Important:</strong> Do not disconnect device during flashing. Firmware will be backed up
                  automatically.
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleStartFlashing}
              disabled={!selectedDevice || !selectedFirmware || isFlashing}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFlashing ? "Flashing..." : "Start Flashing"}
            </Button>
          </Card>
        </div>

        {/* Advanced Options */}
        <Card className="bg-slate-800 border-slate-700 p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">Advanced Options</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <h3 className="font-medium text-white mb-2">Flashing Method</h3>
              <select className="w-full bg-slate-600 text-white rounded px-3 py-2 text-sm border border-slate-500">
                <option>USB (Recommended)</option>
                <option>Wireless</option>
                <option>SD Card</option>
              </select>
            </div>

            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <h3 className="font-medium text-white mb-2">Backup Location</h3>
              <select className="w-full bg-slate-600 text-white rounded px-3 py-2 text-sm border border-slate-500">
                <option>Device Storage</option>
                <option>Cloud Storage</option>
                <option>Local Computer</option>
              </select>
            </div>

            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <h3 className="font-medium text-white mb-2">Verification</h3>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" defaultChecked className="rounded" />
                Verify after flashing
              </label>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
