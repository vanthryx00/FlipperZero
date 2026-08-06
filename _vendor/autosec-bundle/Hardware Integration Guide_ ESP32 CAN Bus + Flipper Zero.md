# Hardware Integration Guide: ESP32 CAN Bus + Flipper Zero

This guide explains how to build the hardware setup for the **AutoSec Research Platform**, integrating an ESP32 for CAN bus communication with your Flipper Zero.

## 1. Components Required
*   **Flipper Zero**
*   **ESP32 Development Board** (e.g., ESP32-WROOM-32)
*   **CAN Transceiver Module** (e.g., SN65HVD230 or TJA1050)
*   **Jumper Wires**
*   **Breadboard** (optional)
*   **OBD-II to DB9 Cable** or **OBD-II Breakout** (for vehicle connection)

## 2. Wiring Diagram

### ESP32 to CAN Transceiver
| ESP32 Pin | CAN Transceiver Pin |
| :--- | :--- |
| **GPIO 5 (TX)** | **CTX / TX** |
| **GPIO 4 (RX)** | **CRX / RX** |
| **3.3V** | **VCC** |
| **GND** | **GND** |

### ESP32 to Flipper Zero (GPIO)
| ESP32 Pin | Flipper Zero Pin |
| :--- | :--- |
| **TX (Serial)** | **14 (RX)** |
| **RX (Serial)** | **13 (TX)** |
| **GND** | **GND (Pin 8 or 11)** |

**Note**: Ensure the ESP32 and Flipper Zero share a common ground.

### CAN Transceiver to Vehicle (OBD-II)
| CAN Transceiver Pin | OBD-II Pin |
| :--- | :--- |
| **CANH** | **Pin 6 (CAN High)** |
| **CANL** | **Pin 14 (CAN Low)** |

## 3. Setup Instructions
1.  **Flash ESP32**: Upload the `esp32_can_autosec.ino` firmware to your ESP32 using the Arduino IDE.
2.  **Connect Hardware**: Follow the wiring diagram above to connect the ESP32, CAN transceiver, and Flipper Zero.
3.  **Connect to Vehicle**: Plug the CAN transceiver into the vehicle's OBD-II port.
4.  **Launch AutoSec Tool**: Open the AutoSec Tool on your Flipper Zero and navigate to the **CAN Bus (ESP32)** module.
5.  **Start Monitoring**: Press **OK** to begin receiving CAN bus data from the ESP32.

## 4. Safety Precautions
*   **Authorized Testing Only**: Only connect to vehicles you have explicit permission to test.
*   **Passive First**: Start by monitoring (sniffing) data before attempting any injection.
*   **Vehicle Stability**: Be aware that injecting incorrect CAN messages can cause vehicle malfunctions or trigger safety systems. Conduct testing in a controlled environment.
