#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=$HOME/Library/Android/sdk

# Install/update JS dependencies
echo "Installing dependencies..."
npm install --silent

# Bundle and build the release APK
echo "Building release APK..."
cd android
./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release.apk"
echo ""
echo "Build complete: mobile/android/$APK_PATH"
ls -lh "$APK_PATH"
