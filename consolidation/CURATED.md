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
- [x] `settings/`                            → **REVIEW** (inspect before first sync)
- [x] `_vendor/`                             → **REVIEW_VENDOR** (keep as vendored copy; do NOT push to device)
- [x] `flipper-sync.ps1`                     → **ARCHIVE** (replaced by `autosync.ps1`)
- [x] `flipper-sync.cmd`                     → **ARCHIVE** (wrapper of above)

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
| 2026-08-02 | _vendor | REVIEW_VENDOR | qFlipper cache; keep local, never sync to device |
| 2026-08-02 | flipper-sync.ps1 / .cmd | ARCHIVE | Superseded by consolidation/autosync.ps1 |

## After curation

1. Update `MANIFEST.yaml` so each `recommendation:` matches your decision above.
2. Re-run sha256 on any folder pair still flagged as duplicates.
3. For ARCHIVE rows, before deleting run:
   ```
   tar -czf "$env:USERPROFILE\Desktop\vanthryx-backups\curation-archive\<name>-<date>.tar.gz" "<full-path>"
   ```
4. Reedit this file so the trail of decisions stays in git history.
