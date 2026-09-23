@echo off
title JRUSS AI TOOL Electron Runner
echo ===================================================
echo     JRUSS AI TOOL - Launcher (Electron + React)
echo ===================================================
echo.

:: Check for local electron installation
if not exist node_modules\electron (
    echo [System] Installing Electron dev dependency...
    cmd /c "npm install --save-dev electron"
)

:: Launch Vite server in the background
echo [System] Starting Vite local dev server in background...
start /b cmd /c "npm run dev"

:: Wait for Vite to boot up
echo [System] Waiting for local server to boot...
timeout /t 3 /nobreak >nul

:: Launch Electron app window
echo [System] Launching Electron application window...
cmd /c "npx electron electron-main.cjs"

echo [System] Exiting and cleaning up background processes...
taskkill /f /im node.exe >nul 2>&1
echo [System] Done.
