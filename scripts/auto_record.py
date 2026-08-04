#!/usr/bin/env python3
"""
auto_record.py — triple-recorder for laptop: keystrokes + audio + webcam.

Starts three parallel recorders and saves everything to timestamped folders
under scripts/_recordings/.  Press Ctrl+C to stop all recorders cleanly.

    python scripts/auto_record.py                  # all three
    python scripts/auto_record.py --no-keys        # audio + webcam only
    python scripts/auto_record.py --no-audio       # keys + webcam only
    python scripts/auto_record.py --no-webcam      # keys + audio only
    python scripts/auto_record.py --duration 30    # auto-stop after 30s

Perfect for verifying Flipper Zero BadUSB payloads — record exactly what
the payload types, what the system plays back, and what the webcam sees.

Requires:
    pip install pynput        # keystroke capture
    ffmpeg (already on PATH)  # audio + webcam capture
"""

from __future__ import annotations

import argparse
import queue
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════
# Config
# ═══════════════════════════════════════════════════════════════════════════

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "_recordings"

# Special-key name mapping (pynput → readable)
KEY_MAP: dict[str, str] = {
    "Key.space": " ",
    "Key.enter": "\n",
    "Key.tab": "\t",
    "Key.backspace": "[BKSP]",
    "Key.delete": "[DEL]",
    "Key.shift": "[SHIFT]",
    "Key.shift_r": "[SHIFT_R]",
    "Key.ctrl": "[CTRL]",
    "Key.ctrl_r": "[CTRL_R]",
    "Key.alt": "[ALT]",
    "Key.alt_r": "[ALT_R]",
    "Key.alt_gr": "[ALTGR]",
    "Key.cmd": "[WIN]",
    "Key.cmd_r": "[WIN_R]",
    "Key.esc": "[ESC]",
    "Key.caps_lock": "[CAPS]",
    "Key.num_lock": "[NUMLK]",
    "Key.scroll_lock": "[SCROLL]",
    "Key.print_screen": "[PRTSC]",
    "Key.insert": "[INS]",
    "Key.home": "[HOME]",
    "Key.end": "[END]",
    "Key.page_up": "[PGUP]",
    "Key.page_down": "[PGDN]",
    "Key.up": "[UP]",
    "Key.down": "[DOWN]",
    "Key.left": "[LEFT]",
    "Key.right": "[RIGHT]",
    "Key.f1": "[F1]",  "Key.f2": "[F2]",  "Key.f3": "[F3]",  "Key.f4": "[F4]",
    "Key.f5": "[F5]",  "Key.f6": "[F6]",  "Key.f7": "[F7]",  "Key.f8": "[F8]",
    "Key.f9": "[F9]",  "Key.f10": "[F10]", "Key.f11": "[F11]", "Key.f12": "[F12]",
    "Key.media_volume_up": "[VOL+]",
    "Key.media_volume_down": "[VOL-]",
    "Key.media_volume_mute": "[MUTE]",
    "Key.media_play_pause": "[PLAY/PAUSE]",
    "Key.media_next": "[NEXT]",
    "Key.media_previous": "[PREV]",
}


def _now_tag() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ═══════════════════════════════════════════════════════════════════════════
# Keystroke recorder
# ═══════════════════════════════════════════════════════════════════════════

