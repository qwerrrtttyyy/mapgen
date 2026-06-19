$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..")
Write-Host "Starting Material Map Generator v0.4.1..."
Write-Host "Open http://127.0.0.1:8765 in your browser"
node server.js
