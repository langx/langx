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
long time nothing did: `api.langx.io` pointed at v1's Appwrite host, and the
repo had no deploy configuration at all. That single gap blocked the
RevenueCat webhook, which cannot be configured without a URL to point at.

`Dockerfile` and `fly.toml` at the repo root are the deploy; `docs/self-host.md`
has the commands and the Cloudflare caveat. Since 3 September 2026
`api.langx.io` resolves to the Fly app `langx-api` and `app.langx.io` serves
the web build; the temporary `api2.langx.io` / `app2.langx.io` names used
while v1 still owned those hosts were removed the same day. That repoint
happened **before** the checklist in **Retiring the v1 API** at the end of
this runbook was worked through, so its remaining items are now about
repairing the callers it lists, not about when to move the name.

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

- [x] RevenueCat → project LangX (`94ab2b94`) → Integrations → Webhooks →
      `https://api.langx.io/webhooks/revenuecat`, with an "Authorization header
      value" you choose. Done 3 Sept 2026, both Production and Sandbox
- [x] The identical string in `REVENUECAT_WEBHOOK_AUTH_HEADER`, plus
      `REVENUECAT_SECRET_API_KEY`. RevenueCat does not sign webhooks
      cryptographically, so that literal-string comparison is the whole
      defense; left unset the route refuses every request rather than
      trusting one. The project had **no** secret key until then — the only
      key on it was the Test Store's public SDK key, which is not the same
      thing and cannot grant anything
- [x] Confirmed without waiting for a store purchase: a promotional grant to a
      throwaway subscriber produced a webhook within a second and the API
      answered 200. RevenueCat's own event list showed nothing for it — that
      list is not evidence, the API's logs are. A Test Store purchase is still
      worth doing for the _purchase_ path, which this does not exercise

Without the webhook the app still sells subscriptions — the paywall calls
`POST /billing/refresh` after a purchase and on restore. What is missed is
every renewal and cancellation that happens outside the app, which is most of
them after the first month.

### Which database production actually uses

dev and prod are **not two clusters — they are two database names inside one
cluster**, and the cluster is the one called `dev`. Checked 28 August 2026:

| Where              | `MONGODB_DB`   | Against                                 |
| ------------------ | -------------- | --------------------------------------- |
| Local `.env`       | `langx_dev`    | `dev.3xuhkbz.mongodb.net` (Atlas)       |
| `fly.toml` `[env]` | `langx`        | whatever the `MONGODB_URI` secret holds |
| Tests              | `langx_*_test` | `mongodb-memory-server`, never Atlas    |

So **production is `langx`, and it is serving**: `langx-api.fly.dev/health`
answers `{"status":"ok","db":"up"}`. `client.db(dbName)` in
`apps/api/src/db/client.ts` is the entire separation — one connection string,
one Atlas user, two names.

Two consequences, neither of which is visible from the app:

- The credentials in `.env` and `atlas-credentials.env` are a **single Atlas
  user reaching both databases**. Anything that can read the dev database can
  read and drop the production one, and a script run with the wrong
  `MONGODB_DB` writes to real users. `scripts/seed-test-users.ts` takes a
  `--db` flag for exactly this reason — it is a guard, not a convenience.
- Both share one cluster's storage and connection limit, so a migration ETL
  run from a laptop competes with production traffic.