def _key_recorder(session: Path, stop: threading.Event) -> None:
    from pynput import keyboard

    log_path = session / "keystrokes.log"
    buf: list[str] = []
    last_flush = time.monotonic()

    def flush() -> None:
        nonlocal last_flush
        if buf:
            with open(log_path, "a", encoding="utf-8") as f:
                for line in buf:
                    f.write(line + "\n")
            buf.clear()
            last_flush = time.monotonic()

    def on_press(key: keyboard.Key | keyboard.KeyCode | None) -> None:
        nonlocal last_flush
        if key is None:
            return
        ts = _now_iso()
        try:
            ch = key.char  # type: ignore[union-attr]
            buf.append(f"{ts}  CHAR  {ch!r}")
        except AttributeError:
            name = str(key)
            mapped = KEY_MAP.get(name, f"[{name}]")
            buf.append(f"{ts}  KEY   {mapped}")
        # Flush every 1s or 20 lines
        if len(buf) >= 20 or time.monotonic() - last_flush > 1.0:
            flush()

    def on_release(key: keyboard.Key | keyboard.KeyCode | None) -> None:
        if key == keyboard.Key.f12 and getattr(keyboard, "Controller", None):
            # F12 alone = emergency stop (only if ctrl is not held)
            pass

    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"# Auto-recorder keystroke log\n")
        f.write(f"# Started: {_now_iso()}\n")
        f.write(f"# Format: TIMESTAMP  TYPE  VALUE\n")
        f.write(f"# Press F12 twice to trigger emergency stop.\n\n")

    listener = keyboard.Listener(on_press=on_press)
    listener.start()

    # Emergency stop: double-F12
    f12_count = 0
    f12_timer = 0.0

    def _f12_check(key: keyboard.Key | keyboard.KeyCode | None) -> None:
        nonlocal f12_count, f12_timer
        try:
            _ = key.char  # type: ignore[union-attr]
            f12_count = 0
            return
        except AttributeError:
            pass
        if str(key) == "Key.f12":
            now = time.monotonic()
            if now - f12_timer < 1.5:
                f12_count += 1
                if f12_count >= 2:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(f"\n{_now_iso()}  STOP  Emergency stop (double-F12)\n")
                    stop.set()
            else:
                f12_count = 1
            f12_timer = now
        else:
            f12_count = 0

    # Re-hook for release detection
    listener.stop()
    listener = keyboard.Listener(on_press=on_press, on_release=_f12_check)
    listener.start()

    while not stop.is_set():
        time.sleep(0.25)

    listener.stop()
    flush()
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"{_now_iso()}  STOP  Recording stopped\n")
    print(f"  [keys]  saved -> {log_path}")


# ═══════════════════════════════════════════════════════════════════════════
# Audio recorder (ffmpeg: system loopback or mic)
# ═══════════════════════════════════════════════════════════════════════════

def _audio_recorder(session: Path, stop: threading.Event, device: str | None = None) -> None:
    out_path = session / "audio.wav"

    if device:
        devices = [device]
    else:
        # Stereo Mix = system audio (best for payload testing).
        # Fall back to Internal Mic if Stereo Mix isn't available.
        devices = [
            "Stereo Mix (Conexant ISST Audio)",
            "Internal Microphone (Conexant ISST Audio)",
        ]

    proc = None
    for dev in devices:
        args = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "dshow", "-i", f"audio={dev}",
            "-ac", "1", "-ar", "22050", "-acodec", "pcm_s16le",
            str(out_path),
        ]
        try:
            proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(2)
            if proc.poll() is not None:
                proc = None
                continue
            break
        except Exception:
            proc = None
            continue

    if proc is None:
        print(f"  [audio] WARNING: could not open any audio device")
        return

    while not stop.is_set():
        time.sleep(0.25)

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

    if out_path.exists() and out_path.stat().st_size > 44:
        print(f"  [audio] saved -> {out_path}  ({out_path.stat().st_size} bytes)")
    else:
        print(f"  [audio] WARNING: no audio captured")
        if out_path.exists():
            out_path.unlink()


# ═══════════════════════════════════════════════════════════════════════════
# Webcam recorder (ffmpeg: capture one frame every N seconds → timelapse)
# ═══════════════════════════════════════════════════════════════════════════

