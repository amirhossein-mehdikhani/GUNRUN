@echo off
title RUNGUN - 3D LAN Multiplayer FPS Server
cd /d "%~dp0"

echo ====================================================
echo    🔫 RUNGUN - 3D MULTIPLAYER FPS (LAN READY) 🔫
echo ====================================================
echo.

if exist "dist\fps-lan-server-win.exe" (
    echo [INFO] Launching standalone server binary...
    start "" "http://localhost:3000"
    "dist\fps-lan-server-win.exe"
) else (
    echo [INFO] Standalone binary not found. Checking Node.js...
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        echo [INFO] Running with Node.js...
        start "" "http://localhost:3000"
        node server.js
    ) else (
        echo [ERROR] Neither standalone binary nor Node.js was found!
        echo Please build the binaries or install Node.js from https://nodejs.org
        pause
    )
)

if %errorlevel% neq 0 (
    echo.
    echo Server stopped with an error code.
    pause
)
