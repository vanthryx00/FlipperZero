# Flipper Zero Programs - Complete Index

**Generated**: June 17, 2026  
**Total Programs**: 5 FAP Applications  
**Total Files**: 10 (5 C source files + 5 manifest files)  
**Status**: All programs properly stored and verified

---

## Program Inventory

### 1. AutoSec Tool
**Type**: Sub-GHz Signal Analysis & Logging  
**Files**:
- `flipper-zero/autosec_tool/autosec_tool.c` (9.2 KB)
- `flipper-zero/autosec_tool/application.fam` (400 B)

**Features**:
- Real-time Sub-GHz signal detection
- Frequency analysis with signal strength
- Modulation detection (FSK, OOK, GFSK)
- Pattern recognition and filtering
- Persistent SD card logging
- Multi-view interface (Scanner, Analyzer, Logger, About)

**Entry Point**: `autosec_tool_app`  
**Stack Size**: 2 KB  
**Category**: Tools

---

### 2. CAN Monitor
**Type**: CAN Bus Message Capture & Analysis  
**Files**:
- `flipper-zero/can_monitor/can_monitor.c` (9.5 KB)
- `flipper-zero/can_monitor/application.fam` (375 B)

**Features**:
- Real-time CAN bus message capture
- Standard (11-bit) and Extended (29-bit) ID support
- Message filtering and pattern analysis
- Hardware abstraction for CAN expansion
- Persistent logging for forensic analysis
- Multi-view interface (Monitor, Filter, Logger, About)

**Entry Point**: `can_monitor_app`  
**Stack Size**: 2 KB  
**Category**: Tools

---

### 3. Marauder Companion
**Type**: WiFi/Bluetooth/GPS Auditing  
**Files**:
- `flipper-zero/marauder_companion/marauder_companion.c` (11 KB)
- `flipper-zero/marauder_companion/application.fam` (425 B)

**Features**:
- WiFi network scanning and enumeration
- Bluetooth device discovery and analysis
- GPS location monitoring and tracking
- Real-time status display
- Multi-view interface (WiFi, Bluetooth, GPS, About)
- Integration with ESP32 Marauder expansion board

**Entry Point**: `marauder_companion_app`  
**Stack Size**: 2 KB  
**Category**: Tools

---

### 4. AutoSec Launcher
**Type**: Unified Application Launcher & Menu  
**Files**:
- `flipper-zero/autosec_launcher/autosec_launcher.c` (9.0 KB)
- `flipper-zero/autosec_launcher/application.fam` (428 B)

**Features**:
- Central hub for all AutoSec tools
- Application launcher interface
- System status monitoring
- Tool availability indicators
- Device information display
- Multi-view interface (Submenu, About, Status, Tools)

**Entry Point**: `autosec_launcher_app`  
**Stack Size**: 2 KB  
**Category**: Tools

---

### 5. ESP32 Flasher
**Type**: Firmware Flashing Tool  
**Files**:
- `flipper-zero/esp32_flasher/esp32_flasher.c` (9.8 KB)
- `flipper-zero/esp32_flasher/application.fam` (406 B)

**Features**:
- Direct firmware flashing from Flipper Zero
- Device connection verification
- Flashing progress monitoring
- Status reporting and error handling
- Backup and restore capabilities
- Multi-view interface (Submenu, Flashing, Status, About)

**Entry Point**: `esp32_flasher_app`  
**Stack Size**: 2 KB  
**Category**: Tools

---

## File Structure

```
flipper-zero-complete-project/
├── flipper-zero/
│   ├── autosec_tool/
│   │   ├── autosec_tool.c (9.2 KB)
│   │   └── application.fam (400 B)
│   ├── can_monitor/
│   │   ├── can_monitor.c (9.5 KB)
│   │   └── application.fam (375 B)
│   ├── marauder_companion/
│   │   ├── marauder_companion.c (11 KB)
│   │   └── application.fam (425 B)
│   ├── autosec_launcher/
│   │   ├── autosec_launcher.c (9.0 KB)
│   │   └── application.fam (428 B)
│   └── esp32_flasher/
│       ├── esp32_flasher.c (9.8 KB)
│       └── application.fam (406 B)
├── BUILD_AND_DEPLOY_GUIDE.md
├── DEPLOYMENT_ORCHESTRATION.md
├── PROJECT_SUMMARY.md
└── PROGRAM_INDEX.md (this file)
```