- [x] Verified against the deploy rather than against this file, on
      28 August 2026: `fly config env -a langx-api` reports `MONGODB_DB=langx`,
      and `fly secrets list` holds only `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
      `MONGODB_URI`, `RESEND_API_KEY`, `EMAIL_FROM` and `TRUSTED_ORIGINS` — no
      `MONGODB_DB` secret, so nothing overrides `[env]` in `fly.toml`.
      Production is `langx`, confirmed from the deploy and not from this file
- [ ] Decide whether production keeps living in a cluster named `dev`. A
      separate cluster — or at minimum a second Atlas user restricted to
      `langx` — is what stops a local mistake reaching real users. It costs one
      `fly secrets set MONGODB_URI` and a restart, so do it **before** the
      migration ETLs load 3,479 real profiles in, not after

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

## Email needs a verified sender and a secret that is never rotated

Push reaches a phone once Apple and Google are configured. Notification email
reaches an inbox once three things are true, and the first is the one that
takes days rather than minutes.

- [ ] **A verified sending domain.** Resend → Domains → `langx.io`, then the
      SPF, DKIM and DMARC records it prints, in Cloudflare DNS. Until this is
      done `EMAIL_FROM` has to stay on `onboarding@resend.dev`, which works but
      puts a stranger's domain on every email the app sends.
- [ ] **`EMAIL_FROM` pointed at it**, e.g. `LangX <hello@langx.io>`. The TODO
      in `env.ts` comes out with it.
- [ ] **`EMAIL_UNSUBSCRIBE_SECRET` set**, `openssl rand -base64 32`.
      **Generate once and never rotate it.** It signs the unsubscribe link in
      every notification email ever sent, and those links live in inboxes for
      years — rotating it breaks all of them at once, which is the legal way
      out of the mail. Unset, the app falls back to `BETTER_AUTH_SECRET` and
      inherits exactly that problem.

Read one before anybody else does: leave `RESEND_API_KEY` unset locally and the
sender prints each message to the log instead, headers included.

### Sending a campaign

The only notification that is not automatic, and the only one that can annoy
several thousand people at once.

```bash
# Counts and prints; sends nothing.
pnpm --filter @langx/api exec tsx scripts/send-campaign.ts \
  --campaign 2026-09-launch --subject "LangX v2 is here" \
  --html-file ./campaigns/launch.html

# Same command, plus --confirm.
```

- The dry run is not optional in practice: it prints the recipient count and
  five masked addresses, and a count that surprises you is the cheapest bug
  report available.
- Both bodies must contain `{{unsubscribeUrl}}`; the script refuses otherwise.
- A re-run after a crash cannot mail anybody twice — recipients are claimed in
  `emailCampaigns` before the batch, and the unique index enforces it.
- Watch Resend's dashboard afterwards. A complaint rate above 0.1% means stop
  and work out why before the next one.
- One campaign is one language. For a bilingual send, run it twice with
  different ids and `--locale`.

## Shipping runs on expo.dev

Builds, store submissions and over-the-air updates are all EAS jobs, defined
in `apps/mobile/.eas/workflows/`. GitHub Actions only tests. The three
workflows, and what each costs:

| Workflow             | Trigger                  | Cost                                  |
| -------------------- | ------------------------ | ------------------------------------- |
| `preview-update.yml` | every merge to `main`    | nothing — an OTA update, no build     |
| `preview-build.yml`  | by hand, pick a platform | one build of the free plan's 15/month |
| `release.yml`        | by hand, pick a platform | one build, then `eas submit`          |

The free plan allows 15 Android and 15 iOS cloud builds a month and 1,000
monthly active users on updates. JS-only changes never need a build: a
preview install picks them up on the next launch from the `preview` channel,
and a store build from the `production` channel once one exists. Only a
native change — a new module, a permission, an SDK bump, an icon — needs a
build, and those are started by hand so the quota is spent on purpose.

- [ ] **Link the GitHub repo once**, or the push trigger never fires: expo.dev
      → project `langx` → Project settings → GitHub → connect `langx/langx`,
      base directory `apps/mobile`. Manual runs work without it:
      `eas workflow:run preview-build.yml` from `apps/mobile`.
- [ ] **iOS credentials.** EAS holds the APNs key but no distribution
      certificate or provisioning profile, and no App Store Connect API key
      for submission. One interactive `eas credentials -p ios` on a Mac with
      the Apple ID signed in creates the first two; the API key is made in
      App Store Connect → Users and Access → Integrations and uploaded on the
      same screen. Until then `preview-build.yml` and `release.yml` only work
      for Android.
- [ ] **Play submit permissions.** The service account
      `eas-submit@langx-48eb0.iam.gserviceaccount.com` is uploaded to EAS but
      Play does not know it yet: Play Console → Users and permissions → invite
      that address with release permissions, and enable the Google Play
      Android Developer API on the `langx-48eb0` project. Until then
      `release.yml` builds Android and fails at the submit step.

What is already in EAS: the Android application identifier with the real
upload keystore (alias `key0`, the v1 key Play trusts), the FCM V1 service
account and the APNs key for push, and `GOOGLE_SERVICES_JSON` /
`GOOGLE_SERVICES_PLIST` as file variables on every environment.

## Actions that succeed silently

`src/lib/alert.ts` and `AlertHost` give the app a dialog that works in the
browser as well as on a device, and the destructive paths already ask before
they act. The other half is missing: an action that _succeeds_ says nothing.

Sign out is the clearest case. `apps/mobile/app/(app)/me.tsx` unregisters the
push token, ends the session and replaces the route — three things — and all
the user sees is the sign-in screen appearing. On web that reads as a page that
navigated by itself, not as a session that ended.

**The decision, made once so it is not remade per screen: something that
worked gets a toast, something that failed gets an alert.** A failure carries
detail and is worth interrupting for — missing it because you looked away for
four seconds is the outcome `alert.ts` exists to prevent. A success has nothing
to decide, and putting an OK button under it asks for a tap that means nothing.
`src/lib/toast.ts` is the second queue that follows from it, drawn by
`ToastHost` as a self-dismissing banner rather than a `Modal`, so it never
takes the screen's touches while it is up.

- [x] Ask before signing out, so a mis-tap on the profile screen is not an
      instant session loss
- [x] Acknowledge after it: "Signed out — your session has ended." The banner
      outlives the `router.replace` underneath it because `ToastHost` is
      mounted at the root layout rather than inside the navigator — the same
      reason the delete-account confirmation survives signing itself out
- [x] Give the same treatment to the other actions that return to a screen with
      no word about what happened: profile saved, photo uploaded, report sent,
      user blocked and unblocked, account deleted. Reporting was the worst of
      them — the picker closed onto an identical screen, so nothing
      distinguished a sent report from a cancelled one

Nothing here blocks the build, and all of it is visible in the first minute of
use. It belongs before the rollout widens, not in the first patch after it.

## Design pass — the app does not look like LangX yet

Two things are wrong with how v2 looks, and only one of them is a matter of
taste.

The first is not. `apps/mobile/app.config.ts` sets no `icon`, no `splash`, no
`android.adaptiveIcon` and no `web.favicon`, and there is no image file
anywhere in this repo. Every build so far has shipped Expo's default icon.
That blocks submission on its own, and it is invisible while developing,
because a dev client shows its own icon instead.

The second is that the code and the store have drifted apart. What users
recognise is v1's identity, and it is still consistent everywhere it is
served: amber `#ffc409` with orange `#ff571a`, the two-arc exchange mark,
Comfortaa — on langx.io, on token.langx.io, in every store screenshot, in the
Windows tile colour. `apps/mobile/src/lib/theme.ts` uses none of it: `primary`
is near-black `#111113`, `accent` is blue, and there is no yellow in the app
at all. The website still holds the old palette while borrowing `pro`,
`streak` and `accent` back from `theme.ts`, so the two surfaces have already
half-merged into a third thing nobody designed. Ship it as-is and the icon,
the screenshots and the app disagree with each other in the same listing.

