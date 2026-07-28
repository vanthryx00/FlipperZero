# install-autosync.ps1 — FlipperZero hub.
# Idempotently registers/updates the `flipperzero-sync` Windows Task Scheduler entry.
# Run from an elevated PowerShell.

[CmdletBinding()]
param(
    [string]$ScriptPath = "C:\Users\bugre\FlipperZero\consolidation\autosync.ps1",
    [string]$TaskName   = "flipperzero-sync",
    [string]$RunTime    = "08:00",
    [string]$HealthScriptPath = "C:\Users\bugre\FlipperZero\consolidation\health-server.py",
    [string]$HealthTaskName   = "flipperzero-health"
)

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
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Description "Auto-sync FlipperZero from origin (git fetch + ff-only pull)."

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -eq $existing) {
    Register-ScheduledTask -TaskName $TaskName -InputObject $newTask | Out-Null
    Write-Host "Created '$TaskName' (daily at $RunTime)."
} else {
    Set-ScheduledTask -InputObject $newTask | Out-Null
    Write-Host "Updated '$TaskName' in place (run history preserved)."
}

# Register health-server task (runs at logon, stays running)
if (-not (Test-Path $HealthScriptPath)) {
    throw "Cannot find health server at $HealthScriptPath"
}

$healthAction = New-ScheduledTaskAction `
    -Execute "python.exe" `
    -Argument "`"$HealthScriptPath`""

$healthTrigger = New-ScheduledTaskTrigger -AtLogon

$healthSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

$healthTask = New-ScheduledTask `
    -Action    $healthAction `
    -Trigger   $healthTrigger `
    -Settings  $healthSettings `
    -Description "Health endpoint for FlipperZero autosync."

$existingHealth = Get-ScheduledTask -TaskName $HealthTaskName -ErrorAction SilentlyContinue
if ($null -eq $existingHealth) {
    Register-ScheduledTask -TaskName $HealthTaskName -InputObject $healthTask | Out-Null
    Write-Host "Created '$HealthTaskName' (runs at logon)."
} else {
    Set-ScheduledTask -InputObject $healthTask | Out-Null
    Write-Host "Updated '$HealthTaskName' in place."
}

Write-Host ""
Write-Host "Run now:           Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Health endpoint:   http://127.0.0.1:17779/health"
Write-Host "Tail the log:      Get-Content '$ScriptPath\..\autosync.log' -Wait"
Write-Host "Unregister sync:   Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host "Unregister health: Unregister-ScheduledTask -TaskName '$HealthTaskName' -Confirm:`$false"
