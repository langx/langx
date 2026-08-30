// Imported from dedicated subpaths, not the package root: app.config.ts is
// evaluated by Expo's config loader under plain Node ESM resolution (not
// Metro's bundler resolution), which requires explicit file extensions on
// relative imports. `@langx/shared`'s barrel file re-exports several modules
// without them (fine for Metro/tsc's Bundler resolution, not for Node's
// native loader). These two modules have no imports of their own, which is
// why they are the ones this loader can resolve — keep it that way.
import { ANDROID_PACKAGE, APP_LINK_HOST, IOS_BUNDLE_ID } from '@langx/shared/appIdentity'
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
 *     Declaring them is only half of it — both platforms verify the claim
 *     against a file on the domain, so these entries do nothing until
 *     `apps/mobile/public/.well-known/` is actually served from that host.
 *
 * versionCode/buildNumber must stay above the published 119.
 */
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
    bundleIdentifier: IOS_BUNDLE_ID,
    buildNumber: '120',
    supportsTablet: true,
    // Adds the Sign in with Apple entitlement. Without it the native sheet
    // opens and then fails with no identity token, which reads like a bug in
    // the app rather than a missing capability.
    usesAppleSignIn: true,
    // `webcredentials` is not about links: it is what lets iCloud Keychain
    // treat a password saved on app.langx.io and one saved in the app as the
    // same credential, so signing in on the phone offers the password the
    // person already has. Both halves are declared in the AASA file.
    associatedDomains: [`applinks:${APP_LINK_HOST}`, `webcredentials:${APP_LINK_HOST}`],
  },

  android: {
    package: ANDROID_PACKAGE,
    versionCode: 120,
    /**
     * FCM's Android client config. Only set when the file is actually there:
     * naming a file that does not exist fails the prebuild, and this repo is
     * public so the file is not committed. Without it the app builds and runs
     * and simply never receives a remote notification on Android — which is
     * the state it is in until someone points this at a real file.
     */
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
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

  /**
   * The brand mark, from `branding/app-resources`. There was no `icon` at all
   * before this, which is to say every build shipped Expo's default.
   */
  icon: './assets/icons/default.png',

  plugins: [
    'expo-router',
    /**
     * A second home-screen icon, for Pro. Native only and **native only in the
     * strong sense**: switching icons is an OS call, it cannot travel in an
     * over-the-air update, and neither the web build nor Expo Go has anywhere
     * to put it. The settings row hides itself where `isSupported` is false.
     */
    [
      'expo-alternate-app-icons',
      [
        {
          name: 'dark',
          ios: './assets/icons/dark.png',
          android: {
            foregroundImage: './assets/icons/dark.png',
            backgroundColor: '#141519',
          },
        },
      ],
    ],
    // The birth-date picker's native module. Config-plugin only — there is
    // nothing to configure, but without the entry the module is not linked
    // into a build.
    '@react-native-community/datetimepicker',
    // Microphone access is only ever requested when the user taps record, but
    // the string has to be declared here or iOS terminates the app the first
    // time it is asked for.
    [
      'expo-audio',
      { microphonePermission: 'LangX uses the microphone so you can send voice messages.' },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'LangX uses your photo library so you can share photos in chat.' },
    ],
    // Only ever requested when someone turns on location sharing in Settings,
    // and only ever "when in use" — there is no background permission here and
    // adding one would change what both stores' privacy forms have to say.
    // The string is what iOS shows in the prompt, so it names the feature
    // rather than the permission.
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'LangX uses your approximate location so you can find language partners near you. Your exact position is never stored, and nobody is shown more than a rough distance.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: { projectId: EAS_PROJECT_ID },
  },
}

export default config
