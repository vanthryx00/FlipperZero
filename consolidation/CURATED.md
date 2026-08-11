# Curation Checklist — FlipperZero

Walk each row top → bottom. Replace the blank with **one** decision per row.

Legend: **KEEP** = leave as-is · **MERGE** = bring clean files into
`consolidation/tools/` · **ARCHIVE** = zip + move to
`vanthryx-backups/curation-archive/` · **DELETE** = remove after one more backup.

---

## One decision per source

- [x] `apps/`                                → **KEEP**
- [x] `badusb/`                              → **KEEP**
- [x] `dolphin/`                             → **KEEP**
- [x] `ibutton/`                             → **KEEP**
- [x] `infrared/`                            → **KEEP**
- [x] `lfrfid/`                              → **KEEP**
- [x] `nfc/`                                 → **KEEP**
- [x] `subghz/`                              → **KEEP**
- [x] `u2f/`                                 → **KEEP**
- [x] `scripts/`                             → **KEEP**
- [x] `settings/`                            → **KEEP** (starter `system_settings.txt` added + inspected)
- [x] `_vendor/`                             → **REVIEW_VENDOR** (keep as vendored copy; do NOT push to device)
- [x] `flipper-sync.ps1`                     → **KEEP** (device-sync tool; `autosync.ps1` only git-pulls the repo, it does NOT replace this)
- [x] `flipper-sync.cmd`                     → **KEEP** (wrapper of above; keep both for the device-sync workflow)

---

## ⚠ Heads-up: auto-sync + manual curation

`autosync.ps1` runs `git pull --ff-only`. As soon as you commit a curation
change locally and `origin/$branch` has moved on, the sync will exit 2 and
silently do nothing until you reconcile.

1. Commit curation decisions as you go.
2. If `autosync.log` reports "Local branch diverged", manually reconcile:
   - `git pull --rebase` if your local commits can replay, or
   - `git fetch origin && git reset --hard origin/<branch>` if you trust origin.
3. After reconciling, the next scheduled run resumes normally.

---

## Decisions log

| Date | Source | Decision | Rationale |
| ---- | ------ | -------- | --------- |
| 2026-08-02 | apps, badusb, dolphin, ibutton, infrared, lfrfid, nfc, subghz, u2f, scripts | KEEP | Active payload/tooling trees, all syncable to device |
| 2026-08-02 | settings | REVIEW | Config files; inspect before first push |
| 2026-08-04 | settings | KEEP | Documented placeholder `system_settings.txt` added (no active keys; settings live in RTC / device-written files on current firmware); reviewed before sync |
| 2026-08-04 | ibutton, apps, dolphin, u2f | KEEP | Folder completion: CRC-valid DS1990 test key + per-folder READMEs |
| 2026-08-02 | _vendor | REVIEW_VENDOR | qFlipper cache; keep local, never sync to device |
| 2026-08-02 | flipper-sync.ps1 / .cmd | ARCHIVE | Superseded by consolidation/autosync.ps1 |
| 2026-08-11 | flipper-sync.ps1 / .cmd | KEEP | Decision **reverted** — autosync.ps1 only git-pulls the repo; flipper-sync.ps1 is the only device-push tool (README workflow depends on it) |
| 2026-08-11 | AI-synthesized payloads (see below) | OPEN — verify on hardware | All payloads pass PC-side validators + data tests, but the LLM-synthesized files below were never confirmed against a real device/reader |

---

## ⏳ Remaining work: verify AI-synthesized payloads on real hardware

Everything in the workspace passes the PC-side header validator and data
tests (0 failures), but the following **LLM-synthesized** files were never
tested on a physical device. "Unverified" = structurally valid + loadable,
but nobody has confirmed the signal actually works against the target gear.

Verify each on the real hardware, tick it off, and re-commit:

| File | What to verify | How |
| --- | --- | --- |
| `subghz/AI_433_Gate_Remote.sub` | plays out on the Sub-GHz radio at 433.92 MHz | Sub-GHz → Read RAW → replay → check with an SDR receiver
| `infrared/AI_LG_TV_Power.ir` | toggles an actual LG TV | point at the TV → Send → confirm power on/off
| `infrared/AI_Roku_Home_OK.ir` | Home / OK on an actual Roku | point at the Roku → Send → confirm UI response
| `infrared/AI_Samsung_Volume.ir` | volume up on an actual Samsung TV | point at the TV → Send → confirm volume changes
| `lfrfid/AI_HID_Prox_37bit.rfid` | reads as a 37-bit HID Prox on an LF reader | emulate near an HID reader → confirm raw Wiegand bits
| `lfrfid/AI_Indala_Prox.rfid` | reads as Indala on an LF reader | emulate near an Indala reader → confirm decode
| `lfrfid/AI_T5577_Emulation.rfid` | EM4100-style replay via T5577 | emulate near a generic EM4100 reader → confirm UID
| `badusb/AI_SystemInfo_Gather.txt` | runs cleanly on a target Windows box | authorized machine only → plug in → confirm sysinfo.txt lands on Desktop

> When each is confirmed working, flip its row to ✅ (or `DELETE` if it never
> works) and add a dated line to the decisions log. Until then, the build is
> **done except for this hardware pass** — no PC-side step can finish it.

## After curation

1. Update `MANIFEST.yaml` so each `recommendation:` matches your decision above.
2. Re-run sha256 on any folder pair still flagged as duplicates.
3. For ARCHIVE rows, before deleting run:
   ```
   tar -czf "$env:USERPROFILE\Desktop\vanthryx-backups\curation-archive\<name>-<date>.tar.gz" "<full-path>"
   ```
4. Reedit this file so the trail of decisions stays in git history.
