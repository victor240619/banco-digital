#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS archive precisa rodar em macOS com Xcode instalado." >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild nao encontrado. Instale/abra o Xcode e configure as Command Line Tools." >&2
  exit 1
fi

npm run build
npx cap sync ios

cd ios/App

project_args=(
  -scheme App
  -configuration Release
  -destination generic/platform=iOS
  -archivePath build/BravusBank.xcarchive
)

if [[ -d App.xcworkspace ]]; then
  project_args=(-workspace App.xcworkspace "${project_args[@]}")
else
  project_args=(-project App.xcodeproj "${project_args[@]}")
fi

auth_args=()
if [[ -n "${APP_STORE_CONNECT_API_KEY_PATH:-}" && -n "${APP_STORE_CONNECT_KEY_ID:-}" && -n "${APP_STORE_CONNECT_ISSUER_ID:-}" ]]; then
  auth_args=(
    -allowProvisioningUpdates
    -authenticationKeyPath "$APP_STORE_CONNECT_API_KEY_PATH"
    -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID"
    -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID"
  )
fi

build_settings=()
if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
  build_settings+=(DEVELOPMENT_TEAM="$APPLE_TEAM_ID")
fi
if [[ -n "${IOS_BUNDLE_ID:-}" ]]; then
  build_settings+=(PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID")
fi

xcodebuild \
  "${project_args[@]}" \
  "${auth_args[@]}" \
  archive \
  "${build_settings[@]}"

echo "Archive gerado em ios/App/build/BravusBank.xcarchive"

if [[ "${IOS_EXPORT_IPA:-0}" == "1" ]]; then
  mkdir -p build/export
  export_options="build/ExportOptions.plist"

  cat > "$export_options" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${IOS_EXPORT_METHOD:-app-store-connect}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>destination</key>
  <string>export</string>
PLIST

  if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
    cat >> "$export_options" <<PLIST
  <key>teamID</key>
  <string>${APPLE_TEAM_ID}</string>
PLIST
  fi

  cat >> "$export_options" <<'PLIST'
</dict>
</plist>
PLIST

  xcodebuild \
    -exportArchive \
    -archivePath build/BravusBank.xcarchive \
    -exportPath build/export \
    -exportOptionsPlist "$export_options" \
    "${auth_args[@]}"

  echo "IPA exportado em ios/App/build/export"
fi
