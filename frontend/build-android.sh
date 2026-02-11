#!/bin/bash
# Build script for Sharda Lead Management Android APK
# Run this on a machine with Android Studio or Android SDK installed

set -e

echo "=== Sharda Lead Management - Android APK Build ==="
echo ""

# Check prerequisites
if [ -z "$ANDROID_HOME" ]; then
    echo "ERROR: ANDROID_HOME is not set. Install Android Studio first."
    echo "Download: https://developer.android.com/studio"
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo "ERROR: Java is not installed. Install JDK 17+."
    exit 1
fi

echo "1. Building web assets..."
cd "$(dirname "$0")"
yarn build

echo "2. Syncing to Android..."
npx cap sync android

echo "3. Building debug APK..."
cd android
./gradlew assembleDebug

echo ""
echo "=== BUILD COMPLETE ==="
echo "Debug APK: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "To build a release APK (for Play Store):"
echo "  ./gradlew assembleRelease"
echo ""
echo "To install on connected device:"
echo "  adb install android/app/build/outputs/apk/debug/app-debug.apk"
