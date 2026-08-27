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

## The API has to be deployed, and it has to be deployed early

Everything below this line assumes the v2 API answers on a public URL. For a
long time nothing did: `api.langx.io` still points at v1's Appwrite host, and
the repo had no deploy configuration at all. That single gap blocked the
RevenueCat webhook, which cannot be configured without a URL to point at.

`Dockerfile` and `fly.toml` at the repo root are the deploy; `docs/self-host.md`
has the commands and the Cloudflare caveat. Use a **new** subdomain rather than
`api.langx.io` — v1 is still serving from that name and moving it now breaks
the users we are trying to migrate.

- [ ] MongoDB Atlas cluster created and `MONGODB_URI` set. It must be a replica
      set; Atlas already is, a hand-rolled `mongod` is not, and Better Auth
      fails on the first sign-up without one
- [ ] `fly launch --no-deploy`, then `fly secrets set` for `MONGODB_URI`,
      `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and whichever optional services
      are being switched on. Nothing secret goes in `fly.toml` — this repo is
      public
- [ ] `fly certs add <host>`, with the Cloudflare record on DNS-only (grey
      cloud) or the certificate never issues
- [ ] `TRUSTED_ORIGINS` includes the web origin and both app schemes, or the
      browser drops the session cookie and sign-in appears to succeed and do
      nothing

**This is ordered before the EAS build on purpose.** `EXPO_PUBLIC_API_URL` is
compiled into the client bundle, so the host has to exist and be final before
the build that goes to the stores. Build first and deploy after, and the
binary in review is pointing at `http://localhost:4000` — which passes every
local test and fails on every real device. Setting that variable on the
`preview` and `production` profiles in `eas.json` is the checklist item this
deadline exists for; it is listed with the other prerequisites below.

Once the host answers, the webhook is a five-minute dashboard task:

- [ ] RevenueCat → project LangX (`94ab2b94`) → Integrations → Webhooks →
      `https://<host>/webhooks/revenuecat`, with an "Authorization header
      value" you choose
- [ ] The identical string in `REVENUECAT_WEBHOOK_AUTH_HEADER`, plus
      `REVENUECAT_SECRET_API_KEY`. RevenueCat does not sign webhooks
      cryptographically, so that literal-string comparison is the whole
      defense; left unset the route refuses every request rather than
      trusting one
- [ ] Confirm with a Test Store purchase: a 200 in RevenueCat's webhook log,
      and `profiles.entitlement` updating without the client calling
      `POST /billing/refresh`

Without the webhook the app still sells subscriptions — the paywall calls
`POST /billing/refresh` after a purchase and on restore. What is missed is
every renewal and cancellation that happens outside the app, which is most of
them after the first month.

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

### Android needs both fingerprints, and v1 tells us which

`ANDROID_CERT_SHA256` in `packages/shared/src/appIdentity.ts` holds two:

| Fingerprint     | What it is                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `17:D3:…:9D:A0` | v1's release key — `langx-angular/android/release.keystore`, alias `key0`, issued 10 January 2024, valid to 2049 |
| `A6:55:…:CD:0E` | Google's app signing key, from Play App Signing                                                                  |

Both come from what v1 serves at
`https://app.langx.io/.well-known/assetlinks.json` today, which is the file
every shipped Play install has been verifying against — so this is not a guess
about how Play is configured, it is the configuration itself, read back out.
Two fingerprints means Play App Signing is enabled: Google re-signs the bundle
and store installs present its certificate, while internal-testing APKs,
side-loads and `eas build --local` still present the release key. Ship one of
them and half the installs fail verification.

`assetlinks.json` lists the same two values and a test fails if the file and
the constant ever disagree.

- [ ] Confirm the second value against **Play Console → Test and release → App
      integrity → App signing key certificate** before submitting. It should
      match; if Play shows something else, Play wins and both go in the list.

v2 replaces this file when the web build deploys, so getting it wrong is a
regression against links that work today, not a new feature that fails.

`eas credentials --platform android` prints the fingerprint of the keystore
EAS holds for this project, which is the upload key. It needs no password.

Nothing here is secret. Android serves these fingerprints from every device
that has the app installed, which is why they belong in a public repo.

## Push needs credentials in three places

The pipeline is complete in code — a token is registered, a message send fans
out to the recipient's devices, a nudge goes out at 20:00 local, a tapped
notification opens the conversation — and none of it reaches a phone until
Expo can talk to Apple and Google on our behalf. There are three separate
pieces and missing any one of them looks identical from the app: nothing
arrives, nothing errors.

- [ ] **APNs key (iOS).** Apple Developer → Keys → a key with the Apple Push
      Notifications service enabled. `eas credentials` uploads it. One key
      covers development and production.
- [ ] **FCM v1 service account (Android).** Firebase console → Project
      settings → Service accounts → generate a private key, then upload the
      JSON with `eas credentials`. The legacy server key is gone; FCM v1 is
      the only option now.
- [ ] **`google-services.json` in the build.** The same Firebase project's
      Android app config, which carries the sender id the client registers
      with. It is gitignored — this repo is public — so point
      `GOOGLE_SERVICES_JSON` at a local path or an EAS file secret.
      `app.config.ts` only sets `googleServicesFile` when that variable is
      present, so a build without it succeeds and simply never receives a
      remote notification.

The Firebase project must use the same package name,
`tech.newchapter.languageXchange`. A mismatch registers tokens that Expo
accepts and FCM silently drops.

Verify with a real device before submitting — a simulator cannot receive
remote notifications at all:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H 'content-type: application/json' \
  -d '{"to":"ExponentPushToken[…]","title":"test","body":"hello"}'
```

A `DeviceNotRegistered` ticket in the reply means the credentials are wrong,
not the token. The API prunes tokens that come back with it, so a
misconfigured send also quietly empties the devices collection — fix the
credentials before running the streak reminder against real users.

## Prerequisites that are business process, not code

None of these can be done from this repo, and Faz 7's subscription work cannot
be tested end to end until they are:

- [ ] Paid apps agreement accepted (Apple + Google)
- [ ] Bank and tax details submitted
- [ ] Subscription group + products created in App Store Connect
- [ ] Subscription products created in Play Console
- [ ] RevenueCat project connected to both, API keys issued. The webhook is a
      separate step and needs the API deployed first — see above
- [ ] Google OAuth client created (Web application type) and
      `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set
- [ ] Sign in with Apple: Services ID, key (.p8) and the four `APPLE_*`
      variables set. **Apple requires this if any other social login ships**,
      so it gates the iOS release rather than merely improving it. Until both
      are set the sign-in screen simply does not draw the buttons
- [x] `ascAppId` (6474187141) and `appleTeamId` (8F63M4JH8P) in `eas.json`
- [ ] `EXPO_PUBLIC_API_URL` set on the `preview` and `production` build
      profiles in `eas.json`. Only `development` sets it today, and only to
      localhost — which a development build rewrites to the dev server's
      address at runtime, but a released build has no dev server and would
      ship pointing at the phone itself
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
