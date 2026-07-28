# install-autosync.ps1 — FlipperZero hub.
# Idempotently registers/updates the `flipperzero-sync` and `flipperzero-health` Windows Task Scheduler entries.
# Run from an elevated PowerShell.

[CmdletBinding()]
param(
    [string]$ScriptPath = "C:\Users\bugre\FlipperZero\consolidation\autosync.ps1",
    [string]$TaskName   = "flipperzero-sync",
    [string]$RunTime    = "08:00",
    [string]$HealthScriptPath = "C:\Users\bugre\FlipperZero\consolidation\health-server.py",
    [string]$HealthTaskName   = "flipperzero-health",
    [switch]$SkipElevationCheck,
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

# Scheduled-task registration requires elevation unless testing.
if (-not $WhatIf -and -not $SkipElevationCheck -and
    -not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must be run from an elevated PowerShell (Run as Administrator)."
}

if (-not (Test-Path $ScriptPath)) {
    throw "Cannot find script at $ScriptPath"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At $RunTime

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

$newTask = New-ScheduledTask `
    -Action       $action `
    -Trigger      $trigger `
    -Settings     $settings `
    -Description  "Auto-sync FlipperZero from origin (git fetch + ff-only pull)."

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($WhatIf) {
    $verb = if ($existing) { "update" } else { "create" }
    Write-Host "WhatIf: $verb scheduled task '$TaskName' (daily at $RunTime)."
} else {
    Register-ScheduledTask -TaskName $TaskName -InputObject $newTask -Force | Out-Null
    if ($existing) {
        Write-Host "Updated '$TaskName' in place."
    } else {
        Write-Host "Created '$TaskName' (daily at $RunTime)."
    }
}

# Register health-server task (runs at logon, stays running)
if (-not (Test-Path $HealthScriptPath)) {
    throw "Cannot find health server at $HealthScriptPath"
}

$healthDir = Split-Path -Parent $HealthScriptPath

$healthAction = New-ScheduledTaskAction `
    -Execute "pythonw.exe" `
    -Argument "`"$HealthScriptPath`"" `
    -WorkingDirectory $healthDir

$healthTrigger = New-ScheduledTaskTrigger -AtLogon

$healthSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

$healthTask = New-ScheduledTask `
    -Action       $healthAction `
    -Trigger      $healthTrigger `
    -Settings     $healthSettings `
    -Description  "Health endpoint for FlipperZero autosync."

$existingHealth = Get-ScheduledTask -TaskName $HealthTaskName -ErrorAction SilentlyContinue
if ($WhatIf) {
    $verb = if ($existingHealth) { "update" } else { "create" }
    Write-Host "WhatIf: $verb scheduled task '$HealthTaskName' (runs at logon)."
} else {
    Register-ScheduledTask -TaskName $HealthTaskName -InputObject $healthTask -Force | Out-Null
    if ($existingHealth) {
        Write-Host "Updated '$HealthTaskName' in place."
    } else {
        Write-Host "Created '$HealthTaskName' (runs at logon)."
    }
}

if ($WhatIf) {
    exit 0
}

Write-Host ""
Write-Host "Run now:           Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Health endpoint:   http://127.0.0.1:17779/health"
Write-Host "Tail the log:      Get-Content '$ScriptPath\..\autosync.log' -Wait"
Write-Host "Unregister sync:   Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host "Unregister health: Unregister-ScheduledTask -TaskName '$HealthTaskName' -Confirm:`$false"