def _webcam_recorder(session: Path, stop: threading.Event, fps: float = 2.0) -> None:
    """
    Captures from the default webcam at `fps` frames/sec into a video file.
    On most laptops this records smoothly at 2–5 fps — perfect for reviewing
    what was on screen during a payload test.
    """
    out_path = session / "webcam.mp4"

    # Use 'video=HP HD Camera' or just 'video=Integrated Camera'
    # On Windows, 'video=video' often picks the first webcam.
    # Try common names; fall back to device list via ffmpeg -list_devices.
    cameras = [
        "video=HP HD Camera",
        "video=Integrated Camera",
        "video=USB Camera",
    ]

    proc = None
    for cam in cameras:
        args = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "dshow",
            "-i", cam,
            "-r", str(fps),
            "-vcodec", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            str(out_path),
        ]
        try:
            proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(2)
            if proc.poll() is not None:
                # ffmpeg exited — try next camera
                proc = None
                continue
            break
        except Exception:
            continue

    if proc is None:
        print(f"  [webcam] WARNING: could not open any webcam device")
        return

    while not stop.is_set():
        time.sleep(0.25)

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

    if out_path.exists() and out_path.stat().st_size > 1024:
        print(f"  [webcam] saved -> {out_path}  ({out_path.stat().st_size} bytes)")
    else:
        print(f"  [webcam] WARNING: no webcam frames captured")
        if out_path.exists():
            out_path.unlink()


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Triple laptop recorder: keystrokes + audio + webcam"
    )
    ap.add_argument("--no-keys", action="store_true", help="Skip keystroke recording")
    ap.add_argument("--no-audio", action="store_true", help="Skip audio recording")
    ap.add_argument("--no-webcam", action="store_true", help="Skip webcam recording")
    ap.add_argument("--audio-device", help="Audio device name (default: auto-detect)")
    ap.add_argument("--webcam-fps", type=float, default=2.0, help="Webcam capture fps (default: 2)")
    ap.add_argument("--duration", type=float, default=0, help="Auto-stop after N seconds (0 = run until Ctrl+C)")
    ap.add_argument("--tag", help="Session tag appended to folder name")
    args = ap.parse_args()

    tag = _now_tag()
    if args.tag:
        tag = f"{tag}_{args.tag}"
    session = OUT_DIR / tag
    session.mkdir(parents=True, exist_ok=True)

    stop = threading.Event()

    # Graceful shutdown on Ctrl+C
    def _sigint(_sig: int, _frame: object) -> None:
        print("\n\n[STOP] Stopping recorders...\n")
        stop.set()
    signal.signal(signal.SIGINT, _sigint)

    threads: list[threading.Thread] = []

    print(f"[REC] Recording -> {session}\n")

    if not args.no_keys:
        t = threading.Thread(target=_key_recorder, args=(session, stop), daemon=True)
        t.start()
        threads.append(t)
        # Brief pause so pynput can hook the keyboard
        time.sleep(0.3)

    if not args.no_audio:
        t = threading.Thread(target=_audio_recorder, args=(session, stop, args.audio_device), daemon=True)
        t.start()
        threads.append(t)

    if not args.no_webcam:
        t = threading.Thread(target=_webcam_recorder, args=(session, stop, args.webcam_fps), daemon=True)
        t.start()
        threads.append(t)

    print("   Press Ctrl+C to stop | Double-tap F12 for emergency stop\n")

    if args.duration > 0:
        time.sleep(args.duration)
        print(f"\n[TIMER] Duration reached ({args.duration}s) -- stopping...\n")
        stop.set()
    else:
        try:
            while not stop.is_set():
                time.sleep(0.5)
        except KeyboardInterrupt:
            stop.set()

    for t in threads:
        t.join(timeout=5)

    # Summary
    print(f"\n[DONE] Session: {session.name}")
    for f in sorted(session.iterdir()):
        size = f.stat().st_size
        if size > 1024:
            print(f"   {f.name}  ({size:,} bytes)")
        else:
            print(f"   {f.name}  ({size} bytes)")
    print(f"\nFolder: {session}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
