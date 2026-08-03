# Flipper Zero — Workspace

> A single folder containing everything on this Windows machine that touches
> Flipper Zero, aligned with the Flipper SD-card layout so any `.sub` / `.ir`
> / `.fap` / `.nfc` / `.rfid` you drop here is ready to copy off to a plugged-in
> device.

## Layout

```
FlipperZero\
├── apps\        ← Flipper Application Packages (.fap) — extends the firmware UI
├── badusb\      ← BadUSB payload scripts (.txt) — Ducky-style keyboard injection
├── infrared\    ← Universal Remote files (.ir) — TV remotes, ACs, projectors
├── subghz\      ← Sub-GHz radio files (.sub) — garage doors, sensors, gates
├── nfc\         ← NFC tag dumps / emulation .nfc files
├── lfrfid\      ← Low-Frequency RFID .rfid files (EM4100, HID Prox)
├── ibutton\     ← iButton (1-Wire) keys
├── u2f\         ← U2F / FIDO2 credentials
├── dolphin\     ← Dolphin animation / level assets
├── settings\    ← system_settings.txt + favorite metadata
├── scripts\     ← PC-side validator + helpers (NOT pushed to the device)
├── _vendor\     ← saved state from the qFlipper vendor app (do NOT edit)
└── flipper-sync.{ps1,cmd}  ← drop everything onto a plugged-in device
```

