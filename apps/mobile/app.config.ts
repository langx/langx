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
 * The build number and Android versionCode are deliberately absent: `eas.json`
 * sets `appVersionSource: "remote"`, so EAS owns them and hands one out per
 * build. They were declared here until 3 September 2026, which silently broke
 * every `production` build — `autoIncrement` cannot write back into a dynamic
 * config, so the build failed before it started. The remote counter has to
 * stay above the published 119.
 */
// Existing EAS project, carried over from the abandoned rewrite.
const EAS_PROJECT_ID = 'c331c0a6-b2fc-4664-a9a3-c04d1fb2c115'

const config: ExpoConfig = {
  name: 'LangX',
  slug: 'langx',
  // The project lives in the `langx` org. Without this, a personal token —
  // EXPO_TOKEN in .env, what the CLI uses non-interactively — is refused as
  // "owner does not match the logged in user" even though it is an org owner.
  owner: 'langx',
  version: '2.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: [...APP_SCHEMES],

  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    supportsTablet: true,
    // The app encrypts nothing of its own; it only speaks HTTPS through the
    // system stack, which Apple's export rules exempt. Answering that here
    // answers it once — without it every upload sits in App Store Connect as
    // "Missing Compliance" and TestFlight will not hand the build to anyone.
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
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
    /**
     * Android 13+'s predictive back: the system previews where back leads
     * before the gesture commits. `react-native-screens` drives the stack's
     * animation from it. Off by default because a screen that intercepts back
     * itself would misbehave — none here does; the only custom handling is
     * `Modal`'s own `onRequestClose`.
     */
    predictiveBackGestureEnabled: true,
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
    /**
     * expo-image-picker declares `READ_EXTERNAL_STORAGE` (up to API 32) and
     * Play's photo-and-video policy counts that as broad gallery access: the
     * first production upload was refused with "developers requesting access
     * to the photo and video permissions are required to tell Google Play
     * about the core functionality of their app". Picking a photo does not
     * need it — Android 13+ never asked for it, and below that the picker is
     * the system photo picker or the documents UI, both of which hand back a
     * URI the app can read without any permission. `pickImageAsset` knows not
     * to request it. `WRITE_EXTERNAL_STORAGE` stays: the camera on Android 9
     * and below cannot save its capture without it, and the policy does not
     * cover it.
     */
    blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE'],
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
   * does not have.
   *
   * `fingerprint` hashes the native layer itself — the native dependencies,
   * the config plugins, everything `expo prebuild` would produce — so the
   * version changes exactly when the binary would have had to change. The
   * `sdkVersion` policy this replaces was one number for a whole SDK release:
   * adding a native module inside SDK 57 left the runtime at
   * `exposdk:57.0.0`, so the update was still offered to a store build that
   * could not run it. That is the guard that lets every merge to `main`
   * publish straight to `production` (`decisions.md`); with one number per SDK
   * it was not a guard at all. A mismatched phone now simply sees no update
   * and keeps the bundle it shipped with.
   *
   * The cost is that a build made under the old policy — 2.0.0 (121), the
   * first store release — has runtime `exposdk:57.0.0` and will never match a
   * fingerprint. It cannot be reached over the air; the next build can.
   *
   * `expo-video`, added for video attachments, is the first native module to
   * arrive under the new policy and the first thing it protects.
   */
  runtimeVersion: { policy: 'fingerprint' },

  /**
   * The brand mark, from `branding/app-resources`. There was no `icon` at all
   * before this, which is to say every build shipped Expo's default.
   */
  icon: './assets/icons/default.png',

  plugins: [
    'expo-router',
    /*
     * The static splash the OS draws before any JS exists. Its whole job is to
     * be indistinguishable from `AppSplash`'s first frame — same ground, same
     * badge, same size — so that hiding it is not a blink.
     *
     * `imageWidth` here and `TILE_SIZE` in `AppSplash.tsx` are one number in
     * two files: this file is evaluated by Node under plain ESM resolution and
     * cannot import from the app. Changing one without the other makes the
     * badge jump size at the exact moment the handover is meant to be
     * invisible.
     *
     * The two hexes are `colors.bg` from `theme/tokens.ts`, written out, for
     * the same reason. Keep them in step by hand.
     *
     * The badges are circles on a transparent surround, and that is not a
     * style choice: Android 12+ draws the splash icon through the platform
     * SplashScreen API, which masks it to a circle. A square icon becomes a
     * disc there and stays square on iOS, so the mark would change shape
     * between the two and again when the JS layer took over.
     */
    [
      'expo-splash-screen',
      {
        image: './assets/splash/badge.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { image: './assets/splash/badge-dark.png', backgroundColor: '#1c1f24' },
      },
    ],
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
    //
    // `enableBackgroundPlayback` defaults to **true**, which is where
    // `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` came from,
    // along with a `mediaPlayback` media-session service and iOS's `audio`
    // background mode. Nothing here plays audio in the background: the only
    // playback is a voice message in an open chat (`MediaBubble`), and the
    // recorder never keeps running once the app is away. Play treats the
    // permission as a declarable one — version 121 sat overdue on App content →
    // Foreground service permissions because of it — and a declaration would
    // have claimed a feature the app does not have. Turning it off removes the
    // permissions and the service rather than blocking the permission and
    // leaving a service that could never legally start.
    /*
     * Video playback. No options: background playback and picture-in-picture
     * both stay off, because a clip in a thread needs neither and each of them
     * adds a background mode the store forms then have to account for.
     */
    'expo-video',
    [
      'expo-audio',
      {
        microphonePermission: 'LangX uses the microphone so you can send voice messages.',
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'LangX uses your photo library so you can share photos and videos in chat.',
        /*
         * Worded, not defaulted. Without this key the plugin still writes
         * `NSCameraUsageDescription` — its own generic "Allow $(PRODUCT_NAME)
         * to access your camera" — so the camera already worked in shipped
         * builds; what it did not have was a sentence saying what for.
         *
         * Android needs nothing here: `CAMERA` comes from expo-image-picker's
         * own manifest, and the plugin only ever *blocks* it, when this is
         * explicitly `false`.
         */
        cameraPermission: 'LangX uses your camera so you can take a photo to send.',
      },
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
