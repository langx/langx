# Release runbook — shipping v2 over the v1 listings

v2 is an **update to the published LangX listings**, not a new app. That single
fact drives everything below. Get it wrong and the store treats v2 as a
different app: a second icon on people's devices, zero reviews, no install
base.

## Before anything else: can we still sign the Android build?

**This gates the entire Android release and nothing else can proceed without
it.** Check Play Console → Test and release → App Integrity → Play app signing.

**The original keystore was found.** `langx-angular/android/release.keystore`
(2708 bytes, dated 10 January 2024) is v1's release key, with a second copy at
`backup/languageXchange/android/release.keystore`. It is not in any repo — it
sits in the working copy, gitignored — and signing was done by hand rather than
in CI, so the password is not in `gradle.properties`, `build.gradle` or any
workflow. Only the owner has it.

**And the password works.** Confirmed 27 August 2026 by listing the keystore:
one entry, alias `key0`, a 2048-bit RSA key issued 10 January 2024 to New
Chapter Technology LLC and valid until January 2049, SHA-256
`17:D3:A5:F3:…:15:64:9D:A0`. So the best case below is the actual case, and the
two recovery paths are recorded only because losing the password later would
put us back on one of them.

| State                                       | What it means                                                                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **We hold the keystore and its password**   | **This is where we are.** Import it with `eas credentials` and submit normally.                                                                                                               |
| **Play App Signing enabled, password lost** | Still recoverable. Generate a new keystore, export `upload_certificate.pem`, and request an upload key reset in Play Console. Google keeps the app signing key, so nothing changes for users. |
| **Disabled, and the password is lost**      | The Android listing cannot be updated. There is no workaround.                                                                                                                                |

Back the keystore up somewhere that is not a working directory before touching
anything else. Losing it is the one failure in this document with no recovery
path.

Two things about the reset path, both of which affect the schedule: the request
must come from the **Account Owner** (or an account with release + App Signing
permission), and the new key takes **several days** to activate. Put those days
in the plan before promising a date.

## Store identity — do not "clean these up"

Four values in `apps/mobile/app.config.ts` are load-bearing. They look like
leftovers. They are not.

| Value                    | Must stay                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios.bundleIdentifier`   | `tech.newchapter.languageXchange`                                                                                                                  |
| `android.package`        | `tech.newchapter.languageXchange`                                                                                                                  |
| App Store Connect app id | `6474187141` (wired into `eas.json` submit)                                                                                                        |
| Apple Team ID            | `8F63M4JH8P`                                                                                                                                       |
| `scheme`                 | **Both** schemes. v1 registered `tech.newchapter.languagexchange` (lowercase x). Ship only `langx` and every deep link already in the wild breaks. |
| App links                | `https://app.langx.io`, `autoVerify` — carried from v1's AndroidManifest. Declaring them is half the job; see the next section                     |

`versionCode` and `buildNumber` must both start **above 119**, the published
v1 version. They are currently 120.

## Deep links only work once the domain answers

`app.langx.io` is claimed in two places — `associatedDomains` on iOS,
`autoVerify` intent filter on Android — and **both platforms verify the claim
by fetching a file from the domain**. Until that fetch succeeds, every
`https://app.langx.io/...` link opens the browser. Nothing errors, nothing logs.

The files are checked in at `apps/mobile/public/.well-known/`, which Expo
copies verbatim to the root of the web export, so hosting the web build hosts
them. Three things about how they are served are not optional:

- **HTTPS, no redirect.** Both platforms follow zero redirects. A host that
  bounces `app.langx.io` to `www.` or appends a trailing slash fails
  verification while looking fine in a browser.
- **`apple-app-site-association` has no extension and must come back as
  `application/json`.** A static host that guesses `application/octet-stream`
  is the usual cause of "it works on Android but not iOS".
- **No authentication, no geo-blocking.** Apple fetches through its own CDN,
  Google from its own servers; neither carries a user's session.

Verify after deploying, before submitting:

```bash
curl -sI https://app.langx.io/.well-known/apple-app-site-association   # 200, application/json, no 30x
curl -s  https://app.langx.io/.well-known/assetlinks.json | jq .
```

