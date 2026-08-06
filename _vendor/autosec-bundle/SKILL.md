---
name: automotive-security-research
description: Complete development and deployment framework for automotive security research platforms with Flipper Zero FAP applications, ESP32 integration, web-based flasher, comprehensive auditing, and documentation generation. Use for building automotive security tools, creating Flipper Zero applications, conducting security audits, generating project documentation, and deploying firmware to devices.
---

# Automotive Security Research Platform Development

This skill provides a complete, reusable framework for developing automotive security research platforms that integrate Flipper Zero, ESP32, and web-based deployment systems. It includes code generation, security auditing, documentation automation, and deployment orchestration.

## When to Use This Skill

Use this skill when building automotive security research tools, creating Flipper Zero FAP applications, developing ESP32-based security tools, conducting comprehensive security audits, generating project documentation, deploying firmware to Flipper Zero and ESP32 devices, setting up web-based flasher interfaces, or integrating multiple security tools into a unified platform.

## Core Workflow

The skill follows a structured development and deployment process: (1) Generate FAP Applications - Create Flipper Zero applications with proper structure, (2) Audit System - Conduct comprehensive security audits for telemetry, tracking, and malicious code, (3) Generate Documentation - Automatically create project documentation and verification reports, (4) Deploy to Devices - Flash applications to Flipper Zero and ESP32 devices, (5) Verify Installation - Confirm successful deployment and functionality.

## Key Components

### Scripts

The skill includes three main scripts in `scripts/`:

#### `generate_fap_application.py`
Generates complete Flipper Zero FAP applications with proper C source files and manifests. Usage: `python generate_fap_application.py <app_name> <app_type> <description>`. Example: `python generate_fap_application.py autosec_tool "signal_analysis" "Sub-GHz signal detection and analysis"`. Output includes `flipper-zero/<app_name>/<app_name>.c` (C source file) and `flipper-zero/<app_name>/application.fam` (manifest file). Features proper memory allocation/deallocation, complete view dispatcher setup, multi-view UI framework, error handling, and logging support.

#### `audit_system.py`
Conducts comprehensive security audits of Flipper Zero and web applications. Usage: `python audit_system.py <project_path>`. Checks for telemetry and tracking code, identifies suspicious network calls, scans for malware patterns, finds hardcoded credentials, audits npm package dependencies, and generates JSON report with audit results, dependency list, and security status.

#### `generate_documentation.py`
Generates comprehensive project documentation automatically. Usage: `python generate_documentation.py <project_path> <project_name>`. Generates PROGRAM_INDEX.md (complete program inventory), STORAGE_MANIFEST.md (storage verification), VERIFICATION_REPORT.md (security verification), and DEPENDENCIES_ANALYSIS.md (dependency audit).

### References

The skill includes comprehensive reference documentation in `references/`:

#### `flipper_zero_development.md`
Complete reference for Flipper Zero FAP development including core concepts and architecture, memory management, key Flipper OS libraries, application lifecycle, view dispatcher pattern, common patterns and best practices, manifest file format, build commands, and testing/debugging guidance.

#### `web_deployment_guide.md`
Complete guide for web application deployment including architecture overview, tRPC API procedures, database schema, frontend components, security implementation, deployment checklist, performance optimization, monitoring and logging, disaster recovery, and troubleshooting.

## Workflow Examples

### Create a New Flipper Zero Application

Generate the application: `python scripts/generate_fap_application.py can_monitor "bus_analysis" "CAN bus monitoring and analysis"`. Review generated files: `cat flipper-zero/can_monitor/can_monitor.c` and `cat flipper-zero/can_monitor/application.fam`. Build: `cd /path/to/flipper-firmware && ./fbt fap_can_monitor`. Deploy: `./fbt flash_usb_fap build/f7/apps/external/can_monitor.fap`.

### Audit a Project for Security Issues

