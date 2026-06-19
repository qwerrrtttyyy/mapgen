# Quick start for Windows
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Join-Path $ScriptDir ".."
Set-Location $RootDir

Write-Host "Material Map Generator v0.4.1 - C/S Architecture"
Write-Host ""

# Check Node.js
try {
  $nodeVer = node -v
  Write-Host "[OK] Node.js $nodeVer"
} catch {
  Write-Host "[ERR] Node.js is not installed. Download from https://nodejs.org"
  exit 1
}

# Check port
$port = if ($env:MAPGEN_PORT) { $env:MAPGEN_PORT } else { 8765 }
$inUse = netstat -ano | Select-String ":${port}\s"
if ($inUse) {
  Write-Host "[WARN] Port $port in use, will auto-fallback"
} else {
  Write-Host "[OK]  Port $port available"
}

Write-Host ""
Write-Host "Starting server..."
Write-Host "Open http://127.0.0.1:$port in your browser"
Write-Host ""

node server.js
