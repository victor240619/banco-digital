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
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath build/BravusBank.xcarchive \
  archive

echo "Archive gerado em ios/App/build/BravusBank.xcarchive"
echo "Para exportar IPA assinado, use Xcode Organizer ou xcodebuild -exportArchive com ExportOptions.plist da conta Apple."
