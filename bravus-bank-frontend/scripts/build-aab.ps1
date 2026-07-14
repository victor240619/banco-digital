$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:ANDROID_HOME) {
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
if (-not $env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}
if (-not $env:JAVA_HOME) {
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
}

$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

$localTrustStore = Join-Path $root ".gradle-certs\cacerts"
if (Test-Path $localTrustStore) {
  $sslOptions = "-Djavax.net.ssl.trustStore=$localTrustStore -Djavax.net.ssl.trustStorePassword=changeit"
  $env:GRADLE_OPTS = "$sslOptions $env:GRADLE_OPTS".Trim()
}

$keyProperties = Join-Path $root "android\key.properties"
if (-not (Test-Path $keyProperties)) {
  throw "Arquivo de assinatura nao encontrado: android\key.properties"
}

& (Join-Path $PSScriptRoot "generate-app-icons.ps1")

npm.cmd run build

$downloadsInDist = Join-Path $root "dist\downloads"
Remove-Item -LiteralPath $downloadsInDist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $root "android\app\src\main\assets\public\downloads") -Recurse -Force -ErrorAction SilentlyContinue

npx.cmd cap sync android

Push-Location android
try {
  .\gradlew.bat bundleRelease
}
finally {
  Pop-Location
}

$aab = Join-Path $root "android\app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aab)) {
  throw "AAB nao encontrado em $aab"
}

$outputDir = "C:\Users\ALMENAG2406\Documents\Codex\2026-07-13\n\outputs"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$outputAab = Join-Path $outputDir "bravus-bank-playstore-release.aab"
Copy-Item -LiteralPath $aab -Destination $outputAab -Force

Write-Host "AAB Play Store gerado em $outputAab"
