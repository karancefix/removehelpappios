import Constants from 'expo-constants';

export default ({ config }) => ({
  ...config,
  expo: {
    ...config.expo,
    name: "Remove.Help",
    slug: "remove",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#facc15"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.remove.help",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "This app uses the camera to allow you to take photos for background removal."
      }
    },
    android: {
      package: "com.remove.help",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#facc15"
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false
          }
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    owner: "cursor1",
    extra: {
      router: {},
      eas: {
        projectId: "194f7ed6-16f4-4b42-9465-0e21677d7b95"
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
}); 