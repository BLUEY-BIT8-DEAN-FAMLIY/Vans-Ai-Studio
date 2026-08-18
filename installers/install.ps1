# Vans AI Studio - one-line installer for Windows
# Usage:  irm https://raw.githubusercontent.com/BLUEY-BIT8-DEAN-FAMLIY/Vans-Ai-Studio/main/installers/install.ps1 | iex
# Afterwards just run:  vurs
$ErrorActionPreference = 'Stop'
$Owner = 'BLUEY-BIT8-DEAN-FAMLIY'
$Repo  = 'Vans-Ai-Studio'

$Dir = Join-Path $env:LOCALAPPDATA 'VansAiStudio'
$Bin = Join-Path $Dir 'bin'
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

Write-Host ''
Write-Host '  Vans AI Studio installer' -ForegroundColor Cyan
Write-Host '  ------------------------'

$Exe = Join-Path $Dir 'VansAiStudio.exe'
$WebUrl = "https://$($Owner.ToLower()).github.io/$Repo/"

# try to grab the portable desktop build from the latest GitHub release
try {
  $rel = Invoke-RestMethod "https://api.github.com/repos/$Owner/$Repo/releases/latest" -TimeoutSec 20
  $asset = $rel.assets | Where-Object { $_.name -like '*Portable*.exe' } | Select-Object -First 1
  if ($asset) {
    Write-Host "  downloading $($asset.name) ..."
    Invoke-WebRequest $asset.browser_download_url -OutFile $Exe
    Write-Host '  desktop app installed.' -ForegroundColor Green
  } else {
    Write-Host '  no desktop build found yet - vurs will open the web version.'
  }
} catch {
  Write-Host '  release not available yet - vurs will open the web version.'
}

# the vurs command
$cmd = @"
@echo off
if /I "%1"=="web" (start "" "$WebUrl" & exit /b)
if exist "$Exe" (start "" "$Exe") else (start "" "$WebUrl")
"@
Set-Content -Path (Join-Path $Bin 'vurs.cmd') -Value $cmd -Encoding ASCII

# add to user PATH
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($null -eq $userPath) { $userPath = '' }
if ($userPath -notlike "*$Bin*") {
  [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $Bin), 'User')
}

Write-Host ''
Write-Host '  Done! Open a NEW terminal and run:  vurs' -ForegroundColor Green
Write-Host '  (vurs web - always opens the web version)'
Write-Host ''
