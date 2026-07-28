# autosync.ps1 — FlipperZero hub.
# Pulls the latest committed state from `origin` for the current branch.
# Designed to be run silently by Windows Task Scheduler (Windows PowerShell 5.1+).
#
# Exit codes:
#   0  - up to date or fast-forwarded cleanly
#   1  - network / git error (logged)
#   2  - local branch has diverged (manual action required)

[CmdletBinding()]
param(
    [string]$RepoRoot    = "C:\Users\bugre\FlipperZero",
    [string]$LogFile     = "",
    [int]    $MaxLogKB   = 256,
    [int]    $MaxRetries = 3,
    [int]    $RetryDelaySec = 5,
    [string]$HealthFile  = "",
    [string]$EmailFrom   = "",
    [string]$EmailTo     = "",
    [string]$SmtpServer  = "",
    [int]    $SmtpPort   = 587,
    [string]$SmtpPassword = ""
)

# Resolve log path at runtime; $PSScriptRoot can be empty when invoked
# from non-standard shells (e.g. bash -> powershell.exe).
if ([string]::IsNullOrWhiteSpace($LogFile)) {
    $scriptPath = $MyInvocation.MyCommand.Path
    if ($scriptPath) {
        $scriptDir = Split-Path -Parent $scriptPath
        $LogFile = Join-Path $scriptDir "autosync.log"
    } else {
        $LogFile = Join-Path (Join-Path $RepoRoot "consolidation") "autosync.log"
    }
}

if ([string]::IsNullOrWhiteSpace($HealthFile)) {
    $healthDir = Split-Path -Parent $LogFile
    if (-not $healthDir) { $healthDir = $RepoRoot }
    $HealthFile = Join-Path $healthDir "autosync.health.json"
}

function Write-Log {
    param([string]$Msg)
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line  = "$stamp  [$env:USERNAME]  $Msg"
    Add-Content -Path $LogFile -Value $line
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length / 1KB) -gt $MaxLogKB) {
        $old = "$LogFile.old"
        Move-Item -Path $LogFile -Destination $old -Force
    }
}

function Write-Health {
    param([string]$Status, [string]$Message, [int]$ExitCode)
    $health = @{
        repo       = $RepoRoot
        checked_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        status     = $Status
        exit_code  = $ExitCode
        message    = $Message
    }
    $healthDir = Split-Path -Parent $HealthFile
    if ($healthDir -and -not (Test-Path $healthDir)) {
        New-Item -ItemType Directory -Path $healthDir -Force | Out-Null
    }
    $health | ConvertTo-Json -Depth 3 | Set-Content -Path $HealthFile -Force
}

function Send-Notification {
    param([string]$Subject, [string]$Body)
    # Windows Event Log (always available)
    $eventSource = "flipperzero-sync"
    try {
        if (-not [System.Diagnostics.EventLog]::SourceExists($eventSource)) {
            New-EventLog -LogName Application -Source $eventSource
        }
        Write-EventLog -LogName Application -Source $eventSource -EventId 1001 -EntryType Error -Message $Body -ErrorAction SilentlyContinue
    } catch {
        # Event log may require elevation; fail silently.
    }

    # BurntToast toast notification (best-effort)
    if (Get-Module -ListAvailable -Name BurntToast) {
        try {
            New-BurntToastNotification -Text $Subject, $Body -ErrorAction SilentlyContinue
        } catch {}
    }

    # Email alert if configured
    if ($EmailTo -and $SmtpServer -and $EmailFrom) {
        try {
            $smtp = New-Object System.Net.Mail.SmtpClient($SmtpServer, $SmtpPort)
            $smtp.EnableSsl = $true
            if ($SmtpPassword) {
                $smtp.Credentials = New-Object System.Net.NetworkCredential($EmailFrom, $SmtpPassword)
            }
            $msg = New-Object System.Net.Mail.MailMessage($EmailFrom, $EmailTo, $Subject, $Body)
            $smtp.Send($msg)
        } catch {
            Write-Log "Failed to send email alert: $($_.Exception.Message)"
        }
    }
}

function Invoke-WithRetry {
    param([scriptblock]$Action, [string]$ActionName)
    for ($i = 1; $i -le $MaxRetries; $i++) {
        Write-Log "Attempting $ActionName ($i/$MaxRetries)..."
        & $Action
        if ($LASTEXITCODE -eq 0) { return $true }
        Write-Log "$ActionName failed on attempt $i/$MaxRetries (exit $LASTEXITCODE)."
        if ($i -lt $MaxRetries) {
            Start-Sleep -Seconds $RetryDelaySec
        }
    }
    return $false
}

$ErrorActionPreference = "Stop"
try {
    if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
        Write-Log "No .git found at $RepoRoot. Run `git init` first, or change -RepoRoot."
        exit 1
    }

    # Git 2.35+ raises "dubious ownership" if $RepoRoot was ever touched by another user.
    # Idempotent: git dedupes safe.directory entries.
    $alreadySafe = [bool](& git config --global --get-all safe.directory 2>$null |
                          Where-Object { $_ -eq $RepoRoot })
    if (-not $alreadySafe) {
        Write-Log "Marking $RepoRoot as a safe git directory."
        & git config --global --add safe.directory $RepoRoot 2>&1 | Out-Null
    }

    Push-Location $RepoRoot
    try {
        Write-Log "Begin sync: $RepoRoot"

        $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
        $before = (& git rev-parse HEAD).Trim()
        Write-Log "Branch: $branch  Before: $before"

        $fetchOk = Invoke-WithRetry -ActionName "git fetch origin" -Action {
            & git fetch origin 2>&1 | ForEach-Object { Write-Log $_ }

        }
        if (-not $fetchOk) {
            $msg = "git fetch origin failed after $MaxRetries attempts."
            Write-Log $msg
            Write-Health "failure" $msg 1
            Send-Notification "FlipperZero sync failed" $msg
            exit 1
        }

        $hasUpstream = (& git rev-parse --abbrev-ref "@{u}" 2>$null)
        if (-not $hasUpstream) {
            Write-Log "No upstream; setting origin/$branch."
            & git branch --set-upstream-to "origin/$branch" 2>&1 | ForEach-Object { Write-Log $_ }
        }

        $pullOk = Invoke-WithRetry -ActionName "git pull --ff-only" -Action {
            & git pull --ff-only 2>&1 | ForEach-Object { Write-Log $_ }

        }
        if (-not $pullOk) {
            $msg = "git pull --ff-only failed after $MaxRetries attempts. Local branch may have diverged."
            Write-Log $msg
            Write-Health "failure" $msg 2
            Send-Notification "FlipperZero sync diverged" $msg
            exit 2
        }

        $after = (& git rev-parse HEAD).Trim()
        if ($after -eq $before) {
            Write-Log "Already up to date."
            Write-Health "success" "Already up to date." 0
        } else {
            Write-Log "Fast-forwarded to $after."
            Write-Health "success" "Fast-forwarded to $after." 0
        }
        exit 0
    }
    finally {
        Pop-Location
    }
}
catch {
    $err = "ERROR: $($_.Exception.Message)"
    Write-Log $err
    Write-Health "failure" $err 1
    Send-Notification "FlipperZero sync error" $err
    exit 1
}
