#!/bin/bash
cd "$(dirname "$0")"

echo "===================================================="
echo "   🔫 RUNGUN - 3D MULTIPLAYER FPS (LAN READY) 🔫"
echo "===================================================="
echo ""

if [ -f "dist/fps-lan-server-macos" ]; then
    echo "[INFO] Launching standalone macOS server binary..."
    chmod +x dist/fps-lan-server-macos
    open "http://localhost:3000" 2>/dev/null &
    ./dist/fps-lan-server-macos
elif command -v node >/dev/null 2>&1; then
    echo "[INFO] Running with Node.js..."
    open "http://localhost:3000" 2>/dev/null &
    node server.js
else
    echo "[ERROR] Neither standalone binary nor Node.js was found!"
    echo "Please download the binary or install Node.js from https://nodejs.org"
    read -p "Press Enter to exit..."
fi
