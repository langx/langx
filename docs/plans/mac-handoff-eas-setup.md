# Handoff: finish the EAS setup from the Mac

Paste everything below this line into a fresh `claude` session started in
`~/Developer/langx/langx` on the Mac. It is self-contained; the droplet
session (`langx-cd`) has done everything that can be done without a browser
or the Mac.

## Done — 3 September 2026, evening

All four tasks below were completed from the Mac and verified against the
Expo and Apple APIs rather than by eye. What actually happened:

1. **`.env` and Firebase files** — already in place; all four keys present,
   both files present and git-ignored, `eas whoami` prints `bhc`.
2. **GitHub link** — needed a step this document did not have. Expo refuses to
   link a GitHub _organisation_ repo to a personal Expo account, so an Expo
   organisation `langx` was created and the project transferred into it; it is
   now `@langx/langx`. Nothing in the repo changed: `app.config.ts` has no
   `owner` field and `updates.url` is built from the project id, which the
   transfer preserved. Credentials, the FCM key, the push key and the
   `GOOGLE_SERVICES_*` environment variables all survived the move. Repo
   `langx/langx` is connected; base directory reads `/apps/mobile` — the field
   adds the leading slash itself, so that is its normalised form.
3. **iOS credentials** — the ASC key route worked with no Apple login or 2FA.
   Bundle id registered, distribution certificate `5B7C13E37CFFA09640AAE5EBBE55522C`
   and provisioning profile created, both `active` until 3 September 2027, both
   on team `8F63M4JH8P — New Chapter Technology LLC (Company/Organization)`.
   The team type was confirmed from the App Store seller name before choosing
   it. The account had no distribution certificate before this, so nothing was
   revoked. The `.p8` lives at `~/.keys/AuthKey_769S36JR7Z.p8`, never in the
   repo.
4. **Play Console** — `<eas-submit service account>` invited
   and immediately `Active` (service accounts need no acceptance), with six app
   permissions on LangX: the two that were asked for (release to production,
   manage testing tracks), the two read-only defaults, and two Google adds
   automatically with production release (policy declarations, deep links).
   No admin, financial or store-presence access. `androidpublisher.googleapis.com`
   is now `Enabled` in project `langx-48eb0` (project number 545992842478).

Note that **"Release apps to testing tracks" was deliberately left unchecked**,
because this document named only the other two permissions. If a later
`eas submit` targets an internal or testing track rather than production, that
is the permission it will be missing.

All three follow-ups were then closed except the device test: the push trigger
was proved by merging #1087, the ASC key `769S36JR7Z` is registered for
submissions (which needs an Apple ID login and 2FA — the `EXPO_ASC_*` route does
not cover that endpoint), and the first local Android preview build produced an
APK once Metro's worker pool was capped (langx/langx#1088). What is left is
installing that APK on a phone and verifying a real push. See
`push-and-email-notifications.md`.

The instructions below are kept as a record of what was run.

---

You are working in `~/Developer/langx/langx` (Expo + Fastify monorepo, public
repo, read its `CLAUDE.md` first). Reply in Turkish; everything committed or
written to disk is English. Four one-time tasks remain to finish moving builds
and updates onto expo.dev. Do them in order, verify each, and **never start a
cloud build** (`eas build` without `--local`) — the free quota is reserved.
Nothing here needs a commit; if you do change a tracked file, branch from
`origin/main` and open a PR, never push to main.

Facts you need (no secrets here; secrets come from the droplet or the user):

- Expo account `bhc`, project `@bhc/langx`, id `c331c0a6-b2fc-4664-a9a3-c04d1fb2c115`.
- Android package / iOS bundle id: `tech.newchapter.languageXchange`.
- Firebase project `langx-48eb0`. Submit service account:
  `<eas-submit service account>` (already attached to EAS).
- Apple Team ID `8F63M4JH8P`. APNs push key `UXY2GT9ZR3` is already attached.
  Do not use `WM4V6DTZWA` (sandbox-only).
- Already done on EAS: Android keystore `key0`, FCM V1 key, submit service
  account, `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` file env vars in
  development/preview/production. Workflows live in
  `apps/mobile/.eas/workflows/` (`preview-update.yml` on push to main,
  `preview-build.yml` and `release.yml` manual). Runbook section:
  `docs/release-runbook.md` → "Shipping runs on expo.dev".
- The droplet is reachable as `ssh claude`; the workspace there is
  `/root/Developer/langx`.

## Task 1 — sync `.env` and the Firebase files from the droplet

