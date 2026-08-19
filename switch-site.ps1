# ============================================================
#  Move Vans AI Studio to a short address: https://vansaistudio.github.io/
#
#  GitHub serves an organisation site from a repo named exactly
#  <org>.github.io, so this script creates that repo inside the
#  organisation, pushes the code, turns on Pages and rewrites every
#  link in the project.
#
#  BEFORE running: create the free organisation once, in a browser:
#      https://github.com/organizations/plan  ->  Free  ->  name it "vansaistudio"
#  (creating an account or organisation is the one step that has to be yours)
#
#  Then just run this file.
# ============================================================
param(
  [string]$Org = 'vansaistudio'
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# gh writes to stderr even for ordinary "not found" answers, which would abort
# the script under ErrorActionPreference=Stop. This probes without throwing.
function Test-Gh {
  param([string[]]$GhArgs)
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  & gh @GhArgs *> $null
  $code = $LASTEXITCODE
  $ErrorActionPreference = $old
  return ($code -eq 0)
}

$Repo    = "$Org.github.io"
$SiteUrl = "https://$Org.github.io"
$OldSite = 'https://bluey-bit8-dean-famliy.github.io/Vans-Ai-Studio'

Write-Host ''
Write-Host '  ==========================================' -ForegroundColor DarkCyan
Write-Host "    Vans AI Studio  ->  $SiteUrl" -ForegroundColor Cyan
Write-Host '  ==========================================' -ForegroundColor DarkCyan
Write-Host ''

# ---- 0) signed in? ----
if (-not (Test-Gh @('auth','status'))) {
  Write-Host '  Not signed in to GitHub. Run:  gh auth login' -ForegroundColor Yellow
  exit 1
}
gh auth setup-git 2>&1 | Out-Null

# ---- 1) does the organisation exist yet? ----
if (-not (Test-Gh @('api', "orgs/$Org"))) {
  Write-Host "  The organisation '$Org' does not exist yet." -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  Create it once, for free, in your browser:' -ForegroundColor Cyan
  Write-Host '      https://github.com/organizations/plan'
  Write-Host "      choose Free, and name it exactly:  $Org"
  Write-Host ''
  Write-Host '  Then run this file again.'
  exit 1
}
Write-Host "  organisation found: $Org" -ForegroundColor Green

# ---- 2) create the site repo if needed ----
if (-not (Test-Gh @('repo','view', "$Org/$Repo"))) {
  Write-Host "  creating $Org/$Repo ..."
  gh repo create "$Org/$Repo" --public `
    --description "Vans AI Studio - free AI studio for images, video, music, 3D, documents and presentations. No API key."
  if ($LASTEXITCODE -ne 0) { throw "could not create $Org/$Repo" }
} else {
  Write-Host "  repository already exists: $Org/$Repo"
}

# ---- 3) point every link at the new address ----
Write-Host '  rewriting links ...'
$files = @('README.md','HOW-IT-WORKS.md','PUBLISH-GUIDE.md','package.json',
           'installers\install.ps1','installers\install.sh','app\index.html')
foreach ($f in $files) {
  if (-not (Test-Path $f)) { continue }
  $c = Get-Content $f -Raw
  $before = $c
  $c = $c.Replace($OldSite, $SiteUrl)
  $c = $c.Replace('BLUEY-BIT8-DEAN-FAMLIY/Vans-Ai-Studio', "$Org/$Repo")
  $c = $c.Replace("OWNER=`"BLUEY-BIT8-DEAN-FAMLIY`"", "OWNER=`"$Org`"")
  $c = $c.Replace("`$Owner = 'BLUEY-BIT8-DEAN-FAMLIY'", "`$Owner = '$Org'")
  $c = $c.Replace("REPO=`"Vans-Ai-Studio`"", "REPO=`"$Repo`"")
  $c = $c.Replace("`$Repo  = 'Vans-Ai-Studio'", "`$Repo  = '$Repo'")
  if ($c -ne $before) { Set-Content $f -Value $c -NoNewline -Encoding UTF8; Write-Host "    $f" }
}

# the installers build the web address from the owner name; for an org site the
# address has no repo segment, so hard-code it
$ips = 'installers\install.ps1'
if (Test-Path $ips) {
  $c = Get-Content $ips -Raw
  $c = $c -replace '\$WebUrl = "[^"]*"', "`$WebUrl = `"$SiteUrl/`""
  Set-Content $ips -Value $c -NoNewline -Encoding UTF8
}
$ish = 'installers\install.sh'
if (Test-Path $ish) {
  $c = Get-Content $ish -Raw
  $c = $c -replace 'WEB="[^"]*"', "WEB=`"$SiteUrl/`""
  Set-Content $ish -Value $c -NoNewline -Encoding UTF8
}

# ---- 4) commit and push to the new repo ----
git add -A
git commit -m "Serve the site from $SiteUrl" --allow-empty | Out-Null

if ((git remote) -contains 'site') { git remote remove site }
git remote add site "https://github.com/$Org/$Repo.git"
Write-Host '  pushing ...'
git push -u site main --force
if ($LASTEXITCODE -ne 0) { throw 'push failed' }

git tag -f v1.1.0 | Out-Null
git push -f site v1.1.0 2>&1 | Out-Null

# ---- 5) turn on Pages ----
try { gh api -X POST "repos/$Org/$Repo/pages" -f "build_type=workflow" *> $null } catch { }

Write-Host ''
Write-Host '  Done!' -ForegroundColor Green
Write-Host ''
Write-Host "    Site:          $SiteUrl/"
Write-Host "    Family work:   $SiteUrl/dean/famliy/work/"
Write-Host "    Code:          https://github.com/$Org/$Repo"
Write-Host "    Builds:        https://github.com/$Org/$Repo/actions   (10-20 min)"
Write-Host ''
Write-Host '  The old address keeps working until you delete the old repo.' -ForegroundColor DarkGray
Write-Host ''
