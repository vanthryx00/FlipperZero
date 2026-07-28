# install-autosync.ps1 — FlipperZero hub.
# Idempotently registers/updates the `flipperzero-sync` Windows Task Scheduler entry.
# Run from an elevated PowerShell.

[CmdletBinding()]
param(
    [string]$ScriptPath = "C:\Users\bugre\FlipperZero\consolidation\autosync.ps1",
    [string]$TaskName   = "flipperzero-sync",
    [string]$RunTime    = "08:00"
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
    Set-ScheduledTask -TaskName $TaskName -InputObject $newTask | Out-Null
    Write-Host "Updated '$TaskName' in place (run history preserved)."
}

Write-Host ""
Write-Host "Run now:           Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Tail the log:      Get-Content '$ScriptPath\..\autosync.log' -Wait"
Write-Host "Unregister:        Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
