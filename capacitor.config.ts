import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tech.newchapter.languageXchange',
  appName: 'languageXchange',
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
      autoUpdate: true,
      appReadyTimeout: 1000, // (1 second)
      responseTimeout: 10, // (10 second)
      autoDeleteFailed: false,
      autoDeletePrevious: false,
      resetWhenUpdate: false,
      updateUrl: 'https://api.languagexchange.net/api/update/auto_update',
      statsUrl: 'https://api.languagexchange.net/api/update/stats',
    },
  },
};

export default config;