This sits before **Release** rather than in it on purpose: the icon and the
screenshots are part of the submission, not part of the rollout.

Two constraints on whatever gets decided. `docs/token-messaging-brief.md`
rules out coin, chain and wallet iconography — that is an App Review question
(3.1.5(b)), not a stylistic one. And `packages/shared/src/cosmetics.ts` sells
`frame.gold` as a rank, so if the brand colour stays amber, gold has to read
as something bought rather than as the product.

- [ ] Decide the identity first: keep v1's amber and orange, or make the
      black-and-blue drift in `theme.ts` official. This ships as an update to
      the existing listings, so a changed icon on a returning user's home
      screen is a cost being chosen, not a free redraw
- [ ] One source per surface — `theme.ts` for the app, `_themes.scss` and
      `_variables.scss` for the site. The site's `define-color` mixin emits
      the `-rgb` and `-contrast` variants that components composite against;
      replacing it with flat hex breaks `Button`, `Tag` and `Waves`. Radius
      and the first six spacing steps already match across the two, and
      should stay matched
- [ ] Dark mode in the app. `userInterfaceStyle: 'automatic'` has been set
      all along with nothing behind it, while the site has had three-state
      theming since launch. `colors` is a module constant that 41
      `StyleSheet.create` calls capture at load, so this is the one item that
      is not a value swap
- [ ] A typeface. The app loads no font and renders in the platform default;
      the site's headings are Comfortaa. `expo-font` is already a dependency
- [ ] Replace the emoji icons, the tab bar in `app/(app)/_layout.tsx`
      included, with a real icon set. They became the house style by
      accident, and they draw differently on every platform
- [ ] Move `components/ui/Button.tsx` and `FormField.tsx` onto the tokens.
      Both predate `theme.ts` and hold most of the stray hex left in the app;
      fixing those two reaches 22 and 7 screens respectively
- [ ] Give the cosmetic tiers real colours. `cosmetics.ts` names bronze,
      silver and gold and defines no values, so nothing can render them today