Anything under `scripts\` is PC-only — the sync script only walks the
canonical Flipper subdirs, so PC helpers stay on this machine.

Drop a file into the matching subdir and run **`.\\flipper-sync.cmd`**. The
script scans every removable drive for the two canonical Flipper folders
(`apps\\` and `subghz\\`). When it finds them, it rsync's this whole folder
onto the device.

## Dope Code Index

This workspace ships a small, opinionated set of reference files and helpers
so the user has something real to push on day one instead of an empty
folder skeleton. Listed in priority order across two batches.

### Batch 1: integration anchors

#### `badusb\\Launch_BugReaperX_HUD.txt`
DuckyScript 1.0 payload. When the Flipper is plugged into a Windows PC
that already has BugReaperX installed (default port 7777), this payload
opens `http://127.0.0.1:7777` in the default browser via `Win+R ->
cmd /c start <URL>`. The cross-system integration anchor: physical
Flipper plug-in → dashboard opens automatically.

**Authorized target only**: the operator's own machine. Wrong target =
keyboard-injection on someone else's box; the file's header comment makes
this explicit.

#### `scripts\\verify_flipper_files.py`
Pre-sync validator (Python 3, stdlib only, zero deps). Walks every
canonical Flipper subdir, parses each payload's `Key: Value` header
lines, and:

- Requires `Filetype` / `Version` / `Frequency` / `Preset` for `.sub`
- Requires `Filetype` / `Version` / `Device Type` for `.nfc`; Mifare
  Classic files must also carry `Mifare Classic type` (1K/4K) and
  `Data format version: 1` (modern firmware refuses to load without them)
- Requires `Filetype` / `Version` / `Name` / `Type` for `.ir` (case-insensitive);
  parsed NEC records must use the modern 4-byte `address:` / `command:`
  fields (the old 2-byte form no longer loads)
- Requires `Filetype` / `Version` / `Frequency` / `Key type` for `.rfid`
  with the modern lowercase `Key type:` casing
- Requires `Filetype` / `Version` for `.ibutton`
- For BadUSB `.txt`: ensures first non-blank line is `ID`, `REM`, or
  `DEFAULT_DELAY`; surfaces unrecognized command tokens so a typo doesn't
  silently behave as NOP on the device

Case-insensitive: SubGhz / NFC / RFID / iButton use TitleCase keys,
IR uses lowercase `name:` / `type:`. Both styles pass. One exception:
`Key type:` casing is enforced exactly, because the firmware's key lookup
is case-sensitive (legacy `Key Type:` files fail to load).

Run automatically by `flipper-sync.ps1` before every sync (and manually
as a pre-flight):

```powershell
python "$env:USERPROFILE\FlipperZero\scripts\verify_flipper_files.py"
```

Exit `0` = clean, `1` = at least one file has missing required keys,
`>1` = invocation error. `--strict` returns non-zero on soft warnings
too. `flipper-sync.ps1` exits `3` if this check or the data tests fail.

#### `scripts\test_flipper_payloads.py`
Data-level test runner (Python 3, stdlib only). Complements the header
validator by checking the *contents* of the payload files:

- `subghz/*.sub` → the `RAW_Data` timing stream is a valid OOK envelope
  (integers, strictly alternating pulse/gap, first and last value
  positive, no zero-length timings)
- `nfc/*.nfc` → Mifare Classic dumps: all 64 (1K) / 256 (4K) blocks
  present, 16 bytes each, block-0 UID matches the `UID:` header, BCC byte
  equals XOR of the UID bytes, SAK/ATQA consistency, sane sector trailers
- `infrared/*.ir` → parsed records: `address:` / `command:` are hex byte
  fields with the protocol-correct width (NEC = 4 bytes each)
- `lfrfid/*.rfid` → EM4100 keys: exactly 5 bytes (the 40-bit ID), hex
  bytes, a sane carrier frequency, and a full **on-wire frame rebuild** —
  the 64-bit frame (9-bit header, 10× nibble+row-parity groups, column
  parity, stop bit) is reconstructed from the 5 stored bytes and verified
  against the EM4100 spec
- `badusb/*.txt` → DuckyScript: `ID VID:PID` line format, integer
  arguments for `DELAY`/`REPEAT`-style commands, non-empty
  `STRING`/`ALTSTRING` arguments, integer `ALTCHAR` alt-codes, and
  script-structure warnings (missing `ID` first line, bare `GUI`/`CTRL`-
  style modifiers, `REPEAT` with nothing to repeat or a zero count, args
  to `WAIT_FOR_BUTTON_PRESS`), plus command-token typos

```powershell
python "$env:USERPROFILE\FlipperZero\scripts\test_flipper_payloads.py"
python "$env:USERPROFILE\FlipperZero\scripts\test_flipper_payloads.py" --selftest
```

Example output on the shipped workspace:

```
  [OK  ] subghz\Template_433_RAW.sub      (99 timings)
  [OK  ] nfc\Mifare_Classic_1k_Template.nfc  (64 blocks)
  [OK  ] infrared\Meeting_Room_Deflector.ir  (3 records)
  [OK  ] lfrfid\Audit_Trigger_Badge.rfid    (EM4100)
  [OK  ] badusb\Launch_BugReaperX_HUD.txt   (5 lines)
  [OK  ] badusb\Vanthryx_Panic_Lock.txt     (6 lines)
[OK]   all payload data checks passed.
```

`--selftest` verifies the checkers themselves against known-good and
known-bad samples, so the test is trustworthy before it's used to judge
your payloads.

A GitHub Actions workflow (`.github/workflows/validate.yml`) runs the
header validator, the data-test self-check, and the data tests on every
push and pull request — a broken payload turns the build red instead of
silently failing on a device later.

#### `subghz\\Template_*_RAW.sub` — vehicle frequency templates
Five structurally complete AM RAW SubGhz files, one per common vehicle
key-fob / remote-start band the Flipper's radio can actually tune
(300–928 MHz). Each has the header filled in (`Filetype` / `Version` /
`Frequency` / `Preset` / `Protocol: RAW`) and a real, loadable
`RAW_Data` timing stream (a synthesized EV1527-style test frame, 99
alternating pulse/gap values) so it opens and plays out of the box as a
generic test signal.

| File | Frequency | Typical vehicle use |
|---|---|---|
| `Template_315_RAW.sub` | 315.00 MHz | North America — most US-market fobs / remote starters |
| `Template_330_RAW.sub` | 330.00 MHz | GM (incl. OnStar-linked) and Chrysler fobs |
| `Template_390_RAW.sub` | 390.00 MHz | Ford-family fobs / remote starts |
| `Template_433_RAW.sub` | 433.92 MHz | EU standard band |
| `Template_868_RAW.sub` | 868.00 MHz | EU smart-entry (BMW, Mercedes, VW-group) |

These are **frequency references / test envelopes, not device clones**:
modern vehicle remotes use rolling-code (KEELOQ-style) protocols, so a
RAW replay of a single frame cannot clone them. To control your own
hardware, capture the real signal on the Flipper (`Sub-GHz → Read RAW`)
and paste its timing line over `RAW_Data` — and only test against
equipment you own and are authorized to operate.

#### `nfc\\Mifare_Classic_1k_Template.nfc`
Structural Mifare Classic 1K tag for emulation testing. The UID is
deliberately `04 DE AD BE` (4-byte single-size) with the correct
Block Check Character (BCC = `C9` from XOR(0x04, 0xDE, 0xAD, 0xBE)).
This file CANNOT impersonate any real contactless card — useful for
proving the Flipper's NFC emulator + a third-party reader handshake
works without ABUsing access control on someone else's door.

`ATQA + SAK` match the real Mifare Classic 1K family signatures so the
Flipper enumerates the file as a Mifare Classic card without complaint.

#### `infrared\\Camera_Shutter.ir`
A **real** camera IR capture — the Canon RC-6 wireless remote trigger
(shutter release), sourced verbatim from `Lucaslhm/Flipper-IRDB`
(`Cameras/Canon/Canon_RC-6_Trigger.ir`). Raw format (`type: raw`) with
a real 38 kHz timing line. Set the camera to IR remote-control mode,
point the Flipper at its receiver, and send `Trigger` to release the
shutter. Compatible with a wide range of Canon EOS bodies (full model
list is in the file). Unlike the synthesized placeholders elsewhere in
this workspace, this one is a genuine capture — still verify it against
your own camera before relying on it.

### Batch 2: Unleashed-flavoured utilities

Web-sourced patterns from `DarkFlippers/unleashed-firmware` and the wider
Unleashed ecosystem, each with a "twist" that ties into the BugReaperX /
Vanthryx cross-system wiring rather than being a straight copy.

#### `badusb\\Vanthryx_Panic_Lock.txt`
DuckyScript panic-button. Plug the Flipper into the workstation you are
logged into → on USB enumeration:

1. Drops a timestamped breadcrumb into BugReaperX logs at
   `%USERPROFILE%\BugReaperX_Supreme\logs\flipper_panic.log`
2. Triggers `Win+L` via `WINDOWS l` so the workstation locks.

**Twist vs. vanilla `Win+L`**: the breadcrumb lets BugReaperX correlate
panic-lock events with subsequent login attempts, session durations, and
any post-panic file modifications — purely defensive, logs are written
*inside* the user's profile, not exfiltrated.

#### `infrared\\Meeting_Room_Deflector.ir`
IR signal palette with three NEC-format entries (Mute / Display_Off /
Volume_Down_x3). Each `address:` and `command:` value is a **synthesized
placeholder**, NOT a captured remote button — the file ships with
explicit notes that you must verify against the actual A/V remote for
your hardware before relying on these in production.

**Twist vs. a vanilla IR capture**: this is a defensive "engage privacy
mode" palette. If BugReaperX or Vanthryx output accidentally gets cast
to a shared projector, broadcasting `Mute` + `Display_Off` against
nearby A/V gear silences the leak.

#### `lfrfid\\Audit_Trigger_Badge.rfid`
EM4100 RFID emulation with UID `DE AD BE EF CA` — a deliberately
impossible pattern (`DEADBEEF CA` cannot appear on a real EM4100 wafer).
The file CANNOT impersonate any access-control badge.

**Twist vs. a vanilla cloned credential**: when the Flipper emulates
this near an RFID reader, BugReaperX detects the impossible UID and
reports "Audit event: synthetic UID detected" — useful for validating
that an RFID-enabled workstation can detect emulated input at all, for
smoke-testing RFID log pipelines, and for pen-test verification that
the Flipper's RFID emulator is wired correctly.

## Workflow

`flipper-sync.ps1` runs **both validators automatically before every
sync** — the header check (`verify_flipper_files.py`) then the data
tests (`test_flipper_payloads.py`). If either fails, the sync aborts
(exit code `3`) without touching the device. Running them manually is
now optional, as a pre-flight:

```powershell
python "$env:USERPROFILE\FlipperZero\scripts\verify_flipper_files.py"
# [OK] Scanning: C:\Users\bugre\FlipperZero
#   [OK  ] ...\badusb\Launch_BugReaperX_HUD.txt
#   [OK  ] ...\badusb\Vanthryx_Panic_Lock.txt
#   [OK  ] ...\infrared\Camera_Shutter.ir
#   [OK  ] ...\infrared\Meeting_Room_Deflector.ir
#   [OK  ] ...\lfrfid\Audit_Trigger_Badge.rfid
#   [OK  ] ...\nfc\Mifare_Classic_1k_Template.nfc
#   [OK  ] ...\subghz\Template_315_RAW.sub
#   [OK  ] ...\subghz\Template_330_RAW.sub
#   [OK  ] ...\subghz\Template_390_RAW.sub
#   [OK  ] ...\subghz\Template_433_RAW.sub
#   [OK  ] ...\subghz\Template_868_RAW.sub
# [OK]   workspace is syncable.

python "$env:USERPROFILE\FlipperZero\scripts\test_flipper_payloads.py"
#   [OK  ] subghz\Template_315_RAW.sub  (99 timings)
#   [OK  ] subghz\Template_330_RAW.sub  (99 timings)
#   [OK  ] subghz\Template_390_RAW.sub  (99 timings)
#   [OK  ] subghz\Template_433_RAW.sub  (99 timings)
#   [OK  ] subghz\Template_868_RAW.sub  (99 timings)
#   [OK  ] nfc\Mifare_Classic_1k_Template.nfc  (64 blocks)
#   [OK  ] infrared\Camera_Shutter.ir  (1 record)
#   [OK  ] infrared\Meeting_Room_Deflector.ir  (3 records)
# [OK]   all payload data checks passed.
```

Then plug the Flipper in (USB MSD mode) and sync:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\FlipperZero\flipper-sync.ps1"
```

The script will print, e.g.:

```
=== Header validator (verify_flipper_files.py) ===
[OK]   workspace is syncable.

=== Data tests (test_flipper_payloads.py) ===
[OK]   all payload data checks passed.

Workspace validators passed.

Flipper Zero detected on D:\.
Copying 2 files into D:\badusb\
Copying 2 files into D:\infrared\
Copying 1 file  into D:\lfrfid\
Copying 1 file  into D:\nfc\
Copying 5 files into D:\subghz\
Done. Unplug and reboot the Flipper to pick up your files.
```

## What's in `_vendor\\`

| File | Origin |
|---|---|
| `qFlipper.ini` | `%APPDATA%\\Flipper Devices Inc\\qFlipper.ini` (vendor app config) |
| `logs\\qFlipper-20260530-*.txt` | `%LOCALAPPDATA%\\qFlipper\\` (qFlipper update logs) |

qFlipper is the official cross-platform firmware updater. We keep its
config + logs for diagnostics so you can answer "did the previous flash
succeed?" without digging around `%APPDATA%`.

> _Note: the sync script skips any folder named `_vendor` at **any depth**,
> not just the workspace root. So if you (or a tool) ever creates
> `apps\\_vendor\\` or `subghz\\_vendor\\`, that subtree is automatically
> excluded from the device push. Don't put real Flipper content in any
> `_vendor` folder — name it `_internal` or similar if you want a private
> stash that still gets pushed._

## Syncing onto a device

Plug the Flipper Zero in via USB. Windows mounts it as a removable drive
whose root contains the same folder structure as above (without
`_vendor\\` and `scripts\\`). Then run one of:

```powershell
# PowerShell (preferred; supports file locks better)
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\FlipperZero\flipper-sync.ps1"

# or command prompt
%USERPROFILE%\FlipperZero\flipper-sync.cmd
```

If the Flipper isn't detected, you'll see a yellow warning — make sure
you're in **USB MSD mode** (the Flipper's `Settings → USB` menu), not
**USB CDC mode** (the latter exposes only a serial port, no SD card).

## Syncing firmware updates

The "Flash options" the device exposes on its `Settings → About` menu are
handled by qFlipper itself. To change the firmware channel (Official,
Unleashed, Momentum, Xtreme, etc.) you'll still want to use the qFlipper
GUI. This workspace's `_vendor\\` keeps the qFlipper config so its
current "flash options" choix isn't lost.

## Adding custom payloads without a device present

Just drop them in, then validate, then sync:

```powershell
# 1. Drop the file in the matching subdir
iwr https://example.com/garage.sub -OutFile "$env:USERPROFILE\FlipperZero\subghz\garage.sub"

# 2. Validate the payload -- flipper-sync.ps1 now does this
#    automatically before every sync, but it's cheaper to catch a
#    missing Filetype / Frequency / Key header here than mid-sync
python "$env:USERPROFILE\FlipperZero\scripts\verify_flipper_files.py"

# 3. Now flipper-sync will re-validate and ferry them onto the device
#    without surprises
```

The validator's exit code lets you wire it into a scheduled task or CI
hook if you ever want "every BadUSB payload I write gets a header check
before it can hit the device."

## ESP32 devboard: Wi-Fi/BLE testing (Marauder-style)

The Flipper Zero has **no Wi-Fi or Bluetooth radio of its own**. An ESP32
devboard plugged into its GPIO header turns it into a portable Wi-Fi/BLE
testing rig, with the Flipper acting as the screen and controller.

### Hardware

- **Official Flipper Zero WiFi Dev Board** — plugs straight into the 2×8
  GPIO header on the Flipper's top edge; no wiring.
- **Generic ESP32 devkit** (WROOM-32 / WROVER) — wire `3V3` + `GND`, and
  cross `TX ↔ RX` to the Flipper's UART pins (**13 = TX, 14 = RX** on the
  GPIO header).
- **Optional microSD** on the devboard so Marauder can save captured
  traffic as PCAP files (SPI: `VCC→3V3`, `GND→GND`, `DI→IO35`, `DO→IO37`,
  `SCK→IO36`, `CS→IO10`).

### Firmware

1. **Flash the ESP32** with the Marauder firmware
   (`justcallmekoko/ESP32Marauder`). Easiest routes: the web installer
   (Spacehuhn web flasher), **FZ Marauder Flasher**, or
   **FZEasyMarauderFlash**; build from source if you want customisation.
2. **Get the Flipper-side UI** — the **"WiFi Marauder" app (by
   0xchocolate)** ships prebuilt in the popular custom firmwares:
   **Momentum** (recommended), Unleashed, Xtreme, RogueMaster. On stock
   firmware, install it from the Flipper app catalog instead.
3. **Plug the devboard in and launch** the app. The Flipper is just the
   serial UI — all radio work happens on the ESP32.

### Typical test run (against your OWN network)

- `Scan APs` / `Scan stations` → inventory the 2.4 GHz airspace.
- `Deauth flood` on your own AP → verify clients re-associate and
  recovery is automatic (a resilience test).
- `EAPOL / PMKID scan` → capture a handshake from your own WPA2 network
  and crack it offline on a PC (aircrack-ng / hashcat) to test password
  strength.
- `Packet monitor` / PCAP capture → save traffic to the devboard's SD
  card for analysis.
- Bluetooth: BLE sniffing, card-skimmer detection, Airtag sniff.
- Lab-only extras (keep them in your lab): beacon spam, evil portal,
  karma, AP-clone spam.

### Legal line

- **Authorized targets only**: your own router/AP and devices, or
  networks you have written permission to test.
- Deauth floods, beacon spam, and evil portals are intrusive and
  detectable. Using them on anyone else's network violates computer-crime
  law (US CFAA and state statutes, and equivalents elsewhere).
- Radio traffic bleeds into shared airspace, so keep attacks confined to
  a controlled setting and your own equipment.
- This is a testing rig, **not a general vulnerability scanner** —
  finding software CVEs is PC work (nmap / OpenVAS).

## Honest limits

- No Flipper device plugged in = sync script falls through with a warning.
- ADB / wireless / Bluetooth transports are **not** supported (Flipper Zero
  is USB-only). The folder only knows about MSD mounts.
- Custom firmware channels (Unleashed, Momentum, etc.) ship in their own
  firmware ZIP from their respective communities. Drop the .dfu into
  `_vendor\\firmware\\` and qFlipper will see it as a custom update.
- The validator is structural-only. It does not analyze signal content,
  replay safety, or RF legality — those reviews are the operator's job.
- IR codes in `Meeting_Room_Deflector.ir` are synthesized placeholders,
  not real captures. Verify against your actual A/V remote before
  relying on them in production.
- The `Audit_Trigger_Badge.rfid` UID is a synthetic `DEADBEEF` marker that
  cannot impersonate any real badge — that's a deliberate defense, not
  a limitation.

## Honest limits: cameras, traffic lights, vulnerability scanning

Three topics that come up constantly around a Flipper Zero, and the honest
version of what the device can and cannot do.

### Cameras

- The Flipper Zero has **no camera and no Wi-Fi/ethernet** — it cannot
  access, scan, or break into IP/security cameras. That is PC-tool
  territory (nmap / Shodan-style recon), and accessing cameras you don't
  own is illegal without authorization.
- What legitimately *does* exist: **IR camera remotes** (real captured
  `.ir` files — see `Camera_Shutter.ir`, the Canon RC-6 shutter release)
  and **RF-based hidden-camera detection** via an ESP32 add-on board
  (defensive: it finds transmitting devices; it does not break into
  them).

### Traffic lights

- The viral "Flipper changes traffic lights" is **IR traffic-signal
  preemption** (OptiCom/MIRT-style), not radio: the internal Sub-GHz
  radio does nothing here, and the internal IR blaster is too weak — the
  real rigs drive an *external* high-power IR LED array over GPIO at
  ~14 Hz to fool legacy optical receivers on signal masts.
- It is a **federal crime in the US** (18 U.S.C. § 39 — unauthorized
  preemption use: fines up to $100k, prison) and a criminal offense in
  the EU (e.g. Germany's StGB § 316b). Emergency/transit agencies hold
  narrow legal exceptions.
- **Modern intersections won't respond anyway** — they use encoded IDs,
  GPS/cellular/DSRC, and log every preemption attempt. So it's
  simultaneously illegal, obsolete, and recorded.
- Nothing like it ships in this workspace, and it won't be added.

### Vulnerability scanning

- The Flipper is an **RF/radio tool, not a general vulnerability
  scanner**. Its built-in scanners hunt *signal types and raw
  credentials* — SubGHz signal scanner, RFID/NFC/iButton sniffers —
  which is exactly what the payload files in this workspace exercise.
- **Wi-Fi/BLE reconnaissance** requires an ESP32 devboard (Wi-Fi
  scanning, packet capture, deauth-style testing) and is only legitimate
  against networks you own — see the ESP32 devboard section above.
- **Software vulnerability scanning** (nmap, nikto, OpenVAS, etc.) is PC
  territory; the Flipper has no role in it.
