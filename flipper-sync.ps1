<#
.SYNOPSIS
    Sync everything in %USERPROFILE%\FlipperZero onto a plugged-in Flipper Zero.

.DESCRIPTION
    Runs the two workspace validators first -- scripts\verify_flipper_files.py
    (header check) then scripts\test_flipper_payloads.py (data tests). If
    either fails, the sync aborts (exit code 3) without touching the device.

    Then scans every removable drive (C-H) for the canonical Flipper SD-card
    marker pair (apps\ AND subghz\ as folders). When found, copies the
    workspace contents onto the device's SD card root. Skips PC-only
    content: _vendor\ (local qFlipper cache), scripts\ and
    consolidation\ (PC-side tooling), .git\, and top-level helper files
    (README.md, flipper-sync.*, .gitignore, etc.).

.PARAMETER DryRun
    Show what would be copied without writing.

.OUTPUTS
    Exit codes: 0 = ok (validated and synced), 1 = no Flipper detected,
    2 = workspace missing, 3 = validator failed (abort before copy).

.EXAMPLE
    PS> .\flipper-sync.ps1
    Flipper Zero detected on D:\
    Copying 3 files into D:\apps\
    ...

.EXAMPLE
    PS> .\flipper-sync.ps1 -DryRun
    (would copy ...) ...
#>

[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$src = Join-Path $env:USERPROFILE 'FlipperZero'

if (-not (Test-Path -LiteralPath $src -PathType Container)) {
    Write-Host "Workspace missing: $src" -ForegroundColor Red
    exit 2
}

# PC-only content -- never push these onto the device.
$skip_dirs = @('_vendor', 'scripts', 'consolidation', '.git')

function Test-IsFlipperDrive {
    param([string]$Path)
    return (
        (Test-Path -LiteralPath (Join-Path $Path 'apps')     -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $Path 'subghz')   -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $Path 'infrared') -PathType Container)
    )
}

function Find-FlipperDrive {
    foreach ($letter in 'C','D','E','F','G','H') {
        $drive = "${letter}:\"
        if (-not (Test-Path -LiteralPath $drive)) { continue }
        if (Test-IsFlipperDrive -Path $drive) {
            return $drive
        }
    }
    return $null
}

function Sync-Folder {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Indent = '',
        [switch]$Root
    )
    $entries = Get-ChildItem -LiteralPath $Source -Force
    foreach ($e in $entries) {
        if ($e.Name -in $skip_dirs) { continue }
        # At the workspace root only, skip PC-side helper files.
        if ($Root -and -not $e.PSIsContainer -and
            ($e.Name -eq '.gitignore' -or $e.Extension -in @('.md', '.cmd', '.ps1'))) {
            continue
        }
        $target = Join-Path $Destination $e.Name
        if ($e.PSIsContainer) {
            if (-not (Test-Path -LiteralPath $target)) {
                if ($DryRun) { Write-Host "$Indent(would mkdir) $target" }
                else { New-Item -ItemType Directory -Path $target -Force | Out-Null }
            }
            Sync-Folder -Source $e.FullName -Destination $target -Indent ($Indent + '  ')
        } else {
            $size_kb = [math]::Round($e.Length / 1024, 1)
            if ($DryRun) {
                Write-Host "$Indent(would copy) $($e.FullName.Substring($src.Length))  ($size_kb KB)"
            } else {
                Copy-Item -LiteralPath $e.FullName -Destination $target -Force
                Write-Host "$Indent$($e.FullName.Substring($src.Length))  ($size_kb KB)" -ForegroundColor Gray
            }
        }
    }
}

function Invoke-WorkspaceValidation {
    # Every sync is gated on both validators: the header check and the
    # data tests. Fail-fast here -- cheaper than pushing broken payloads
    # to the device only for them to fail on the Flipper screen.
    $py = $null
    foreach ($candidate in @('python', 'py')) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            $py = $candidate
            break
        }
    }
    if (-not $py) {
        Write-Host "Python not found on PATH -- cannot run validators (required before every sync)." -ForegroundColor Red
        Write-Host "Install Python 3 and/or add it to PATH, then re-run." -ForegroundColor Red
        exit 3
    }

    $headerScript = Join-Path $src 'scripts\verify_flipper_files.py'
    $dataScript   = Join-Path $src 'scripts\test_flipper_payloads.py'

    Write-Host ""
    Write-Host "=== Header validator (verify_flipper_files.py) ===" -ForegroundColor Cyan
    & $py $headerScript $src
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Header validation FAILED. Fix the issues above and re-run." -ForegroundColor Red
        exit 3
    }

    Write-Host ""
    Write-Host "=== Data tests (test_flipper_payloads.py) ===" -ForegroundColor Cyan
    & $py $dataScript --root $src
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Data tests FAILED. Fix the issues above and re-run." -ForegroundColor Red
        exit 3
    }
    Write-Host ""
    Write-Host "Workspace validators passed." -ForegroundColor Green
}

# ───── main ─────
Invoke-WorkspaceValidation

$flipper = Find-FlipperDrive
if (-not $flipper) {
    Write-Host "Flipper Zero not detected on C:\, D:\, E:\, F:\, G:\, H:\" -ForegroundColor Yellow
    Write-Host "Make sure the device is plugged in and in USB MSD mode (Settings → Storage → USB)." -ForegroundColor Yellow
    exit 1
}

Write-Host "Flipper Zero detected at ${flipper}." -ForegroundColor Cyan
if ($DryRun) { Write-Host "(dry run; nothing will be written)" -ForegroundColor DarkCyan }

Sync-Folder -Source $src -Destination $flipper -Root

if (-not $DryRun) {
    Write-Host ""
    Write-Host "Done. Safely eject the Flipper (right-click the tray icon → 'Eject') before unplugging." -ForegroundColor Green
}