- [ ] Produce the icon, splash, adaptive icon and favicon and wire them into
      `app.config.ts`. `branding/` has no vector master — its only SVG is an
      auto-trace — and its `splash.png` is 3601×3600, so none of it can be
      reused unaltered
- [x] Profile screens show account age ("Registered 3 months ago", the unit
      widening from days to months to years as the account gets older) and a
      Verified Email badge. The DTO is `PublicProfile` in
      `apps/api/src/modules/profiles/profiles.ts`, mirrored by
      `PublicProfileDto` in `apps/mobile/src/api/types.ts` — **not**
      `packages/shared`, which holds the schemas and now the wording in
      `accountAge.ts`. `emailVerified` lives in Better Auth's `user`
      collection, so it crosses the id boundary and goes through
      `lib/authId.ts`. One thing to know before reading the badge as a signal:
      it is true for **every** profile today, because onboarding is gated on
      `requireVerifiedEmail`, and a pre-created v1 row is verified from the start
      itself, so nothing can currently produce an unverified profile. It is
      read from `user` rather than assumed, so that an email-change flow later
      does not turn it into a badge that lies
- [ ] Restyle the screens and the pages. `website/src/lib/data/*.ts` is
      hand-synced content and does not move, and neither does the
      toast-and-alert behaviour decided above — only the appearance changes
- [ ] The brand colour also lives outside CSS: the meta tags in
      `website/src/app.html`, `website/static/favicons/*`, the inline fills
      in `Logo.svelte`, and the feature screenshots under
      `website/static/images/features/`, which still show v1's UI
- [ ] Re-shoot the store screenshots in the new identity. They live in
      `branding/`, which is out of scope for work — the shots are needed, the
      repo is still not one to work in

## Prerequisites that are business process, not code

None of these can be done from this repo, and Faz 7's subscription work cannot
be tested against a real store until they are. What _can_ be tested without
them — the paywall, the webhook handler, entitlement and reconciliation, as one
flow — is in [`billing-testing.md`](billing-testing.md); it does not replace the
Test Store purchase below, it only stops that purchase being the first time any
of it runs together.

- [ ] Paid apps agreement accepted (Apple + Google)
- [ ] Bank and tax details submitted
- [ ] Subscription group + products created in App Store Connect
- [ ] Subscription products created in Play Console
- [ ] RevenueCat project connected to both, API keys issued. The webhook is a
      separate step and needs the API deployed first — see above
- [ ] Google OAuth client created (Web application type) and
      `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set. Authorized redirect URIs
      are the API's callback, one per environment —
      `https://api.langx.io/api/auth/callback/google` and
      `http://localhost:4000/api/auth/callback/google`. There is no third one
      for a phone: Google refuses a private LAN address, so a development build
      on a real device can only sign in against the deployed API
- [ ] Sign in with Apple: Services ID, key (.p8) and the four `APPLE_*`
      variables set. **Apple requires this if any other social login ships**,
      so it gates the iOS release rather than merely improving it. Until both
      are set the sign-in screen simply does not draw the buttons
- [ ] `APPLE_DOMAIN_ASSOCIATION` set, **before** the Services ID's return URL
      can be saved. Apple verifies the domain of the return URL — `api.langx.io`,
      the API's host, not the web app's — by fetching
      `/.well-known/apple-developer-domain-association.txt` from it over HTTPS
      with no redirect. The API serves that path from this variable; unset, it
      404s and the portal refuses to save
- [x] `ascAppId` (6474187141) and `appleTeamId` (8F63M4JH8P) in `eas.json`
- [x] `EXPO_PUBLIC_API_URL` set on the `preview` and `production` build
      profiles in `eas.json` — both point at `https://api.langx.io`.
      `development` still points at localhost, which a development build
      rewrites to the dev server's address at runtime; a released build has no
      dev server and would ship pointing at the phone itself, which is what
      this item existed to prevent
- [ ] `EXPO_PUBLIC_REVENUECAT_*` keys set, `react-native-purchases` wired into
      the paywall screen (which today states the offer and says purchase is not
      yet enabled — deliberately, rather than shipping a button that cannot work).
      All three are empty, so `isPurchasesAvailable()` is false on every
      platform. Setting `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY` alone is enough
      to exercise the whole paywall before the store products exist
- [ ] **Buying on the web is not built at all**, and no key changes that:
      `react-native-purchases` is native-only, so `purchases.ts` returns early
      on `Platform.OS === 'web'` and the paywall says purchasing is
      unavailable. It needs RevenueCat Web Billing — a Stripe connection on
      their side, web products and packages, `@revenuecat/purchases-js` as a
      dependency, and a third branch in `purchases.ts`. A project of its own,
      not a configuration gap

