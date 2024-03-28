import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tech.newchapter.languageXchange',
  appName: 'LangX',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'alert', 'sound'],
    },
    Badge: {
      persist: true,
      autoClear: false,
    },
    CapacitorUpdater: {
      appReadyTimeout: 1000, // (1 second)
      responseTimeout: 10, // (10 second)
      autoDeleteFailed: false,
      autoDeletePrevious: false,
      autoUpdate: false,
      resetWhenUpdate: false,
    },
  },
};

export default config;
