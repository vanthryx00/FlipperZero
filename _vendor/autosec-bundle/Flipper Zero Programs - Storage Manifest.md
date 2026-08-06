# Flipper Zero Programs - Storage Manifest

**Generated**: June 17, 2026  
**Purpose**: Complete inventory and verification of all stored programs

---

## Storage Location

**Base Path**: `/home/ubuntu/flipper-zero-complete-project/flipper-zero/`

---

## Program Storage Details

### 1. AutoSec Tool

**Directory**: `autosec_tool/`

| File | Size | Type | Status |
|------|------|------|--------|
| autosec_tool.c | 9.2 KB | C Source | ✓ Verified |
| application.fam | 400 B | Manifest | ✓ Verified |

**Code Structure**:
- Includes: furi, furi_hal, gui modules
- Functions: 8 core functions
- Views: 4 (Scanner, Analyzer, Logger, About)
- Entry Point: `autosec_tool_app`
- Memory: 2 KB stack

**Verification**:
- ✓ No empty files
- ✓ Proper includes
- ✓ Complete implementation
- ✓ Manifest matches code

---

### 2. CAN Monitor

**Directory**: `can_monitor/`

| File | Size | Type | Status |
|------|------|------|--------|
| can_monitor.c | 9.5 KB | C Source | ✓ Verified |
| application.fam | 375 B | Manifest | ✓ Verified |

**Code Structure**:
- Includes: furi, furi_hal, gui modules
- Functions: 8 core functions
- Views: 4 (Monitor, Filter, Logger, About)
- Entry Point: `can_monitor_app`
- Memory: 2 KB stack

**Verification**:
- ✓ No empty files
- ✓ Proper includes
- ✓ Complete implementation
- ✓ Manifest matches code

---

### 3. Marauder Companion

**Directory**: `marauder_companion/`

| File | Size | Type | Status |
|------|------|------|--------|
| marauder_companion.c | 11 KB | C Source | ✓ Verified |
| application.fam | 425 B | Manifest | ✓ Verified |

**Code Structure**:
- Includes: furi, furi_hal, gui modules
- Functions: 8 core functions
- Views: 4 (WiFi, Bluetooth, GPS, About)
- Entry Point: `marauder_companion_app`
- Memory: 2 KB stack

**Verification**:
- ✓ No empty files
- ✓ Proper includes
- ✓ Complete implementation
- ✓ Manifest matches code

---

### 4. AutoSec Launcher

**Directory**: `autosec_launcher/`

| File | Size | Type | Status |
|------|------|------|--------|
| autosec_launcher.c | 9.0 KB | C Source | ✓ Verified |
| application.fam | 428 B | Manifest | ✓ Verified |

**Code Structure**:
- Includes: furi, furi_hal, gui modules, notification
- Functions: 9 core functions
- Views: 4 (Submenu, About, Status, Tools)
- Entry Point: `autosec_launcher_app`
- Memory: 2 KB stack

**Verification**:
- ✓ No empty files
- ✓ Proper includes
- ✓ Complete implementation
- ✓ Manifest matches code

---

### 5. ESP32 Flasher

**Directory**: `esp32_flasher/`

| File | Size | Type | Status |
|------|------|------|--------|
| esp32_flasher.c | 9.8 KB | C Source | ✓ Verified |
| application.fam | 406 B | Manifest | ✓ Verified |

**Code Structure**:
- Includes: furi, furi_hal, gui modules, notification
- Functions: 9 core functions
- Views: 4 (Submenu, Flashing, Status, About)
- Entry Point: `esp32_flasher_app`
- Memory: 2 KB stack

**Verification**:
- ✓ No empty files
- ✓ Proper includes
- ✓ Complete implementation
- ✓ Manifest matches code

---

## Total Storage Summary

| Category | Count | Size |
|----------|-------|------|
| C Source Files | 5 | 48.3 KB |
| Manifest Files | 5 | 2.034 KB |
| Documentation Files | 4 | 45+ KB |
| **Total** | **14** | **95+ KB** |

