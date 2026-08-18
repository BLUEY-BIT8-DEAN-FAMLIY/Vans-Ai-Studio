@echo off
title Publish Vans AI Studio to GitHub
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "publish.ps1"
pause
