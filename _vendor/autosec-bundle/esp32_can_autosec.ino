#include <Arduino.h>
#include <ESP32-TWAI-CAN.hpp>

/* 
 * AutoSec ESP32 CAN Bus Sniffer/Injector
 * Designed to work with Flipper Zero AutoSec Tool.
 * Hardware: ESP32 + CAN Transceiver (e.g., SN65HVD230)
 */

// CAN Pins (adjust based on your wiring)
#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4

// Serial communication with Flipper Zero
#define FLIPPER_SERIAL Serial
#define BAUD_RATE 115200

CanFrame rx_frame;

void setup() {
  FLIPPER_SERIAL.begin(BAUD_RATE);
  
  // Initialize TWAI (CAN) driver
  // Defaulting to 500kbps (common for automotive)
  if (ESP32Can.begin(CAN_500KBPS, CAN_TX_PIN, CAN_RX_PIN)) {
    FLIPPER_SERIAL.println("CAN_INIT_OK");
  } else {
    FLIPPER_SERIAL.println("CAN_INIT_FAIL");
  }
}

void loop() {
  // 1. Sniffing: Receive from CAN and send to Flipper
  if (ESP32Can.readFrame(rx_frame, 0)) {
    FLIPPER_SERIAL.print("CAN_RX:");
    FLIPPER_SERIAL.print(rx_frame.identifier, HEX);
    FLIPPER_SERIAL.print(":");
    FLIPPER_SERIAL.print(rx_frame.data_length_code);
    FLIPPER_SERIAL.print(":");
    for (int i = 0; i < rx_frame.data_length_code; i++) {
      if (rx_frame.data[i] < 0x10) FLIPPER_SERIAL.print("0");
      FLIPPER_SERIAL.print(rx_frame.data[i], HEX);
    }
    FLIPPER_SERIAL.println();
  }

  // 2. Injection: Receive from Flipper and send to CAN
  if (FLIPPER_SERIAL.available()) {
    String cmd = FLIPPER_SERIAL.readStringUntil('\n');
    if (cmd.startsWith("CAN_TX:")) {
      // Format: CAN_TX:ID:DLC:DATA_HEX
      // Example: CAN_TX:123:8:AABBCCDD11223344
      int firstColon = cmd.indexOf(':');
      int secondColon = cmd.indexOf(':', firstColon + 1);
      int thirdColon = cmd.indexOf(':', secondColon + 1);

      if (firstColon != -1 && secondColon != -1 && thirdColon != -1) {
        uint32_t id = strtoul(cmd.substring(firstColon + 1, secondColon).c_str(), NULL, 16);
        uint8_t dlc = cmd.substring(secondColon + 1, thirdColon).toInt();
        String dataHex = cmd.substring(thirdColon + 1);

        CanFrame tx_frame;
        tx_frame.identifier = id;
        tx_frame.data_length_code = dlc;
        for (int i = 0; i < dlc; i++) {
          String byteHex = dataHex.substring(i * 2, i * 2 + 2);
          tx_frame.data[i] = (uint8_t)strtol(byteHex.c_str(), NULL, 16);
        }

        if (ESP32Can.writeFrame(tx_frame)) {
          FLIPPER_SERIAL.println("CAN_TX_OK");
        } else {
          FLIPPER_SERIAL.println("CAN_TX_FAIL");
        }
      }
    }
  }
}
