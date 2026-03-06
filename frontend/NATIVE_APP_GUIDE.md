# Native App Setup Guide

Your Campus Connect app is now configured to run as a standalone application on mobile (iOS & Android) and desktop (via Electron), with full native notification support!

## 🚀 Quick Start

### Build Web App First
Always build the web app before syncing to native platforms:

```bash
npm run build
```

---

## 📱 Mobile Apps (iOS & Android)

### iOS Setup

#### Prerequisites
- **macOS** required
- **Xcode** 14+ installed
- **Apple Developer Account** (for real device testing and App Store)

#### Build & Run

```bash
# Sync web build to iOS
npm run build:mobile

# Open in Xcode
npm run cap:open:ios
```

In Xcode:
1. Select your team in **Signing & Capabilities**
2. Choose a simulator or connected device
3. Click **Run** (▶️) button

#### Push Notifications Setup (iOS)
1. In Xcode, go to **Signing & Capabilities**
2. Click **+ Capability** and add **Push Notifications**
3. Add **Background Modes** capability and enable:
   - Remote notifications
   - Background fetch
4. Generate APNs certificate in Apple Developer portal
5. Configure push notifications in your Supabase backend

### Android Setup

#### Prerequisites
- **Android Studio** installed
- **Android SDK** (API 24+)
- **Java JDK 17+**

#### Build & Run

```bash
# Sync web build to Android
npm run build:mobile

# Open in Android Studio
npm run cap:open:android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Select an emulator or connected device
3. Click **Run** (▶️) button

#### Push Notifications Setup (Android)
1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Add Android app to Firebase project
3. Download `google-services.json` and place it in `/android/app/`
4. Configure Firebase Cloud Messaging (FCM) in your Supabase backend

---

## 💻 Desktop App (Electron)

### Prerequisites
- Node.js 18+
- npm or yarn

### Build & Run

```bash
# Sync web build to Electron
npm run build:desktop

# Open Electron project
npm run cap:open:electron
```

In the Electron project directory:

```bash
cd electron
npm run electron:start
```

### Package Desktop App

To create distributable installers:

```bash
cd electron
npm run electron:pack
```

This creates installers for your current platform in `electron/dist/`:
- **macOS**: `.dmg` file
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` or `.deb`

---

## 🔔 Notification Features

Your app now has **native notifications** that work across all platforms:

### Features
- ✅ **Chat messages**: Get notified of new messages
- ✅ **Mentions**: Special notifications when you're @mentioned
- ✅ **Channels**: Organized by notification type
- ✅ **Rich notifications**: Shows sender name and message preview
- ✅ **Tap to open**: Clicking notification opens the relevant chat
- ✅ **Background sync**: All devices stay synchronized via Supabase

### How Notifications Work

1. **Mobile (Push)**: Uses Apple Push Notification Service (APNs) and Firebase Cloud Messaging (FCM)
2. **Desktop (Local)**: Uses system notifications
3. **Web (Fallback)**: Uses browser notifications

All notification logic is in `src/services/notifications.ts` and automatically initialized when the app starts.

---

## 📦 Development Workflow

### Making Changes

1. **Edit your React code** in `/src`
2. **Build the web app**: `npm run build`
3. **Sync to native platforms**: `npm run cap:sync`
4. **Run on target platform** (see platform-specific commands above)

### Hot Reload During Development

For faster development, you can run the web dev server and point native apps to it:

1. Update `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.campusconnect.app',
  appName: 'Campus Connect',
  webDir: 'dist',
  server: {
    url: 'http://localhost:5173',  // Your dev server
    cleartext: true,                // Allow HTTP (dev only!)
  },
};
```

2. Start dev server: `npm run dev`
3. Run native app - it will load from your dev server
4. **Remember to remove `server` config before production builds!**

---

## 🏗️ Building for Production

### iOS App Store

1. In Xcode, select **Any iOS Device** as the build target
2. Product → Archive
3. Upload to App Store Connect
4. Submit for review

### Google Play Store

1. In Android Studio, Build → Generate Signed Bundle/APK
2. Choose **Android App Bundle**
3. Create/select signing key
4. Upload `.aab` file to Google Play Console

### Desktop Installers

```bash
cd electron
npm run electron:pack
```

Distribute the installers in `electron/dist/`

---

## 🔧 Configuration Files

### Capacitor Config
`capacitor.config.ts` - Main configuration for all platforms

### iOS
- `ios/App/App/Info.plist` - iOS permissions and settings
- `ios/App/App.xcodeproj` - Xcode project

### Android
- `android/app/src/main/AndroidManifest.xml` - Android permissions
- `android/app/build.gradle` - Android build config

### Electron
- `electron/package.json` - Electron build settings
- `electron/src/index.js` - Main Electron process

---

## 🐛 Troubleshooting

### Notifications Not Working

**iOS:**
- Check Push Notifications capability is added in Xcode
- Verify APNs certificate is valid
- Test on a real device (not simulator)

**Android:**
- Ensure `google-services.json` is in place
- Check Firebase project is configured
- Verify notification permissions granted

**Desktop:**
- Check system notification permissions
- Ensure Electron has notification access

### Build Errors

**Clear caches and rebuild:**
```bash
# Clean
rm -rf node_modules dist android ios electron/app
npm install
npm run build

# Re-add platforms
npx cap add ios
npx cap add android
npx cap add @capacitor-community/electron

# Sync
npm run cap:sync
```

### TypeScript Errors

If you see Capacitor import errors:
```bash
npm install --save-dev @capacitor/cli
```

---

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Local Notifications Plugin](https://capacitorjs.com/docs/apis/local-notifications)
- [Electron Capacitor Community](https://github.com/capacitor-community/electron)

---

## 🎉 You're All Set!

Your Campus Connect app can now run on:
- 📱 iOS devices
- 📱 Android devices
- 💻 macOS desktop
- 💻 Windows desktop
- 💻 Linux desktop
- 🌐 Web browsers (as before)

All with synchronized data and native notifications! 🚀
