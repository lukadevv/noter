<#
.SYNOPSIS
  Packs the Tauri release build into an MSIX for the Microsoft Store.

.DESCRIPTION
  Tauri bundles NSIS and MSI installers, but the Store's free signing path is
  MSIX. This script lays out the already-built executable next to the Store
  assets, fills in the manifest and runs makeappx from the Windows SDK.

  The package is not signed: Partner Center re-signs every MSIX it accepts, so
  a signature here would be discarded. An unsigned MSIX cannot be sideloaded,
  which is why it is only meant for the Store upload.

  Required environment (Partner Center → Product management → Product identity):
    MSIX_IDENTITY_NAME            Package/Identity/Name, e.g. 12345Lukadevv.Noter
    MSIX_PUBLISHER                Package/Identity/Publisher, e.g. CN=ABCDEF12-...
    MSIX_PUBLISHER_DISPLAY_NAME   Package/Properties/PublisherDisplayName

  Optional:
    MSIX_DISPLAY_NAME             Package/Properties/DisplayName, the app name
                                  reserved in Partner Center. Defaults to Noter X.

.EXAMPLE
  pnpm desktop:build; pwsh scripts/build-msix.ps1
#>
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$package = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
# The Store requires four parts and a zero revision.
$version = "$($package.version).0"

foreach ($name in 'MSIX_IDENTITY_NAME', 'MSIX_PUBLISHER', 'MSIX_PUBLISHER_DISPLAY_NAME') {
  if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue).Value) {
    throw "$name is not set. Copy it from Partner Center → Product identity."
  }
}

# The Store only accepts a display name that is reserved for the product, so a
# different reservation has to be mirrored here.
$displayName = if ($env:MSIX_DISPLAY_NAME) { $env:MSIX_DISPLAY_NAME.Trim() } else { 'Noter X' }

$release = Join-Path $root 'src-tauri/target/release'
$exe = @('Noter.exe', 'noter.exe') | ForEach-Object { Join-Path $release $_ } | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { throw "No release executable in $release. Run 'pnpm desktop:build' first." }

$layout = Join-Path $root 'src-tauri/target/msix-layout'
if (Test-Path $layout) { Remove-Item $layout -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $layout 'Assets') | Out-Null

Copy-Item $exe (Join-Path $layout 'Noter.exe')
Copy-Item (Join-Path $root 'src-tauri/windows/msix/Assets/*') (Join-Path $layout 'Assets')

$manifest = Get-Content (Join-Path $root 'src-tauri/windows/msix/AppxManifest.xml.tmpl') -Raw
$manifest = $manifest.
  Replace('{{IDENTITY_NAME}}', $env:MSIX_IDENTITY_NAME).
  Replace('{{PUBLISHER}}', [Security.SecurityElement]::Escape($env:MSIX_PUBLISHER)).
  Replace('{{PUBLISHER_DISPLAY_NAME}}', [Security.SecurityElement]::Escape($env:MSIX_PUBLISHER_DISPLAY_NAME)).
  Replace('{{DISPLAY_NAME}}', [Security.SecurityElement]::Escape($displayName)).
  Replace('{{VERSION}}', $version)
Set-Content -Path (Join-Path $layout 'AppxManifest.xml') -Value $manifest -Encoding utf8

# makeappx ships with the Windows 10/11 SDK; pick the newest installed copy.
$makeappx = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\makeappx.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $makeappx) { throw 'makeappx.exe not found. Install the Windows 10/11 SDK.' }

$out = Join-Path $root "src-tauri/target/Noter_${version}_x64.msix"
& $makeappx.FullName pack /o /d $layout /p $out
if ($LASTEXITCODE -ne 0) { throw "makeappx failed with exit code $LASTEXITCODE" }

Write-Host "Packed $out (DisplayName: $displayName)"
"MSIX_PATH=$out" | Out-File -FilePath ($env:GITHUB_ENV ?? 'NUL') -Append -Encoding utf8
