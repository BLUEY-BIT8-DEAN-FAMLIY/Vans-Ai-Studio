# Publishes Vans AI Studio to GitHub: creates the repo, pushes, tags v1.0.0
# (which triggers cloud builds of EXE / DMG / AppImage / APK) and enables the web version.
# Requirement: run `gh auth login` once before this.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# 0) check auth
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '  Not logged in to GitHub yet. Run this first:' -ForegroundColor Yellow
  Write-Host '      gh auth login' -ForegroundColor Cyan
  Write-Host '  (choose GitHub.com -> HTTPS -> Login with a web browser)'
  Write-Host '  Then run publish.ps1 again.'
  exit 1
}

# 0b) route git auth through gh, since the OS credential manager may hold a stale token
gh auth setup-git 2>&1 | Out-Null

# 1) real owner name
$Owner = gh api user -q .login
if (-not $Owner) { throw 'could not resolve GitHub user' }
Write-Host "  GitHub user: $Owner" -ForegroundColor Cyan

# 2) replace __GHOWNER__ placeholders
$files = @('README.md', 'package.json', 'installers\install.ps1', 'installers\install.sh', 'app\index.html')
foreach ($f in $files) {
  if (Test-Path $f) {
    $c = Get-Content $f -Raw
    $c = $c.Replace('__GHOWNERLC__', $Owner.ToLower()).Replace('__GHOWNER__', $Owner)
    Set-Content $f -Value $c -NoNewline -Encoding UTF8
  }
}
Write-Host '  links updated.'

# 3) git commit
if (-not (Test-Path '.git')) { git init -b main | Out-Null }
git add -A
git -c core.safecrlf=false commit -m "Vans AI Studio v1.0.0" --allow-empty | Out-Null

# 4) create repo + push (public, so people can download and Actions are free)
$exists = $false
gh repo view "$Owner/Vans-Ai-Studio" *> $null
if ($LASTEXITCODE -eq 0) { $exists = $true }
if (-not $exists) {
  gh repo create Vans-Ai-Studio --public --source . --remote origin --push `
    --description "Free AI studio - images, video, music, 3D and custom models. No API key. סטודיו יצירה חופשי בעברית"
} else {
  if (-not (git remote | Select-String -Quiet '^origin$')) {
    git remote add origin "https://github.com/$Owner/Vans-Ai-Studio.git"
  }
  git push -u origin main
}

# 5) tag -> triggers the cloud release build (EXE/DMG/AppImage/APK)
git tag -f v1.0.0
git push -f origin v1.0.0

Write-Host ''
Write-Host '  Published!' -ForegroundColor Green
Write-Host "  Repo:     https://github.com/$Owner/Vans-Ai-Studio"
Write-Host "  Builds:   https://github.com/$Owner/Vans-Ai-Studio/actions   (10-20 min)"
Write-Host "  Releases: https://github.com/$Owner/Vans-Ai-Studio/releases"
Write-Host "  Web:      https://$($Owner.ToLower()).github.io/Vans-Ai-Studio/"
Write-Host ''
