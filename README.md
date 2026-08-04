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
folder skeleton. Listed in priority order across three batches.

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

### Batch 3: canonical folder completion

Every canonical SD folder in the layout at the top now ships with at least a
documented starter. The three folders that can only be filled by real
hardware or firmware ship a `README.md` instead of a fake file.

#### `ibutton\\Audit_Trigger_Key.ibutton`
Synthesized **DS1990** (Dallas 1-Wire) test key. The `DE AD BE EF` serial
pattern cannot appear on a real iButton wafer, so it CANNOT impersonate any
real key — but the ROM is structurally valid (family code `01`, correct
CRC-8/MAXIM byte `8E` computed over the first 7 bytes), so the Flipper's
iButton app and a reader handshake can be smoke-tested end-to-end without
touching a real credential.

#### `settings\\system_settings.txt`
A *documented placeholder*, not active config. On current (development-
channel) firmware, Settings → System values are stored in the MCU RTC and
per-app SD settings are binary saved-struct files the device writes itself
— there is no hand-authored `system_settings.txt` on modern builds. The
legacy `system.rpc` / `system.lcd_*` text keys are listed as commented
reference only. Change settings in the device UI; don't sync hand-written
settings over the device's own files.

#### `apps\\`, `dolphin\\`, `u2f\\`
Compiled `.fap` binaries, the generated `.dolphin.state` (hidden file), and
the on-device `key.u2f` file cannot be synthesized on a PC. Each folder
ships a `README.md` explaining how to populate it correctly (app catalog /
qFlipper for FAPs, firmware-bundled animation packs, on-device U2F
registration).

#### Full payload inventory

