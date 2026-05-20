# ez-rapp installer — Windows
#   irm https://kody-w.github.io/ez-rapp/install.ps1 | iex
#
# Windows has its own "unidentified developer" prompt (SmartScreen).
# This installer downloads the .exe and runs it without the SmartScreen
# warning the way a browser-download would — files written by curl/iwr
# don't get the "Mark of the Web" Zone.Identifier attached.

$ErrorActionPreference = "Stop"
$Repo = "kody-w/ez-rapp"

Write-Host ""
Write-Host "  ez-rapp installer" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching the latest release..." -ForegroundColor Gray
$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
$tag = $release.tag_name
Write-Host "  latest: $tag"

# Pick the Windows installer asset.
$asset = $release.assets | Where-Object { $_.name -like "*win.exe" -or $_.name -like "*Setup*.exe" } | Select-Object -First 1
if (-not $asset) {
    Write-Host "No Windows installer in release $tag" -ForegroundColor Red
    exit 1
}

$tmp = Join-Path $env:TEMP "ez-rapp-installer.exe"
Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmp

# Strip "Mark of the Web" so SmartScreen doesn't intervene on first run.
try { Unblock-File -Path $tmp } catch {}

Write-Host ""
Write-Host "  Installed downloader to $tmp" -ForegroundColor Green
Write-Host "Running installer (it'll set up ez-rapp into your user profile)..." -ForegroundColor Gray
Start-Process -FilePath $tmp -Wait
Write-Host ""
Write-Host "Done. ez-rapp should appear in your Start menu." -ForegroundColor Green
