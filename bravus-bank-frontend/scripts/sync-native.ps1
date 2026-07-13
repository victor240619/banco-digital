param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("android", "ios")]
  [string]$Platform
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

npm.cmd run build

$downloadsInDist = Join-Path $root "dist\downloads"
Remove-Item -LiteralPath $downloadsInDist -Recurse -Force -ErrorAction SilentlyContinue

if ($Platform -eq "android") {
  Remove-Item -LiteralPath (Join-Path $root "android\app\src\main\assets\public\downloads") -Recurse -Force -ErrorAction SilentlyContinue
}
if ($Platform -eq "ios") {
  Remove-Item -LiteralPath (Join-Path $root "ios\App\App\public\downloads") -Recurse -Force -ErrorAction SilentlyContinue
}

npx.cmd cap sync $Platform