Run comprehensive audit: `python scripts/audit_system.py /path/to/project`. Review audit results showing status (CLEAN or ISSUES_FOUND), list of all dependencies, and any suspicious patterns detected.

### Generate Complete Project Documentation

Generate all documentation: `python scripts/generate_documentation.py /path/to/project "My Security Project"`. Documentation files created in project/documentation/ include PROGRAM_INDEX.md, STORAGE_MANIFEST.md, VERIFICATION_REPORT.md, and DEPENDENCIES_ANALYSIS.md.

### Complete Platform Development

Create multiple FAP applications: `python scripts/generate_fap_application.py autosec_tool "signal_analysis" "Sub-GHz analysis"`, `python scripts/generate_fap_application.py can_monitor "bus_analysis" "CAN bus monitoring"`, `python scripts/generate_fap_application.py marauder_companion "wifi_ble_gps" "WiFi/BLE/GPS auditing"`. Audit entire project: `python scripts/audit_system.py .`. Generate documentation: `python scripts/generate_documentation.py . "Automotive Security Platform"`. Build all: `cd /path/to/flipper-firmware && ./fbt fap_autosec_tool fap_can_monitor fap_marauder_companion`. Deploy: `./fbt flash_usb_fap build/f7/apps/external/*.fap`.

## Integration with Web Platform

The skill integrates with web-based deployment systems through tRPC API procedures for device detection, firmware operations, flashing operations, and backup operations. The web application provides device detection and status monitoring, firmware upload and management, real-time flashing progress, backup and restore operations, and flashing history tracking.

## Security Considerations

All generated Flipper Zero applications follow security best practices: no hardcoded credentials, proper memory management, safe string handling, input validation, error handling, and local storage only (no network communication). The audit_system.py script verifies no telemetry or tracking code, no malware or backdoors, no suspicious network calls, no hardcoded credentials, and safe dependency list. Generated documentation includes security verification reports, dependency analysis, storage manifest verification, and program integrity checks.

## Best Practices

**Application Development**: Always allocate in `*_app_alloc()` and deallocate in `*_app_free()`, check allocation success, use static allocation when possible, check all return values, provide user feedback, log errors to SD card, handle edge cases, ensure clear navigation, responsive input, helpful error messages, and about/info screens.

**Security Auditing**: Run regularly after each development cycle, review all findings, address detected problems, and keep audit reports for compliance.

**Documentation**: Generate early during development, keep updated after changes, verify accuracy of generated docs, and store documentation with releases.

## Troubleshooting

**FAP Generation Issues**: Generated C file has compilation errors - Review generated code and ensure all includes are correct (see `flipper_zero_development.md`). Application crashes on device - Check memory allocation, verify stack size, review error logs (see memory management section in `flipper_zero_development.md`).

**Audit Issues**: Audit reports false positives - Review patterns in `audit_system.py` and adjust regex if needed. Missing dependencies detected - Ensure all source files are in project path and check project structure matches expected layout.

**Documentation Issues**: Generated documentation is incomplete - Verify project structure and ensure all files are present, check `generate_documentation.py` for expected structure.

## Advanced Usage

**Custom FAP Templates**: Modify `generate_fap_application.py` to create custom templates for signal analysis, bus monitoring, wireless auditing, or firmware flashing applications.

**Extended Auditing**: Enhance `audit_system.py` to add custom checks for performance analysis, code complexity metrics, dependency version checking, or license compliance.

**Enhanced Documentation**: Extend `generate_documentation.py` to create API documentation, user guides, developer guides, or architecture diagrams.

## Integration with Manus Platform

The skill integrates with Manus OAuth (user authentication for web platform), AWS S3 (firmware file storage), Database (project and deployment tracking), and Notifications (deployment status updates).

## Support and Documentation

For detailed information: Flipper Zero Development (see `references/flipper_zero_development.md`), Web Deployment (see `references/web_deployment_guide.md`), Script Usage (run scripts with `--help` flag), Examples (see workflow examples above).
