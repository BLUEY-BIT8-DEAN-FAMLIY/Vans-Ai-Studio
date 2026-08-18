# ============================================================
#  Vans AI Studio - publish to GitHub (one step)
#
#  Just run this file (or double-click publish.bat).
#  If you are not signed in to GitHub yet, it opens the sign-in
#  for you, then creates the repo, pushes, and tags v1.0.0 -
#  which triggers the cloud builds of the EXE / DMG / AppImage / APK.
# ============================================================
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Test-GhAuth {
  gh auth status *> $null
  return ($LASTEXITCODE -eq 0)
}

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor DarkCyan
Write-Host '    Vans AI Studio  ->  GitHub' -ForegroundColor Cyan
Write-Host '  ==============================================' -ForegroundColor DarkCyan
Write-Host ''

# ---- 0) sign in to GitHub if needed ----
if (-not (Test-GhAuth)) {
  Write-Host '  Step 1 of 2: sign in to GitHub' -ForegroundColor Yellow
  Write-Host '  A browser window will open. Copy the code shown here,'
  Write-Host '  paste it in the browser, and approve.'
  Write-Host ''
  gh auth login --hostname github.com --git-protocol https --web
  Write-Host ''
  if (-not (Test-GhAuth)) {
    Write-Host '  Sign-in did not complete. Run this file again to retry.' -ForegroundColor Red
    Write-Host ''
    Read-Host '  Press Enter to close'
    exit 1
  }
  Write-Host '  Signed in.' -ForegroundColor Green
  Write-Host ''
}

# route git auth through gh (the Windows credential manager may hold a stale token)
gh auth setup-git 2>&1 | Out-Null

# ---- 1) who are we ----
$Owner = (gh api user -q .login).Trim()
if (-not $Owner) { throw 'could not resolve your GitHub username' }
$Repo = 'Vans-Ai-Studio'
Write-Host "  Step 2 of 2: publishing as $Owner" -ForegroundColor Yellow
Write-Host ''

# ---- 2) put the real username into every link ----
$files = @('README.md', 'HOW-IT-WORKS.md', 'package.json',
           'installers\install.ps1', 'installers\install.sh', 'app\index.html')
foreach ($f in $files) {
  if (Test-Path $f) {
    $c = Get-Content $f -Raw
    if ($c -match '__GHOWNER__|__GHOWNERLC__') {
      $c = $c.Replace('__GHOWNERLC__', $Owner.ToLower()).Replace('__GHOWNER__', $Owner)
      Set-Content $f -Value $c -NoNewline -Encoding UTF8
      Write-Host "    links updated: $f"
    }
  }
}

# ---- 3) commit ----
if (-not (Test-Path '.git')) { git init -b main | Out-Null }
git add -A
git commit -m "Publish Vans AI Studio v1.0.0" --allow-empty | Out-Null
Write-Host '    committed.'

# ---- 4) create the repo (or reuse it) and push ----
gh repo view "$Owner/$Repo" *> $null
$exists = ($LASTEXITCODE -eq 0)

if (-not $exists) {
  Write-Host '    creating the repository...'
  gh repo create $Repo --public --source . --remote origin --push `
    --description "Free AI studio - images, video, music, 3D and custom models. No API key needed."
  if ($LASTEXITCODE -ne 0) { throw 'could not create the repository' }
} else {
  Write-Host '    repository already exists - pushing.'
  $hasOrigin = (git remote) -contains 'origin'
  if (-not $hasOrigin) { git remote add origin "https://github.com/$Owner/$Repo.git" }
  git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw 'push failed' }
}

# ---- 5) tag -> triggers the cloud builds ----
Write-Host '    tagging v1.0.0 (starts the installer builds)...'
git tag -f v1.0.0 | Out-Null
git push -f origin v1.0.0 2>&1 | Out-Null

# ---- 6) turn on GitHub Pages for the web version ----
try {
  gh api -X POST "repos/$Owner/$Repo/pages" -f "build_type=workflow" *> $null
} catch { }

$lc = $Owner.ToLower()
Write-Host ''
Write-Host '  Published!' -ForegroundColor Green
Write-Host ''
Write-Host "    Repo:     https://github.com/$Owner/$Repo"
Write-Host "    Builds:   https://github.com/$Owner/$Repo/actions      (10-20 min)"
Write-Host "    Releases: https://github.com/$Owner/$Repo/releases"
Write-Host "    Web app:  https://$lc.github.io/$Repo/"
Write-Host ''
Write-Host '  The EXE / DMG / AppImage / APK appear on the Releases page' -ForegroundColor DarkGray
Write-Host '  once the Actions builds finish.' -ForegroundColor DarkGray
Write-Host ''
Read-Host '  Press Enter to close'