## Migration cutover

Storage first. Steps 2 and 3 copy media into our bucket and write its public
URL into the staged records, so `STORAGE_*` has to be final — not just set —
before either runs.

- [x] Bucket created and verified on 2 September 2026: Backblaze B2
      `langx-media`, `allPublic`, region `eu-central-003`, in the same account
      as v1's `langxapp` (Appwrite's encrypted store, 8,236 objects — leave it
      alone, the ETL reads it through Appwrite). One CORS rule for
      `app.langx.io` and the local Expo origins. The key is scoped to this
      bucket only. Presign → PUT → public GET → delete → 404 passed from the
      local `.env`. `docs/self-host.md` → Storage has the commands.
      **Production only**: local development uses the separate
      `langx-media-dev` bucket (same region, localhost-only CORS, its own
      key), which is what `.env` points at — so nothing tested on a laptop
      can land next to migrated user media
- [ ] Decide the public base URL **before the first real upload and before
      the ETLs**: `https://f003.backblazeb2.com/file/langx-media` (the shape the dev
      `.env` uses today, with `-dev`) or `https://media.langx.io/file/langx-media` behind
      Cloudflare (free egress; needs one proxied CNAME to
      `f003.backblazeb2.com`). Whatever is stored is permanent — see the
      self-host doc for why
- [ ] `fly secrets set STORAGE_*` on `langx-api`, pointing at `langx-media`.
      Create a fresh bucket-scoped key for it at that moment with
      `b2 key create --bucket langx-media ...` — B2 shows a secret once, and the one made on
      2 September was not kept. Not set as of 2 September 2026; the deploy's
      upload endpoints still answer "Storage is not configured". Setting
      secrets restarts the machine

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
6. Open the v2 accounts:
   `tsx --env-file=../../.env --env-file=../../.env.prod scripts/precreate-v1-users.ts --apply`
   (dry run first). Writes a verified, passwordless `user` row for every v1
   Auth account, so "forgot password" and Google/Apple work for returning
   users and nobody has to sign up again — see `docs/decisions.md` → _Every
   v1 account has a v2 `user` row_. **Also needs the live Appwrite**: it is
   the only source of the plaintext emails. Idempotent; an address that
   already has a v2 user is left alone.
7. Verify a returning user's handle claim end to end before opening the gates.
8. Verify chat history too: restore two accounts that talked to each other in
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

## Location changes both privacy forms

Nearby (Polyglot) added the app's first location permission, so two answers that
were "no" are now "yes", and a store form that still says otherwise is a false
declaration rather than a stale one. The box-by-box version of everything below,
including two answers that are already live and wrong, is
[`store/privacy-forms-checklist.md`](store/privacy-forms-checklist.md) — open it
next to the Console rather than working from this section:

- [ ] Play Data Safety → **Location → Approximate location**: collected, not
      shared, optional, purpose "App functionality". **Precise location stays
      unchecked** — the client asks the OS for its lowest accuracy and the
      server rounds to ~1 km before storing, so there is no precise data to
      declare
- [ ] Apple App Privacy → **Location → Coarse Location**, linked to the user,
      purpose "App Functionality". Precise Location stays unchecked
- [ ] The privacy policy has to describe it: what is stored, that it is
      optional, that it is rounded, and that other users see only a bucketed
      distance. `docs/store/privacy-data-safety.md` is the source text

The permission itself is **when-in-use only** and declared in
`app.config.ts`. Nothing here needs a background-location declaration, and
adding one later would reopen both forms and, on Android, require a separate
Play review.

## Content that must ship with the release

See `docs/legal/promise-change.md`. In short: the homepage's "free forever"
claim, the token's retirement, the Terms, the privacy policy, and both store
listings all need updating, and the release notes must tell returning users to
sign up again to claim their username. Their old passwords could not be
migrated; without that line, the first thing a returning user meets is a login
that rejects them.

## Retiring the v1 API (`langx/api`) — after the rollout, not before

