/**
 * Who this app *is*, to Apple, Google and the web — the values that have to be
 * byte-identical across five places or something breaks silently.
 *
 * v2 ships as an update to the live listings, so none of these are ours to
 * choose: they were fixed by `langx-angular` 0.15.0 (versionCode 119) and are
 * inherited. See `docs/v1-reference.md`.
 *
 * The reason this is a module rather than three literals in
 * `apps/mobile/app.config.ts`: the same bundle identifier also has to appear
 * in the API's Apple provider (`appBundleIdentifier`, or a native Sign in with
 * Apple token resolves to a *different* account than the web flow) and in the
 * two association files under `apps/mobile/public/.well-known/`, which are
 * plain JSON served to Apple and Google and cannot import anything. A test
 * checks those files against these constants, because a typo there does not
 * fail a build — it fails months later as "deep links stopped working".
 *
 * Imported by `app.config.ts` through the `@langx/shared/appIdentity` subpath
 * for the same reason `appScheme.ts` is: Expo's config loader resolves it with
 * plain Node ESM, which cannot follow the barrel file's extensionless
 * re-exports. Keep this module free of imports.
 */

/** Identical on both platforms, and identical to v1. Note the capital X. */
export const IOS_BUNDLE_ID = 'tech.newchapter.languageXchange'
export const ANDROID_PACKAGE = 'tech.newchapter.languageXchange'

/** Apple Developer team. Public — it is half of every app ID Apple publishes. */
export const APPLE_TEAM_ID = '8F63M4JH8P'

/** What Apple calls an "app ID prefix + bundle ID", used in the AASA file. */
export const IOS_APP_ID = `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`

/**
 * The domain that opens the app. Carried over from v1's AndroidManifest, and
 * the host of the web build — which is what makes universal links cheap here:
 * every route already answers on the same paths on the web, so a link that
 * opens the app for someone who has it opens the same page for someone who
 * does not.
 */
export const APP_LINK_HOST = 'app.langx.io'

/**
 * SHA-256 fingerprints of the certificates Android accepts as "this app", for
 * `assetlinks.json`.
 *
 * There is usually more than one, and getting this wrong is the single most
 * common reason App Links silently fall back to the browser:
 *
 * - With **Play App Signing**, the fingerprint that matters is Google's *app
 *   signing key*, not the upload key. Play Console → Test and release → App
 *   integrity → App signing key certificate.
 * - Anyone side-loading a build signed with the **upload/release key** — an
 *   internal-testing APK, a local `eas build --local` — verifies against that
 *   key instead, so it belongs here too.
 *
 * Both are public information: Android serves them from every device that has
 * the app installed. Nothing secret goes in this list.
 */
export const ANDROID_CERT_SHA256: readonly string[] = [
  // v1's release key — `langx-angular/android/release.keystore`, alias `key0`,
  // issued 10 Jan 2024 to New Chapter Technology LLC, valid until 2049. This
  // is the certificate the published 0.15.0 build was signed with.
  //
  // Whether it is *sufficient* depends on Play App Signing: if it is enabled,
  // Google re-signs the bundle and store installs present Google's app signing
  // certificate instead, which has a different fingerprint and has to be added
  // alongside this one. Direct installs — internal testing APKs, side-loads,
  // `eas build --local` — present this one either way, so it belongs here
  // regardless of how that question resolves. See docs/release-runbook.md.
  '17:D3:A5:F3:FD:53:32:D3:A3:D2:4F:3F:C0:99:30:21:45:F7:DE:A6:B3:A9:C3:18:6D:B4:3F:34:15:64:9D:A0',

  // The second certificate v1 verifies against, and the answer to the question
  // above: Play App Signing *is* enabled, so store installs present Google's
  // key, not the one above. Taken from what the live site serves today —
  // https://app.langx.io/.well-known/assetlinks.json, which is the file the
  // shipped 0.15.0 build verifies against on every Play install there is.
  //
  // Read off the live deployment rather than the Play Console because the
  // console needs a human, and because this file is the ground truth either
  // way: whatever it lists is what Android has been accepting. Worth
  // confirming against Play Console → App integrity → App signing key
  // certificate at release time, but shipping without it is the failure we
  // know about — dropping it would break App Links for every store install.
  'A6:55:54:9F:DB:37:29:20:30:1B:8D:78:96:2B:B4:8C:95:AD:4C:0D:26:79:0F:D8:1B:BD:8E:74:DA:BF:CD:0E',
]
