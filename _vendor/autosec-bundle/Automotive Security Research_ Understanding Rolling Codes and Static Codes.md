# Automotive Security Research: Understanding Rolling Codes and Static Codes

This guide provides an overview of key concepts in automotive security, specifically focusing on the differences between static codes and rolling codes, and how tools like the Flipper Zero (with the AutoSec Tool) can be used for ethical, passive analysis.

## 1. Static Codes

**Static codes** are fixed, unchanging signals transmitted by a remote control (like an older car key fob) to perform an action (e.g., lock, unlock). When the button is pressed, the remote sends the same code every time. This simplicity makes them vulnerable to certain types of attacks.

### Vulnerabilities of Static Codes
*   **Replay Attacks**: An attacker can easily record a static code transmission and then 
replay it later to unlock or start a vehicle. This is a significant security flaw, as the recorded signal remains valid indefinitely.
*   **Code Grabbing**: Devices can capture the code when it's transmitted, allowing an attacker to use it later.

### Example of Static Code Systems
Older garage door openers, some basic alarm systems, and very old vehicle keyless entry systems often used static codes.

## 2. Rolling Codes (Hopping Codes)

**Rolling codes** are a security feature designed to prevent replay attacks. Instead of sending the same code every time, the remote and the receiver (e.g., in the car) use a synchronized algorithm to generate a new, unique code for each transmission. This code is typically a combination of a fixed component and a dynamic component (the 'rolling' part).

### How Rolling Codes Work
1.  **Synchronization**: Both the remote and the receiver maintain a shared secret key and a counter. Each time a button is pressed, the counter increments.
2.  **Code Generation**: The remote uses the secret key and the current counter value to generate a unique code.
3.  **Transmission**: The remote transmits this new code.
4.  **Reception and Validation**: The receiver, using its own secret key and counter, generates the expected next code. If the received code matches the expected code (or one within a small window, to account for multiple button presses out of range), the command is executed, and the receiver's counter is updated.
5.  **Invalidation**: Once a code is used, it becomes invalid. If an attacker records and replays an old code, the receiver will reject it because its internal counter has advanced.

### Vulnerabilities and Challenges with Rolling Codes
While significantly more secure than static codes, rolling codes are not entirely invulnerable:
*   **Code Grabber with Jamming**: Some advanced attacks involve jamming the legitimate signal while simultaneously grabbing the transmitted rolling code. The user presses the button again, transmitting a new code, which the attacker also grabs. The attacker then replays the *first* grabbed code (which the car now accepts, as it's within the rolling code window), and keeps the second, newer code for future unauthorized access.
*   **Desynchronization**: If the remote is pressed too many times out of range, the remote's counter can advance too far beyond the receiver's counter, leading to desynchronization. Modern systems often have mechanisms to resynchronize, but it can be an inconvenience.

## 3. Ethical Research with the AutoSec Tool

The **AutoSec Tool** for Flipper Zero is designed for **passive observation** and **data logging**. It can be used to:

*   **Identify Frequencies and Modulations**: Determine the operating frequency (e.g., 433.92 MHz) and modulation type (e.g., OOK, FSK) used by a vehicle's key fob.
*   **Capture Raw Signal Data**: Record the raw radio signals transmitted by a key fob. This data can then be analyzed offline to understand the structure of the transmitted codes.
*   **Study Rolling Code Mechanisms**: By capturing multiple transmissions from a rolling code system, researchers can observe how the codes change over time. This helps in understanding the underlying algorithm (if it's known or can be reverse-engineered) and identifying potential weaknesses in its implementation.

**Important Note**: The AutoSec Tool does **not** transmit signals. It is a receiver and logger only. Therefore, it cannot be used to perform replay attacks or to interact with a vehicle's systems. Its purpose is purely for analysis and understanding, which is a critical first step in ethical security research.

### Why Direct Vehicle Control is Not Possible with This Tool
Attempting to start or turn off a vehicle using only passively logged signals from a modern system is generally not possible due to rolling codes. Even if you capture a signal, replaying it will likely fail because the vehicle's receiver will expect a different, new code. The complexity of modern automotive security systems, often involving multiple layers of encryption and authentication, further prevents simple signal replay from granting control.

This tool empowers you to understand these complex systems through observation, fostering knowledge and responsible disclosure of vulnerabilities, rather than enabling unauthorized actions.

## References
[1] [Flipper Zero — Portable Multi-tool Device for Geeks](https://flipper.net/)
[2] [Sub-GHz · jamisonderek/flipper-zero-tutorials Wiki](https://github.com/jamisonderek/flipper-zero-tutorials/wiki/Sub-GHz)
[3] [Frequencies - Flipper Zero Documentation](https://docs.flipper.net/zero/sub-ghz/frequencies)