`langx/api` is v1's Express + Appwrite API that answered on `api.langx.io`.
Nothing has been committed to it since June 2024 and `REPO_MAP.md` files it
under archive, so it reads as dead. It was not: it served production traffic
for three callers. **On 3 September 2026 `api.langx.io` was repointed at v2
before this list was worked through.** Two of the callers have since been
moved to v2's `/public/newsletter` and `/public/leaderboard/token` (#1080),
but as of the same day `api.langx.io` sends no `Access-Control-Allow-Origin`
for `langx.io` or `token.langx.io` — only `app.langx.io` is in
`TRUSTED_ORIGINS` — so in a browser both still fail until that is fixed. The
v0.15 install base has no replacement for `/api/update`. The list still
stands — as repair work, not as a schedule for the repoint.

| Caller                                                                     | Endpoint                                      |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| v0.15 on the stores (`langx-angular/src/environments/environment.prod.ts`) | `https://api.langx.io/` — all of v1           |
| `website/src/lib/components/molecules/NewsletterForm.svelte`               | `/api/mail` — the newsletter form on langx.io |
| `token-website/js/leaderboard-token.js`                                    | `/api/leaderboard/token`                      |

It also answered `/api/update`, driven by `ANDROID_VERSION`,
`ANDROID_MAINTENANCE`, `IOS_*` and `WEB_*` in its `.env` (env only — a version
bump needed no commit). That endpoint was the **only channel that could tell a
v1 install to update or that the service is down**, and v1 installs are exactly
the users this release exists to migrate. Its fourth flag,
`COPILOT_MAINTENANCE`, had no caller left in `copilot/` and blocked nothing.

Archiving the GitHub repo does not stop the deploy — archiving is a read-only
flag — but it does declare dead a service the shipped app still depends on and
leaves nobody able to push a fix to it. Do these first, in order:

- [x] Move the newsletter form off `/api/mail`. Done 3 September 2026:
      `POST /public/newsletter` in `apps/api/src/routes/public.ts`
      (langx/langx#1080) puts the address on the Resend audience named by
      `RESEND_AUDIENCE_ID` — already a Fly secret — and answers v1's
      `{ status: 'ok' }` so the form did not have to change shape. The form
      posts there on `website`'s `main` (langx/website#132, deployed) and on
      `redesign/v3-mobile-language`, which had branched off before the fix.
      v1's SendGrid list is not migrated; the addresses on it stay there
- [x] Point `token-website`'s leaderboard at v2. Done the same day:
      `GET /public/leaderboard/token` (langx/langx#1080) serves the all-time
      top ten as `{ period, entries: [{ rank, handle, displayName, tokens }] }`
      — no `userId`, `streak` or viewer fields, so the open internet sees
      less than a guest in the app does — and `js/leaderboard-token.js`
      reads that shape (langx/token-website#21, deployed). The board is empty
      until the migration ETL loads all-time aggregates into production
- [x] Ship the CORS change (`fix/public-cors`, merged 3 September 2026).
      Until it deployed **both pages were broken in a browser**: the API
      answered `/public/*` without `Access-Control-Allow-Origin` for
      `langx.io` or `token.langx.io`, since `TRUSTED_ORIGINS` names only the
      web build. curl saw a 200; the page saw "No 'Access-Control-Allow-Origin'
      header is present" and an empty board (checked on token.langx.io the
      same day). After any deploy that touches CORS, verify with the command
      under this list — the header, not the status
- [ ] Confirm every migrated client takes its version and maintenance flags
      from v2's `appConfig` route and `middleware/maintenance.ts`
- [x] ~~Let the v0.15 install base drain far enough that losing `/api/update`
      strands nobody~~ — overtaken. The repoint on 3 September 2026 took
      `/api/update` down with it, so a v0.15 install can no longer be told to
      update or that the service is down; the store listings and a forced
      minimum version in the stores are the only levers left. The
      install-base numbers under **Release** still decide `minSdk`
- [ ] ~~Only then repoint `api.langx.io`~~ (done 3 September 2026), then stop
      the v1 deploy and archive the repo

The check that would have caught the CORS gap on deploy day — the status code
says nothing, only the header does:

```bash
curl -sI -H 'Origin: https://token.langx.io' https://api.langx.io/public/leaderboard/token | grep -i access-control-allow-origin   # must print *
```

`/api/update` stopped answering with the repoint. Nothing in v2 replaces it
for a v1 client — `/app-config` speaks to v2 installs only — which is why the
migration campaign, not this endpoint, is now what reaches the user who never
updates.

One unknown to resolve before pulling it down — where it actually runs.
`netlify.toml` says Netlify (with `npm run start` as the build command) while
`README.md` documents `pm2` on a VM. Find the live one before assuming a
disabled Netlify site is the whole shutdown.
