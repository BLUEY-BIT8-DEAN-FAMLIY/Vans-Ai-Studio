@echo off
title Vans AI Studio
cd /d "%~dp0"
echo.
echo   Starting Vans AI Studio (web) ...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" -Port 8765 -Open
pause
