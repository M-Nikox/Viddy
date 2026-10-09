#!/usr/bin/env bash
# ========================================================
# Viddy Portable Launcher (Linux / macOS)
# Zero system daemon, zero ~/.config pollution.
# Can be run from any folder, external SSD, or USB drive.
#
# First run: installs dependencies and builds the frontend,
# then starts the server in production mode.
# ========================================================

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "   Viddy - Ultra-Lightweight LAN Media Hub"
echo "   100% Portable Mode - Zero System Footprint"
echo "========================================================"
echo "Root Folder: $DIR"
echo "Config & Library: Stored strictly inside this folder"
echo ""

if [ ! -d node_modules ]; then
  echo "[1/3] Installing dependencies (first run only)..."
  npm install
fi

if [ ! -f dist/index.html ]; then
  echo "[2/3] Building frontend (first run only)..."
  npm run build
fi

echo "[3/3] Starting local LAN server on port 3000..."
echo ""
npm run start
