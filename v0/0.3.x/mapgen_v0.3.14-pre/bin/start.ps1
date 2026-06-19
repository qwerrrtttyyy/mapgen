# Material Map Generator — One-click start script (Windows PowerShell)
# Usage:
#   irm https://github.com/qwerrrtttyyy/mapgen/releases/download/v0.3.12-preview/start.ps1 | iex
#   Or: .\start.ps1

param(
    [string]$Version = "0.3.12-preview",
    [string]$InstallDir = "$env:LOCALAPPDATA\mapgen",
    [int]$Port = 8765,
    [string]$Host = "127.0.0.1"
)

$Repo = "qwerrrtttyyy/mapgen"
$DownloadBase = "https://github.com/$Repo/releases/download/$Version"
$JsUrl = "$DownloadBase/mapgen_v$Version.js"

Write-Host ""
Write-Host "  ==============================================="
Write-Host "  Material Map Generator  v$Version"
Write-Host "  ==============================================="
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "  Node.js: $nodeVersion"
} catch {
    Write-Host "  [ERROR] Node.js not found." -ForegroundColor Red
    Write-Host "  Please install Node.js: https://nodejs.org/"
    exit 1
}

Write-Host ""

# Create install directory
if (-not (Test-Path $InstallDir)) {
    Write-Host "  Installing to $InstallDir ..."
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    Write-Host "  Downloading $JsUrl ..."
    try {
        Invoke-WebRequest -Uri $JsUrl -OutFile "$InstallDir\mapgen.js" -UseBasicParsing
        Write-Host "  Downloaded successfully."
    } catch {
        Write-Host "  [ERROR] Failed to download." -ForegroundColor Red
        Write-Host "  $_"
        exit 1
    }
} else {
    Write-Host "  Using existing installation at $InstallDir"
}

Write-Host ""
Write-Host "  Starting server..."
Write-Host "  Open: http://$Host`:$Port"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

# Check port
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "  Port $Port is in use. Trying $($Port + 1)..."
    $Port = $Port + 1
}

$env:MAPGEN_PORT = $Port
$env:MAPGEN_HOST = $Host

Set-Location $InstallDir
node mapgen.js
