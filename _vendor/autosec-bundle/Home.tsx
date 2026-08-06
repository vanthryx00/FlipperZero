import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, Shield, Wifi, Bluetooth, MapPin, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "setup", label: "Setup", icon: CheckCircle },
    { id: "features", label: "Features", icon: Wifi },
    { id: "usage", label: "Usage", icon: MapPin },
    { id: "ethics", label: "Ethics & Legal", icon: AlertCircle },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Sidebar */}
      <nav className="fixed left-0 top-0 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-6 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-sidebar-accent">Marauder</h1>
          <p className="text-sm text-sidebar-foreground/70">V6.1 Expansion Board</p>
          <p className="text-xs text-sidebar-foreground/60 mt-1">by justcallmekoko</p>
        </div>

        <div className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeSection === section.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{section.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-12 p-4 bg-sidebar-accent/10 rounded-lg border border-sidebar-accent/20">
          <p className="text-xs text-sidebar-foreground/80">
            <strong>Version Info:</strong> Hardware V1.9.0, Marauder V6.1, ESP-IDF V4.4.5
          </p>
        </div>

        <div className="mt-4 p-4 bg-sidebar-accent/10 rounded-lg border border-sidebar-accent/20">
          <p className="text-xs text-sidebar-foreground/80">
            <strong>⚠️ Legal Notice:</strong> This guide is for authorized security research only. Unauthorized access is illegal.
          </p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {/* Hero Section */}
        {activeSection === "overview" && (
          <section className="relative h-screen flex items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663650160982/WANFAasLN3Mtm9iwwPZ6vS/hero-background-LNKrCW45udCHQSE7Zxrvup.webp')`,
                opacity: 0.3,
              }}
            />
            <div className="relative z-10 max-w-4xl mx-auto px-8 text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 text-primary">
                ESP32 Marauder V6.1
              </h1>
              <p className="text-xl md:text-2xl text-foreground/80 mb-4">
                Flipper Zero WiFi, Bluetooth & GPS Expansion Board
              </p>
              <p className="text-lg text-foreground/70 mb-8">
                Created by <strong>justcallmekoko</strong>
              </p>
              <Button
                size="lg"
                onClick={() => setActiveSection("setup")}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Get Started <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </section>
        )}

        {/* Setup Section */}
        {activeSection === "setup" && (
          <section className="py-16 px-8 max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-primary">Quick Setup</h2>

            {/* Quick Start */}
            <Card className="mb-12 p-8 bg-accent/10 border-accent/30">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-primary mb-2">Plug & Play</h3>
                  <p className="text-foreground/80">
                    Your ESP32 Marauder V6.1 expansion board is ready to use. Simply align the 18-pin header with your Flipper Zero's GPIO pins and gently press down until it clicks into place. No additional configuration needed!
                  </p>
                </div>
              </div>
            </Card>

            {/* Installation Steps */}
            <Card className="p-8 bg-card">
              <h3 className="text-2xl font-semibold mb-6 text-primary">Installation Steps</h3>
              <div className="space-y-6">
                {[
                  {
                    step: "1",
                    title: "Power Off Your Flipper Zero",
                    desc: "Ensure your Flipper Zero is completely powered off before attaching the expansion board.",
                  },
                  {
                    step: "2",
                    title: "Align the Board",
                    desc: "Position the Marauder board so the 18-pin header aligns with the GPIO pins on your Flipper Zero. The board should sit flush on top.",
                  },
                  {
                    step: "3",
                    title: "Press Down Firmly",
                    desc: "Gently but firmly press the board down until you hear or feel a click. The board should be securely seated.",
                  },
                  {
                    step: "4",
                    title: "Power On",
                    desc: "Turn your Flipper Zero back on. The Marauder board will automatically initialize and you'll see the interface on the Flipper's screen.",
                  },
                  {
                    step: "5",
                    title: "Access the Apps",
                    desc: "Navigate to Applications > GPIO or Apps > Marauder to access WiFi, Bluetooth, and GPS features.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">{item.title}</h4>
                      <p className="text-foreground/80">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* Features Section */}
        {activeSection === "features" && (
          <section className="py-16 px-8 max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-primary">Key Features</h2>

            {/* WiFi Capabilities */}
            <Card className="mb-8 p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <Wifi className="w-8 h-8 text-accent" />
                <h3 className="text-2xl font-semibold text-primary">WiFi Capabilities</h3>
              </div>
              <div className="space-y-4">
                <p className="text-foreground/80">
                  The Marauder V6.1 provides comprehensive WiFi security testing capabilities for authorized research:
                </p>
                <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-2">
                  <li><strong>Network Scanning:</strong> Identify all WiFi networks in range with signal strength and encryption details</li>
                  <li><strong>Packet Capture:</strong> Sniff and log WiFi packets for offline analysis</li>
                  <li><strong>Deauthentication Testing:</strong> Test network resilience against deauth attacks (authorized only)</li>
                  <li><strong>PMKID Capture:</strong> Capture PMKID hashes for WPA2 security analysis</li>
                  <li><strong>Beacon Sniffing:</strong> Monitor WiFi beacon frames to identify network vulnerabilities</li>
                </ul>
              </div>
            </Card>

            {/* Bluetooth Capabilities */}
            <Card className="mb-8 p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <Bluetooth className="w-8 h-8 text-accent" />
                <h3 className="text-2xl font-semibold text-primary">Bluetooth Capabilities</h3>
              </div>
              <div className="space-y-4">
                <p className="text-foreground/80">
                  Comprehensive Bluetooth Low Energy (BLE) and classic Bluetooth security research tools:
                </p>
                <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-2">
                  <li><strong>BLE Device Discovery:</strong> Scan for nearby Bluetooth Low Energy devices</li>
                  <li><strong>Advertisement Sniffing:</strong> Capture and analyze BLE advertisements</li>
                  <li><strong>Packet Analysis:</strong> Examine Bluetooth packet structure and content</li>
                  <li><strong>Device Fingerprinting:</strong> Identify device types and manufacturers</li>
                  <li><strong>Connection Testing:</strong> Evaluate Bluetooth pairing and authentication mechanisms</li>
                </ul>
              </div>
            </Card>

            {/* GPS Capabilities */}
            <Card className="p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <MapPin className="w-8 h-8 text-accent" />
                <h3 className="text-2xl font-semibold text-primary">GPS Capabilities</h3>
              </div>
              <div className="space-y-4">
                <p className="text-foreground/80">
                  Integrated GPS functionality for location-based security research:
                </p>
                <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-2">
                  <li><strong>Location Tracking:</strong> Real-time GPS coordinates and altitude</li>
                  <li><strong>Signal Strength Mapping:</strong> Correlate WiFi/Bluetooth signals with physical location</li>
                  <li><strong>Geofencing Analysis:</strong> Test location-based security mechanisms</li>
                  <li><strong>Navigation Data:</strong> Access satellite information and accuracy metrics</li>
                </ul>
              </div>
            </Card>
          </section>
        )}

        {/* Usage Section */}
        {activeSection === "usage" && (
          <section className="py-16 px-8 max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-primary">Usage Guide</h2>

            {/* Accessing the Interface */}
            <Card className="mb-12 p-8 bg-card">
              <h3 className="text-2xl font-semibold mb-6 text-primary">Accessing the Marauder Interface</h3>
              <div className="space-y-4">
                <p className="text-foreground/80">
                  Once your Marauder board is installed and your Flipper Zero is powered on, access the application through one of these methods:
                </p>
                <div className="border-l-4 border-accent pl-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-primary mb-1">Method 1: Apps Menu</h4>
                    <p className="text-foreground/80 text-sm">Navigate to <code className="bg-muted px-2 py-1 rounded">Apps &gt; Marauder</code> to launch the main interface</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-1">Method 2: GPIO Menu</h4>
                    <p className="text-foreground/80 text-sm">Navigate to <code className="bg-muted px-2 py-1 rounded">Applications &gt; GPIO &gt; [ESP32] Marauder</code></p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-1">Method 3: Quick Access</h4>
                    <p className="text-foreground/80 text-sm">If configured, use the Flipper's quick access menu to launch Marauder directly</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* WiFi Auditing */}
            <Card className="mb-12 p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <Wifi className="w-8 h-8 text-accent" />
                <h3 className="text-2xl font-semibold text-primary">WiFi Auditing Workflow</h3>
              </div>
              <div className="space-y-6">
                {[
                  {
                    step: "1",
                    title: "Launch WiFi Scanner",
                    desc: "From the Marauder menu, select WiFi > Scan to begin scanning for available networks.",
                  },
                  {
                    step: "2",
                    title: "Review Networks",
                    desc: "The scanner will display all networks in range with SSID, signal strength (RSSI), encryption type, and channel information.",
                  },
                  {
                    step: "3",
                    title: "Select Target",
                    desc: "Choose the network you are authorized to test. Verify you have explicit written permission before proceeding.",
                  },
                  {
                    step: "4",
                    title: "Capture Packets",
                    desc: "Use Sniff > Beacon or Sniff > Packets to capture network traffic for analysis.",
                  },
                  {
                    step: "5",
                    title: "Export Data",
                    desc: "Save captured packets to the SD card for detailed analysis using tools like Wireshark.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">{item.title}</h4>
                      <p className="text-foreground/80">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bluetooth Auditing */}
            <Card className="p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <Bluetooth className="w-8 h-8 text-accent" />
                <h3 className="text-2xl font-semibold text-primary">Bluetooth Auditing Workflow</h3>
              </div>
              <div className="space-y-6">
                {[
                  {
                    step: "1",
                    title: "Launch BLE Scanner",
                    desc: "From the Marauder menu, select Bluetooth > Scan to begin scanning for BLE devices.",
                  },
                  {
                    step: "2",
                    title: "Identify Devices",
                    desc: "The scanner displays discovered devices with MAC addresses, signal strength, and device names.",
                  },
                  {
                    step: "3",
                    title: "Analyze Advertisements",
                    desc: "Select a device to view detailed BLE advertisement data and service UUIDs.",
                  },
                  {
                    step: "4",
                    title: "Sniff Traffic",
                    desc: "Use Sniff mode to capture BLE packets and analyze communication patterns.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">{item.title}</h4>
                      <p className="text-foreground/80">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* Ethics & Legal Section */}
        {activeSection === "ethics" && (
          <section className="py-16 px-8 max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-primary">Ethics & Legal Considerations</h2>

            <div className="space-y-8">
              <Card className="p-8 bg-destructive/10 border-destructive/30">
                <h3 className="text-2xl font-semibold text-destructive mb-4">⚠️ Legal Warning</h3>
                <p className="text-foreground/80 mb-4">
                  Unauthorized access to computer systems, networks, or wireless communications is illegal in most jurisdictions, including Canada under the <strong>Radiocommunication Act</strong>. Violating these laws can result in severe consequences:
                </p>
                <ul className="list-disc list-inside space-y-2 text-foreground/80">
                  <li>Heavy fines (up to $25,000 for corporations, $5,000 for individuals in Canada)</li>
                  <li>Criminal imprisonment</li>
                  <li>Civil liability and damages</li>
                  <li>Permanent criminal record</li>
                  <li>Loss of professional licenses and certifications</li>
                </ul>
              </Card>

              <Card className="p-8 bg-card">
                <h3 className="text-2xl font-semibold text-primary mb-6">Authorization Requirements</h3>
                <div className="space-y-4">
                  <p className="text-foreground/80">
                    Before conducting ANY security testing, you must obtain <strong>explicit, written authorization</strong> from the system owner. This authorization should clearly document:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-2">
                    <li>Scope of testing (specific networks, devices, or systems to be tested)</li>
                    <li>Duration and timeframe of the engagement</li>
                    <li>Approved testing methods and techniques</li>
                    <li>Rules of engagement and specific limitations</li>
                    <li>Contact information and escalation procedures</li>
                    <li>Liability and indemnification clauses</li>
                  </ul>
                </div>
              </Card>

              <Card className="p-8 bg-card">
                <h3 className="text-2xl font-semibold text-primary mb-6">Responsible Disclosure</h3>
                <p className="text-foreground/80 mb-4">
                  When you discover vulnerabilities during authorized testing, follow these responsible disclosure practices:
                </p>
                <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-2">
                  <li>Report findings to the system owner immediately and confidentially</li>
                  <li>Provide clear, actionable remediation steps and severity ratings</li>
                  <li>Do not disclose vulnerabilities publicly without explicit permission</li>
                  <li>Allow reasonable time (typically 90 days) for the owner to patch before disclosure</li>
                  <li>Document all communication, findings, and remediation efforts</li>
                  <li>Maintain confidentiality of sensitive information discovered during testing</li>
                </ul>
              </Card>

              <Card className="p-8 bg-accent/10 border-accent/30">
                <h3 className="text-2xl font-semibold text-primary mb-4">✓ Best Practices for Authorized Research</h3>
                <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-2">
                  <li>Always maintain detailed records of your testing activities, including timestamps and findings</li>
                  <li>Use isolated test environments whenever possible to minimize risk</li>
                  <li>Stay updated on current laws and regulations in your jurisdiction</li>
                  <li>Respect the privacy and confidentiality of the systems you test</li>
                  <li>Maintain professional ethics and integrity at all times</li>
                  <li>Consider obtaining professional liability insurance for security research</li>
                  <li>Participate in bug bounty programs when available for responsible disclosure</li>
                </ul>
              </Card>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
