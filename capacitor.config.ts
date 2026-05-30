
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bicadriver.app',
  appName: 'BicaDriver',
  webDir: 'dist',

  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app.bicadriver.ng'
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false  // Set true for dev builds only
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#032e02",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },

    Geolocation: {
      permissions: ["location", "coarseLocation"]
    },

    Camera: {
      permissions: ["camera"]
    }
  }
};

export default config;
