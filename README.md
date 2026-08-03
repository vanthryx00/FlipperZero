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

Run before every sync:

```powershell
python "$env:USERPROFILE\FlipperZero\scripts\verify_flipper_files.py"
```

Exit `0` = clean, `1` = at least one file has missing required keys,
`>1` = invocation error. `--strict` returns non-zero on soft warnings too.

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
  bytes, and a sane carrier frequency
- `badusb/*.txt` → DuckyScript: `ID VID:PID` line format, integer
  arguments for `DELAY`/`REPEAT`-style commands, non-empty `STRING`
  arguments, and command-token typos

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

#### `subghz\\Template_433_RAW.sub`
A structurally complete 433.92 MHz AM RAW SubGhz file with the header
filled in (`Filetype` / `Version` / `Frequency` / `Preset` / `Protocol: RAW`)
and a real, loadable `RAW_Data` timing stream (a synthesized
EV1527-style test frame, 99 alternating pulse/gap values). It plays out
of the box as a generic test signal, but it is NOT a replay of any
specific device — to control your own hardware, capture the real signal
on the Flipper and paste its timing line over `RAW_Data`.

#### `nfc\\Mifare_Classic_1k_Template.nfc`
Structural Mifare Classic 1K tag for emulation testing. The UID is
deliberately `04 DE AD BE` (4-byte single-size) with the correct
Block Check Character (BCC = `C9` from XOR(0x04, 0xDE, 0xAD, 0xBE)).
This file CANNOT impersonate any real contactless card — useful for
proving the Flipper's NFC emulator + a third-party reader handshake
works without ABUsing access control on someone else's door.

`ATQA + SAK` match the real Mifare Classic 1K family signatures so the
Flipper enumerates the file as a Mifare Classic card without complaint.

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

Before any sync, run both the header validator and the data tests:

```powershell
python "$env:USERPROFILE\FlipperZero\scripts\verify_flipper_files.py"
# [OK] Scanning: C:\Users\bugre\FlipperZero
#   [OK  ] ...\badusb\Launch_BugReaperX_HUD.txt
#   [OK  ] ...\badusb\Vanthryx_Panic_Lock.txt
#   [OK  ] ...\infrared\Meeting_Room_Deflector.ir
#   [OK  ] ...\lfrfid\Audit_Trigger_Badge.rfid
#   [OK  ] ...\nfc\Mifare_Classic_1k_Template.nfc
#   [OK  ] ...\subghz\Template_433_RAW.sub
# [OK]   workspace is syncable.

python "$env:USERPROFILE\FlipperZero\scripts\test_flipper_payloads.py"
#   [OK  ] subghz\Template_433_RAW.sub  (99 timings)
#   [OK  ] nfc\Mifare_Classic_1k_Template.nfc  (64 blocks)
#   [OK  ] infrared\Meeting_Room_Deflector.ir  (3 records)
# [OK]   all payload data checks passed.
```

Then plug the Flipper in (USB MSD mode) and sync:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\FlipperZero\flipper-sync.ps1"
```

The script will print, e.g.:

```
Flipper Zero detected on D:\.
Copying 6 files into D:\badusb\
Copying 1 file  into D:\infrared\
Copying 1 file  into D:\lfrfid\
Copying 1 file  into D:\nfc\
Copying 1 file  into D:\subghz\
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

# 2. Always run the validator BEFORE syncing -- catches missing
#    Filetype / Frequency / Key headers cheaply on the PC instead of
#    after they silently fail to load on the Flipper
python "$env:USERPROFILE\FlipperZero\scripts\verify_flipper_files.py"

# 3. Now flipper-sync will ferry them onto the device without surprises
```

The validator's exit code lets you wire it into a scheduled task or CI
hook if you ever want "every BadUSB payload I write gets a header check
before it can hit the device."

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
