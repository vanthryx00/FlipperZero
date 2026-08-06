import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Zap, Wifi } from "lucide-react";
import { toast } from "sonner";

export function FirmwareFlasher() {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [hardwareVersion, setHardwareVersion] = useState("V1.9.0");
  const [description, setDescription] = useState("");
  const [selectedFirmwareId, setSelectedFirmwareId] = useState<number | null>(null);
  const [flashMethod, setFlashMethod] = useState<"usb" | "wireless">("usb");
  const [isFlashing, setIsFlashing] = useState(false);

  // tRPC mutations and queries
  const uploadMutation = trpc.firmware.upload.useMutation();
  const listQuery = trpc.firmware.list.useQuery();
  const flashMutation = trpc.firmware.startFlashing.useMutation();

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

  const handleFlash = async (firmwareId: number) => {
    if (!firmwareId) {
      toast.error("Please select a firmware to flash");
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
                        disabled={isFlashing}
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

      {/* Instructions */}
      <Card className="p-8 bg-accent/10 border-accent/30">
        <h3 className="text-lg font-semibold text-primary mb-4">Flashing Instructions</h3>
        <div className="space-y-3 text-foreground/80 text-sm">
          <div>
            <strong>USB Method:</strong>
            <p>Connect your Flipper Zero via USB and select USB flashing. The device will be detected automatically.</p>
          </div>
          <div>
            <strong>Wireless Method:</strong>
            <p>Ensure your Marauder board is powered on and connected to WiFi. The flashing will proceed over the network.</p>
          </div>
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive">
            ⚠️ <strong>Warning:</strong> Do not disconnect or power off your device during flashing. This may brick your device.
          </div>
        </div>
      </Card>
    </div>
  );
}
