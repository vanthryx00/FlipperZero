import { FirmwareFlasherAdvanced } from "@/components/FirmwareFlasherAdvanced";

export default function Flasher() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-primary mb-2">Firmware Flasher</h1>
          <p className="text-lg text-foreground/70">
            Upload and flash custom firmware to your ESP32 Marauder board with automatic device detection, backup, and safety checks
          </p>
        </div>

        <FirmwareFlasherAdvanced />
      </div>
    </div>
  );
}
