@echo off
REM ───────────────────────────────────────────────────────────────────────
REM  Flipper-sync wrapper: forward to flipper-sync.ps1 with the right policy.
REM  Usage:    flipper-sync               (real sync)
REM            flipper-sync --dry-run     (show what would change)
REM ───────────────────────────────────────────────────────────────────────

setlocal
set "SCRIPT=%~dp0flipper-sync.ps1"

if not exist "%SCRIPT%" (
    echo flipper-sync.ps1 not found next to this .cmd 1>&2
    exit /b 2
)

if /I "%~1"=="--dry-run" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -DryRun
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
)

endlocal
