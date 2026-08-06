# Flipper Zero Applications - Build and Deployment Guide

**Author**: Koko  
**Date**: June 10, 2026  
**Version**: 1.0.0

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Building Applications](#building-applications)
4. [Deploying to Flipper Zero](#deploying-to-flipper-zero)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

Before you can build and deploy the Flipper Zero applications, ensure you have the following installed on your system:

### Required Software

- **Flipper Zero Official Firmware**: Latest version from [official repository](https://github.com/flipperdevices/flipperzero-firmware)
- **Flipper Zero SDK (FBT)**: Build system for Flipper Zero applications
- **Python 3.8+**: Required for build scripts and tools
- **Git**: For version control and cloning repositories
- **C Compiler**: GCC or Clang for compiling C code

### Hardware Requirements

- **Flipper Zero Device**: Official hardware with USB connection
- **USB Cable**: Standard USB-A to USB-C cable for device communication
- **Computer**: Windows, macOS, or Linux with at least 4GB RAM

---

## Environment Setup

### Step 1: Install Flipper Zero SDK

The Flipper Zero SDK (FBT - Flipper Build Tool) is essential for compiling applications. Follow these steps to install it:

**On Linux/macOS:**

```bash
# Clone the Flipper Zero firmware repository
git clone https://github.com/flipperdevices/flipperzero-firmware.git
cd flipperzero-firmware

# Install dependencies
./fbt --help  # This will initialize the environment

# Set up the environment
source ./fbt
```

**On Windows (PowerShell):**

```powershell
# Clone the Flipper Zero firmware repository
git clone https://github.com/flipperdevices/flipperzero-firmware.git
cd flipperzero-firmware

# Run the setup script
.\fbt.cmd --help
```

### Step 2: Verify Installation

Test that the FBT is properly installed:

```bash
./fbt --version
```

You should see output similar to:

```
FBT version: 1.0.0
Python version: 3.9.0
```

### Step 3: Clone the AutoSec Project

```bash
# Clone the complete project
git clone https://github.com/koko/flipper-zero-complete-project.git
cd flipper-zero-complete-project
```

---

## Building Applications

### Build All Applications

To build all three Flipper Zero applications at once:

```bash
# Navigate to the Flipper Zero firmware directory
cd /path/to/flipperzero-firmware

# Build all applications
./fbt fap_autosec_tool fap_can_monitor fap_marauder_companion
```

### Build Individual Applications

#### AutoSec Tool

```bash
./fbt fap_autosec_tool
```

**Output**: `build/f7/apps/external/autosec_tool.fap`

#### CAN Monitor

```bash
./fbt fap_can_monitor
```

**Output**: `build/f7/apps/external/can_monitor.fap`

#### Marauder Companion

```bash
./fbt fap_marauder_companion
```

**Output**: `build/f7/apps/external/marauder_companion.fap`

### Build with Verbose Output

For debugging build issues, use verbose mode:

```bash
./fbt fap_autosec_tool -v
```

### Clean Build

To perform a clean build (remove all previous build artifacts):

```bash
./fbt clean
./fbt fap_autosec_tool
```

---

## Deploying to Flipper Zero

### Method 1: USB Deployment (Recommended)

The easiest way to deploy applications to your Flipper Zero is via USB.

**Step 1: Connect Flipper Zero**

1. Connect your Flipper Zero to your computer via USB cable
2. The device should appear as a USB device in your system

**Step 2: Deploy Applications**

```bash
# Deploy a single application
./fbt flash_usb_fap apps/external/autosec_tool.fap

# Or deploy all applications
./fbt flash_usb_fap apps/external/autosec_tool.fap apps/external/can_monitor.fap apps/external/marauder_companion.fap
```

**Step 3: Verify Deployment**

1. On your Flipper Zero, navigate to: **Applications > External**
2. You should see the newly deployed applications

### Method 2: SD Card Deployment

If USB deployment doesn't work, you can deploy via SD card:

**Step 1: Prepare SD Card**

1. Insert the SD card into your Flipper Zero
2. Connect the Flipper Zero to your computer via USB

**Step 2: Copy Applications**

```bash
# Copy applications to the SD card
cp build/f7/apps/external/autosec_tool.fap /path/to/flipper/sd/apps/external/
cp build/f7/apps/external/can_monitor.fap /path/to/flipper/sd/apps/external/
cp build/f7/apps/external/marauder_companion.fap /path/to/flipper/sd/apps/external/
```

**Step 3: Eject and Restart**

1. Safely eject the SD card
2. Restart your Flipper Zero
3. Navigate to **Applications > External** to see the applications

### Method 3: Web Flasher

Flipper Zero also supports web-based flashing:

1. Visit [Flipper Zero Web Flasher](https://flipperzero.one/web-flasher)
2. Connect your Flipper Zero via USB
3. Select the `.fap` file to deploy
4. Click "Flash"

---

## Troubleshooting

### Issue: "Command not found: fbt"

**Solution**: Ensure the Flipper Zero firmware directory is in your PATH:

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export PATH="/path/to/flipperzero-firmware:$PATH"
```

### Issue: USB Device Not Recognized

**Solution**: 

1. **Linux**: Install udev rules
   ```bash
   sudo cp ./udev_rules/flipper.rules /etc/udev/rules.d/
   sudo udevadm control --reload-rules
   ```

2. **macOS**: Install Flipper Zero drivers from [official website](https://docs.flipper.net/)

3. **Windows**: Install drivers from Device Manager

### Issue: Build Fails with "Python not found"

**Solution**: Ensure Python 3.8+ is installed and in your PATH:

```bash
python3 --version  # Should output 3.8 or higher
```

### Issue: "Permission Denied" on Linux

**Solution**: Add execute permissions to FBT:

```bash
chmod +x ./fbt
```

### Issue: Application Crashes After Deployment

**Solution**:

1. Check the application logs:
   ```bash
   ./fbt console  # Connect to Flipper Zero serial console
   ```

2. Verify the application manifest (`application.fam`) is correct

3. Rebuild with verbose output to check for compilation warnings:
   ```bash
   ./fbt fap_autosec_tool -v
   ```

---

## Advanced Configuration

### Custom Build Flags

You can customize the build process by modifying the `application.fam` file:

```python
App(
    appid="autosec_tool",
    name="AutoSec Tool",
    apptype=FlipperAppType.EXTERNAL,
    entry_point="autosec_tool_app",
    stack_size=2 * 1024,  # Increase if running out of memory
    fap_category="Tools",
    fap_description="Automotive security research tool",
    fap_author="Koko",
    fap_version="1.0.0",
)
```

### Enabling Debug Logging

To enable debug logging in your applications:

1. Modify the application source code to include debug macros:

```c
#define DEBUG_ENABLED 1

#if DEBUG_ENABLED
#define DEBUG_LOG(fmt, ...) FURI_LOG_I(TAG, fmt, ##__VA_ARGS__)
#else
#define DEBUG_LOG(fmt, ...)
#endif
```

2. Rebuild and deploy:

```bash
./fbt fap_autosec_tool
./fbt flash_usb_fap apps/external/autosec_tool.fap
```

### Increasing Stack Size

If your application runs out of memory, increase the stack size in `application.fam`:

```python
stack_size=4 * 1024,  # Increased from 2 * 1024
```

Then rebuild and redeploy.

---

## Deployment Checklist

Before deploying to production, ensure:

- [ ] All applications compile without errors
- [ ] No warnings in build output
- [ ] Application manifests are correctly configured
- [ ] USB connection is stable
- [ ] Flipper Zero firmware is up to date
- [ ] Sufficient storage space on device
- [ ] All legal disclaimers are displayed
- [ ] Testing completed on target device

---

## Performance Optimization

### Memory Usage

Monitor memory usage during development:

```bash
./fbt console  # Connect to Flipper Zero serial console
# Type: free  # View memory statistics
```

### Execution Speed

Profile application performance:

1. Add timing markers in your code:

```c
uint32_t start = furi_get_tick();
// Your code here
uint32_t elapsed = furi_get_tick() - start;
FURI_LOG_I(TAG, "Execution time: %lu ms", elapsed);
```

2. Monitor performance via serial console:

```bash
./fbt console
```

---

## Continuous Integration

For automated builds and deployments, you can set up CI/CD pipelines:

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build Flipper Zero Apps

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup FBT
        run: |
          git clone https://github.com/flipperdevices/flipperzero-firmware.git
          cd flipperzero-firmware
          ./fbt --help
      - name: Build Applications
        run: |
          cd flipperzero-firmware
          ./fbt fap_autosec_tool fap_can_monitor fap_marauder_companion
      - name: Upload Artifacts
        uses: actions/upload-artifact@v2
        with:
          name: flipper-apps
          path: build/f7/apps/external/*.fap
```

---

## Support and Resources

- **Flipper Zero Documentation**: https://docs.flipper.net/
- **Official GitHub Repository**: https://github.com/flipperdevices/flipperzero-firmware
- **Community Forum**: https://forum.flipper.net/
- **Discord Community**: https://discord.gg/flipper

---

## Legal Notice

These applications are designed for **authorized security research and penetration testing only**. Unauthorized access to computer systems is illegal. Always obtain proper authorization before conducting any security testing.

---

**Last Updated**: June 10, 2026  
**Maintained By**: Koko
