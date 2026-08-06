# ESP32 Marauder Integration Guide: WiFi & Bluetooth Auditing

This guide explains how to integrate the **ESP32 Marauder** firmware into your **AutoSec Research Platform** for authorized WiFi and Bluetooth security audits using your Flipper Zero.

## 1. Overview
The ESP32 Marauder is a powerful suite of WiFi and Bluetooth offensive and defensive tools. When flashed onto an ESP32 and connected to the Flipper Zero, it can be controlled via the **[ESP32] WiFi Marauder** companion app on the Flipper.

## 2. Installation Instructions

### A. Flash Marauder Firmware
1.  **Download Firmware**: Obtain the latest `esp32_marauder.bin` for your specific ESP32 board (e.g., WiFi Dev Board, ESP32-WROOM) from the [official ESP32Marauder GitHub releases](https://github.com/justcallmekoko/ESP32Marauder/releases).
2.  **Flash via Web**: Use the [ESP32 Marauder Web Flasher](https://esp.huhn.me/) or the `esptool.py` command-line tool.
    *   **Command Example**: `esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 921600 write_flash -z 0x10000 esp32_marauder.bin`
3.  **Flash via Flipper (Optional)**: If you have the `ESP32 WiFi Marauder` app installed on your Flipper, you can often flash the firmware directly from the Flipper's SD card if the ESP32 is connected via GPIO.

### B. Connect to Flipper Zero
Connect your ESP32 to the Flipper Zero's GPIO pins as follows:

| ESP32 Pin | Flipper Zero Pin |
| :--- | :--- |
| **TX (Serial)** | **14 (RX)** |
| **RX (Serial)** | **13 (TX)** |
| **3.3V** | **3.3V (Pin 9)** |
| **GND** | **GND (Pin 8 or 11)** |

## 3. Usage via Flipper Zero
1.  **Launch App**: On your Flipper Zero, go to **Applications > GPIO > [ESP32] WiFi Marauder**.
2.  **Scan for Access Points**: Select `Scan > APs` to identify nearby WiFi networks.
3.  **Select Target**: Once the scan is complete, go to `Select > APs` and choose the network you are authorized to test.
4.  **Deauthentication Attack (Authorized Only)**: Select `Attack > Deauth` to demonstrate how a client can be disconnected from the network. This is used to test the resilience of your own systems against such attacks.
5.  **Sniffing**: Use `Sniff > Beacon` or `Sniff > PMKID` to capture packets for offline analysis (e.g., in Wireshark).

## 4. Bluetooth Auditing
The Marauder also supports Bluetooth scanning and sniffing.
1.  **Scan Bluetooth**: Select `Bluetooth > Scan` to identify nearby Bluetooth Low Energy (BLE) devices.
2.  **Sniff BLE**: Use the sniffing tools to capture BLE advertisements and data packets for security research.

## 5. Ethical and Legal Reminder
WiFi and Bluetooth auditing must only be performed on networks and devices you own or have explicit, written permission to test. Unauthorized deauthentication or sniffing is illegal in many jurisdictions, including Canada under the **Radiocommunication Act**.
