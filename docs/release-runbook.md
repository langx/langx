# Release runbook — shipping v2 over the v1 listings

v2 is an **update to the published LangX listings**, not a new app. That single
fact drives everything below. Get it wrong and the store treats v2 as a
different app: a second icon on people's devices, zero reviews, no install
base.

## Before anything else: can we still sign the Android build?

**This gates the entire Android release and nothing else can proceed without
it.** Check Play Console → Test and release → App Integrity → Play app signing.

| State                                                       | What it means                                                                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Play App Signing enabled**                                | A lost upload key is recoverable. Generate a new keystore, export `upload_certificate.pem`, and request a reset in Play Console. Google keeps the app signing key, so nothing changes for users. |
| **Enabled, and we still hold the original upload keystore** | Best case. Import it into EAS with `eas credentials`.                                                                                                                                            |
| **Disabled, and the original keystore is lost**             | The Android listing cannot be updated. There is no workaround.                                                                                                                                   |

Two things about the reset path, both of which affect the schedule: the request
must come from the **Account Owner** (or an account with release + App Signing
permission), and the new key takes **several days** to activate. Put those days
in the plan before promising a date.

## Store identity — do not "clean these up"

Four values in `apps/mobile/app.config.ts` are load-bearing. They look like
leftovers. They are not.

| Value                  | Must stay                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios.bundleIdentifier` | `tech.newchapter.languageXchange`                                                                                                                  |
| `android.package`      | `tech.newchapter.languageXchange`                                                                                                                  |
| `scheme`               | **Both** schemes. v1 registered `tech.newchapter.languagexchange` (lowercase x). Ship only `langx` and every deep link already in the wild breaks. |
| App links              | `https://app.langx.io`, `autoVerify` — carried from v1's AndroidManifest                                                                           |

`versionCode` and `buildNumber` must both start **above 119**, the published
v1 version. They are currently 120.

## Prerequisites that are business process, not code

None of these can be done from this repo, and Faz 7's subscription work cannot
be tested end to end until they are:

- [ ] Paid apps agreement accepted (Apple + Google)
- [ ] Bank and tax details submitted
- [ ] Subscription group + products created in App Store Connect
- [ ] Subscription products created in Play Console
- [ ] RevenueCat project connected to both, API keys issued
- [ ] `ascAppId` filled into `eas.json`'s submit profile
- [ ] `EXPO_PUBLIC_REVENUECAT_*` keys set, `react-native-purchases` wired into
      the paywall screen (which today states the offer and says purchase is not
      yet enabled — deliberately, rather than shipping a button that cannot work)

## Migration cutover

1. Run the reservation ETL: `tsx scripts/migrate-appwrite.ts --apply`
   (dry run first — last verified 3479 profiles → 3401 reservation candidates)
2. Run the profile ETL: `tsx scripts/migrate-profiles.ts --apply`
   (dry run: 3479 → 3150 stageable; needs `STORAGE_*` for the media step)
3. Both are idempotent and can be re-run. The profile ETL skips anything a v2
   user has already restored.
4. Verify a returning user's handle claim end to end before opening the gates.

## Release

- **Play:** staged rollout starting at 10% (`eas.json` sets `rollout: 0.1`).
- **iOS:** phased release.
- Watch crash-free sessions before widening. The `minSdk` bump means some v1
  devices will stop receiving updates — check the install base's OS
  distribution first so that is a decision, not a surprise.

## The 16 KB page size requirement

Android's deadline was **31 May 2026 — already passed**. Expo SDK 57 / RN 0.86
handle this, but any third-party native library that has not been rebuilt for
16 KB pages will fail on newer devices. Verify with a real device or emulator
image configured for 16 KB before the rollout widens past 10%.

## Content that must ship with the release

See `docs/legal/promise-change.md`. In short: the homepage's "free forever"
claim, the token's retirement, the Terms, the privacy policy, and both store
listings all need updating, and the release notes must tell returning users to
sign up again to claim their username. Their old passwords could not be
migrated; without that line, the first thing a returning user meets is a login
that rejects them.
