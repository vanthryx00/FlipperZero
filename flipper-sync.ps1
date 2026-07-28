<#
.SYNOPSIS
    Sync everything in %USERPROFILE%\FlipperZero onto a plugged-in Flipper Zero.

.DESCRIPTION
    Scans every removable drive (C-H) for the canonical Flipper SD-card
    marker pair (apps\ AND subghz\ as folders). When found, copies the
    workspace contents onto the device's SD card root. Skips _vendor\
    intentionally — never copy the local qFlipper cache onto a device.

.PARAMETER DryRun
    Show what would be copied without writing.

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

# Vendor cache stays local — do NOT copy it onto the device.
$skip_name = '_vendor'

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
        [string]$Indent = ''
    )
    $entries = Get-ChildItem -LiteralPath $Source -Force
    foreach ($e in $entries) {
        if ($e.Name -eq $skip_name) { continue }
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

# ───── main ─────
$flipper = Find-FlipperDrive
if (-not $flipper) {
    Write-Host "Flipper Zero not detected on C:\, D:\, E:\, F:\, G:\, H:\" -ForegroundColor Yellow
    Write-Host "Make sure the device is plugged in and in USB MSD mode (Settings → Storage → USB)." -ForegroundColor Yellow
    exit 1
}

Write-Host "Flipper Zero detected at ${flipper}." -ForegroundColor Cyan
if ($DryRun) { Write-Host "(dry run; nothing will be written)" -ForegroundColor DarkCyan }

Sync-Folder -Source $src -Destination $flipper

if (-not $DryRun) {
    Write-Host ""
    Write-Host "Done. Safely eject the Flipper (right-click the tray icon → 'Eject') before unplugging." -ForegroundColor Green
}
