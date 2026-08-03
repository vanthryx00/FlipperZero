#!/usr/bin/env python3
"""
verify_flipper_files.py -- pre-sync validator for the FlipperZero workspace.

Walks each canonical Flipper SD-card subdirectory and validates the headers
of every payload file. Catches missing `Filetype`/`Version` keys BEFORE you
`flipper-sync.ps1` the workspace to a device, which is cheaper than
discovering the file is malformed on the Flipper screen.

Supported file types and required keys:
  badusb/*.txt       -> first non-blank line is ID/REM/DEFAULT_DELAY.
                        Known DuckyScript commands detected; typo'd tokens
                        surface as warnings.
  subghz/*.sub       -> Requires Filetype, Version, Frequency, Preset.
  nfc/*.nfc          -> Requires Filetype, Version, Device Type. Mifare
                        Classic files must also carry 'Mifare Classic type'
                        and 'Data format version' (modern firmware).
  infrared/*.ir      -> Requires Filetype, Version, Name, Type. Parsed
                        NEC records must use 4-byte address:/command:.
  lfrfid/*.rfid      -> Requires Filetype, Version, Frequency, Key type,
                        with the modern lowercase 'Key type:' casing.
  ibutton/*.ibutton  -> Requires Filetype, Version.

Usage:
  python verify_flipper_files.py [path-to-FlipperZero-root]
  Defaults to the workspace one level above this script.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

# Lowercased so the validator matches both Flipper stylings:
#   - SubGhz / NFC / RFID / iButton convention uses TitleCase keys
#     (e.g. "Filetype:", "Device Type:").
#   - IR convention uses lowercase keys (e.g. "name:", "type:").
# parse_kv() normalises everything to lowercase before lookup.
REQUIRED_SUBGHZ    = ("filetype", "version", "frequency", "preset")
REQUIRED_NFC       = ("filetype", "version", "device type")
REQUIRED_IR        = ("filetype", "version", "name", "type")
REQUIRED_RFID      = ("filetype", "version", "frequency", "key type")
REQUIRED_IBUTTON   = ("filetype", "version")

# Modern-firmware keys enforced on top of the required headers (dev branch:
# mf_classic.c refuses to load a Mifare Classic file without these).
NFC_MIFARE_KEYS = ("mifare classic type", "data format version")
# IR protocols whose address:/command: are stored as 4-byte raw values on
# current firmware; the old 2-byte form no longer loads.
IR_4BYTE_PROTOCOLS = frozenset({"nec", "necext", "nec42", "nec42ext"})

BADUSB_KNOWN_COMMANDS = {
    "ID", "REM", "DEFAULT_DELAY", "DEFAULT_STRING_DELAY", "DELAY", "STRING_DELAY",
    "STRING", "STRINGLN", "REPEAT",
    "CTRL", "SHIFT", "ALT", "GUI", "WINDOWS",
    "ENTER", "ESCAPE", "TAB", "SPACE", "BACKSPACE", "DELETE",
    "UP", "DOWN", "LEFT", "RIGHT", "HOME", "END", "INSERT", "PAGE_UP", "PAGE_DOWN",
    "CAPSLOCK", "NUMLOCK", "SCROLLLOCK",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    "VOLUME_UP", "VOLUME_DOWN", "MUTE", "PLAY_PAUSE", "MEDIA_NEXT", "MEDIA_PREV",
    "LEFTCLICK", "RIGHTCLICK", "MIDDLECLICK", "MOUSEMOVE", "MOUSESCROLL",
    "WAIT_FOR_BUTTON_PRESS", "SYSRQ",
    "ALTCHAR", "ALTSTRING",
}


@dataclass
class Finding:
    path: Path
    ok: bool
    issues: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def render(self) -> str:
        tag = "OK  " if self.ok and not self.issues else "WARN" if self.issues else "INFO"
        lines = [f"  [{tag}] {self.path}"]
        for issue in self.issues:
            lines.append(f"      issue : {issue}")
        for note in self.notes:
            lines.append(f"      note  : {note}")
        return "\n".join(lines)


def parse_kv(text: str) -> dict[str, str]:
    """Parse 'Key: Value' lines, ignore blanks and `#` comments. Lines without
    a colon are silently ignored (preserves backwards-compat with arbitrary
    free-form lines, e.g. 'Protocol: RAW', 'RAW_Data: ...'). Keys are
    lowercased so IR file conventions (lowercase `name:`/`type:`) and
    SubGhz/NFC/RFID conventions (TitleCase `Filetype:`/`Device Type:`)
    look up identically.
    """
    out: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        out[key.strip().lower()] = val.strip()
    return out


def parse_ir_records(text: str) -> list[dict[str, str]]:
    """Split an .ir file into per-signal records keyed by lowercase keys.
    A new record starts at each `name:` line; `#` comments and blank lines
    are skipped.
    """
    records: list[dict[str, str]] = []
    cur: dict[str, str] | None = None
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.lower().startswith("name:"):
            if cur:
                records.append(cur)
            cur = {"name": s.split(":", 1)[1].strip()}
            continue
        if cur is not None and ":" in s:
            k, _, v = s.partition(":")
            cur[k.strip().lower()] = v.strip()
    if cur:
        records.append(cur)
    return records


def validate_subghz(text: str) -> tuple[list[str], list[str]]:
    issues, notes = [], []
    kv = parse_kv(text)
    for k in REQUIRED_SUBGHZ:
        if k not in kv:
            issues.append(f"missing required key: {k}")
    freq = kv.get("frequency", "")
    if freq and not freq.lstrip("-").isdigit():
        issues.append(f"Frequency must be integer Hz, got: {freq!r}")
    elif freq and not (300_000_000 <= int(freq) <= 928_000_000):
        notes.append(
            f"Frequency {freq} Hz is outside the SubGhz ISM band 300-928 MHz"
        )
    if "Protocol: RAW" in text:
        notes.append(
            "RAW format -- replay fidelity depends on capture quality"
        )
    return issues, notes


def validate_nfc(text: str) -> tuple[list[str], list[str]]:
    issues, notes = [], []
    kv = parse_kv(text)
    for k in REQUIRED_NFC:
        if k not in kv:
            issues.append(f"missing required key: {k}")
    dtype = kv.get("device type", "")
    allowed = {
        "ISO14443-3A", "ISO14443-3B", "ISO14443-4A",
        "NTAG/Ultralight", "Mifare Classic", "Mifare DESFire",
    }
    if dtype and dtype not in allowed:
        notes.append(f"Unrecognized Device Type {dtype!r} -- verify against Flipper docs")
    if "mifare classic" in dtype.lower():
        for k in NFC_MIFARE_KEYS:
            if k not in kv:
                issues.append(f"missing required key: {k} (Mifare Classic)")
        mct = kv.get("mifare classic type", "")
        if mct and mct.upper() not in ("1K", "4K"):
            notes.append(f"Unrecognized Mifare Classic type {mct!r} -- expected 1K or 4K")
        dfv = kv.get("data format version", "")
        if dfv and dfv != "1":
            notes.append(f"Unrecognized Data format version {dfv!r} -- expected 1")
    if "UID:" in text and re.search(r"UID:\s*([0-9A-Fa-f\s]+)", text):
        notes.append(
            "Contains a UID -- do not sync a real contactless card UID to your "
            "device unless you have an explicit test card."
        )
    return issues, notes


def validate_ir(text: str) -> tuple[list[str], list[str]]:
    issues, notes = [], []
    kv = parse_kv(text)
    for k in REQUIRED_IR:
        if k not in kv:
            issues.append(f"missing required key: {k}")
    # Per-record checks: parsed signals need address:/command: with the
    # protocol-correct width (NEC family = 4 hex bytes on modern firmware).
    for i, rec in enumerate(parse_ir_records(text)):
        label = rec.get("name") or f"record {i + 1}"
        if (rec.get("type") or "").lower() != "parsed":
            continue  # raw records store a timing array, not byte fields
        proto = (rec.get("protocol") or "").lower()
        if not proto:
            issues.append(f"{label}: parsed record missing 'protocol:'")
            continue
        if proto in IR_4BYTE_PROTOCOLS:
            for field in ("address", "command"):
                val = rec.get(field)
                if val is None:
                    issues.append(f"{label}: parsed {proto} record missing '{field}:'")
                    continue
                toks = val.split()
                if len(toks) != 4:
                    issues.append(
                        f"{label}: {field}: must be 4 hex bytes on modern "
                        f"firmware, got {len(toks)} ({val!r})")
                for tok in toks:
                    if not re.fullmatch(r"[0-9A-Fa-f]{2}", tok):
                        issues.append(f"{label}: {field}: non-hex byte {tok!r}")
                        break
        else:
            for field in ("address", "command"):
                if not rec.get(field):
                    issues.append(f"{label}: parsed {proto} record missing '{field}:'")
    return issues, notes


def validate_rfid(text: str) -> tuple[list[str], list[str]]:
    issues, notes = [], []
    kv = parse_kv(text)
    for k in REQUIRED_RFID:
        if k not in kv:
            issues.append(f"missing required key: {k}")
    # A data-bearing key is required (modern firmware reads 'Data', older
    # reads 'Key'); having only a 'Key type' selector is not enough.
    if "key" not in kv and "data" not in kv:
        issues.append("missing key/data: at least one of 'Key:' or 'Data:' "
                      "is required")
    # The firmware key lookup is case-sensitive: modern builds read
    # 'Key type' (lowercase) and ignore the legacy 'Key Type:' casing.
    # Deliberately NO re.IGNORECASE -- this check is about casing. Comments
    # are stripped so a doc note about the old casing can't trip it.
    body = "\n".join(
        l for l in text.splitlines() if not l.lstrip().startswith("#"))
    if re.search(r"(?m)^Key\s+Type\s*:", body):
        issues.append(
            "'Key Type:' uses legacy casing -- modern firmware reads "
            "'Key type:'")
    return issues, notes


def validate_ibutton(text: str) -> tuple[list[str], list[str]]:
    issues, notes = [], []
    kv = parse_kv(text)
    for k in REQUIRED_IBUTTON:
        if k not in kv:
            issues.append(f"missing required key: {k}")
    return issues, notes


def validate_badusb(text: str) -> tuple[list[str], list[str]]:
    issues, notes = [], []
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    if first.startswith("ID "):
        parts = first.split()
        if len(parts) >= 2 and ":" not in parts[1]:
            issues.append(f"`ID` line missing VID:PID: {first!r}")
    elif first.startswith("REM") or first.startswith("DEFAULT_DELAY"):
        pass  # REM or DEFAULT_DELAY on the first line is legal
    else:
        issues.append(
            "first non-blank line should be `ID VID:PID` (recommended) or `REM`;"
            f" got: {first!r}"
        )
    # Surface unknown commands so a typo doesn't silently behave as NOP.
    line_no = 0
    unknown: list[tuple[int, str]] = []
    for line in text.splitlines():
        line_no += 1
        s = line.strip()
        if not s or s.startswith("REM"):
            continue
        # First token (with possible chaining like CTRL-ALT-DEL).
        token = re.split(r"\s+", s, maxsplit=1)[0]
        if "-" in token:
            tokens = token.split("-")
            if all(t in BADUSB_KNOWN_COMMANDS for t in tokens):
                continue
        if token in BADUSB_KNOWN_COMMANDS:
            continue
        unknown.append((line_no, token))
    if unknown:
        sample = ", ".join(f"L{n}:{tok}" for n, tok in unknown[:5])
        notes.append(
            f"{len(unknown)} unrecognized command token(s); sample: {sample}"
        )
    return issues, notes


VALIDATORS = {
    "subghz": validate_subghz,
    "nfc":    validate_nfc,
    "infrared": validate_ir,
    "lfrfid": validate_rfid,
    "ibutton": validate_ibutton,
    "badusb": validate_badusb,
}

EXT_BY_DIR = {
    "subghz":   (".sub",),
    "nfc":      (".nfc",),
    "infrared": (".ir",),
    "lfrfid":   (".rfid",),
    "ibutton":  (".ibutton",),
    "badusb":   (".txt",),
    "settings": (),  # free-form, no validation
    "dolphin":  (),  # dolphin animation frames, binary
    "apps":     (),  # FAPs, leave for flipper-sync-qflipper
    "u2f":      (),
}


def scan(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    for sub, exts in EXT_BY_DIR.items():
        d = root / sub
        if not d.is_dir():
            continue
        for p in sorted(d.iterdir()):
            if not p.is_file():
                continue
            if exts and p.suffix.lower() not in exts:
                # Allow ...Tag.nfc-like samples that still have the canonical ext.
                if not any(p.name.lower().endswith(e) for e in exts):
                    continue
            text = p.read_text(encoding="utf-8", errors="replace")
            validator = VALIDATORS.get(sub)
            if validator is None:
                findings.append(Finding(p, ok=True, notes=["no validator registered"]))
                continue
            issues, notes = validator(text)
            findings.append(Finding(p, ok=not issues, issues=issues, notes=notes))
    return findings


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Pre-sync validator for the FlipperZero workspace."
    )
    ap.add_argument(
        "root",
        nargs="?",
        default=str(Path(__file__).resolve().parent.parent),
        help="Path to the FlipperZero workspace root "
             "(default: ../ of this script).",
    )
    ap.add_argument(
        "--strict", action="store_true",
        help="Exit non-zero on WARN findings too (notes without issues).",
    )
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"[FAIL] workspace root not found: {root}", file=sys.stderr)
        return 2

    print(f"[OK]   Scanning: {root}")
    findings = scan(root)
    if not findings:
        print("[INFO] No payload files found in canonical subdirs. "
              "Add a .sub / .nfc / .txt / .ir / .rfid / .ibutton to a subdir"
              " and re-run.")
        return 0

    hard_failures = 0
    soft_warnings = 0
    for f in findings:
        print(f.render())
        if f.issues:
            hard_failures += 1
        elif f.notes:
            soft_warnings += 1

    print()
    print(f"  Total files scanned : {len(findings)}")
    print(f"  Hard-validation fails: {hard_failures}")
    print(f"  Soft warnings        : {soft_warnings}")

    if hard_failures:
        print("[FAIL] at least one file failed validation -- "
              "fix or remove before running flipper-sync.ps1 .")
        return 1
    if soft_warnings and args.strict:
        print("[WARN] returning non-zero in --strict mode due to soft warnings.")
        return 1
    print("[OK]   workspace is syncable.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
