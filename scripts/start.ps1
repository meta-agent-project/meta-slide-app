param([switch]$NoOpen, [int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = "http://127.0.0.1:$Port"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js is required. Install Node.js 22 or newer, then run start.cmd again.' }
$existing = $null
try { $existing = Invoke-RestMethod "$appUrl/healthz" -TimeoutSec 2 } catch { }
if ($existing.app -ne 'slide-room') {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listener) { throw "Port $Port is used by another application. Use scripts/start.ps1 -Port 4174." }
    $logDirectory = Join-Path $projectRoot '.local'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $previousPort = $env:PORT
    try {
        $env:PORT = [string]$Port
        $serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList 'server.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "server-$Port.out.log") -RedirectStandardError (Join-Path $logDirectory "server-$Port.err.log")
        $serverProcess.Id | Set-Content -LiteralPath (Join-Path $logDirectory "server-$Port.pid")
    } finally { $env:PORT = $previousPort }
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $response = Invoke-RestMethod "$appUrl/healthz" -TimeoutSec 1; if ($response.app -eq 'slide-room') { $ready = $true; break } } catch { }
        Start-Sleep -Milliseconds 150
    }
    if (-not $ready) { throw 'Server did not start. Check .local log files.' }
}
if (-not $NoOpen) { Start-Process $appUrl }
Write-Output "Slide Room is ready: $appUrl"
