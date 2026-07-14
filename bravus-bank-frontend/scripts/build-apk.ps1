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

npm.cmd run build

$downloadsInDist = Join-Path $root "dist\downloads"
Remove-Item -LiteralPath $downloadsInDist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $root "android\app\src\main\assets\public\downloads") -Recurse -Force -ErrorAction SilentlyContinue

npx.cmd cap sync android

Push-Location android
try {
  if (Test-Path (Join-Path $root "android\key.properties")) {
    .\gradlew.bat assembleRelease
  }
  else {
    .\gradlew.bat assembleDebug
  }
}
finally {
  Pop-Location
}

$releaseApk = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
$debugApk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
$apk = if (Test-Path $releaseApk) { $releaseApk } else { $debugApk }
if (-not (Test-Path $apk)) {
  throw "APK nao encontrado em $apk"
}

$downloadDir = Join-Path $root "public\downloads"
New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
Copy-Item -LiteralPath $apk -Destination (Join-Path $downloadDir "bravus-bank.apk") -Force
Copy-Item -LiteralPath $apk -Destination (Join-Path $downloadDir "bravus-bank-mobile.apk") -Force

Write-Host "APK copiado para public\downloads\bravus-bank.apk e public\downloads\bravus-bank-mobile.apk"
