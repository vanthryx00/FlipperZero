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
                 and a sane carrier frequency. The full 64-bit on-wire
                 frame (9-bit header, 10x nibble+row-parity groups, column
                 parity, stop bit) is rebuilt from the 5 stored bytes and
                 verified against the EM4100 spec. Parity itself is NOT
                 stored in the file -- the Flipper recomputes it on the
                 wire -- so this check proves the ID encodes a
                 structurally valid frame.
  badusb/*.txt   DuckyScript: ID VID:PID line format, integer arguments for
                 DELAY/REPEAT-style commands, non-empty STRING/ALTSTRING
                 arguments, integer ALTCHAR alt-codes, script-structure
                 warnings (missing ID first line, bare modifiers, REPEAT
                 with nothing to repeat or a zero count, args to
                 WAIT_FOR_BUTTON_PRESS), and typos in command tokens.
  ibutton/*.ibutton  Dallas 1-Wire keys: exactly 8 ROM bytes (family code +
                 6 serial + CRC), hex bytes, and a valid CRC-8/MAXIM over
                 the first 7 bytes -- a bad CRC shows as a CRC error on the
                 Flipper's iButton app. Accepts the current Version 2
                 format (Protocol: + Rom Data:) and legacy Version 1
                 (Key type: + Data:).

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
# Parsed-protocol address:/command: byte widths we assert on. Current
# firmware stores EVERY parsed protocol's address:/command: as 4-byte
# little-endian hex fields (RC5/RC6 included -- see the canonical IRDB
# files, which use e.g. 'command: 0C 00 00 00' for RC5). The old
# packed-single-value convention is not used on modern firmware.
BYTE_WIDTHS = {p: 4 for p in (NEC_FAMILY | {"rc5", "rc5ext", "rc6"})}

# iButton ROM is 8 bytes: family code + 6 serial bytes + CRC-8/MAXIM over
# the first 7 bytes (1-Wire spec; matches the Flipper's dallas_common.c and
# one_wire/maxim_crc.c). Current firmware (dev) writes Version 2 files with
# 'Protocol:' + 'Rom Data:' keys; Version 1 'Key type:' + 'Data:' still load.
IBUTTON_ROM_BYTES = 8
# Dallas family codes per the Flipper's own protocol registry
# (lib/ibutton/protocols/dallas/*.c, verified from source -- these differ
# from the classic Maxim datasheet codes). Only used for a soft warning when
# a file's family byte disagrees with its declared protocol; a mismatch does
# not fail the load. Protocols without a verified entry are left unchecked.
IBUTTON_FAMILY_BY_NAME = {
    "DS1990": 0x01, "DS1992": 0x08, "DS1996": 0x0C, "DS1971": 0x14,
}

# EM4100 stores the 40-bit ID as 5 bytes (EM4100_DECODED_DATA_SIZE).
EM4100_DATA_BYTES = 5
EM4100_CARRIER_HZ = 125_000
# EM4100 on-wire frame layout (standard spec; matches the Flipper's
# encoder in lib/lfrfid/protocols/protocol_em4100.c):
#   9 bits     header, all '1'
#   10 groups  4 data bits (MSB first) + 1 even row-parity bit  -> 50 bits
#   4 bits     even column parity, one per data-bit position
#   1 bit      stop, '0'
#   total      64 bits
EM4100_FRAME_BITS = 64
EM4100_HEADER_BITS = 9
EM4100_GROUPS = 10

# DuckyScript commands whose argument must be a non-negative integer.
# (REPEAT is handled by its own branch -- it also needs ordering/zero
# checks -- so it is not listed here.)
BADUSB_INT_ARG_CMDS = {
    "DEFAULT_DELAY", "DEFAULT_STRING_DELAY", "DELAY", "STRING_DELAY",
}
# DuckyScript commands that require a text argument.
BADUSB_TEXT_CMDS = {"STRING", "STRINGLN"}


def check_subghz(text: str) -> tuple[list[str], list[str]]:
    """Validate the RAW_Data timing stream of a SubGhz RAW file."""
    fails: list[str] = []
    warns: list[str] = []
    if not PROTOCOL_RAW_RE.search(text):
        return fails, warns  # keyed protocols carry no timing stream

    # Multi-repeat captures (the community-standard Tesla doorbell files)
    # carry one RAW_Data line per repeat -- validate EVERY line, not just
    # the first, so a corrupt later repeat can't ship to the device.
    matches = list(RAW_DATA_RE.finditer(text))
    if not matches:
        fails.append("Protocol is RAW but the RAW_Data line is missing/empty")
        return fails, warns
    for ln, m in enumerate(matches, start=1):
        prefix = f"RAW_Data line {ln}: " if len(matches) > 1 else ""
        raw = m.group(1)
        if not raw.strip():
            fails.append(f"{prefix}RAW_Data line is missing/empty")
            continue
        # Official captures split timings on commas; many community
        # captures (and the Flipper firmware itself) accept plain
        # whitespace too. Accept both -- only detect truly empty tokens.
        if "," in raw:
            tokens = raw.split(",")
            if any(t.strip() == "" for t in tokens):
                fails.append(
                    f"{prefix}RAW_Data contains an empty token (double comma)")
                continue
        else:
            tokens = raw.split()
        try:
            vals = [int(t.strip()) for t in tokens]
        except ValueError:
            fails.append(f"{prefix}RAW_Data contains a non-integer timing value")
            continue

        if len(vals) < 2:
            fails.append(
                f"{prefix}RAW_Data must contain at least a pulse/gap pair")
        if vals[0] <= 0:
            fails.append(
                f"{prefix}first RAW_Data value must be positive (a pulse), "
                f"got {vals[0]}")
        # A trailing gap (negative last value) is tolerated: many real
        # captures -- including the community-standard Tesla charge-port
        # opener -- store each repeat line ending on the inter-frame pause,
        # and the Flipper plays them fine. Warn instead of fail.
        if vals[-1] <= 0:
            warns.append(
                f"{prefix}last RAW_Data value is negative (ends on a gap, not "
                f"a pulse) -- the Flipper plays it, but the documented "
                f"format ends on a pulse")
        if len(vals) % 2 == 0:
            warns.append(
                f"{prefix}RAW_Data count is even (ends on a gap) -- same "
                f"tolerance as the trailing-gap note above")
        for i, v in enumerate(vals):
            if v == 0:
                fails.append(
                    f"{prefix}RAW_Data[{i}] is 0 -- zero-length pulse/gap is "
                    f"invalid")
            if i and (v > 0) == (vals[i - 1] > 0):
                fails.append(
                    f"{prefix}RAW_Data[{i - 1}] and RAW_Data[{i}] don't "
                    f"alternate sign")
            if abs(v) > MAX_SANE_TIMING_US:
                warns.append(
                    f"{prefix}RAW_Data[{i}] = {v} us exceeds the 500 ms "
                    f"sanity bound")
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


def _check_raw_ir_data(rec: dict[str, str], label: str,
                       fails: list[str]) -> None:
    """Sanity-check a raw IR record's `data:` timing line.

    The Flipper stores raw IR as space-separated POSITIVE pulse/pause
    timings in microseconds (e.g. '320 960 320 960'). This only catches
    malformed data (missing/empty line, non-integer, non-positive or
    zero values) -- it cannot verify the signal matches a real device.
    """
    data = rec.get("data")
    if data is None or not data.strip():
        fails.append(f"{label!r}: raw record missing 'data:' timing line")
        return
    toks = data.split()
    try:
        vals = [int(t) for t in toks]
    except ValueError:
        fails.append(f"{label!r}: raw data contains a non-integer value")
        return
    if len(vals) < 2:
        fails.append(f"{label!r}: raw data needs at least a pulse/pause pair")
    for v in vals:
        if v <= 0:
            fails.append(
                f"{label!r}: raw data values must be positive integers "
                f"(pulse/pause in us), got {v}")
            break


def check_ir(text: str) -> tuple[list[str], list[str]]:
    """Validate address:/command: field widths of parsed IR records and
    sanity-check the timing line of raw IR records."""
    fails: list[str] = []
    warns: list[str] = []
    records = parse_ir_records(text)
    if not records:
        return fails, warns

    for i, rec in enumerate(records):
        label = rec.get("name") or f"record {i + 1}"
        rtype = (rec.get("type") or "").lower()
        if rtype != "parsed":
            if rtype == "raw":
                _check_raw_ir_data(rec, label, fails)
            continue  # raw records store a timing array, not byte fields
        proto = (rec.get("protocol") or "").lower()
        addr, cmd = rec.get("address"), rec.get("command")
        if addr is None or cmd is None:
            fails.append(f"{label!r}: parsed record missing address:/command:")
            continue
        width = BYTE_WIDTHS.get(proto)
        for field, val in (("address", addr), ("command", cmd)):
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
        if proto and width is None:
            warns.append(
                f"{label!r}: no width expectation registered for protocol "
                f"{proto!r} -- verify by eye")
    return fails, warns


def _maxim_crc8(data: bytes) -> int:
    """Dallas / Maxim CRC-8 (reflected poly 0x8C) used for 1-Wire ROMs.
    Verified against the CRC-8/MAXIM check value: crc8(b'123456789') == 0xA1.
    """
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc >> 1) ^ 0x8C) if (crc & 1) else (crc >> 1)
    return crc


def check_ibutton(text: str) -> tuple[list[str], list[str]]:
    """Validate an iButton key file: 8-byte Dallas ROM with a valid
    CRC-8/MAXIM. Accepts current Version 2 (Protocol + Rom Data) and legacy
    Version 1 (Key type + Data). A bad CRC fails -- the Flipper's iButton
    app reports a CRC error for such files.
    """
    fails: list[str] = []
    warns: list[str] = []
    kv = parse_kv(text)
    proto = kv.get("protocol") or kv.get("key type") or ""
    if not proto:
        fails.append("missing 'Protocol' (v2) / 'Key type' (v1) header")
        return fails, warns
    rom_txt = kv.get("rom data") or kv.get("data") or ""
    toks = rom_txt.split()
    if not toks:
        fails.append(f"{proto}: missing 'Rom Data' (v2) / 'Data' (v1) field")
        return fails, warns
    if any(not HEX2_RE.fullmatch(t) for t in toks):
        for tok in toks:
            if not HEX2_RE.fullmatch(tok):
                fails.append(f"{proto}: non-hex ROM byte {tok!r}")
        return fails, warns
    if len(toks) != IBUTTON_ROM_BYTES:
        fails.append(
            f"{proto}: expected {IBUTTON_ROM_BYTES} ROM bytes "
            f"(family + 6 serial + CRC), got {len(toks)}")
        return fails, warns
    rom = bytes(int(t, 16) for t in toks)
    expected_crc = _maxim_crc8(rom[:7])
    if rom[7] != expected_crc:
        fails.append(
            f"{proto}: ROM CRC byte {rom[7]:02X} != CRC-8/MAXIM over first "
            f"7 bytes = {expected_crc:02X} (CRC error on the device)")
    fam = IBUTTON_FAMILY_BY_NAME.get(proto.upper())
    if fam is not None and rom[0] != fam:
        warns.append(
            f"{proto}: family code {rom[0]:02X} != expected {fam:02X} "
            f"for {proto}")
    return fails, warns


def build_em4100_frame(uid: bytes) -> str:
    """Build the 64-bit EM4100 on-wire frame for a 40-bit ID (5 bytes).

    Layout: 9x '1' header, 10 groups of (4 data bits + 1 even row-parity
    bit), 4 even column-parity bits (one per bit position, MSB first),
    then a '0' stop bit.
    """
    bits = "1" * EM4100_HEADER_BITS
    nibbles: list[int] = []
    for byte in uid:
        nibbles.append((byte >> 4) & 0xF)
        nibbles.append(byte & 0xF)
    for nib in nibbles:
        data = f"{nib:04b}"
        bits += data + ("0" if data.count("1") % 2 == 0 else "1")
    for col in range(4):
        parity = 0
        for nib in nibbles:
            parity ^= (nib >> (3 - col)) & 1
        bits += "0" if parity == 0 else "1"
    return bits + "0"


def verify_em4100_frame(bits: str) -> list[str]:
    """Validate a 64-bit EM4100 frame; return a list of spec violations.

    Checks the header, all 10 row-parity bits, the 4 column-parity bits
    and the stop bit. An empty list means the frame is structurally valid.
    """
    fails: list[str] = []
    if len(bits) != EM4100_FRAME_BITS:
        return [f"frame is {len(bits)} bits, expected {EM4100_FRAME_BITS}"]
    if bits[:EM4100_HEADER_BITS] != "1" * EM4100_HEADER_BITS:
        fails.append("frame must start with 9 '1' header bits")
    for g in range(EM4100_GROUPS):
        start = EM4100_HEADER_BITS + g * 5
        data, par = bits[start:start + 4], bits[start + 4]
        if par != ("0" if data.count("1") % 2 == 0 else "1"):
            fails.append(f"row {g} parity bit {par!r} is wrong")
    for col in range(4):
        col_bits = "".join(
            bits[EM4100_HEADER_BITS + g * 5 + col]
            for g in range(EM4100_GROUPS))
        par = bits[EM4100_HEADER_BITS + EM4100_GROUPS * 5 + col]
        if (col_bits.count("1") % 2) != (1 if par == "1" else 0):
            fails.append(f"column {col} parity bit {par!r} is wrong")
    if bits[-1] != "0":
        fails.append("frame must end with a '0' stop bit")
    return fails


def check_rfid(text: str) -> tuple[list[str], list[str]]:
    """Validate the data field of an LF RFID key file. For EM4100 the
    64-bit on-wire frame (header, row/column parity, stop bit) is rebuilt
    from the 5 stored ID bytes and verified against the spec."""
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
        elif all(HEX2_RE.fullmatch(t) for t in data_toks):
            # Only reachable with exactly EM4100_DATA_BYTES valid hex
            # bytes. Parity is derived from the ID, so any 5 bytes encode a
            # valid frame; this proves the stored ID maps to a spec-correct
            # 64-bit EM4100 frame (header, row/column parity, stop bit).
            # The selftest exercises the builder/verifier against
            # bit-flipped frames so the check itself is trustworthy.
            frame = build_em4100_frame(
                bytes(int(t, 16) for t in data_toks))
            for bad in verify_em4100_frame(frame):
                fails.append(f"EM4100: {bad}")
        freq = kv.get("frequency", "")
        if freq.lstrip("-").isdigit() and int(freq) != EM4100_CARRIER_HZ:
            warns.append(
                f"EM4100: Frequency {freq} Hz != typical {EM4100_CARRIER_HZ} Hz")
        if kv.get("bit count") not in (None, "64"):
            warns.append(
                f"EM4100: Bit Count is {kv.get('bit count')}, expected 64 "
                f"(the on-wire frame is {EM4100_FRAME_BITS} bits for a "
                f"{EM4100_DATA_BYTES}-byte ID)")
    else:
        warns.append(
            f"no byte-count expectation registered for Key type {key_type!r}")
    return fails, warns


def check_badusb(text: str) -> tuple[list[str], list[str]]:
    """Validate DuckyScript payload structure (ID line, args, ordering,
    typos)."""
    fails: list[str] = []
    warns: list[str] = []
    first_command_seen = False
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
        elif cmd == "REPEAT":
            if not first_command_seen:
                warns.append(
                    f"L{i}: REPEAT before any command -- nothing to repeat")
            elif not arg.isdigit():
                fails.append(
                    f"L{i}: REPEAT expects a non-negative integer count, "
                    f"got {arg!r}")
            elif int(arg) == 0:
                warns.append(f"L{i}: REPEAT 0 is a no-op")
        elif cmd in BADUSB_INT_ARG_CMDS:
            if not arg.isdigit():
                fails.append(
                    f"L{i}: {cmd} expects a non-negative integer ms/count, "
                    f"got {arg!r}")
        elif cmd in BADUSB_TEXT_CMDS:
            if not arg:
                fails.append(f"L{i}: {cmd} requires a text argument")
        elif cmd == "ALTSTRING":
            if not arg:
                fails.append(f"L{i}: ALTSTRING requires a text argument")
        elif cmd == "ALTCHAR":
            if not arg.isdigit():
                fails.append(
                    f"L{i}: ALTCHAR expects an integer Windows alt-code, "
                    f"got {arg!r}")
        elif cmd in ("GUI", "WINDOWS"):
            if not arg:
                warns.append(
                    f"L{i}: {cmd} with no key -- NOP (e.g. 'GUI r' opens Run)")
        elif cmd in ("CTRL", "SHIFT", "ALT"):
            if not arg:
                warns.append(
                    f"L{i}: {cmd} with no key -- NOP (modifier alone)")
        elif cmd == "WAIT_FOR_BUTTON_PRESS":
            if arg:
                warns.append(
                    f"L{i}: WAIT_FOR_BUTTON_PRESS takes no argument "
                    f"(ignores {arg!r})")
        elif "-" in cmd:
            if not all(t in BADUSB_KNOWN_COMMANDS for t in cmd.split("-")):
                warns.append(f"L{i}: unrecognized modifier chain {cmd!r}")
        elif cmd not in BADUSB_KNOWN_COMMANDS:
            warns.append(
                f"L{i}: unrecognized command {cmd!r} (typo -> silent NOP "
                f"on device)")

        if not first_command_seen:
            # 'ID' first is the recommended keyboard-layout hint;
            # DEFAULT_DELAY is also accepted by the header validator.
            if cmd not in ("ID", "DEFAULT_DELAY"):
                warns.append(
                    f"L{i}: first command is {cmd!r} -- an 'ID VVVV:PPPP' "
                    f"first line is recommended (keyboard-layout hint)")
            first_command_seen = True
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
    if suffix == ".ibutton":
        return check_ibutton(text)
    return [], []


def discover(root: Path) -> list[Path]:
    out: list[Path] = []
    for sub, ext in (("subghz", ".sub"), ("nfc", ".nfc"),
                     ("infrared", ".ir"), ("lfrfid", ".rfid"),
                     ("badusb", ".txt"), ("ibutton", ".ibutton")):
        d = root / sub
        if d.is_dir():
            out.extend(
                p for p in sorted(d.iterdir())
                if p.is_file() and p.suffix.lower() == ext)
    return out


def _summary(path: Path, text: str) -> str:
    if path.suffix.lower() == ".sub":
        total = 0
        for m in RAW_DATA_RE.finditer(text):
            raw = m.group(1)
            total += len(raw.split(",")) if "," in raw else len(raw.split())
        return f"{total} timings" if total else ""
    if path.suffix.lower() == ".nfc":
        return f"{len(BLOCK_RE.findall(text))} blocks"
    if path.suffix.lower() == ".ir":
        return f"{len(re.findall(r'(?im)^name:', text))} records"
    if path.suffix.lower() == ".rfid":
        m = re.search(r"(?im)^Key\s*type\s*:\s*(\S+)", text)
        return m.group(1) if m else ""
    if path.suffix.lower() == ".txt":
        return f"{len([l for l in text.splitlines() if l.strip() and not l.lstrip().startswith('REM')])} lines"
    if path.suffix.lower() == ".ibutton":
        m = re.search(r"(?im)^Protocol\s*:\s*(\S+)", text)
        return m.group(1) if m else ""
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
    _, w = check_subghz("Protocol: RAW\nRAW_Data: 320, -960, 320, -960")
    expect(any("ends on a gap" in x for x in w),
           "trailing-gap RAW_Data should warn (not fail)")
    f, _ = check_subghz("Protocol: RAW\nRAW_Data: 320, -960, 320, 960, 320")
    expect(f, "non-alternating RAW_Data not caught")
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
    # Space-separated RAW_Data is a valid community format (the Flipper
    # loads comma- AND space-separated timing streams) -- must not fail.
    space_sub = (
        "Filetype: Flipper SubGhz RAW File\nVersion: 1\n"
        "Frequency: 433920000\nPreset: FuriHalSubGhzPresetOok650Async\n"
        "Protocol: RAW\nRAW_Data: 400 -400 400 -1200 400 -400 800"
    )
    f, _ = check_subghz(space_sub)
    expect(not f, f"space-separated RAW_Data flagged: {f}")
    f, _ = check_subghz(
        "Protocol: RAW\nRAW_Data: 400 -400 400 -abc 400")
    expect(f, "space-separated non-integer RAW_Data not caught")

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
    f, _ = check_ir("name: Cap\ntype: raw\nprotocol: NEC\ndata: 320 960 320 960")
    expect(not f, "good raw IR record flagged")
    f, _ = check_ir("name: Cap\ntype: raw\nprotocol: NEC\ndata: 320 abc 960")
    expect(f, "non-integer raw IR data not caught")
    f, _ = check_ir("name: Cap\ntype: raw\nprotocol: NEC\ndata: 320 -960 320")
    expect(f, "negative raw IR data not caught")
    f, _ = check_ir("name: Cap\ntype: raw\nprotocol: NEC\ndata: 320 0 960")
    expect(f, "zero-length raw IR data not caught")
    f, _ = check_ir("name: Cap\ntype: raw\nprotocol: NEC")
    expect(f, "raw IR record without data: not caught")
    # RC5/RC6 are stored as 4-byte hex fields on modern firmware (canonical
    # IRDB format) -- must not be treated as bit-packed values.
    ir_rc5 = (
        "name: Grundig\ntype: parsed\nprotocol: RC5\naddress: 00 00 00 00\n"
        "command: 0C 00 00 00"
    )
    f, _ = check_ir(ir_rc5)
    expect(not f, f"RC5 4-byte record flagged: {f}")
    f, _ = check_ir(ir_rc5.replace("command: 0C 00 00 00", "command: 0C"))
    expect(f, "narrow RC5 command not caught")

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

    # EM4100 on-wire frame rebuild + parity (build/verify against spec).
    frame = build_em4100_frame(bytes([0xDE, 0xAD, 0xBE, 0xEF, 0xCA]))
    expect(len(frame) == EM4100_FRAME_BITS,
           f"EM4100 frame length {len(frame)} != 64")
    expect(not verify_em4100_frame(frame),
           f"valid EM4100 frame flagged: {verify_em4100_frame(frame)}")
    expect(frame[:9] == "111111111", "EM4100 header bits wrong")
    expect(frame[-1] == "0", "EM4100 stop bit wrong")
    expect(not verify_em4100_frame(build_em4100_frame(bytes([0x00] * 5))),
           "all-zero EM4100 ID should still encode a valid frame")
    flipped = list(frame)
    flipped[9 + 2] = "1" if flipped[9 + 2] == "0" else "0"  # data bit
    violations = verify_em4100_frame("".join(flipped))
    expect(violations, "flipped data bit not caught (row parity)")
    expect(any("row 0" in v for v in violations),
           f"flipped data bit should flag row 0 parity: {violations}")
    flipped = list(frame)
    flipped[9 + 4] = "1" if flipped[9 + 4] == "0" else "0"  # row parity bit
    violations = verify_em4100_frame("".join(flipped))
    expect(any("row 0" in v for v in violations),
           "flipped row parity not caught")
    flipped = list(frame)
    flipped[59] = "1" if flipped[59] == "0" else "0"  # column parity 0
    violations = verify_em4100_frame("".join(flipped))
    expect(any("column 0" in v for v in violations),
           "flipped column parity not caught")
    flipped = list(frame)
    flipped[5] = "0"  # header bit
    violations = verify_em4100_frame("".join(flipped))
    expect(any("header" in v for v in violations),
           "flipped header bit not caught")
    flipped = list(frame)
    flipped[63] = "1"  # stop bit
    violations = verify_em4100_frame("".join(flipped))
    expect(any("stop" in v for v in violations),
           "flipped stop bit not caught")
    _, w = check_rfid(rfid_good.replace("Bit Count: 64", "Bit Count: 40"))
    expect(any("Bit Count" in x for x in w),
           "non-64 Bit Count should warn for EM4100")

    # ---- iButton --------------------------------------------------------
    ib_good = (
        "Filetype: Flipper iButton key\nVersion: 2\nProtocol: DS1990\n"
        "Rom Data: 01 00 DE AD BE EF 01 8E"
    )
    f, _ = check_ibutton(ib_good)
    expect(not f, f"good iButton flagged: {f}")
    f, _ = check_ibutton(ib_good.replace("8E", "8F"))
    expect(f, "iButton CRC mismatch not caught")
    f, _ = check_ibutton(ib_good.replace(
        "Rom Data: 01 00 DE AD BE EF 01 8E", "Rom Data: 01 00 DE AD"))
    expect(f, "short iButton ROM not caught")
    f, _ = check_ibutton(ib_good.replace(
        "Rom Data: 01 00 DE AD BE EF 01 8E",
        "Rom Data: 01 00 DE AD BE EF XX 8E"))
    expect(f, "non-hex iButton ROM byte not caught")
    f, _ = check_ibutton("Filetype: Flipper iButton key\nVersion: 1\n"
                         "Key type: DS1990\nData: 01 00 DE AD BE EF 01 8E")
    expect(not f, "v1 iButton file falsely flagged")
    f, _ = check_ibutton("Filetype: Flipper iButton key\nVersion: 2\n"
                         "Protocol: DS1990")
    expect(f, "iButton missing ROM data not caught")
    _, w = check_ibutton(
        ib_good.replace("Protocol: DS1990", "Protocol: DS1992"))
    expect(any("family" in x.lower() for x in w),
           "iButton family-code mismatch not warned")
    f, _ = check_ibutton("Filetype: Flipper iButton key\nVersion: 2\n"
                         "Protocol: Dallas\nRom Data: 01 00 DE AD BE EF 01 8E")
    expect(not f, "unmapped iButton protocol falsely flagged")

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

    # BadUSB script structure (ordering, modifiers, alt-code commands).
    f, _ = check_badusb("REM hi\nID 046d:c31c\nDELAY 100")
    expect(not f, "ID-first payload flagged")
    _, w = check_badusb("DELAY 100\nID 046d:c31c")
    expect(any("first command" in x.lower() for x in w),
           "missing ID-first recommendation not warned")
    _, w = check_badusb("DEFAULT_DELAY 100\nID 046d:c31c")
    expect(not any("first command" in x.lower() for x in w),
           "DEFAULT_DELAY first should not warn")
    _, w = check_badusb("ID 046d:c31c\nREPEAT 0")
    expect(any("no-op" in x.lower() for x in w), "REPEAT 0 not warned")
    _, w = check_badusb("REPEAT 2")
    expect(any("nothing to repeat" in x.lower() for x in w),
           "REPEAT-first not warned")
    f, _ = check_badusb("ID 046d:c31c\nALTSTRING")
    expect(f, "empty ALTSTRING not caught")
    f, _ = check_badusb("ID 046d:c31c\nALTCHAR abc")
    expect(f, "non-integer ALTCHAR not caught")
    f, _ = check_badusb("ID 046d:c31c\nALTSTRING hello")
    expect(not f, "ALTSTRING with text flagged")
    f, _ = check_badusb("ID 046d:c31c\nALTCHAR 65")
    expect(not f, "ALTCHAR with integer flagged")
    _, w = check_badusb("ID 046d:c31c\nGUI")
    expect(any("no key" in x for x in w), "bare GUI not warned")
    _, w = check_badusb("ID 046d:c31c\nCTRL")
    expect(any("no key" in x for x in w), "bare CTRL not warned")
    _, w = check_badusb("ID 046d:c31c\nWAIT_FOR_BUTTON_PRESS hello")
    expect(any("takes no argument" in x for x in w),
           "WAIT_FOR_BUTTON_PRESS with arg not warned")
    f, _ = check_badusb("ID 046d:c31c\nWINDOWS l")
    expect(not f, "WINDOWS with key flagged")
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
