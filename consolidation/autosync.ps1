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
    [string]$RepoRoot  = "C:\Users\bugre\FlipperZero",
    [string]$LogFile   = (Join-Path $PSScriptRoot "autosync.log"),
    [int]    $MaxLogKB = 256
)

function Write-Log {
    param([string]$Msg)
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line  = "$stamp  [$env:USERNAME]  $Msg"
    Add-Content -Path $LogFile -Value $line
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length / 1KB) -gt $MaxLogKB) {
        $old = "$LogFile.old"
        # Move-Item -Force overwrites the destination in one step - atomic, no pre-remove needed.
        Move-Item -Path $LogFile -Destination $old -Force
    }
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

        & git fetch origin 2>&1 | ForEach-Object { Write-Log $_ }
        if ($LASTEXITCODE -ne 0) {
            Write-Log "git fetch failed (exit $LASTEXITCODE)."
            exit 1
        }

        $hasUpstream = (& git rev-parse --abbrev-ref "@{u}" 2>$null)
        if (-not $hasUpstream) {
            Write-Log "No upstream; setting origin/$branch."
            & git branch --set-upstream-to "origin/$branch" 2>&1 | ForEach-Object { Write-Log $_ }
        }

        & git pull --ff-only 2>&1 | ForEach-Object { Write-Log $_ }
        switch ($LASTEXITCODE) {
            0 {
                $after = (& git rev-parse HEAD).Trim()
                if ($after -eq $before) {
                    Write-Log "Already up to date."
                } else {
                    Write-Log "Fast-forwarded to $after."
                }
                exit 0
            }
            default {
                Write-Log "git pull --ff-only failed (exit $LASTEXITCODE). Local branch diverged - manual reconcile required."
                exit 2
            }
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
