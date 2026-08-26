import type { ExpoConfig } from 'expo/config'

/**
 * v2 ships as an **update to the existing store listings**, not a new app.
 * Three things below are load-bearing for that and must not be "cleaned up":
 *
 *  1. `bundleIdentifier` / `package` are byte-identical to v1
 *     (`langx-angular` 0.15.0). Change either one and the store treats this as
 *     a different app: second icon on device, zero reviews, lost install base.
 *  2. Both URL schemes are declared. v1 registered
 *     `tech.newchapter.languagexchange` (lowercase x); the abandoned Expo
 *     rewrite declared only `langx`. Ship only `langx` and every deep link
 *     already in the wild breaks.
 *  3. `app.langx.io` app links are carried over from v1's AndroidManifest.
 *
 * versionCode/buildNumber must stay above the published 119.
 */
const V1_URL_SCHEME = 'tech.newchapter.languagexchange'
const APP_LINK_HOST = 'app.langx.io'

const config: ExpoConfig = {
  name: 'LangX',
  slug: 'langx',
  version: '2.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: ['langx', V1_URL_SCHEME],

  ios: {
    bundleIdentifier: 'tech.newchapter.languageXchange',
    buildNumber: '120',
    supportsTablet: true,
    associatedDomains: [`applinks:${APP_LINK_HOST}`],
  },

  android: {
    package: 'tech.newchapter.languageXchange',
    versionCode: 120,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: APP_LINK_HOST }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  web: {
    bundler: 'metro',
    output: 'static',
  },

  plugins: ['expo-router'],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      // Existing EAS project, carried over from the abandoned rewrite.
      projectId: 'c331c0a6-b2fc-4664-a9a3-c04d1fb2c115',
    },
  },
}

export default config
