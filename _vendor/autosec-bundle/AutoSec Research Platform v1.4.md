# AutoSec Research Platform v1.4

This is a significantly evolved Flipper Application (FAP) for **authorized automotive security research**, transforming the Flipper Zero into a foundational research platform.

## Research Platform Features
- **Structured Signal Data Management**: Captures and stores signals with metadata (frequency, modulation, timestamp).
- **On-Device Analysis Primitives**: Real-time display of signal characteristics and raw data patterns.
- **Advanced Emulation Control**: Granular control over signal transmission for targeted vulnerability testing.
- **Detailed Research Logging**: Enhanced logging to `/ext/autosec_research_log.txt` for comprehensive post-analysis.
- **Integrated Pentesting Guide**: Professional guide for demonstrating automotive vulnerabilities ethically.

## How to Use for Advanced Research
1. **Capture**: Use the **Research Scanner** to monitor the target frequency. The tool will capture structured signal data.
2. **Analyze**: Switch to **Signal Analysis** to view the characteristics and raw data of the captured signal directly on the device.
3. **Emulate**: Use **Advanced Emulation** to transmit the captured signal and observe the vehicle's response.
4. **Export**: Review the `autosec_research_log.txt` and `autosec_signals.json` (simulated) for off-device analysis and reporting.

## Technical Foundation
- **Structured Data**: Implementation of `AutoSecSignal` struct for organized data handling.
- **Analysis Primitives**: Basic on-device logic for extracting and displaying signal information.
- **Enhanced UI**: Refined navigation and visual feedback for a professional research experience.

## Ethical and Legal Compliance
As a professional researcher in Canada, always ensure you have explicit, written authorization before testing any system. This tool is designed to support **authorized research and vulnerability demonstration** in compliance with the **Radiocommunication Act**.
