# FlipperZero Consolidation Plan

> Standalone hub for `C:\Users\bugre\FlipperZero\`.

## What this is

`FlipperZero/` is a real Flipper Zero hacking repo, but it had no `.git`. After
guiding you through `git init` and (later) a remote, this `consolidation/`
turns it into a self-syncing hub.

NOTE: the folder already contains a `flipper-sync.ps1` + `flipper-sync.cmd`.
This scaffold adds **`flipperzero-sync`** to Task Scheduler — *different* name,
intentionally, so the two never collide. You can either keep both, retire the
old one, or let the new one replace it (your call via `CURATED.md`).

## Inventory at a glance

| Sub-tree | Kind | Default action |
| --- | --- | --- |
| `apps/` | Flipper apps | KEEP |
| `badusb/` | BadUSB scripts | KEEP |
| `dolphin/` | Dolphin sources | KEEP |
| `ibutton/`, `infrared/`, `lfrfid/`, `nfc/`, `subghz/`, `u2f/` | Flipper protocols | KEEP |
| `_vendor/` | third-party vendored content | REVIEW (decision: take it via submodule or copy in) |
| `flipper-sync.ps1` / `.cmd` | legacy sync | DECIDE in `CURATED.md` |

## Phase 1 (this scaffold) — already produced

- `MANIFEST.yaml` — machine-readable inventory + dedup record
- `CURATED.md` — your one-decision-per-row checklist
- `autosync.ps1` — `git fetch` + `git pull --ff-only` (requires git)
- `install-autosync.ps1` — registers daily `flipperzero-sync` task with Task Scheduler

## Phase 2 — your curation moves

1. Walk `CURATED.md`. Replace the `___________________` blanks with one decision per row.
2. For anything ARCHIVE/DELETE, snapshot to `vanthryx-backups/` BEFORE deleting.
3. Commit curations as you go — auto-sync will refuse `--ff-only` on uncommitted divergence.

## Auto-sync notes

- First time: `install-autosync.ps1` from elevated PowerShell registers `flipperzero-sync` daily at 08:00.
- Until `git init` (Phase 1) AND a remote (Phase 2) are in place, `autosync.log` will show "No upstream / git fetch failed (exit 1)" daily — that's expected, harmless, and disappears once you set the remote.
- Curation/auto-sync conflict rule: commit curation decisions before letting a scheduled run pull.
