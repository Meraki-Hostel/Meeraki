import type { ConfigContext, ExpoConfig } from 'expo/config';

// App identity is still [review] (docs/10-mobile-app.md, "Open decisions"):
// APP_BUNDLE_ID / APP_NAME override the defaults without a code change.
// The Android package name is permanent once the app is on Google Play.
const bundleId = process.env.APP_BUNDLE_ID || 'com.staypookie.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME || 'StayPookie',
  slug: 'staypookie',
  description: 'Rent, requests and notices for your hostel — for residents, wardens and owners.',
  version: '1.0.0', // keep MOBILE_MIN_VERSION / MOBILE_LATEST_VERSION on the API in step
  scheme: 'staypookie',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: bundleId,
    // versionCode is assigned by EAS (eas.json: appVersionSource "remote", autoIncrement).
    adaptiveIcon: {
      backgroundColor: '#F6EFE4',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Tokens live in the keychain, not in auto-backup: a restored backup must not resurrect a session.
    allowBackup: false,
    // Firebase (FCM) config for push on Android. Supply it as an EAS file variable named
    // GOOGLE_SERVICES_JSON (or a local path); without it the app builds but cannot get a push token.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || undefined,
    // Only what the app uses is requested: camera (complaint photos, documents), notifications
    // and network. Expo's modules can add storage and audio permissions the app does not need,
    // and Play reviews every declared permission.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#f6efe4', imageWidth: 200 }],
    ['expo-notifications', { color: '#8c5850' }],
    ['expo-image-picker', {
      cameraPermission: 'StayPookie uses the camera to photograph a problem for a complaint, or a document the hostel asked for.',
      photosPermission: 'StayPookie lets you attach photos to complaints and upload documents the hostel asked for.',
      microphonePermission: false,
    }],
  ],
  extra: {
    // Set by `eas init`; push tokens need it (src/push/register.ts).
    eas: { projectId: process.env.EAS_PROJECT_ID || undefined },
  },
});
