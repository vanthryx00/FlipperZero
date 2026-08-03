#!/usr/bin/env python3
"""
test_flipper_payloads.py -- data-level tests for the FlipperZero workspace.

verify_flipper_files.py checks that the required HEADERS exist; this script
checks the DATA inside the payload files, so a file that has all its headers
but a broken body fails here:

  subghz/*.sub   RAW_Data timing stream must be a valid OOK envelope:
                 integers in microseconds, strictly alternating pulse/gap,
                 first AND last value positive, and no zero-length timings.
  nfc/*.nfc      Mifare Classic dumps: every block present (64 for 1K /
                 256 for 4K), exactly 16 bytes per block, the block-0 UID
                 must match the UID: header, the block-0 BCC byte must equal
                 the XOR of the UID bytes, SAK/ATQA consistency with the
                 headers, and sector-trailer access bits.
  infrared/*.ir  Parsed records: address:/command: are hex byte fields with
                 the protocol-correct width (NEC family = 4 bytes each).
  lfrfid/*.rfid  EM4100 keys: exactly 5 bytes (the 40-bit ID), hex bytes,
                 and a sane carrier frequency. EM4100 row/column parity is
                 rebuilt on the wire by the Flipper, so it is not stored in
                 the file -- the file check is structural.
  badusb/*.txt   DuckyScript: ID VID:PID line format, integer arguments for
                 DELAY/REPEAT-style commands, non-empty STRING arguments,
                 and typos in command tokens.

It is cheap enough to run before every flipper-sync and in CI.

Usage:
  python scripts/test_flipper_payloads.py                  # whole workspace
  python scripts/test_flipper_payloads.py subghz/Foo.sub   # specific files
  python scripts/test_flipper_payloads.py --root <dir>
  python scripts/test_flipper_payloads.py --selftest       # test the checks

Exit codes: 0 = every check passed, 1 = one or more failures,
            2 = usage / I/O error.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from verify_flipper_files import (  # reuse the header validator's helpers
    BADUSB_KNOWN_COMMANDS,
    parse_ir_records,
    parse_kv,
)

RAW_DATA_RE = re.compile(r"^RAW_Data\s*:\s*(.*)$", re.IGNORECASE | re.MULTILINE)
BLOCK_RE = re.compile(r"^Block\s+(\d+)\s*:\s*(.*)$", re.IGNORECASE | re.MULTILINE)
HEX2_RE = re.compile(r"^[0-9A-Fa-f]{2}$")
PROTOCOL_RAW_RE = re.compile(r"^Protocol\s*:\s*RAW\s*$", re.IGNORECASE | re.MULTILINE)

# A single pulse/gap beyond this is almost certainly a bad capture join.
MAX_SANE_TIMING_US = 500_000

NEC_FAMILY = {"nec", "necext", "nec42", "nec42ext"}
# address:/command: byte widths we assert on for parsed IR records.
BYTE_WIDTHS = {p: 4 for p in NEC_FAMILY}
# Protocols stored as a single bit-packed hex value (no byte fields).
PACKED_PROTOCOLS = {"rc5", "rc5ext", "rc6"}

# EM4100 stores the 40-bit ID as 5 bytes (EM4100_DECODED_DATA_SIZE).
EM4100_DATA_BYTES = 5
EM4100_CARRIER_HZ = 125_000

# DuckyScript commands whose argument must be a non-negative integer.
BADUSB_INT_ARG_CMDS = {
    "DEFAULT_DELAY", "DEFAULT_STRING_DELAY", "DELAY", "STRING_DELAY",
    "REPEAT",
}
# DuckyScript commands that require a text argument.
BADUSB_TEXT_CMDS = {"STRING", "STRINGLN"}


def check_subghz(text: str) -> tuple[list[str], list[str]]:
    """Validate the RAW_Data timing stream of a SubGhz RAW file."""
    fails: list[str] = []
    warns: list[str] = []
    if not PROTOCOL_RAW_RE.search(text):
        return fails, warns  # keyed protocols carry no timing stream

    m = RAW_DATA_RE.search(text)
    if not m or not m.group(1).strip():
        fails.append("Protocol is RAW but the RAW_Data line is missing/empty")
        return fails, warns
    tokens = m.group(1).split(",")
    if any(t.strip() == "" for t in tokens):
        fails.append("RAW_Data contains an empty token (double comma)")
        return fails, warns
    try:
        vals = [int(t.strip()) for t in tokens]
    except ValueError:
        fails.append("RAW_Data contains a non-integer timing value")
        return fails, warns

    if len(vals) < 2:
        fails.append("RAW_Data must contain at least a pulse/gap pair")
    if vals[0] <= 0:
        fails.append(
            f"first RAW_Data value must be positive (a pulse), got {vals[0]}")
    if vals[-1] <= 0:
        fails.append(
            f"last RAW_Data value must be positive (ends on a pulse), got {vals[-1]}")
    if len(vals) % 2 == 0:
        fails.append("RAW_Data count must be odd (starts AND ends on a pulse)")
    for i, v in enumerate(vals):
        if v == 0:
            fails.append(f"RAW_Data[{i}] is 0 -- zero-length pulse/gap is invalid")
        if i and (v > 0) == (vals[i - 1] > 0):
            fails.append(
                f"RAW_Data[{i - 1}] and RAW_Data[{i}] don't alternate sign")
        if abs(v) > MAX_SANE_TIMING_US:
            warns.append(
                f"RAW_Data[{i}] = {v} us exceeds the 500 ms sanity bound")
    return fails, warns


def _trailer_blocks(size: int) -> list[int]:
    """Sector-trailer block numbers for a Mifare Classic of `size` blocks."""
    trailers = [sector * 4 + 3 for sector in range(32)]
    if size == 256:  # 4K: sectors 32..39 use 16-block layout
        trailers += [128 + (sector - 32) * 16 + 15 for sector in range(32, 40)]
    return trailers


def check_nfc(text: str) -> tuple[list[str], list[str]]:
    """Validate the block structure + checksums of a Mifare Classic dump."""
    fails: list[str] = []
    warns: list[str] = []
    kv = parse_kv(text)
    if "mifare classic" not in (kv.get("device type") or "").lower():
        return fails, warns  # NTAG/Ultralight etc. use a different layout

    blocks: dict[int, list[str]] = {}
    for m in BLOCK_RE.finditer(text):
        blocks[int(m.group(1))] = m.group(2).split()

    size_txt = (kv.get("mifare classic type") or "").upper()
    if not size_txt:
        warns.append(
            "missing 'Mifare Classic type' key -- assuming 1K (64 blocks)")
        size_txt = "1K"
    expected = {"1K": 64, "4K": 256}.get(size_txt)
    if expected is None:
        warns.append(
            f"unrecognized 'Mifare Classic type' {size_txt!r} -- assuming 1K")
        expected = 64

    missing = [i for i in range(expected) if i not in blocks]
    if missing:
        fails.append(f"missing {len(missing)} block(s); first: {missing[:8]}")
    extra = sorted(set(blocks) - set(range(expected)))
    if extra:
        fails.append(f"block number(s) out of range for {size_txt}: {extra[:8]}")

    for idx, toks in sorted(blocks.items()):
        if len(toks) != 16:
            fails.append(f"Block {idx}: expected 16 bytes, got {len(toks)}")
        for tok in toks:
            if not HEX2_RE.fullmatch(tok):
                fails.append(f"Block {idx}: non-hex byte {tok!r}")
                break

    b0 = blocks.get(0)
    uid_hdr = [
        int(b, 16)
        for b in (kv.get("uid") or "").split() if HEX2_RE.fullmatch(b)]
    if uid_hdr and b0 and len(b0) == 16 and all(
            HEX2_RE.fullmatch(t) for t in b0):
        # Block 0 holds the FIRST 4 UID bytes + their BCC. A double-size
        # (7-byte) UID continues into Block 1, so only the first 4 compare
        # here and only those 4 feed the BCC XOR.
        uid4 = uid_hdr[:4]
        if [int(x, 16) for x in b0[:4]] != uid4:
            fails.append("Block 0 UID bytes don't match the UID: header")
        bcc = 0
        for b in uid4:
            bcc ^= b
        if int(b0[4], 16) != bcc:
            fails.append(
                f"Block 0 BCC byte {b0[4]} != XOR(UID[0:4]) = {bcc:02X}")
        sak = (kv.get("sak") or "").strip()
        if sak and int(b0[5], 16) != int(sak, 16):
            warns.append(f"Block 0 SAK byte {b0[5]} != SAK header {sak}")
        atqa = [
            int(b, 16)
            for b in (kv.get("atqa") or "").split() if HEX2_RE.fullmatch(b)]
        if atqa and (int(b0[6], 16), int(b0[7], 16)) != tuple(atqa):
            warns.append(
                f"Block 0 ATQA bytes {b0[6]} {b0[7]} != ATQA header "
                f"{kv.get('atqa')}")
    elif not uid_hdr:
        fails.append("Mifare Classic file missing a valid UID: header")

    for t in _trailer_blocks(expected):
        b = blocks.get(t)
        if not b or len(b) != 16:
            continue  # already reported above
        if not all(HEX2_RE.fullmatch(x) for x in b[6:9]):
            continue  # non-hex tokens already reported as failures
        ab = (int(b[6], 16), int(b[7], 16), int(b[8], 16))
        if len(set(ab)) == 1:
            warns.append(
                f"Block {t}: access-bits bytes {b[6]} {b[7]} {b[8]} are all "
                "identical -- trailer looks erased or corrupt")
    return fails, warns


def check_ir(text: str) -> tuple[list[str], list[str]]:
    """Validate address:/command: field widths of parsed IR records."""
    fails: list[str] = []
    warns: list[str] = []
    records = parse_ir_records(text)
    if not records:
        return fails, warns

    for i, rec in enumerate(records):
        label = rec.get("name") or f"record {i + 1}"
        if (rec.get("type") or "").lower() != "parsed":
            continue  # raw records store a timing array, not byte fields
        proto = (rec.get("protocol") or "").lower()
        addr, cmd = rec.get("address"), rec.get("command")
        if addr is None or cmd is None:
            fails.append(f"{label!r}: parsed record missing address:/command:")
            continue
        width = BYTE_WIDTHS.get(proto)
        for field, val in (("address", addr), ("command", cmd)):
            if proto in PACKED_PROTOCOLS:
                if not re.fullmatch(r"(0x)?[0-9A-Fa-f]+", val.strip()):
                    fails.append(
                        f"{label!r}: {field} {val!r} is not a bit-packed value")
                continue
            toks = val.split()
            if width is not None and len(toks) != width:
                fails.append(
                    f"{label!r}: {proto} {field} expects {width} hex bytes, "
                    f"got {len(toks)} ({val!r})")
            for tok in toks:
                if not HEX2_RE.fullmatch(tok):
                    fails.append(
                        f"{label!r}: {field} contains non-hex byte {tok!r}")
                    break
        if proto and width is None and proto not in PACKED_PROTOCOLS:
            warns.append(
                f"{label!r}: no width expectation registered for protocol "
                f"{proto!r} -- verify by eye")
    return fails, warns


def check_rfid(text: str) -> tuple[list[str], list[str]]:
    """Validate the data field of an LF RFID key file."""
    fails: list[str] = []
    warns: list[str] = []
    kv = parse_kv(text)
    key_type = (kv.get("key type") or "").upper()
    if not key_type:
        fails.append("missing 'Key type' header")
        return fails, warns

    data_hdr = kv.get("data") or ""
    if not data_hdr.strip() and kv.get("key"):
        warns.append(
            "'Data' field is empty -- falling back to 'Key' (modern "
            "firmware reads Data)")
    data_toks = (data_hdr or kv.get("key") or "").split()
    if not data_toks:
        fails.append(f"{key_type}: missing 'Data' (or 'Key') field")
        return fails, warns
    for tok in data_toks:
        if not HEX2_RE.fullmatch(tok):
            fails.append(f"{key_type}: non-hex byte {tok!r} in Data/Key")
            break

    key_toks = (kv.get("key") or "").split()
    if key_toks and data_toks and key_toks != data_toks:
        warns.append("Key: and Data: fields disagree")

    if key_type == "EM4100":
        if len(data_toks) != EM4100_DATA_BYTES:
            fails.append(
                f"EM4100: expected {EM4100_DATA_BYTES} bytes (40-bit ID), "
                f"got {len(data_toks)}")
        freq = kv.get("frequency", "")
        if freq.lstrip("-").isdigit() and int(freq) != EM4100_CARRIER_HZ:
            warns.append(
                f"EM4100: Frequency {freq} Hz != typical {EM4100_CARRIER_HZ} Hz")
        if kv.get("bit count") not in (None, "64"):
            warns.append(
                f"EM4100: Bit Count is {kv.get('bit count')}, expected 64")
    else:
        warns.append(
            f"no byte-count expectation registered for Key type {key_type!r}")
    return fails, warns


def check_badusb(text: str) -> tuple[list[str], list[str]]:
    """Validate DuckyScript payload structure (ID line, args, typos)."""
    fails: list[str] = []
    warns: list[str] = []
    for i, raw in enumerate(text.splitlines(), start=1):
        s = raw.strip()
        if not s or s.startswith("REM") or s.startswith("#"):
            continue
        parts = s.split()
        cmd = parts[0].upper()
        arg = s[len(parts[0]):].strip()
        if cmd == "ID":
            # 'ID VVVV:PPPP [device name]' -- 4 hex digits each side of ':':
            ok = (len(parts) > 1 and
                  re.fullmatch(r"[0-9A-Fa-f]{4}:[0-9A-Fa-f]{4}", parts[1]))
            if not ok:
                fails.append(
                    f"L{i}: ID line must be 'ID VVVV:PPPP' (4 hex digits "
                    f"each), got: {s!r}")
        elif cmd in BADUSB_INT_ARG_CMDS:
            if not arg.isdigit():
                fails.append(
                    f"L{i}: {cmd} expects a non-negative integer ms/count, "
                    f"got {arg!r}")
        elif cmd in BADUSB_TEXT_CMDS:
            if not arg:
                fails.append(f"L{i}: {cmd} requires a text argument")
        elif "-" in cmd:
            if not all(t in BADUSB_KNOWN_COMMANDS for t in cmd.split("-")):
                warns.append(f"L{i}: unrecognized modifier chain {cmd!r}")
        elif cmd not in BADUSB_KNOWN_COMMANDS:
            warns.append(
                f"L{i}: unrecognized command {cmd!r} (typo -> silent NOP "
                f"on device)")
    return fails, warns


def run_checks(text: str, suffix: str) -> tuple[list[str], list[str]]:
    if suffix == ".sub":
        return check_subghz(text)
    if suffix == ".nfc":
        return check_nfc(text)
    if suffix == ".ir":
        return check_ir(text)
    if suffix == ".rfid":
        return check_rfid(text)
    if suffix == ".txt":
        return check_badusb(text)
    return [], []


def discover(root: Path) -> list[Path]:
    out: list[Path] = []
    for sub, ext in (("subghz", ".sub"), ("nfc", ".nfc"),
                     ("infrared", ".ir"), ("lfrfid", ".rfid"),
                     ("badusb", ".txt")):
        d = root / sub
        if d.is_dir():
            out.extend(
                p for p in sorted(d.iterdir())
                if p.is_file() and p.suffix.lower() == ext)
    return out


def _summary(path: Path, text: str) -> str:
    if path.suffix.lower() == ".sub":
        m = RAW_DATA_RE.search(text)
        return f"{len(m.group(1).split(','))} timings" if m else ""
    if path.suffix.lower() == ".nfc":
        return f"{len(BLOCK_RE.findall(text))} blocks"
    if path.suffix.lower() == ".ir":
        return f"{len(re.findall(r'(?im)^name:', text))} records"
    if path.suffix.lower() == ".rfid":
        m = re.search(r"(?im)^Key\s*type\s*:\s*(\S+)", text)
        return m.group(1) if m else ""
    if path.suffix.lower() == ".txt":
        return f"{len([l for l in text.splitlines() if l.strip() and not l.lstrip().startswith('REM')])} lines"
    return ""


def selftest() -> list[str]:
    """Exercise every checker against known-good and known-bad samples."""
    bad: list[str] = []

    def expect(cond: bool, msg: str) -> None:
        if not cond:
            bad.append(msg)

    # ---- SubGhz RAW_Data ------------------------------------------------
    good_sub = (
        "Filetype: Flipper SubGhz RAW File\nVersion: 1\n"
        "Frequency: 433920000\nPreset: FuriHalSubGhzPresetOok650Async\n"
        "Protocol: RAW\nRAW_Data: 320, -960, 320, -12000, 320, -320, 320"
    )
    f, _ = check_subghz(good_sub)
    expect(not f, f"good RAW_Data flagged: {f}")

    f, _ = check_subghz("Protocol: RAW\nRAW_Data: 320, 960, 320, 12000, 320")
    expect(f, "non-alternating RAW_Data not caught")
    f, _ = check_subghz("Protocol: RAW\nRAW_Data: 320, -960, 320, -960")
    expect(f, "even-count RAW_Data not caught")
    f, _ = check_subghz("Protocol: RAW\nRAW_Data: 320, -abc, 320")
    expect(f, "non-integer RAW_Data not caught")
    f, _ = check_subghz("Protocol: RAW\nRAW_Data: 320, 0, 320")
    expect(f, "zero-length RAW_Data timing not caught")
    f, _ = check_subghz("Protocol: RAW\nRAW_Data: -320, 960, -320")
    expect(f, "negative-first RAW_Data not caught")
    f, _ = check_subghz("Protocol: Princeton\nKey: 11111")
    expect(not f, "keyed .sub treated as RAW")
    f, _ = check_subghz("protocol: raw\nRAW_Data: 320, 960")
    expect(f, "lowercase 'protocol: raw' not detected as RAW")

    # ---- NFC ------------------------------------------------------------
    nfc_good = _good_nfc()
    f, _ = check_nfc(nfc_good)
    expect(not f, f"good NFC flagged: {f}")

    f, _ = check_nfc(
        nfc_good.replace("Block 0: 04 DE AD BE C9", "Block 0: 04 DE AD BE EE"))
    expect(f, "BCC mismatch not caught")
    f, _ = check_nfc(
        nfc_good.replace("Block 0: 04 DE AD BE", "Block 0: 04 DE AD BF"))
    expect(f, "block-0 UID mismatch not caught")
    f, _ = check_nfc("\n".join(
        l for l in nfc_good.splitlines() if not l.startswith("Block 40")))
    expect(f, "missing NFC block not caught")
    f, _ = check_nfc(nfc_good.replace(
        "Block 1: " + "00 " * 15 + "00", "Block 1: 00 00 00"))
    expect(f, "short NFC block not caught")
    f, _ = check_nfc(nfc_good.replace(
        "Block 0: 04 DE AD BE C9", "Block 0: 04 DE AD BE XX"))
    expect(f, "non-hex block 0 not reported as a failure")
    nfc_7b = nfc_good.replace("UID: 04 DE AD BE", "UID: 04 DE AD BE AA BB CC")
    f, _ = check_nfc(nfc_7b)
    expect(not f, f"double-size (7-byte) UID falsely flagged: {f}")
    _, w = check_nfc(nfc_good.replace(
        "Block 3: FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF",
        "Block 3: FF FF FF FF FF FF 00 00 00 69 FF FF FF FF FF FF"))
    expect(any("access" in x.lower() for x in w),
           "broken trailer access bits not warned")

    # ---- IR -------------------------------------------------------------
    ir_good = (
        "name: Mute\ntype: parsed\nprotocol: NEC\naddress: 04 00 00 00\n"
        "command: 07 00 00 00\n#\n"
        "name: Off\ntype: parsed\nprotocol: NEC\naddress: 04 00 00 00\n"
        "command: 08 00 00 00"
    )
    f, _ = check_ir(ir_good)
    expect(not f, f"good IR flagged: {f}")
    f, _ = check_ir(ir_good.replace("command: 07 00 00 00", "command: 07 00"))
    expect(f, "narrow NEC command not caught")
    f, _ = check_ir(ir_good.replace("address: 04 00 00 00",
                                    "address: 04 00 00 ZZ"))
    expect(f, "non-hex IR byte not caught")
    f, _ = check_ir("name: X\ntype: parsed\nprotocol: NEC\naddress: 04 00 00 00")
    expect(f, "missing IR command not caught")
    f, _ = check_ir("name: Cap\ntype: raw\nprotocol: NEC\nraw: 320 -960 320")
    expect(not f, "raw IR record validated as parsed")

    # ---- RFID -----------------------------------------------------------
    rfid_good = (
        "Filetype: Flipper RFID key\nVersion: 1\nFrequency: 125000\n"
        "Bit Count: 64\nKey type: EM4100\nKey: DE AD BE EF CA\n"
        "Data: DE AD BE EF CA"
    )
    f, _ = check_rfid(rfid_good)
    expect(not f, f"good RFID flagged: {f}")
    f, _ = check_rfid(rfid_good.replace("Data: DE AD BE EF CA",
                                        "Data: DE AD BE"))
    expect(f, "short EM4100 data not caught")
    f, _ = check_rfid(rfid_good.replace("Data: DE AD BE EF CA",
                                        "Data: DE AD BE ZZ CA"))
    expect(f, "non-hex RFID byte not caught")
    f, _ = check_rfid("Filetype: Flipper RFID key\nVersion: 1\n"
                      "Frequency: 125000\nKey type: EM4100")
    expect(f, "missing RFID Data/Key not caught")
    f, _ = check_rfid(rfid_good.replace("Frequency: 125000",
                                        "Frequency: 134200"))
    expect(not f, "off-125k EM4100 frequency should only warn")
    _, w = check_rfid(rfid_good.replace(
        "Key: DE AD BE EF CA\nData: DE AD BE EF CA",
        "Key: DE AD BE EF CA\nData: 11 22 33 44 55"))
    expect(any("disagree" in x for x in w), "Key/Data mismatch not warned")

    # ---- BadUSB ---------------------------------------------------------
    badusb_good = (
        "REM comment\nID 046d:c31c\nDEFAULT_DELAY 100\nDELAY 800\n"
        "GUI r\nSTRING cmd /c start http://127.0.0.1:7777\nENTER\n"
    )
    f, _ = check_badusb(badusb_good)
    expect(not f, f"good BadUSB flagged: {f}")
    f, _ = check_badusb("ID 046d:c31c\nDELAY abc")
    expect(f, "non-integer DELAY not caught")
    f, _ = check_badusb("ID 046d:c31c\nREPEAT x")
    expect(f, "non-integer REPEAT not caught")
    f, _ = check_badusb("STRING")
    expect(f, "empty STRING not caught")
    f, _ = check_badusb("ID 123:45\nREM ok")
    expect(f, "malformed ID line not caught")
    _, w = check_badusb("ID 046d:c31c\nSTIRNG hello")
    expect(any("unrecognized" in x.lower() for x in w),
           "typo'd command not warned")
    f, _ = check_badusb("ID 046d:c31c\nCTRL-ALT-DEL")
    expect(not f, "modifier chain CTRL-ALT-DEL flagged")
    return bad


def _good_nfc() -> str:
    lines = [
        "Filetype: Flipper NFC device",
        "Version: 4",
        "Device type: Mifare Classic",
        "UID: 04 DE AD BE",
        "ATQA: 04 44",
        "SAK: 08",
        "Mifare Classic type: 1K",
        "Data format version: 1",
        "",
    ]
    for i in range(64):
        if i == 0:
            lines.append(
                "Block 0: 04 DE AD BE C9 08 04 44 62 63 64 65 66 67 68 69")
        elif i % 4 == 3:
            lines.append(
                f"Block {i}: FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF")
        else:
            lines.append(f"Block {i}: " + "00 " * 15 + "00")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Data-level tests for the FlipperZero workspace.")
    ap.add_argument(
        "files", nargs="*",
        help="Specific files to test (default: scan subghz/, nfc/, "
             "infrared/, lfrfid/, badusb/).")
    ap.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parent.parent),
        help="Workspace root (default: ../ of this script).")
    ap.add_argument(
        "--selftest", action="store_true",
        help="Verify the checkers themselves, then exit.")
    args = ap.parse_args(argv)

    if args.selftest:
        bad = selftest()
        if bad:
            for b in bad:
                print(f"  [FAIL] selftest: {b}")
            print(f"[FAIL] selftest: {len(bad)} problem(s)")
            return 1
        print("[OK]   selftest: all checker tests passed")
        return 0

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"[FAIL] workspace root not found: {root}", file=sys.stderr)
        return 2

    if args.files:
        targets = [Path(f) if Path(f).is_absolute() else root / f
                   for f in args.files]
    else:
        targets = discover(root)
    if not targets:
        print("[INFO] no supported payload files (.sub/.nfc/.ir/.rfid/.txt) "
              "found to test.")
        return 0

    failures = 0
    warnings = 0
    for p in sorted(set(targets)):
        if not p.is_file():
            print(f"  [FAIL] {p}  (no such file)")
            failures += 1
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        fails, warns = run_checks(text, p.suffix.lower())
        if fails:
            failures += 1
        warnings += len(warns)
        try:
            rel = p.relative_to(root)
        except ValueError:
            rel = p
        if not fails and not warns:
            info = _summary(p, text)
            print(f"  [OK  ] {rel}" + (f"  ({info})" if info else ""))
        else:
            print(f"  [FAIL] {rel}" if fails else f"  [WARN] {rel}")
            for f in fails:
                print(f"         fail : {f}")
            for w in warns:
                print(f"         warn : {w}")

    print()
    print(f"  Files tested : {len(targets)}")
    print(f"  Failures     : {failures}")
    print(f"  Warnings     : {warnings}")
    if failures:
        print("[FAIL] at least one payload file has invalid data -- "
              "fix before syncing.")
        return 1
    print("[OK]   all payload data checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
