import type { ConfigContext, ExpoConfig } from 'expo/config';

// App identity is still [review] (docs/10-mobile-app.md, "Open decisions"):
// APP_BUNDLE_ID / APP_NAME override the defaults without a code change.
const bundleId = process.env.APP_BUNDLE_ID || 'com.staypookie.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME || 'StayPookie',
  slug: 'staypookie',
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
    adaptiveIcon: {
      backgroundColor: '#f6efe4',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
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
