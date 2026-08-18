@echo off
REM Vans AI Studio launcher - run "vurs" from the project folder.
title Vans AI Studio
cd /d "%~dp0"

REM Prefer the installed desktop app (Electron) if dependencies are present,
REM otherwise fall back to the dependency-free web version.
if exist "node_modules\electron\dist\electron.exe" (
  call npm start
  goto :eof
)

echo.
echo   Launching Vans AI Studio (web) ...
echo   (For the desktop app run: npm install ^&^& npm start)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" -Port 8765 -Open
