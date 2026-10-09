@echo off
rem ========================================================
rem Viddy Portable Launcher (Windows)
rem Zero Windows Registry, Zero AppData, Zero System Clutter
rem Can be run from any folder, USB stick, or external drive.
rem
rem First run: installs dependencies and builds the frontend,
rem then starts the server in production mode.
rem ========================================================

title Viddy Portable Media Server
echo.
echo ========================================================
echo    Viddy - Ultra-Lightweight LAN Media Hub
echo    100%% Portable Mode - Zero System Footprint
echo ========================================================
echo.
echo [Info] Root Folder: %~dp0
echo [Info] Config & Library: Stored strictly inside this folder
echo.

cd /d "%~dp0"

if not exist node_modules (
  echo [1/3] Installing dependencies - first run only...
  call npm install
)

if not exist dist\index.html (
  echo [2/3] Building frontend - first run only...
  call npm run build
)

echo [3/3] Starting local LAN server on port 3000...
echo.
call npm run start

pause
