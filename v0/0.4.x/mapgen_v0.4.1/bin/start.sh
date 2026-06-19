#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR" || exit 1
echo "Starting Material Map Generator v0.4.1..."
echo "Open http://127.0.0.1:${MAPGEN_PORT:-8765} in your browser"
node server.js
