# Push, in-app and email notifications — plan and status

Copied from Claude's session plan store on 3 September 2026 so it survives
session compaction; moved into this repo on 5 September 2026.

## Status on 3 September 2026

Everything below the line is **built, merged and deployed** (PRs #1068–#1086,
`api.langx.io` and `app.langx.io`). Changes to the plan made while building:

- Badges became a fifth notification kind ("yeni badge kazaninca da bildirim
  atalim"): `badges` × push/email, `stats.notifiedBadgeIds` seeded so nobody
  is congratulated for old badges.
- Push transport: direct FCM was built (#1082) and reverted (#1085). Push
  stays on Expo's relay; do not re-propose direct FCM.
- Shipping lives on expo.dev: `apps/mobile/.eas/workflows/` holds
  `preview-update.yml` (OTA on every merge to main), `preview-build.yml` and
  `release.yml` (manual). Builds are started only when Behic asks.
- Hosts moved from api2/app2 to `api.langx.io` / `app.langx.io`.

Items 1-4 below were finished on the evening of 3 September 2026 and
verified against the Expo and Apple APIs. The Expo project now lives in a new Expo **organisation**
`langx` (`@langx/langx`) — a personal Expo account cannot be linked to a
GitHub organisation repo, which is the one thing the plan did not anticipate.
The project id did not change, so no code changed.

Closed later the same evening:

- **The push trigger fires.** Merging #1087 created a `Preview update` run four
  seconds later (`triggerType: GitHub`, `refs/heads/main@0eebbe9dac04`), so the
  GitHub link is wired correctly. That run then finished `SUCCESS`, so the
  update publishes and not just the trigger fires; it took about fifteen
  minutes, which is slow enough to look stuck without being stuck. Merging
  #1088 produced a second run the same way.
- **The ASC key is registered for submissions.** `appStoreConnectApiKeyForSubmissions`
  is now `769S36JR7Z`. Registering it needed a full Apple ID login with 2FA even
  though the key already existed: EAS only supports user authentication for that
  endpoint, so the `EXPO_ASC_*` route cannot avoid it. Answering **no** to
  "Generate a new App Store Connect API Key?" matters — it reuses the existing
  key instead of creating a second one.
- **First local Android preview build succeeded**, but only after capping Metro's
  worker pool. The predicted `transformFile` failure in
  `:app:createBundleReleaseJsAndAssets` is real on this machine; the fix is
  `config.maxWorkers = 2` in `apps/mobile/metro.config.js`, open as
  langx/langx#1088. The APK is on the Mac at `~/Downloads/langx-preview-2.0.0.apk`
  (116 MB). Note the cap applies to cloud builders and CI too, not only locally.

iOS went further than planned, and turned up a second defect. Behic asked for a
real-device test on iOS too and chose the TestFlight route over ad hoc, which
meant a production build — and `eas build --profile production` had never been
run. It failed instantly:

    autoIncrement option is not supported when using app.config.js

`autoIncrement` cannot write back into a dynamic `app.config.ts`, so
**`release.yml`, the whole store release path, could not have worked for either
platform.** Fixed in langx/langx#1089: `appVersionSource` is now `remote`, EAS
owns the build number and versionCode, and `ITSAppUsesNonExemptEncryption:
false` is declared so uploads do not park in "Missing Compliance".

The trap that fix opens, worth remembering: switching to `remote` starts the EAS
counter at 1, not at the value that used to sit in the config. The first `.ipa`
came out as build 6, which App Store Connect would have rejected — the published
build is 119. The counter was seeded to 120 for both platforms through the Expo
GraphQL API (`appVersion.createAppVersion`), because `eas build:version:set` is
interactive and cannot be scripted.

Also undocumented until now: a local iOS build needs **fastlane** and a working
**CocoaPods** on the Mac. Installing fastlane with Homebrew upgraded Ruby from
3.4.4 to 4.0.6, which broke the existing CocoaPods; `brew reinstall cocoapods`
repaired it. Anyone setting this up on a fresh machine will hit the same
sequence.

**2.0.0 build 120 is on App Store Connect**, `VALID` and
`READY_FOR_BETA_TESTING` — the first v2 binary Apple has ever seen. It does not
touch the live 0.15.0.

Device test on iOS, 3 September 2026 evening (TestFlight build 120 on Behic's
phone, handle `xue2`, production DB). Sender: throwaway account
`<tester address>`, handle `pushtest`, user id
`6a99c71c083e5d208f05b4b2`, conversation `6a99c832083e5d208f05b4bc` —
**delete both from production when the tests are over**.

- OK: `profileVisits` push from the runbook curl arrived (Expo ticket and
  receipt both `ok`).
- OK: a message sent while the app was in the background arrived as an OS
  notification, and tapping it opened the right chat.
- **Bug 1 — no in-app banner on iOS.** Message sent while the app was open on
  another tab: the socket event reached the phone (300 ms later it refetched
  the conversation list, `/me/tokens` and the sender's profile, so the
  `message:new` handler ran and the banner host asked for the sender), the
  `messages/push` switch is on and `me` is cached — but nothing was drawn. A banner did appear later, after message 2 and some
  navigation, so the layer can paint on iOS; the miss is timing or state.
  Suspect the absolute layer in `MessageBannerHost` (and probably `ToastHost`)
  is not painted above the native stack on iOS; nothing in the app had run on
  an iOS device before today.
- **Bug 2 — a chat opened from a push shows stale messages.** The tapped
  notification routed to the thread, but the new message was not in the list:
  the socket was down while backgrounded, so the cache patch never happened,
  and `useNotificationRouting` does not invalidate the thread it opens.

What is still open (bugs 1 and 2 were handed to another session and fixed
in #1106 and #1108):

1. Repeat the two device tests on iOS.
2. Install the preview APK on an Android phone and run the same three checks.
3. Web banner check (verification item 8) — never run in a browser.
4. Delete the `pushtest` account and its conversation from production.

---

# Push, in-app and email notifications

## Context

Settings offers four notification kinds (messages, streak, profileVisits, promotions), one switch each. Only two have a sender: message push (`ws/fanOut.ts`) and the 20:00 streak push (`modules/push/reminderScheduler.ts`). The email channel was removed from the prefs on 2026-08-30 precisely because nothing sent email; profile visits and promotions send nothing at all. Push itself is complete in code (Expo Push Service, `devices` collection, token pruning) and only lacks credentials.

Behic decided on 2026-09-02:

1. **Push stays on Expo Push.** No provider change; complete the credential checklist in `docs/release-runbook.md` → "Push needs credentials in three places".
2. **Email for all four kinds**: unread-message digest, streak reminder for people with no phone signed in, weekly profile-visit summary, promotions (default off, unsubscribe link + RFC 8058 headers mandatory).
3. **Profile-visit push**: batched, at most once per local day, count only (names are Pro).
4. **In-app banner** for new messages while the app is open and that thread is not on screen; tap opens the chat; no OS banner in the foreground; a message arriving in the open thread is marked read.

Repo rules that shape everything below: repository functions only, indexes in `apps/api/src/db/indexes.ts`, thresholds in `packages/shared`, every string through `en.ts` (seven other locales typed against it), optional services degrade, comments explain why. v2 is not in the stores, so request schemas may change; only _stored_ shapes need backward reading. No queue; schedulers are `setInterval` in one Fly process. Tests: API uses `mongodb-memory-server` (`MongoMemoryServer` for repositories, `MongoMemoryReplSet` + `CapturingEmailSender` from `testSupport/authFlow.ts` for app tests); mobile vitest reaches only `src/lib/**` and `src/i18n/**`, so state lives in `src/lib` and renderers in `*Host.tsx`.

Verified while planning: `resend@6.24.0` supports `headers` and `batch.send`; `expo-router@57` exports `useFocusEffect`; conversations carry `lastMessage.createdAt` and `unread: Record<userId, number>`; `buildApp` decorates `app.push` but not `app.email`; `@fastify/formbody` is not installed; `WEB_HOST`/`profileUrl` live in `packages/shared/src/appIdentity.ts`.

## PR 1 — Preferences get the channel axis back

`packages/shared/src/notifications.ts`

- Add `NOTIFICATION_CHANNELS = ['push','email']`, `ChannelPrefs`, `NotificationPrefs = Record<type, ChannelPrefs>`, defaults `{push:true,email:true}` for the three service kinds and `{push:false,email:false}` for promotions.
- `notificationsAllowed(prefs, type, channel)` with `channel` **required** (three call sites: `ws/fanOut.ts:88`, `push/devices.ts:224`, `settings.tsx:413`). Reading rules for the three stored shapes:
  - v1 bare boolean: `false` silences both; `true` gives the default for each channel (promotions default is off, so never inferred).
  - boolean per kind (2026-08-30 shape): push = the value; email = `false` if false, else the default, except promotions email is never inferred on.
  - `{push?, email?}` object (retired matrix and new writes, byte-identical): each channel read literally, defaults fill gaps.
- `resolveNotificationPrefs(prefs): NotificationPrefs` for the settings screen and `updateProfile`.
- Zod: partial object of partial `{push, email}` per kind. Rewrite the module doc comment (its rationale is reversed) and the stale comment at `packages/shared/src/profile.ts:254`.

`apps/api/src/modules/profiles/profiles.ts` `updateProfile` (~618-645): write each touched kind **whole** as `{...resolved[type], ...input[type]}` at `settings.notifications.<type>` (a dotted write onto a boolean is a Mongo type error; `$set` of the whole map would wipe untouched kinds). Add `setEmailNotification(db, userId, type | 'all', enabled)` for PR 2. `streakReminderCandidates` in `push/devices.ts` returns `{userId, streak, push, email}` and keeps users where either channel is allowed (PR 3 decides in the tick). `fanOut.ts` adds `senderId` to push `data` (PR 6 needs it); widen `PushMessage.data`.

Mobile `app/(app)/settings.tsx:391-421`: per kind a title + body, then two `ListRow`s ("Push", "Email") each with one `Toggle` (one accessory slot, one accessibility label per switch). Email toggle disabled with subtitle `notifications.emailUnverified` when `authClient.useSession().data?.user.emailVerified` is false. Mutation sends `{ settings: { notifications: { [type]: { [channel]: next } } } }`. `MeProfile.settings.notifications` type in `src/api/queries.ts:151` becomes the stored union. Rewrite the JSX comment. New keys `notifications.channelPush/channelEmail/emailUnverified`, updated `*Body` copy, and `notifications.primingBody` ("Two things only" becomes false with a third push kind).

One-off check before deploy (read on prod, then an `$unset` if non-zero): `countDocuments({'settings.notifications.promotions.email': true})` — the retired matrix cannot be told from a new write; record the result in the PR.

Tests: rewrite `notifications.test.ts` per the table above plus schema cases; `routes/profiles.test.ts:380-436` (toggle one cell, siblings untouched; boolean converts to object on first touch; promotions email round-trips); any fixture in `ws/chat.test.ts` / `routes/messages.test.ts` writing prefs.

## PR 2 — Email infrastructure

- `email/sender.ts`: `EmailMessage.headers?`, optional `sendBatch` (100 per `client.batch.send`), export `ConsoleEmailSender` (logs headers).
- New leaf `modules/profiles/emailFor.ts` next to `emailVerified.ts`: `{email, verified} | null` via `authId(userId)` on `COLLECTIONS.user`. Guests are unverified, so `verified` alone excludes them.
- `push/devices.ts` `localeFor(db, userId)`: newest device's locale, else `DEFAULT_LOCALE`.
- `email/unsubscribeToken.ts`: `v1.<userId>.<type|all>.<base64url HMAC-SHA256>`, `timingSafeEqual`, **no expiry**. Secret `EMAIL_UNSUBSCRIBE_SECRET` (new env, min 32, optional, falls back to `BETTER_AUTH_SECRET` with a boot warning) — dedicated so rotating the auth secret does not kill every footer link ever mailed. `publicApiUrl(env)` extracted from `auth.ts` into `env.ts`.
- `routes/email.ts`: `GET /email/unsubscribe?token=` renders a confirmation form and changes nothing (link scanners follow GETs); `POST /email/unsubscribe` accepts token from query, form body (scoped `addContentTypeParser` for `application/x-www-form-urlencoded` using `URLSearchParams`) or JSON, calls `setEmailNotification(..., false)`, idempotent 200, rate-limited. Register in `app.ts`.
- `email/templates.ts`: `notificationEmail(locale, {preheader, bodyHtml, cta?, unsubscribeUrl})` with the footer (why you got this, "Turn off these emails", manage in Settings) and `notificationText(lines, unsubscribeUrl)`; the plain-text part carries the URL too. `webUrl(path)` added to `packages/shared/src/appIdentity.ts`.
- `app.ts`: `BuildAppOptions.email?` (default Console), `app.decorate('email')`; `index.ts` passes the sender it already builds; tests pass `CapturingEmailSender`.
- `email/notify.ts`: `sendNotificationEmail(db, ctx, {userId, type, build(locale, unsubscribeUrl)})` → outcome `'sent' | 'no-email' | 'unverified' | 'opted-out' | 'deleted'`. Order: profile deleted → `notificationsAllowed(..., type, 'email')` → `emailFor` verified → `localeFor` → send with `List-Unsubscribe: <url>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. **Every later sender goes through this and nothing else.** `index.ts` builds `NotificationEmailContext {sender, unsubscribeSecret, apiBaseUrl}`.
- API i18n keys under `email.*` (footer, unsubscribe page, kind names); update the header comment in `en.ts`.

Tests: `unsubscribeToken.test.ts`, `routes/email.test.ts` (GET changes nothing, POST flips one cell, bad token 400, headers asserted), `email/notify.test.ts` (every outcome, locale from newest device).

## PR 3 — Streak email fallback

`reminderScheduler.ts`: split into `runStreakReminderTick(db, push, email, now)` + timer (the `poolScheduler`/`runDailyPool` split). In the **same iteration**, after the `streakReminders` `_id` insert succeeds: push if `candidate.push` and tokens exist; otherwise, if `candidate.email`, `sendNotificationEmail(type:'streak')` with `streakReminderEmail(locale, {count, unsubscribeUrl})` (subject reuses `push.streakTitle`, CTA → `webUrl('/chats')`). Same iteration because the ledger insert already claimed the day. `index.ts` passes the email context. New `reminderScheduler.test.ts` (timezone fixture so local hour is 20; no device → one email with headers; device → push only; both channels off → nothing; unverified → ledger row, no mail).

## PR 4 — Unread-message digest

- Shared constants in `notifications.ts`: `UNREAD_DIGEST_AWAY_HOURS = 8`, `UNREAD_DIGEST_MAX_AWAY_DAYS = 14`, `NOTIFICATION_EMAIL_LOCAL_HOURS = {earliest: 9, latest: 21}`, `UNREAD_DIGEST_MAX_SENDERS = 3`. `localHour(date, tz)` moves into `packages/shared/src/periods.ts` next to `localDayKey` (from `streakReminderCandidates`).
- One generic ledger `COLLECTIONS.notificationLedger` `{_id: '<job>:<userId>:<periodKey>', sentOn}`, TTL 30d; `modules/notifications/ledger.ts` `claimOnce` / `alreadyClaimed` (insert, `false` on 11000). `streakReminders` stays as is.
- `modules/notifications/unreadDigest.ts` `runUnreadDigestPass(db, ctx, now)`: profiles with `stats.lastActiveAt` in `[now−14d, now−8h]`, not deleted, `settings.notifications ≠ false` (new index `profiles.last_active`); `notificationsAllowed(...,'messages','email')`; local hour inside the window; **period key = `lastActiveAt.toISOString()`** so one absence yields one digest, not one per day; conversations `{participants: userId, 'lastMessage.createdAt' > lastActiveAt, 'lastMessage.senderId' ≠ userId, unread.<userId> > 0}` limited to `MAX_SENDERS + 1`, excluding archived and `blockedUserIds`; `claimOnce` then send `unreadDigestEmail(locale, {count, names, moreThreads, url, unsubscribeUrl})` — counts and display names only, **never message bodies** (privacy sheet); URL is the thread for one conversation, `/chats` for several.
- `modules/notifications/scheduler.ts` `startNotificationScheduler(db, {push, email}, logger, {intervalMs = 30 min})` running each pass in its own try/catch; added to `index.ts` and `docs/self-host.md`.
- Tests: `unreadDigest.test.ts` (one mail with names and count, ledger, second run silent, 1 h away → nothing, email off → nothing, blocked sender excluded, 03:00 local → nothing and no ledger row).

## PR 5 — Profile visits: daily push, weekly email, new push kind

- `packages/shared/src/push.ts`: `PUSH_KINDS` gains `'profileVisits'`; `PROFILE_VISITS_LOCAL_HOUR = 12` (eight hours from the streak nudge), `PROFILE_VISITS_WEEKLY_LOCAL_WEEKDAY = 1`; `PROFILE_VISITS_EMAIL_MAX_NAMES = 5`.
- `moderation/profileViews.ts` `viewSummarySince(db, userId, since)` → `{count, viewers | null}`; count excludes `blockedUserIds`, `viewers` is `null` unless `hasFeature(effectiveTier(me), 'profileViewerIdentities')` — the free/Pro line is drawn in one module.
- `modules/notifications/profileVisits.ts`: `profilesAtLocalHour(db, hour, now)` (the scan `streakReminderCandidates` does); `runProfileVisitsPushPass` (trailing 24 h, skip 0, skip no tokens, `claimOnce('profileVisitsPush', id, localDay)`, per-locale push `push.profileVisitsTitle` plural / `push.profileVisitsBody`, data `{kind:'profileVisits'}`; copy names nobody); `runProfileVisitsEmailPass` (Mondays, `weekKey`, trailing 7 d, `claimOnce('profileVisitsEmail', id, week)`, `profileVisitsEmail` with names for Pro and `email.visitsLocked` for free, CTA → `webUrl('/viewers')`). Both wired into the PR 4 scheduler.
- Mobile `src/lib/notificationRoute.ts`: `profileVisits → '/viewers'` (switch is exhaustive, build breaks until added) + test.
- Tests: `profileVisits.test.ts` (blocked viewer excluded, count 2, ledger, zero views silent, Monday fixture free vs Pro names, non-Monday silent).

## PR 6 — In-app banner and foreground push (mobile; parallel with 2-5 after PR 1)

- `src/lib/activeConversation.ts`: `set/get/resetForTest`. Chat screen `app/(app)/chat/[id].tsx` replaces the mount-effect read receipt (lines 166-173) with `useFocusEffect` from expo-router: set active + `markConversationRead`, clear on blur. Focus, not mount: `chat/[id]` is a hidden tab screen and stays mounted after navigating away. `markConversationRead(conversationId, queryClient)` moves into `src/api/queries.ts` so the screen and the socket hook share it.
- `src/lib/inAppNotifications.ts` (pure): `MessageBanner {id, conversationId, senderId, previewKind, body}`, `MESSAGE_BANNER_DURATION_MS = 5000`, `subscribe/show/dismiss/resetForTest`, **replace-not-queue** (a banner points at the chat list, which already shows everything; three quick messages must not hold the top of the screen for fifteen seconds). `shouldShowIncomingBanner({message, meId, activeConversationId, appActive, messagesPushAllowed}) → 'banner' | 'markRead' | 'ignore'`: no meId → ignore; own → ignore; deleted/hidden → ignore; active thread and app active → markRead; push switch off → ignore; else banner. The banner honours the **messages/push** switch: it is the push channel's foreground face, and it gives that toggle a visible effect on web.
- `src/components/MessageBannerHost.tsx` mounted in `app/_layout.tsx` right after `<ToastHost />`: same absolute top layer / `box-none` / insets pattern, `colors.surface` card with `Avatar` (via `useProfileCache([senderId])`), name, one-line preview (`chats.previewPhoto/previewVoice/previewCorrection` for non-text; the server's `previewFor` is English-only), tap → dismiss + `router.push('/(app)/chat/:id')`, timer keyed on `banner.id`. Works on web unchanged.
- `src/hooks/useSocket.ts` `message:new`, after the cache patches: run the decision with `AppState.currentState === 'active'` and `notificationsAllowed(keys.me cache prefs, 'messages', 'push')`; `markRead` → `markConversationRead`; `banner` → `showMessageBanner`.
- Foreground push: `src/lib/foregroundPush.ts` `presentationFor(data, appActive) → 'suppress' | 'os'` (suppress only `kind === 'message'` while active; streak/profileVisits keep the OS banner — once a day, no in-app equivalent). `src/lib/notifications.ts` `setNotificationHandler` returns banner/list/sound false (badge true) on `suppress`; lazy import stays. `src/hooks/useNotificationRouting.ts` adds `addNotificationReceivedListener`: on `suppress`, if the thread is active mark read, else `showMessageBanner` from `data.conversationId/senderId` and the notification body. This path only fires when the socket is down while foregrounded (the server sends no push while a socket is in the room), so socket and push cannot double-banner.
- Tests: `inAppNotifications.test.ts`, `activeConversation.test.ts`, `foregroundPush.test.ts`. Mobile keys: `chats.preview*`, `chats.bannerA11y`.

## PR 7 — Promotions campaign script

- `modules/notifications/campaign.ts`: `campaignRecipients(db, campaignId)` (not deleted, `notificationsAllowed(...,'promotions','email') === true`, verified email, not already in ledger) and `claimCampaignRecipients`. `COLLECTIONS.emailCampaigns`, unique `{campaignId, userId}` in `indexes.ts` — a re-run cannot double-send. Tests in `campaign.test.ts`.
- `apps/api/scripts/send-campaign.ts` (style of `maintenance.ts`): `--campaign --subject --html-file [--text-file] [--db] [--limit] [--locale] [--confirm]`; refuses files without `{{unsubscribeUrl}}`; dry run prints count + masked addresses; with `--confirm` claims in batches of 100, substitutes the per-user token URL, sends via `sendBatch` with both List-Unsubscribe headers, releases the claim on a failed batch, sleeps ~700 ms between batches.
- Why not Resend Audiences/Broadcasts: a second copy of addresses and consent outside our DB that account deletion and every toggle would have to sync.

## PR 8 — Ops, docs, memory

- Credentials: run the runbook checklist (APNs key, FCM v1 service account, `google-services.json` via `GOOGLE_SERVICES_JSON`); verify with the curl smoke test before the streak reminder runs against real users.
- Resend: verify `langx.io` (SPF/DKIM/DMARC), set `EMAIL_FROM`, drop the TODO in `env.ts`/`.env.example`; add `EMAIL_UNSUBSCRIBE_SECRET=` (never rotate) to `.env.example`; new runbook section "Email needs a verified sender and an unsubscribe secret" with a campaign runbook (dry run, `--confirm`, watch complaints).
- `docs/architecture.md` (P0 item 9, settings shape at ~584, scheduled work at ~190), `docs/decisions.md` (four entries: matrix returns because every cell has a sender; foreground message is an in-app banner; profile visits batched with count free and names Pro; unsubscribe is a signed non-expiring token on a POST), `docs/self-host.md` schedulers table, `docs/store/privacy-data-safety.md` (Resend row: counts and display names, never message text; ledger rows), `CONTRIBUTING.md` unchanged.
- `website/src/lib/components/organisms/PrivacyPolicy.svelte` ~134-136: per-kind, per-channel switches and the unsubscribe link.
- GitBook `docs/`: new `library/notifications.md` + `SUMMARY.md` entry.
- Memory: rewrite `langx-notification-switches-without-senders.md` and its `MEMORY.md` line; note the never-rotate secret.

## Sequencing

| #   | PR                                    | Depends on | Size |
| --- | ------------------------------------- | ---------- | ---- |
| 1   | Prefs matrix                          | —          | M    |
| 2   | Email infra                           | 1          | M    |
| 3   | Streak email fallback                 | 2          | S    |
| 4   | Unread digest + ledger + scheduler    | 2          | M    |
| 5   | Profile visits push/email + push kind | 2, 4       | M    |
| 6   | In-app banner + foreground push       | 1          | M    |
| 7   | Campaign script                       | 2          | S    |
| 8   | Ops, docs, memory                     | all        | S    |

Each PR: branch from `origin/main`, `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, push and let CI run.

## Verification

1. Local stack per `docs/self-host.md` without `RESEND_API_KEY` (mail lands in the log), seeded users and chat.
2. Prefs: flip `Messages → Email` off on :8081; `mongosh` shows `{push:true,email:false}` and other kinds untouched; a hand-written `messages: false` profile shows both switches off and converts to an object on first toggle.
3. Unsubscribe: copy a `List-Unsubscribe` URL from the log; GET shows the page and changes nothing; POST (button and `curl -d 'List-Unsubscribe=One-Click'`) flips the cell, 200 twice.
4. Streak: user with a streak, local hour 20, no device, verified email → console email with plural title and headers; ledger `_id` present.
5. Digest: `lastActiveAt` 9 h ago, two messages from another account → one digest naming the sender; a third message adds nothing; returning and leaving again produces a new one.
6. Profile visits: two viewers, local noon → one push (`LoggingPushSender` in tests, log in dev); Monday fixture in tests for free vs Pro mail.
7. Real device (after credentials): runbook curl with `kind: profileVisits` opens `/viewers`; `kind: message` in the foreground shows the in-app banner and no OS banner, in the background the OS banner.
8. Web banner: two browser sessions on :8081; A writes while B is on Discover → banner with avatar, tap opens the thread; B keeps the thread open → no banner, marked read; B turns `Messages → Push` off → no banner, Chats badge still increments.
9. Campaign: dry run prints the count; `--confirm` without a key prints each mail; second `--confirm` sends zero; an unsubscribed user is absent.
10. `indexes.test.ts` proves `profiles.last_active`, `notificationLedger.ttl_30d`, `emailCampaigns.campaign_user_unique` apply.