| Folder | File | What it is |
|---|---|---|
| `badusb` | `Launch_BugReaperX_HUD.txt` | opens the local BugReaperX dashboard on plug-in (authorized target only) |
| `badusb` | `Vanthryx_Panic_Lock.txt` | BugReaperX breadcrumb + `Win+L` panic lock |
| `badusb` | `Drop_GlottalStop_Dropper.txt` | drops the on-machine auto-recorder into `%TEMP%` and runs it silently (operator's own machine only) |
| `badusb` | `Hacker_Typer.txt` | harmless "movie hacker" typer — `geektyper.com/plain` (UberGuidoZ) |
| `badusb` | `RickRoll_CMD_Win.txt` | `ascii.live/rick` in a maximized CMD window (UberGuidoZ) |
| `infrared` | `Camera_Shutter.ir` | real Canon RC-6 shutter-release capture (IRDB) |
| `infrared` | `Daikin_AC.ir` | real Daikin AC capture (power / swing) |
| `infrared` | `Epson_Projector_Power.ir` | real Epson projector power capture |
| `infrared` | `Nikon_Camera.ir` | real Nikon camera remote capture |
| `infrared` | `Sony_Handycam_RMT814.ir` | real Sony RMT-814 Handycam capture |
| `infrared` | `Universal_Power_Off.ir` | multi-brand (Samsung/Grundig/LG) power-off palette |
| `infrared` | `AI_LG_TV_Power.ir` | LLM-synthesized LG TV power toggle (unverified) |
| `infrared` | `AI_Roku_Home_OK.ir` | LLM-synthesized Roku Home/OK (unverified) |
| `infrared` | `AI_Samsung_Volume.ir` | LLM-synthesized Samsung volume-up (unverified) |
| `infrared` | `Meeting_Room_Deflector.ir` | synthesized privacy palette (Mute/Display_Off/Volume_Down) |
| `subghz` | `Template_{315,330,390,433,868}_RAW.sub` | frequency-reference RAW test envelopes |
| `subghz` | `AI_433_Gate_Remote.sub` | LLM-synthesized 433 MHz gate remote (unverified) |
| `subghz` | `Byron_DB421E_Doorbell.sub` | real Byron doorbell capture |
| `subghz` | `Chacon_54647TX_Outlet_On.sub` | real Chacon 54647TX outlet capture (keyed protocol) |
| `subghz` | `Tesla_Charge_Port_433_AM650.sub` | real Tesla charge-port opener capture |
| `lfrfid` | `Audit_Trigger_Badge.rfid` | impossible `DEADBEEF` EM4100 badge — audit marker |
| `lfrfid` | `AI_HID_Prox_37bit.rfid` | LLM-synthesized HID Prox 37-bit (unverified) |
| `lfrfid` | `AI_Indala_Prox.rfid` | LLM-synthesized Indala Prox (unverified) |
| `lfrfid` | `AI_T5577_Emulation.rfid` | LLM-synthesized T5577 emulation (unverified) |
| `nfc` | `Mifare_Classic_1k_Template.nfc` | structural Mifare Classic 1K test tag (BCC-valid) |
| `nfc` | `Empty_NTAG213.nfc` / `Empty_NTAG216.nfc` | blank NTAG templates |
| `ibutton` | `Audit_Trigger_Key.ibutton` | impossible `DEADBEEF` DS1990 test key (CRC-valid) |

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

## Agentic workflow: durable state + retrieval (MongoDB Atlas)

`agentic/` is a small, dependency-free agent orchestration engine whose runs
and artifacts are persisted as complex nested documents — locally by default,
and in MongoDB Atlas when you point it at a cluster.

```
validate -> curate -> sync-plan -> report   (the "pipeline" workflow)
```

- **validate** — runs both payload validators (header check + data tests);
  fail-fast, so broken payloads abort the pipeline before anything else.
- **curate** — walks every canonical SD folder and indexes each payload's
  headers, attribution, honest-limits notes, and a search blob (+ embedding)
  into `payloads` documents keyed by file SHA-256.
- **sync-plan** — previews and *audits* exactly what `flipper-sync.ps1`
  would push to a plugged-in device, flagging PC-only content (e.g. `.github/`)
  that the sync script's skip list would currently copy anyway.
- **report** — aggregates the curated state (payloads by kind, recent runs).

### Quickstart (zero dependencies — works right now)

No Atlas, no pymongo, no install needed: state falls back to JSON files in
`agentic/_local_state/` (gitignored).

```powershell
python -m agentic run pipeline     # validate -> curate -> sync-plan -> report
python -m agentic runs             # list workflow runs
python -m agentic show <RUN_ID>    # inspect a run's steps + outputs
python -m agentic search "tesla"   # keyword search over curated payloads
python -m agentic vector "camera"  # vector similarity search
python -m agentic doctor           # backend health + counts
```

Self-test (verifies pipeline, search, vector search, and resume-after-failure):

```powershell
python scripts/test_agentic_workflow.py
```

### Moving to MongoDB Atlas (durable cloud state)

1. Create a free **M0** cluster at https://www.mongodb.com/cloud/atlas
2. **Database Access** → add a database user (read/write)
3. **Network Access** → allow your IP (or `0.0.0.0/0` for dev)
4. **Connect → Drivers** → copy the connection string into `.env` as
   `MONGODB_URI` (see `.env.example`), then `pip install -r requirements.txt`
5. `python -m agentic indexes` — creates the standard indexes + Atlas
   Search/Vector Search indexes
6. `python -m agentic run pipeline` — runs now persist to Atlas; every
   command above works identically

### Honest limits

- **Keyword search (`search`)** uses a regular MongoDB text index on
  `search_text` — works on the **free M0 tier**.
- **Vector search (`vector`)** uses Atlas Vector Search (`$vectorSearch`),
  which **requires an M10+ dedicated tier** — on M0 it reports a clear error.
  The local FileStore implements the same interface with brute-force cosine
  similarity, so the workflow is fully testable before you spend anything.
- **Embeddings**: the default `feature-hash` embedder is zero-dependency but
  *keyword-ish, not semantic* — same vocabulary ⇒ similar vectors. Set
  `OPENAI_API_KEY` (+ `pip install openai`) for real semantic embeddings;
  `get_embedder()` picks the OpenAI embedder automatically.
- **Durable ≠ backup**: Atlas persists runs/artifacts, but this repo's
  payload files remain the source of truth — the store is derived state.

## Developer intelligence: delivery metrics + AI adoption

Two complementary layers — a self-hosted dev-intel module inside `agentic/`
for **this repo**, and a SaaS platform for **team/org-wide** tracking.

### Self-hosted: the `devintel` workflow (agentic/)

```powershell
python -m agentic devintel         # collect git metrics + AI adoption, snapshot, show trend
python -m agentic devintel-trend   # retrieve the stored adoption curve
```

Runs three agents (`collect-git → snapshot → devintel-report`) and persists
one document per UTC day into `devintel_snapshots` (MongoDB Atlas or the
local FileStore fallback), so the adoption trend accumulates over time:

- **Delivery**: commit count, commits/day, files changed, lines added/
  deleted, per-author spread.
- **AI adoption**: heuristic detection of AI-assisted commits via trailers
  (`Co-authored-by: ... Copilot`) and body markers (`Generated with Claude`,
  `ai-generated`, …), with a per-tool breakdown.

Honest limits (also stored in the snapshot, not just here):
- AI detection is **heuristic on commit text** — it cannot see the author's
  editor. A 0% reading means *no AI markers*, not *no AI was used*.
- Delivery metrics are **git-only** (no PR/Jira/CI in this workspace), so
  cycle time is approximated from commit timestamps.

Self-test coverage: `python scripts/test_agentic_workflow.py` runs the
`devintel` workflow and checks snapshot idempotency.

### SaaS: software engineering intelligence platforms

If you want org-wide delivery acceleration + AI-adoption ROI (many repos,
PR/issue/CI data), the researched shortlist is:

| Platform | AI adoption | Delivery acceleration | Pricing reality |
|---|---|---|---|
| **LinearB** (recommended) | 50+ AI tools (Copilot/Cursor/Claude Code), AI↔metrics correlation | DORA + gitStream PR automation, WorkerB bots | Free tier for small teams; paid scales per-seat/credits |
| **Swarmia** | AI-assisted PR measurement, cycle-time deltas | DORA/SPACE + DevEx surveys + Signals | ~$280–430/developer/yr |
| **Jellyfish** | AI Impact module | DORA dashboards (mostly retrospective) | Enterprise quote (~$20–50/dev/mo est.) |
| **Faros AI** | Raw AI telemetry, token-level ROI | Enterprise data graph | Enterprise only |
| **DX (getdx)** | DX AI module | TrueThroughput™ | Enterprise |
| **Allstacks** | AI impact + AI-ready spec governance | Predictive delivery forecasting | Enterprise |
| **Uplevel** | Full-SDLC AI adoption correlation | Leading indicators, GearUp sprints | Enterprise |

**Why LinearB for the org-wide case:** it is the only one combining
*delivery acceleration* (DORA + gitStream policy-as-code PR automation) with
the broadest *AI-adoption tracking* (50+ tools), and it has a free tier —
unlike the enterprise-only options. The dev-intel workflow in `agentic/`
complements it: LinearB covers the org, `devintel` covers this repo with
zero external dependencies and the same data living in your Atlas store.

## Flipper AI toolkit: LLM-powered payload generation, analysis, and fixing

`agentic/agents/flipper_ai.py` adds an AI layer that can **generate**,
**analyze**, and **fix** Flipper Zero payloads using any OpenAI-compatible
LLM — including Ornith-1.0-35B (the uncensored agentic-coding model), OpenAI
GPT-4, or a local Ollama server.

```
generate-badusb  →  BadUSB script from a natural-language description
analyze          →  explain what a payload does step-by-step
generate-ir      →  IR signal file from a device description
generate-subghz  →  SubGHz RAW file from a device description (garage door, sensor, etc.)
generate-rfid    →  RFID emulation file from an LF badge description (EM4100, HID Prox, etc.)
generate-nfc     →  NFC emulation file from a card description (Mifare Classic, NTAG, etc.)
fix              →  spot issues and output a corrected payload
chat             →  raw prompt — useful for any Flipper topic
```

### Quickstart

```powershell
# Generate a BadUSB script
python -m agentic flipper-ai generate-badusb "open notepad and type 'Hello from Flipper!'"

# Explain what a payload does
python -m agentic flipper-ai analyze badusb/Hacker_Typer.txt

# Generate an IR signal for a device
python -m agentic flipper-ai generate-ir "Samsung TV power toggle, NEC protocol"

# Generate a SubGHz RAW file (garage door, sensor, etc.)
python -m agentic flipper-ai generate-subghz "315 MHz garage door opener" --output subghz/garage.sub

# Generate an RFID emulation file (EM4100, HID Prox, etc.)
python -m agentic flipper-ai generate-rfid "HID Prox 26-bit badge, facility 100" --key-type H10301

# Generate an NFC emulation file (Mifare Classic, NTAG, etc.)
python -m agentic flipper-ai generate-nfc "Mifare Classic 1K test card" --output nfc/test_mifare.nfc

# Fix a broken payload
python -m agentic flipper-ai fix badusb/my_script.txt --output badusb/my_script_fixed.txt

# Raw chat about any Flipper topic
python -m agentic flipper-ai chat "What SubGHz frequencies can the Flipper transmit on?"
```

### LLM backends

Configure via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `LLM_BASE_URL` | `http://localhost:8000/v1` | API base URL |
| `LLM_MODEL` | `ornith` | Model name to request |
| `LLM_API_KEY` | `not-needed` | API key (blank for local servers) |

> **Why `ornith`?** Ornith's vLLM serve command uses `--served-model-name ornith`,
> so `ornith` is what you put in API requests. If you rename it (e.g.
> `--served-model-name my-ornith`), set `LLM_MODEL=my-ornith`.

**Works with any OpenAI-compatible endpoint** — just point `LLM_BASE_URL` at it.

### Running with Ornith-1.0-35B (the recommended model)

Ornith is a 35B-parameter agentic-coding model, uncensored and SOTA for
code generation. It requires a beefy GPU (66 GB VRAM for BF16, or 24 GB
NVFP4 on Blackwell). Serve it via Docker + vLLM, then point the toolkit at it:

```powershell
# In WSL2 (Ubuntu), after downloading the model:
# See Ornith's QUICKSTART_DGX_SPARK.md or AGENTS.md for full setup
./serve_ornith.sh spark-dflash

# Then from this repo:
$env:LLM_BASE_URL = "http://localhost:8000/v1"
$env:LLM_MODEL = "ornith"
python -m agentic flipper-ai generate-badusb "..."
```

**No GPU?** Use a smaller model via Ollama (`ollama pull qwen2.5-coder:7b`,
then `$env:LLM_BASE_URL="http://localhost:11434/v1"`,
`$env:LLM_MODEL="qwen2.5-coder:7b"`), or use the OpenAI API
(`$env:LLM_BASE_URL="https://api.openai.com/v1"`,
`$env:LLM_API_KEY="sk-..."`, `$env:LLM_MODEL="gpt-4o"`).

### Zero-dependency LLM client

The LLM client (`agentic/llm_client.py`) uses only Python stdlib (`urllib`),
so the toolkit works without any pip installs. Ornith's thinking-model
output (`<think>…</think>`) is passed through as-is — the model's reasoning
is visible alongside its final answer.

### Worker HTTP API (bugreaperx)

The same agents are exposed as HTTP endpoints via the `bugreaperx`
Cloudflare Worker, so any app or script can generate/analyze payloads via
POST requests:

```bash
# Generate SubGHz
curl -X POST http://localhost:8787/api/flipper-ai/generate-subghz \
  -H 'Content-Type: application/json' \
  -d '{"description":"433 MHz garage opener with static code"}'

# Generate RFID
curl -X POST http://localhost:8787/api/flipper-ai/generate-rfid \
  -H 'Content-Type: application/json' \
  -d '{"description":"EM4100 test badge","key_type":"EM4100"}'

# Generate NFC
curl -X POST http://localhost:8787/api/flipper-ai/generate-nfc \
  -H 'Content-Type: application/json' \
  -d '{"description":"NTAG215 blank tag","protocol":"NTAG215","uid_size":7}'
```

Full endpoint list (all under `/api/flipper-ai/`):

| Method | Path | Description |
|---|---|---|
| `POST` | `/generate-badusb` | LLM-generated BadUSB script |
| `POST` | `/analyze` | LLM payload analysis |
| `POST` | `/generate-ir` | LLM-generated IR signal |
| `POST` | `/generate-subghz` | LLM-generated SubGHz RAW file |
| `POST` | `/generate-rfid` | LLM-generated RFID emulation file |
| `POST` | `/generate-nfc` | LLM-generated NFC emulation file |
| `POST` | `/fix` | LLM payload review & fix |
| `POST` | `/chat` | Raw LLM prompt (JSON response) |
| `POST` | `/chat/stream` | Raw LLM prompt (SSE streaming) |
| `GET` | `/health` | LLM endpoint health check |

Smoke tests (`scripts/smoke_test_flipper_ai.sh`) verify response structure
and payload content headers for all generation endpoints.

### Safety / responsibility

- **LLM-generated payloads are untrusted by default** — always review and
  test before running on a device.
- **The `generate-ir` and `fix` agents add honest-limits notes**: generated
  IR files are marked as synthesized (not captured from a real device),
  and AI-made fixes are annotated with a `# AI-fix:` comment.
- **Uncensored models like Ornith will comply with harmful requests.**
  You, the operator, are the safety layer. Review all AI output before
  deploying it.

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
