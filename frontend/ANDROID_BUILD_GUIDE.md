# Sharda Lead Management - Android App Build Guide

## What's Been Set Up

The Capacitor Android project is fully configured and ready to build:

- **App Name**: Sharda Lead Management
- **App ID (Package)**: `com.shardalms.app`
- **Backend URL**: `https://www.shardalms.com`
- **App Icons**: Custom Sharda logo icons for all Android densities
- **Splash Screen**: Dark navy background (#0f172a) with Sharda logo
- **Status Bar**: Dark theme matching sidebar
- **Target SDK**: Android 14 (API 34)

## How To Build the APK

### Option 1: Using Android Studio (Recommended)

1. **Install Android Studio**: https://developer.android.com/studio
2. **Save this project to GitHub** using the "Save to Github" button in the chat
3. **Clone the repo** to your computer
4. **Open the Android project** in Android Studio:
   - Open Android Studio
   - Click "Open" and navigate to: `frontend/android/`
   - Wait for Gradle sync to complete (first time takes a few minutes)
5. **Build the APK**:
   - Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - The APK will be at: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
6. **Test on your phone**:
   - Transfer the APK to your Android phone
   - Enable "Install from unknown sources" in Settings
   - Install and open the app

### Option 2: Command Line (If you have Android SDK)

```bash
cd frontend
yarn build                    # Build web assets
npx cap sync android          # Sync to Android
cd android
./gradlew assembleDebug       # Build debug APK
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## Publishing to Google Play Store

### Step 1: Create a Developer Account
- Go to https://play.google.com/console
- Pay the one-time $25 registration fee
- Complete identity verification (takes 1-2 days)

### Step 2: Generate a Signed Release APK
In Android Studio:
1. Go to **Build > Generate Signed Bundle / APK**
2. Select **APK**
3. Create a new keystore:
   - Click "Create new..."
   - Set a strong password
   - Fill in certificate details
   - **SAVE THIS KEYSTORE FILE SECURELY** - you need it for every update
4. Select **release** build variant
5. Click **Finish**

### Step 3: Create Store Listing
In Google Play Console:
1. Create a new app
2. Fill in:
   - **App name**: Sharda Lead Management
   - **Short description**: Lead management dashboard for Sharda
   - **Full description**: Comprehensive lead tracking, forecasting, and analytics
   - **Screenshots**: Take screenshots of the app on your phone
   - **Feature graphic**: 1024x500 banner image
   - **App icon**: Already generated at `android/app/src/main/ic_launcher-playstore.png` (512x512)
3. Set content rating, privacy policy, etc.
4. Upload the signed APK/AAB
5. Submit for review (usually approved in 1-3 days)

## How the App Works

The Android app is essentially a native wrapper around your existing web dashboard at `www.shardalms.com`. When users open the app:

1. Splash screen shows with Sharda logo (dark navy background)
2. App loads your website in a native WebView
3. Users get a native app experience (app icon on home screen, fullscreen, no browser bar)
4. All functionality from the website works identically in the app

**Your website (www.shardalms.com) is NOT affected.** The app just loads it.

## Updating the App

When you update the website, the app automatically shows the latest version (since it loads from www.shardalms.com). No app update needed for web changes.

If you need to change app-level settings (icon, splash, permissions):
1. Make changes in the `frontend/android/` directory
2. Run `npx cap sync android`
3. Rebuild the APK
4. Upload new version to Play Store

## File Structure

```
frontend/
├── capacitor.config.ts          # Capacitor configuration
├── build-android.sh             # Build script
├── android/                     # Android native project
│   ├── app/
│   │   ├── build.gradle         # Android build config
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── ic_launcher-playstore.png  # 512x512 Play Store icon
│   │       ├── assets/public/    # Web assets (auto-synced)
│   │       ├── java/com/shardalms/app/
│   │       │   └── MainActivity.java
│   │       └── res/
│   │           ├── mipmap-*/     # App icons (all densities)
│   │           ├── drawable*/    # Splash screens
│   │           ├── values/       # Styles, colors, strings
│   │           └── xml/          # Config files
│   └── gradlew                  # Gradle wrapper
```
