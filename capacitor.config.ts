import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tech.newchapter.languageXchange',
  appName: 'LangX',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['langx.io'],
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
  },
};

export default config;
