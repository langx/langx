// Imported from the dedicated subpath, not the package root: app.config.ts is
// evaluated by Expo's config loader under plain Node ESM resolution (not
// Metro's bundler resolution), which requires explicit file extensions on
// relative imports. `@langx/shared`'s barrel file re-exports several modules
// without them (fine for Metro/tsc's Bundler resolution, not for Node's
// native loader) — `appScheme.ts` has no imports of its own, so it's the one
// module in the package this loader can actually resolve.
import { APP_SCHEMES } from '@langx/shared/appScheme'
import type { ExpoConfig } from 'expo/config'

/**
 * v2 ships as an **update to the existing store listings**, not a new app.
 * Three things below are load-bearing for that and must not be "cleaned up":
 *
 *  1. `bundleIdentifier` / `package` are byte-identical to v1
 *     (`langx-angular` 0.15.0). Change either one and the store treats this as
 *     a different app: second icon on device, zero reviews, lost install base.
 *  2. Both URL schemes are declared (`APP_SCHEMES`, shared with the API's
 *     Better Auth `trustedOrigins` so OAuth redirects back into the app are
 *     trusted). v1 registered `tech.newchapter.languagexchange` (lowercase
 *     x); the abandoned Expo rewrite declared only `langx`. Ship only `langx`
 *     and every deep link already in the wild breaks.
 *  3. `app.langx.io` app links are carried over from v1's AndroidManifest.
 *
 * versionCode/buildNumber must stay above the published 119.
 */
const APP_LINK_HOST = 'app.langx.io'
// Existing EAS project, carried over from the abandoned rewrite.
const EAS_PROJECT_ID = 'c331c0a6-b2fc-4664-a9a3-c04d1fb2c115'

const config: ExpoConfig = {
  name: 'LangX',
  slug: 'langx',
  version: '2.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: [...APP_SCHEMES],

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

  /**
   * Over-the-air updates. JS and assets reach users in minutes without a store
   * review, which is the difference between fixing a crash today and fixing it
   * next week. Native changes — a new module, a new permission, an SDK bump —
   * still require a build and a submission.
   *
   * `fallbackToCacheTimeout: 0` means launch never blocks on the network: the
   * app starts on the bundle it already has and picks up a new one in the
   * background, applied on the next launch. Blocking would trade a crash for a
   * spinner on a bad connection.
   */
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    fallbackToCacheTimeout: 0,
  },

  /**
   * An update is only offered to a build with the same runtime version, which
   * is what stops a JS bundle expecting a native module the installed binary
   * does not have. Tied to the SDK, so it changes exactly when the native
   * layer does.
   */
  runtimeVersion: { policy: 'sdkVersion' },

  plugins: ['expo-router'],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: { projectId: EAS_PROJECT_ID },
  },
}

export default config