---

## Verification Report

### File Integrity
- ✓ All 5 C source files present and non-empty
- ✓ All 5 manifest files present and non-empty
- ✓ No empty or corrupted files detected
- ✓ Total code size: 48.3 KB
- ✓ Total manifest size: 2.034 KB

### Code Quality
- ✓ All files include proper headers
- ✓ All files have proper entry points
- ✓ All files have proper cleanup/deallocation
- ✓ All manifests properly formatted
- ✓ All entry points match manifest declarations

### Program Features
- ✓ AutoSec Tool: 4 views + logging
- ✓ CAN Monitor: 4 views + logging
- ✓ Marauder Companion: 4 views + status
- ✓ AutoSec Launcher: 4 views + navigation
- ✓ ESP32 Flasher: 4 views + progress

---

## Build Instructions

### Build All Programs
```bash
./fbt fap_autosec_tool fap_can_monitor fap_marauder_companion fap_autosec_launcher fap_esp32_flasher
```

### Build Individual Programs
```bash
./fbt fap_autosec_tool          # AutoSec Tool
./fbt fap_can_monitor           # CAN Monitor
./fbt fap_marauder_companion    # Marauder Companion
./fbt fap_autosec_launcher      # AutoSec Launcher
./fbt fap_esp32_flasher         # ESP32 Flasher
```

### Output Locations
```
build/f7/apps/external/autosec_tool.fap
build/f7/apps/external/can_monitor.fap
build/f7/apps/external/marauder_companion.fap
build/f7/apps/external/autosec_launcher.fap
build/f7/apps/external/esp32_flasher.fap
```

---

## Deployment Methods

### USB Deployment (Recommended)
```bash
./fbt flash_usb_fap apps/external/autosec_tool.fap
```

### SD Card Deployment
```bash
cp build/f7/apps/external/*.fap /path/to/flipper/sd/apps/external/
```

### Web Flasher
Visit: https://flipperzero.one/web-flasher

---

## Program Dependencies

### Common Dependencies
- `furi.h` - Flipper OS core
- `furi_hal.h` - Hardware abstraction
- `gui/gui.h` - GUI framework
- `gui/elements.h` - UI elements
- `gui/view_dispatcher.h` - View management
- `storage/storage.h` - File storage

### Optional Dependencies
- `notification/notification.h` - Notifications (AutoSec Launcher, ESP32 Flasher)
- `gui/modules/submenu.h` - Menu UI
- `gui/modules/text_box.h` - Text display
- `gui/modules/widget.h` - Widget framework

---

## Safety & Legal

All programs are designed for **authorized security research and penetration testing only**.

**Legal Notice**: Unauthorized access to computer systems is illegal. Always obtain proper authorization before conducting any security testing.

**Safety Features**:
- ✓ Proper memory management
- ✓ Error handling and validation
- ✓ Safe UI interactions
- ✓ Logging and audit trails
- ✓ Device safety checks

---

## Support & Documentation

- **BUILD_AND_DEPLOY_GUIDE.md**: Complete build and deployment instructions
- **DEPLOYMENT_ORCHESTRATION.md**: Automated deployment system documentation
- **PROJECT_SUMMARY.md**: Comprehensive project overview
- **GitHub**: https://github.com/koko/flipper-zero-complete-project

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-17 | Initial release with 5 FAP applications |

---

## Maintenance

**Last Verified**: June 17, 2026  
**Maintained By**: Koko  
**Status**: All programs properly stored and verified ✓

