# Repairs a half-finished Electron install.
#
# On some Windows machines `npm install` downloads the Electron zip but the
# unzip step fails silently (antivirus or a locked file), leaving an empty
# node_modules\electron\dist. npm still reports success, and `npm start`
# then fails. This script finishes the job from the already-downloaded zip.
#
#   powershell -ExecutionPolicy Bypass -File tools\fix-electron.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dist = Join-Path $repo 'node_modules\electron\dist'
$exe  = Join-Path $dist 'electron.exe'

if (Test-Path $exe) {
  Write-Host "  Electron is already fine: $exe" -ForegroundColor Green
  exit 0
}

if (-not (Test-Path (Join-Path $repo 'node_modules\electron'))) {
  Write-Host '  Run "npm install" first.' -ForegroundColor Yellow
  exit 1
}

$version = (Get-Content (Join-Path $repo 'node_modules\electron\package.json') -Raw |
            ConvertFrom-Json).version
Write-Host "  Repairing Electron v$version ..."

$cache = Join-Path $env:LOCALAPPDATA 'electron\Cache'
$zip = Get-ChildItem $cache -Recurse -Filter "electron-v$version-win32-*.zip" -ErrorAction SilentlyContinue |
       Select-Object -First 1

if (-not $zip) {
  Write-Host '  No cached download found - fetching it...'
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'ia32' }
  $name = "electron-v$version-win32-$arch.zip"
  $target = Join-Path $cache 'manual'
  New-Item -ItemType Directory -Force $target | Out-Null
  $out = Join-Path $target $name
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest "https://github.com/electron/electron/releases/download/v$version/$name" -OutFile $out
  $zip = Get-Item $out
}

Write-Host "  Extracting $($zip.Name) ..."
New-Item -ItemType Directory -Force $dist | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath $dist -Force

# electron's loader reads this file to find the binary
Set-Content -Path (Join-Path $repo 'node_modules\electron\path.txt') -Value 'electron.exe' -NoNewline -Encoding ASCII

if (Test-Path $exe) {
  Write-Host '  Fixed. Run "npm start" to open the desktop app.' -ForegroundColor Green
} else {
  Write-Host '  Extraction did not produce electron.exe - check your antivirus.' -ForegroundColor Red
  exit 1
}
