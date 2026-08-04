Write-Host "=== Ollama ==="
Get-Process -Name "ollama*" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}

Write-Host "`n=== Python ==="
Get-Process -Name "python*" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}

Write-Host "`n=== Node ==="
Get-Process -Name "node*" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}

Write-Host "`n=== Top 5 by memory ==="
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 Id, ProcessName, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}