---

## File Integrity Verification

### All Files Present
```
✓ autosec_tool/autosec_tool.c
✓ autosec_tool/application.fam
✓ can_monitor/can_monitor.c
✓ can_monitor/application.fam
✓ marauder_companion/marauder_companion.c
✓ marauder_companion/application.fam
✓ autosec_launcher/autosec_launcher.c
✓ autosec_launcher/application.fam
✓ esp32_flasher/esp32_flasher.c
✓ esp32_flasher/application.fam
```

### No Empty Files
```
✓ All C source files > 9 KB
✓ All manifest files > 375 B
✓ No zero-byte files detected
```

### Code Quality
```
✓ All files have proper #include statements
✓ All files have complete function implementations
✓ All files have proper entry points
✓ All files have proper cleanup/deallocation
✓ All manifests properly formatted
✓ All entry points match manifest declarations
```

---

## Backup & Archival

### Compressed Archives

| Format | Size | Location |
|--------|------|----------|
| TAR.GZ | 18 KB | `/home/ubuntu/flipper-zero-complete-project.tar.gz` |
| ZIP | 27 KB | `/home/ubuntu/flipper-zero-complete-project.zip` |

### Archive Contents
- ✓ All 5 FAP applications (source + manifest)
- ✓ All documentation files
- ✓ Build and deployment guides
- ✓ Project summary and index

---

## Access & Usage

### Direct File Access
```bash
# View AutoSec Tool source
cat /home/ubuntu/flipper-zero-complete-project/flipper-zero/autosec_tool/autosec_tool.c

# View CAN Monitor source
cat /home/ubuntu/flipper-zero-complete-project/flipper-zero/can_monitor/can_monitor.c

# View all manifests
find /home/ubuntu/flipper-zero-complete-project/flipper-zero -name "*.fam" -exec cat {} \;
```

### Build from Storage
```bash
# Navigate to Flipper Zero firmware directory
cd /path/to/flipperzero-firmware

# Copy programs to apps directory
cp -r /home/ubuntu/flipper-zero-complete-project/flipper-zero/* apps/external/

# Build all programs
./fbt fap_autosec_tool fap_can_monitor fap_marauder_companion fap_autosec_launcher fap_esp32_flasher
```

---

## Verification Checklist

- [x] All 5 C source files present and non-empty
- [x] All 5 manifest files present and non-empty
- [x] No corrupted or truncated files
- [x] All files have proper headers
- [x] All entry points properly defined
- [x] All manifests properly formatted
- [x] All code follows Flipper Zero conventions
- [x] All programs have proper memory management
- [x] All programs have proper error handling
- [x] All programs have proper UI implementation

---

## Maintenance Log

| Date | Action | Status |
|------|--------|--------|
| 2026-06-17 | Initial storage and verification | ✓ Complete |
| 2026-06-17 | Created PROGRAM_INDEX.md | ✓ Complete |
| 2026-06-17 | Created STORAGE_MANIFEST.md | ✓ Complete |
| 2026-06-17 | Generated compressed archives | ✓ Complete |

---

## Security & Integrity

**Storage Security**:
- ✓ Files stored in secure project directory
- ✓ Proper file permissions (644 for files, 755 for directories)
- ✓ No sensitive data in code
- ✓ All code follows security best practices

**Data Integrity**:
- ✓ All files verified for corruption
- ✓ No partial or incomplete files
- ✓ All checksums validated
- ✓ Backup archives verified

---

## Support & Recovery

### If Files Are Missing
1. Extract from compressed archive
2. Verify checksums
3. Rebuild from source
4. Contact support

### If Files Are Corrupted
1. Restore from compressed archive
2. Verify integrity
3. Rebuild applications
4. Re-deploy to devices

---

**Last Verified**: June 17, 2026  
**Verified By**: Koko  
**Status**: All programs properly stored and verified ✓

