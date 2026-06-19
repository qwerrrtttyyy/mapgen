#!/bin/bash
# Material Map Generator — One-click start script (Unix / macOS / Linux / Termux)
# Usage: bash start.sh
#   Or: curl -sL https://github.com/qwerrrtttyyy/mapgen/releases/download/v0.3.12-preview/start.sh | bash

set -e

VERSION="0.3.12-preview"
REPO="qwerrrtttyyy/mapgen"
DOWNLOAD_BASE="https://github.com/qwerrrtttyyy/mapgen/releases/download/${VERSION}"
INSTALL_DIR="${HOME}/.mapgen"
PORT="${MAPGEN_PORT:-8765}"
HOST="${MAPGEN_HOST:-127.0.0.1}"

echo ""
echo "  ==============================================="
echo "  Material Map Generator  v${VERSION}"
echo "  ==============================================="
echo ""

# Detect OS
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js not found."
    echo "  Please install Node.js: https://nodejs.org/"
    echo "  Termux: pkg install nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "  Node.js: ${NODE_VERSION}"
echo ""

# If not installed yet, download and extract
if [ ! -d "${INSTALL_DIR}" ]; then
    echo "  Installing to ${INSTALL_DIR} ..."

    # Download the standalone .js file (self-contained, no extraction needed)
    JS_URL="${DOWNLOAD_BASE}/mapgen_v${VERSION}.js"
    mkdir -p "${INSTALL_DIR}"
    curl -sL -o "${INSTALL_DIR}/mapgen.js" "${JS_URL}" || {
        echo "  [ERROR] Failed to download from ${JS_URL}"
        echo "  Please check your internet connection or download manually:"
        echo "  ${JS_URL}"
        exit 1
    }
    chmod +x "${INSTALL_DIR}/mapgen.js"
    echo "  Downloaded successfully."
else
    echo "  Using existing installation at ${INSTALL_DIR}"
fi

# Optionally check for updates
if [ -f "${INSTALL_DIR}/mapgen.js" ]; then
    CURRENT_VER=$(grep -oP "v\d+\.\d+" "${INSTALL_DIR}/mapgen.js" | head -1 | tr -d 'v' || echo "unknown")
    echo "  Installed version: ${CURRENT_VER} | Latest: ${VERSION}"
fi

echo ""
echo "  Starting server..."
echo "  Open: http://${HOST}:${PORT}"
echo "  Press Ctrl+C to stop"
echo ""

# Auto-port on conflict
try_port() {
    local p="$1"
    if command -v lsof &> /dev/null; then
        if lsof -i ":${p}" &> /dev/null; then
            return 1
        fi
    fi
    return 0
}

# Try current port, fall back if busy
if ! try_port "${PORT}"; then
    echo "  Port ${PORT} is in use. Trying ${PORT} + 1..."
    PORT=$((PORT + 1))
fi

cd "${INSTALL_DIR}"
MAPGEN_PORT="${PORT}" MAPGEN_HOST="${HOST}" node mapgen.js