```bash
cd ~/Developer/langx/langx
for k in EXPO_TOKEN EMAIL_UNSUBSCRIBE_SECRET RESEND_AUDIENCE_ID CLOUDFLARE_ZONE_ID; do
  grep -q "^$k=" .env || ssh claude "grep '^$k=' /root/Developer/langx/langx/.env" >> .env
done
scp claude:/root/Developer/langx/langx/google-services.json \
    claude:/root/Developer/langx/langx/GoogleService-Info.plist .
git status --short   # all four must stay untracked/ignored; if any shows, stop
```

Then update `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` in `.env` to the
Mac paths (`$PWD/google-services.json`, `$PWD/GoogleService-Info.plist`).
Verify: `cd apps/mobile && EXPO_TOKEN=$(grep -oP '^EXPO_TOKEN=\K.*' ../../.env) npx eas-cli whoami`
must print `bhc`. (macOS grep has no `-P`; use `sed -n 's/^EXPO_TOKEN=//p' ../../.env`.)

## Task 2 — link the GitHub repo to the Expo project

Cannot be done from the CLI. Walk the user through it in the browser:
expo.dev → account `bhc` → Settings → GitHub → _Install GitHub app_ on the
`langx` organisation, repository access limited to `langx/langx`. Then
project `langx` → Project settings → GitHub → repository `langx/langx`, base
directory `apps/mobile`. Verify with this query (expects a non-null
`githubRepository` and `baseDirectory: "apps/mobile"`):

```bash
EXPO_TOKEN=$(sed -n 's/^EXPO_TOKEN=//p' .env) node -e '
fetch("https://api.expo.dev/graphql",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.EXPO_TOKEN},
body:JSON.stringify({query:`{app{byId(appId:"c331c0a6-b2fc-4664-a9a3-c04d1fb2c115"){githubRepository{githubRepositoryUrl} githubRepositorySettings{baseDirectory}}}}`})})
.then(r=>r.json()).then(j=>console.log(JSON.stringify(j.data)))'
```

## Task 3 — iOS credentials

Two routes; prefer A because the same key later drives `eas submit`.

**A. App Store Connect API key.** The user creates it: appstoreconnect.apple.com
→ Users and Access → Integrations → Team Keys → `+`, name `eas`, role
**App Manager**; download the `.p8`, note Key ID and Issuer ID. Then, in
`apps/mobile`, run `eas credentials -p ios` and choose: production profile →
_App Store Connect: Manage your API Key_ → upload the `.p8`, Key ID, Issuer
ID → then _Build Credentials_ → _Set up new credentials_ → let EAS create the
distribution certificate and provisioning profile. When it asks for Apple
login, the key route can be selected via env instead:
`EXPO_ASC_API_KEY_PATH=<path>.p8 EXPO_ASC_KEY_ID=… EXPO_ASC_ISSUER_ID=… EXPO_APPLE_TEAM_ID=8F63M4JH8P EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`
(use `COMPANY_OR_ORGANIZATION` if the team is a company; check in the portal).

**B. Apple ID.** `eas credentials -p ios`, sign in with the Apple ID when
prompted, let EAS generate the certificate and profile. Then still add an ASC
key for submissions.

Verify (all three must be non-null / non-empty):

```bash
EXPO_TOKEN=$(sed -n 's/^EXPO_TOKEN=//p' .env) node -e '
fetch("https://api.expo.dev/graphql",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.EXPO_TOKEN},
body:JSON.stringify({query:`{app{byId(appId:"c331c0a6-b2fc-4664-a9a3-c04d1fb2c115"){iosAppCredentials{appleTeam{appleTeamIdentifier} appStoreConnectApiKeyForSubmissions{keyIdentifier} iosAppBuildCredentialsList{iosDistributionType distributionCertificate{validityNotAfter} provisioningProfile{status}}}}}}`})})
.then(r=>r.json()).then(j=>console.log(JSON.stringify(j.data,null,1)))'
```

Move the `.p8` out of the repo tree (e.g. `~/.keys/`) when done; never commit it.

## Task 4 — Play Console permission for the submit account

Browser only, guide the user: play.google.com/console → Users and permissions
→ Invite new users → `<eas-submit service account>` →
app permissions on LangX: _Release to production, exclude devices, and use
Play App Signing_ and _Manage testing tracks and edit tester lists_. Then
console.cloud.google.com → project `langx-48eb0` → APIs & Services → Library
→ _Google Play Android Developer API_ → Enable. There is no API check for
this; the first `eas submit` proves it, and that is not for today.

## After all four

Report to the user what is verified and what is not. The next step, only when
the user asks, is a **local** Android preview build on this Mac:

```bash
cd apps/mobile && eas build --local --platform android --profile preview
```

If Gradle fails inside `createBundleReleaseJsAndAssets` with
`transformFile` undefined, add `config.maxWorkers = 2` in `metro.config.js`
and retry. Install the APK on a phone, sign in against `api.langx.io`, and
tell the droplet session so it can send a real push and check the in-app
banner and tap routing.