Apple's CDN caches the AASA for up to 24 hours, so fix it _before_ the build
goes out for review, not after.

### The Android fingerprint depends on Play App Signing

`ANDROID_CERT_SHA256` in `packages/shared/src/appIdentity.ts` holds one
fingerprint, `17:D3:…:9D:A0` — v1's release key (alias `key0`, issued 10
January 2024 to New Chapter Technology LLC, valid to 2049), which is the
certificate the published 0.15.0 build was signed with. `assetlinks.json`
lists the same value and a test fails if the two ever disagree.

That is sufficient on its own **only if Play App Signing is disabled**. With it
enabled Google re-signs the bundle, so a store install presents _Google's_ app
signing certificate — a different fingerprint. Store users would then fail
verification while a side-loaded APK passed, which is a confusing way to find
out.

- [ ] Read **Play Console → Test and release → App integrity → App signing**
      and add the **app signing key** SHA-256 if one is listed there

The list takes several fingerprints and there is no cost to carrying both: the
key above still covers internal-testing APKs, side-loads and
`eas build --local`, none of which go through Google's re-signing.

`eas credentials --platform android` prints the fingerprint of the keystore
EAS holds for this project, which is the upload key. It needs no password.

Nothing here is secret. Android serves these fingerprints from every device
that has the app installed, which is why they belong in a public repo.

## Prerequisites that are business process, not code

None of these can be done from this repo, and Faz 7's subscription work cannot
be tested end to end until they are:

- [ ] Paid apps agreement accepted (Apple + Google)
- [ ] Bank and tax details submitted
- [ ] Subscription group + products created in App Store Connect
- [ ] Subscription products created in Play Console
- [ ] RevenueCat project connected to both, API keys issued
- [ ] Google OAuth client created (Web application type) and
      `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set
- [ ] Sign in with Apple: Services ID, key (.p8) and the four `APPLE_*`
      variables set. **Apple requires this if any other social login ships**,
      so it gates the iOS release rather than merely improving it. Until both
      are set the sign-in screen simply does not draw the buttons
- [x] `ascAppId` (6474187141) and `appleTeamId` (8F63M4JH8P) in `eas.json`
- [ ] `EXPO_PUBLIC_REVENUECAT_*` keys set, `react-native-purchases` wired into
      the paywall screen (which today states the offer and says purchase is not
      yet enabled — deliberately, rather than shipping a button that cannot work)

## Migration cutover

1. Run the reservation ETL: `tsx scripts/migrate-appwrite.ts --apply`
   (dry run first — last verified 3479 profiles → 3401 reservation candidates)
2. Run the profile ETL: `tsx scripts/migrate-profiles.ts --apply`
   (dry run: 3479 → 3150 stageable; needs `STORAGE_*` for the media step)
3. Run the message ETL: `tsx scripts/migrate-messages.ts --apply`
   (dry run first; needs `STORAGE_*` for the attachments)

   **Do not skip this step, and do not run it after the Appwrite shutdown.** It
   stages v1's chat history _and copies the 4,874 attachments out of Appwrite
   Storage_, which are encrypted at rest and readable only through Appwrite's
   own API — once that server is gone they cannot be recovered from the bucket
   behind it. Nothing later in this runbook will tell you the history is
   missing: threads simply never appear, because the import waits for both
   participants to return and silently finds nothing staged.

4. All three are idempotent and can be re-run. The profile ETL skips anything a
   v2 user has already restored; the message ETL skips attachments it has
   already copied and rooms already imported into a live conversation.
5. Run the level conversion: `tsx scripts/migrate-levels.ts --apply`
   (dry run first). Rewrites `learning[].level` from CEFR to the four-tier
   scale in both `profiles` and `legacyProfiles`. Skip it and every profile
   written before the switch fails validation the first time its owner edits
   it, while the discovery `minLevel` filter matches none of them — silently,
   in both cases. **Order matters:** run it _after_ the profile ETL, or the ETL
   writes fresh CEFR values behind it.
6. Verify a returning user's handle claim end to end before opening the gates.
7. Verify chat history too: restore two accounts that talked to each other in
   v1 and confirm the thread arrives with its photos and voice notes. A
   conversation is only imported once **both** sides are back, so testing with
   one account proves nothing.

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
