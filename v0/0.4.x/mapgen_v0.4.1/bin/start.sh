#!/usr/bin/env bash
# Quick start — delegates to run.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/run.sh"
