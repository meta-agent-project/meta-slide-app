param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectRoot ".local/server-$Port.pid"
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Output 'No launcher-managed server found.'; exit 0 }
$serverId = [int](Get-Content -LiteralPath $pidPath)
$serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverId" -ErrorAction SilentlyContinue
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($serverProcess -and $serverProcess.Name -eq 'node.exe' -and $serverProcess.CommandLine -match 'server\.mjs' -and $listener.OwningProcess -contains $serverId) {
    Stop-Process -Id $serverId
    Remove-Item -LiteralPath $pidPath
    Write-Output 'Slide Room server stopped. Saved projects are retained.'
} else { Write-Output 'Saved process is no longer this server; no process was stopped.' }
