# Analytics — PostHog

What the app sends, where it goes, and what has to be true outside the repo for
it to work. The _why_ — a private dashboard, PostHog over a self-hosted
Plausible, EU Cloud — is in [`decisions.md`](decisions.md) → _The analytics
dashboard is private_. The store-form consequences are in
[`store/privacy-data-safety.md`](store/privacy-data-safety.md). Nothing here is
public: the page anyone can read is `insight.langx.io`, which is counted from
our own database and shares no field with this — see
[`insight.md`](insight.md).

## Where it lives

| File                                              | What                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/mobile/src/lib/analyticsEvents.ts`          | The closed list of events and their properties. **The only place a new event can be added.** |
| `apps/mobile/src/lib/analyticsCore.ts`            | Consent, the queue that holds calls until the flag is read, identity. Pure, and tested       |
| `apps/mobile/src/lib/analytics.ts`                | The SDK, its configuration, and the exports screens use                                      |
| `apps/mobile/src/hooks/useScreenTracking.ts`      | One `$screen` per route change, named after the route file                                   |
| `apps/mobile/src/hooks/useAnalyticsPreference.ts` | The Settings switch                                                                          |
| `apps/mobile/src/hooks/usePaywallTracking.ts`     | The paywall's one `paywall_viewed`, and its one `paywall_dismissed` from `beforeRemove`      |
| `apps/mobile/app/_layout.tsx`                     | Starts the SDK; binds and unbinds the user id in the same effect that does it for RevenueCat |
| `apps/mobile/src/lib/installedAt.ts`              | The device's own record of its first launch, for `seconds_since_install`                     |
| `apps/mobile/src/lib/signupOrigin.ts`             | Counts a sign-up and remembers how it was made, so the end of the wizard can say             |

## Configuration

Two public variables, both compiled into the bundle (`EXPO_PUBLIC_*`):

| Variable                   | Value                                               |
| -------------------------- | --------------------------------------------------- |
| `EXPO_PUBLIC_POSTHOG_KEY`  | PostHog → Project settings → Project API key        |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` — the default when unset |

**Unset, nothing happens.** The SDK is never imported, every `track()` is a
no-op, and Settings shows no analytics row — a switch that changes nothing is
worse than none. That is the state of every development build and of any
self-hosted instance without a project.

Set it in `apps/mobile/.env` locally (Expo does not read the root `.env` — see
`.env.example`) and as an EAS environment variable on the `preview` and
`production` profiles. It is not committed even though it can only write: the
repo is public, and a public write key is an invitation to fill the project
with junk.

## What is sent

**Screens.** A `$screen` event on every route change, with the route _file_ as
the name — `(app)/chat/[id]`, never `/chat/64f…`. Identifiers stay on the
device; the funnel asks whether people reach the chat screen, not which chat.

**Lifecycle.** `Application Installed`, `Application Opened`, `Application
Backgrounded` — the SDK's own, and the only way to count an install that never
reached a screen of ours.

**Events.** The closed union in `analyticsEvents.ts`:

| Event                       | Properties                                                                                                                                                                                 | Fired                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `welcome_chosen`            | `choice` (browse, create, sign_in)                                                                                                                                                         | One of the welcome screen's three actions                                                        |
| `signup_submitted`          | `method` (email, google, apple, facebook, discord), `from_guest`                                                                                                                           | The sign-up request leaves the device. Not that it succeeded                                     |
| `signup_verified`           | `method`                                                                                                                                                                                   | The mailed link was opened and spent by the app. Email only                                      |
| `guest_gate_hit`            | `action` (message, like, follow, post, echo, other)                                                                                                                                        | A guest was refused a write and sent to sign-up                                                  |
| `onboarding_step_completed` | `step`, `guest`, `resumed`                                                                                                                                                                 | One wizard step was finished — what `$screen` cannot say                                         |
| `onboarding_completed`      | `referred`, `native_languages`, `learning_languages`, `method`, `from_guest`, `seconds_since_install`                                                                                      | The profile is created                                                                           |
| `message_sent`              | `kind` (text, correction, image, audio, video), `reply`                                                                                                                                    | The server acknowledged a send. Never the body                                                   |
| `paywall_viewed`            | `feature` (what sent them), `tier` (the viewer's own plan), `source` (onboarding, gate, me, deeplink, first_reply, langx, gift_code), `gift` (over a gift of months), `offers` (see below) | The paywall is first shown — up to a second after it opens — or left before then                 |
| `paywall_dismissed`         | `source`, `seconds_open`, `exit` (close, back, gesture, other)                                                                                                                             | It was left without a plan gained: the X, "Continue free", back or a swipe. Once                 |
| `plan_selected`             | `source`, `period` (monthly, yearly, lifetime)                                                                                                                                             | A plan card was picked that was not already the picked one                                       |
| `benefits_expanded`         | `source`                                                                                                                                                                                   | "And N more" was opened. Opening only                                                            |
| `restore_tapped`            | `source`                                                                                                                                                                                   | "Restore purchases" was tapped                                                                   |
| `restore_finished`          | `source`, `result` (completed, failed)                                                                                                                                                     | The store call came back. `completed` is not "restored" — see below                              |
| `purchase_started`          | `offer`, `tier`, `period`, `change` (`buy` only now — `upgrade`/`portal` are history), `trial_days` (null: no trial, or not eligible)                                                      | A buy button is tapped                                                                           |
| `purchase_finished`         | the same, plus `outcome`                                                                                                                                                                   | The store sheet closes: purchased, cancelled, failed or unavailable                              |
| `gift_code_redeemed`        | `outcome` (granted, invalid, used, expired, exhausted, rate_limited), `months` (granted only, else null)                                                                                   | The server answered a gift code from the paywall's "Have a gift code?" sheet. Never the code     |
| `review_prompted`           | `trigger` (streakMilestone or correction)                                                                                                                                                  | The OS review sheet was requested; whether it showed is unknowable                               |
| `boosted_strip_shown`       | `count` (1–12)                                                                                                                                                                             | Discover is focused with a non-empty Boosted strip                                               |
| `boosted_strip_tapped`      | `slot` (0-based); `tier` only from builds without the single-plan JS                                                                                                                       | A Boosted card is tapped                                                                         |
| `discovery_card_tapped`     | `slot` (0-based)                                                                                                                                                                           | A row in the discovery list below the strip is tapped                                            |
| `message_received`          | `kind` (any `MessageType`)                                                                                                                                                                 | A message from somebody else arrives over the socket                                             |
| `message_send_failed`       | `kind` (text, media), `reason` (error code or null)                                                                                                                                        | A send did not land. A media quota refusal is a fair-use alert, not a failure                    |
| `notification_opened`       | `kind` (any `PushKind`, or unknown), `cold_start`                                                                                                                                          | A push was tapped. Counts taps, never sends                                                      |
| `push_registration_failed`  | `step` (token, register), `reason`                                                                                                                                                         | This phone has permission and could not register a push token                                    |
| `push_permission_prompted`  | `source` (priming, chats, settings)                                                                                                                                                        | The system notification dialog was requested. Asks, not dialogs shown                            |
| `push_permission_answered`  | `source`, `answer` (granted, denied, undetermined)                                                                                                                                         | The dialog came back. `undetermined` is Android's dismissed-unanswered, not a no                 |
| `filters_applied`           | `count`, `pro`                                                                                                                                                                             | The discovery filter sheet is applied. How many, never which                                     |
| `tokens_spent`              | `sku`, `kind` (cosmetic kind or consumable), `amount`                                                                                                                                      | A wallet purchase the server accepted. Spending only, never earning                              |
| `streak_checked_in`         | `days` (the streak reached)                                                                                                                                                                | The check-in was the first to credit today. Once per active day                                  |
| `streak_milestone_reached`  | `days` (a day in the shared milestone table)                                                                                                                                               | That check-in carried the streak to a milestone length. The payout is a separate claim           |
| `freeze_used`               | `days` (the streak kept)                                                                                                                                                                   | That check-in spent a banked freeze to bridge yesterday                                          |
| `streak_repaired`           | `days` (the streak after)                                                                                                                                                                  | A missed day was bought back and the server accepted it                                          |
| `streak_broken`             | `longest` (the best on record, not the length that ended)                                                                                                                                  | A check-in began a new run at one under a longer best. Sent on return from the lapse             |
| `recap_story_viewed`        | `slides_seen`, `completed`, `period`                                                                                                                                                       | The monthly or yearly recap story was left; how far it got, and whether that was the share slide |
| `tour_started`              | `is_guest`                                                                                                                                                                                 | The first-run tour opened. Once per install                                                      |
| `tour_step_viewed`          | `step`, `index`                                                                                                                                                                            | One tour step was drawn against a measured element                                               |
| `tour_skipped`              | `step`, `index`                                                                                                                                                                            | The tour was left part-way, by Skip or the back button                                           |
| `tour_completed`            | `is_guest`                                                                                                                                                                                 | The tour's last step was passed                                                                  |
| `tip_shown`                 | `tip` (its id), `slot` (chat, chats, discover, feed, echo, me, composer). Never the sentence                                                                                               | A tip was put on screen: its slot's cursor advanced. Once per mount of the screen                |
| `tip_dismissed`             | `tip`, `slot`                                                                                                                                                                              | The tip's own close button was tapped. Switching tips off in Settings is not this                |
| `tip_action`                | `tip`, `slot`                                                                                                                                                                              | The button on a tip was tapped. Nothing sends this yet: no tip has a button                      |
| `echo_card_captured`        | `source` (chat, post, phrase, manual)                                                                                                                                                      | A sentence was kept as a card. Only one that was created                                         |
| `echo_session_started`      | `cards`, `offline`                                                                                                                                                                         | A review deck was opened and had cards in it                                                     |
| `echo_card_graded`          | `grade` (again, hard, good, easy), `producing`, `seconds`                                                                                                                                  | One card was answered. Never the card's text                                                     |
| `echo_session_finished`     | `reviewed`, `remembered`, `offline`                                                                                                                                                        | The last card of the deck was graded. Leaving early sends nothing                                |
| `echo_pack_started`         | `lang`, `level`, `count`                                                                                                                                                                   | A pack handed over its next batch of cards                                                       |
| `echo_ask_opened`           | `kind` (the preselected ask — always pronunciation since "Post to the feed"), `entry` (session, card, cards)                                                                               | "Post to the feed" opened the composer from a card. Counts opens, not posts                      |
| `post_created`              | `asks` (none, correction, pronunciation, both), `media` (file count), `hasText`, `from` (feed, echo)                                                                                       | A post was written. `asks: none` is a moment                                                     |
| `feed_card_opened`          | `position` (0-based among loaded cards), `asks`                                                                                                                                            | A timeline card was opened — the input for tuning the ranking weights                            |
| `live_activity_started`     | `minutes_ahead`                                                                                                                                                                            | A Live Activity was put on the Lock Screen for an agreed call — once per call per launch         |
| `companion_opened`          | `source` (live_activity, widget), `target` (chat, me, chats, echo)                                                                                                                         | The app was opened from the Live Activity or a Home Screen widget — phase 7's measure            |
| `pro_welcome_shown`         | `source` (the `ProWelcomeSource`), `months` (or null)                                                                                                                                      | "You're Pro now" was put on screen                                                               |
| `pro_welcome_closed`        | `source`, `action` (start, close)                                                                                                                                                          | The welcome was dismissed — `start` goes on to Discover, `close` does not                        |
| `langx_poll_answered`       | `poll_id`, `option_id` — both operator slugs, never a person's own words                                                                                                                   | A poll under an `@langx` broadcast was answered and the server acknowledged it                   |
| `langx_card_tapped`         | `action` (storeReview, openUrl, openRoute)                                                                                                                                                 | The button on a card under an `@langx` broadcast was tapped. Never the URL or route              |
| `share_card_created`        | `kind` (streak, badge, rank, recap), `shape` (or null for the link row), `link_only`, `failed`                                                                                             | A share sheet for a card was acted on                                                            |
| `invite_shared`             | `via` (sheet, copy)                                                                                                                                                                        | The invite link was copied, or its share sheet opened. Opens, not sends                          |
| `profile_shared`            | `own` (the Me share screen, else somebody's profile menu), `via` (sheet, copy)                                                                                                             | A profile link was copied, or its share sheet opened. Never whose                                |
| `fair_use_limit_hit`        | `kind` (media)                                                                                                                                                                             | A fair-use ceiling was hit — a plain alert, not a paywall                                        |
| `call_started`              | `media` (audio, video), `source` (header, row, meeting, siri)                                                                                                                              | A call button was pressed and the call is on its way to the server                               |
| `call_refused`              | `code` (the server's error code, or MIC_DENIED / CAMERA_DENIED)                                                                                                                            | A call did not get as far as ringing — the gate, the cooldown, a busy line, a denied microphone  |
| `call_answered`             | `media`, `with_camera`                                                                                                                                                                     | A ringing call was answered. `with_camera` is false for "answer without camera"                  |
| `call_connected`            | `media`, `role` (caller, callee), `setup_seconds`                                                                                                                                          | Media flowed for the first time. `setup_seconds` is from the answer to that moment               |
| `call_ended`                | `media`, `role`, `reason` (a `CallEndReason`, or an error code), `connected`, `seconds`                                                                                                    | A call left the screen. Never who it was with                                                    |

Some of these carry a number that needs a caveat rather than a footnote:

- **`post_created` and `feed_card_opened`** are sent only by builds that have
  the one-timeline feed. Installed builds from before it post and open cards
  without a word, so adoption counts undercount the old-build population until
  it has updated — read them beside the app-version split, not alone. And
  `echo_ask_opened.kind` kept its values on purpose, for dashboard 963222's
  series; that it is now always `pronunciation` is the change, not a drop in
  correction asks.

- **`seconds_since_install`** counts from the first launch the device recorded,
  which is `FLAG_KEYS.installedAt` (`src/lib/installedAt.ts`) rather than
  PostHog's own `Application Installed` — that one is stamped server-side and
  cannot be read back on the phone. A device that was already running the app
  when this shipped mints the stamp on its next launch, so the number is only
  meaningful for installs from that release onwards. It is `null` where nothing
  was recorded.
- **`paywall_dismissed`** is sent once, from the navigator's `beforeRemove`, so
  it sees every way out of the screen that goes through a navigation action —
  on iOS and Android, all of them. The web browser's own back button does not:
  it resets the navigator without an action, so on web that exit is still a
  view with no dismissal (decision _The paywall counts every way out_). `exit`
  is `close` for the X and
  "Continue free" — the two the screen knows are its own — `back` for Android's
  back button and system back gesture, `gesture` for the iOS swipe, and `other`
  for anything else that takes the screen off the stack: a `replace`, a reset, a
  deep link. They are kept apart so that a number which folded those into the
  rest would not pass for a back-button count. It is not sent when the person
  leaves holding a plan they did not arrive with — a purchase, a restore that
  found one, a gift code — which is a conversion and not a dismissal. Builds
  before this one sent it for the X and "Continue free" only and without
  `exit`, so Android back is missing from them: a view with no dismissal.
- **`paywall_viewed`** is sent when the page is first shown, not when the route
  opens. The page waits up to a second for the store so that its headline is
  true, and `offers` is what the store had said by then: `pending` (not yet),
  `none` (answered with nothing to sell), `plain` (Pro is sold with no free week
  on any package — the app cannot tell "no trial offered" from "this account
  has had it", because the store only says so on iOS), `trial`, or `owned` (the
  plan held already covers Pro, so the store was not consulted). A paywall left
  before that second is still counted, as `pending` — on the way out, or when
  the screen unmounts without one. Builds before this send the view on open and
  carry no `offers`, and that is a break in the series, not a footnote: an app
  killed inside that first second counted a view before and counts none now.
  Read views before and after this build as two series, split by app version.
- **`restore_finished.result`** is the small truth. `completed` means the store
  call returned without error and `failed` that it threw or there was no store
  behind it; neither says whether a subscription was found, because the server
  reconciles afterwards and nothing waits for it. A restore success rate cannot
  be read from here until `restorePurchases()` reports what it found, and that
  change is expected to add values to `result`.
- **`source`** on the paywall separates the once-only exposure at the end of
  onboarding from the quota and locked-feature gates. Mixed together, a
  conversion rate describes neither.
- **The Boosted strip's three** need reading together. `boosted_strip_shown`
  means the strip was in the list on that visit, not that pixels reached an
  eye — there is deliberately no viewability maths on a horizontal scroller of
  at most twelve cards. It re-fires on every refocus, so it is comparable with
  `$screen` for `(app)/(tabs)/discover`, and the denominator is strip _shows_
  rather than tab visits; it also fires again when the sort toggle takes the
  strip away and brings it back, because it genuinely did. `slot` is 0-based on
  both tap events, so the click-through rate at slot _i_ is
  `boosted_strip_tapped(slot = i)` over `boosted_strip_shown(count > i)`, and
  `discovery_card_tapped` is the baseline that makes such a rate mean anything.
  Neither tap event carries the boosted person's id or handle: an id of theirs
  in thousands of other people's events would outlive their own deletion, which
  the purge below cannot reach. So these measure the placement and never one
  subscriber's delivery — that number belongs on the server, where it also
  survives an analytics opt-out. `boosted_strip_shown` is the app's first
  high-frequency event, roughly one `$screen`'s worth; every other one here is
  a once-per-account milestone.
- **`message_received`** is a lower bound, not a count of messages received. It
  fires where the socket delivers, so a message that arrived as a push while
  the app was closed is never counted, and neither is one first seen in a cold
  start's fetch. What it honestly measures is conversations that were live
  while somebody was looking — which is the thing `message_sent` cannot say.
- **`message_send_failed`** does not fire for the media quota refusal. That one
  is a fair-use alert, not a failure of the send path — since the single plan
  there is nothing to sell there, so it is a plain alert rather than a
  paywall — and it is counted by `fair_use_limit_hit`, not by this event.
- **`tier`**, wherever it appears (`paywall_viewed`, `purchase_started`,
  `purchase_finished`), reads "Pro" as `pro` **and** the retired `pro_plus`,
  which still arrives — on Polyglot subscriptions that are still renewing, and
  on gifts granted before the merge — and still means Pro. `paywall_viewed.tier`
  is the _viewer's own_ plan, not what the pitch is for. `offer` on the
  purchase events carries the same history: `pro_plus_monthly` and
  `pro_plus_yearly` alongside today's
  `$rc_monthly`/`$rc_annual`/`$rc_lifetime`.
- **`notification_opened`** counts taps. A push that was delivered and ignored
  leaves no trace on the device, so the denominator for an open rate has to
  come from the server's own send log rather than from here.
- **`push_permission_prompted`** counts asks, not dialogs: where the OS already
  holds an answer it returns it without drawing anything. `source` is which of
  the three askers it was — the card at the end of onboarding (`priming`), the
  chats tab's one attempt (`chats`), the Settings switch (`settings`) — so a
  dialog that followed a reason can be read against one that did not. A prompt
  with no answer after it is the app killed while the dialog was up, or a
  request that threw.
- **`tokens_spent`** cannot be summed into a balance. Earning happens in cron
  jobs and gifts the device never sees, so this is one side of a ledger whose
  other side exists only on the server.
- **The streak five** are read off the check-in answer and the repair answer
  and off nothing else; the client infers no streak it was not told. That is
  also the limit: a check-in reports what _that call_ did, so a day first
  credited by something other than the check-in (a message sent before the
  launch request landed) sends nothing. They are lower bounds, and the
  server's activity map is the full record. `streak_milestone_reached` is the
  streak reaching the length, not the reward being paid — the payout is a
  separate claim made on the day's first real action. `streak_broken` is a new
  run starting at one while the account's longest on record is higher; the
  response does not carry the length of the run that ended, so `longest` is the
  best instead, and the event fires on the return from a lapse, so somebody who
  never came back is not in it. A first-ever day is not a broken streak, and
  neither is a streak of one that lapsed before any longer one existed.
  `streak_repaired` has no `tokens_spent` beside it: the repair does not pass
  through the wallet store's purchase, so this is its only trace.
- **`recap_story_viewed`** fires as the story goes away, so a story still on
  screen when the app is killed is never counted. `slides_seen` varies with
  the month — a month without corrections has no corrections slide — so read
  `completed` for "reached the share", not `slides_seen` against a constant.
  `period` is `month` or `year`: "Your Year" is the same story over twelve
  months.
  The share itself is `share_card_created` with `kind: recap`.
- **The tip three** carry the tip's id and its slot and never the sentence,
  which is translated and would arrive in eight spellings for one tip.
  `tip_shown` is the slot's cursor advancing — the moment the existing code
  already treats a tip as shown — so it is once per mount of the screen that
  holds it, not once per look. The `composer` slot is the half-row under the
  chat composer and `chat` the line that opens a short thread; neither has a
  close button, so both send only `tip_shown`. `tip_action`
  is in the union and sent by nothing: no tip has a button today, and the first
  that does will be measured from its first day.
- **`invite_shared` and `profile_shared`** with `via: sheet` count the share
  sheet being opened. The sheet does not say whether it was used and a cancelled
  one looks the same, so these are intent and not delivery; `copy` is the link
  on the clipboard. `own` on the profile event is the share screen under Me;
  `false` is somebody else's profile, from its menu, and never says whose.
- **Echo's six** are read as one funnel and not one at a time: capture
  (`echo_card_captured` + `echo_pack_started`) → `echo_session_started` →
  `echo_card_graded` → `echo_session_finished`. Two of them need a caveat.
  `echo_card_captured` fires only where the capture created a card — the
  endpoint is idempotent and answers `created: false` for a sentence already
  kept — and it never carries `pack`, because a pack's cards are minted in one
  server-side batch that `echo_pack_started` counts instead. And
  `echo_session_finished` means the deck was exhausted: leaving half way
  through still saves every grade, so a session that is started and never
  finished is a real thing this measures rather than a lost event.
  `echo_card_graded` is high-frequency like the Boosted strip's, bounded by
  `SRS_RULES.sessionSize` per session.

Purchases themselves — renewals, refunds, what was actually charged — come
from RevenueCat's server-side PostHog integration (below), not from the app.
`purchase_finished` is the client's view of the sheet, for the funnel.

**Identity.** After sign-in, `identify(userId)` with the Better Auth user id
and nothing else — no email, no name, no handle. Before sign-in, and for a
guest, the SDK's own anonymous id; the two are merged on identify. Sign-out
resets to a fresh anonymous id.

**Never:** message bodies, free text, email, handle, display name, location,
the IP-derived country (`disableGeoip`). The first four are enforced twice — by
the type of `AnalyticsEvent`, and by `sanitizeEventProperties` at runtime; the
last is an SDK option in `analytics.ts`, and changing it changes the store
forms. Screens are also recorded now, and _Session replay_ below is what keeps
this same sentence true inside a recording.

## Session replay

Screens are recorded on iOS and Android, and what the recording holds is a
wireframe: the native plugin masks every piece of text and every image before
a frame leaves the device, so a chat is a column of grey blocks and a profile
is a grey block where the photo was. What is left is layout, timing and where
the taps went — which is the half of the funnel no event here could reach.
`onboarding_step_completed` says the step was finished and `$screen` says it
was seen; why somebody left between the two is what this answers.

Five options in `analytics.ts` are that claim, and all five are written out:

| Option                           | Why                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `maskAllTextInputs: true`        | Despite the name, **all** text — a message bubble, a handle, a bio, a display name — not only fields somebody types into |
| `maskAllImages: true`            | Avatars, gallery photos, image messages                                                                                  |
| `maskAllSandboxedViews: true`    | The system pickers a photo is chosen in, drawn by the OS and outside our own view tree. iOS only                         |
| `captureLog: false`              | A console line is whatever the app logged, which no masking ever sees. Defaults to `true`                                |
| `captureNetworkTelemetry: false` | A request URL carries the chat and profile ids the events deliberately leave on the device. Defaults to `true`, iOS only |

The first three are the SDK's own defaults, written out anyway: a dependency
bump that changed one would change what leaves the phone without changing a
line here, and the store forms are answered from that file. The last two are
the only defaults in it that are inverted rather than repeated.

**It needs a native module, so it needs a build.**
`@posthog/react-native-plugin` is autolinked — `expo prebuild` and EAS pick it
up — but Expo Go has no such module and neither has the web build: the SDK
skips the plugin on web entirely, which is why `enableSessionReplay` is
`Platform.OS !== 'web'` rather than `true`. `app.langx.io` records nothing.
Adding the module also moves the `runtimeVersion` fingerprint
(`apps/mobile/app.config.ts`), so replay cannot arrive over the air: the first
build carrying it is a store build, and an older install simply sees no update.
That is the guard working.

**How much is recorded is a dashboard setting, not a constant here.**
`sessionReplayConfig.sampleRate` is deliberately unset, because a rate set
locally wins over the project's and would make "record fewer sessions" a store
release. The project's rate arrives with the remote config — which is why
`disableRemoteConfig` is now `false`, the first thing in this app that reads
it — and it is _cached_, so a rate set today reaches a phone on its next
launch rather than this one. The project's own **Record user sessions** switch
is the other half: with it off nothing is ingested, whatever a phone sends.

**What the plugin is not allowed to do.** It can hand PostHog the device's push
token and count notification opens, and both are on by default;
`capturePushNotificationSubscriptions` and `capturePushNotificationOpened` turn
them off. The token belongs in `devices` and `notification_opened` already
counts taps — a second copy of both, on a third party, for nothing. Native
crash capture stays off as well: it needs `errorTracking.autocapture`, which
nothing sets, and the store forms say crash logs are not collected.

## Opting out

Settings → Privacy → **Share usage data**. Default on; the refusal is stored on
the device (`analyticsOptOut` in `localFlags.ts`), read before the SDK is
started, and honoured before there is an account. Turning it off resets the
anonymous id and discards the SDK's queue, so nothing captured before the
switch is sent afterwards. Turning it back on starts from a new id. The refusal
reaches the recorder too — the SDK passes it down to the native plugin — so the
switch stops the recording as well as the events, without waiting for a
restart.

## Outside the repo

Set up once, in dashboards, not in code:

- **PostHog project** on EU Cloud, with the key above. **Record user sessions**
  has to be on there, and its sample rate is the only dial for how much gets
  recorded — the app deliberately sets none (_Session replay_ above).
  Autocapture, surveys and heatmaps stay off in the project settings as well —
  the app does not enable them, but a project-level default is one fewer thing
  to rely on the app for.
- **RevenueCat → Integrations → PostHog**, region EU, with the same project
  key. Leave the sandbox key empty (test-store purchases have no business in
  the production project), leave "send subscriber attributes as person
  properties" off (the app sets no attributes, and the id is meant to be the
  only thing on the person), and take the default event names —
  `rc_initial_purchase_event`, `rc_renewal_event`, `rc_cancellation_event`,
  `rc_expiration_event` and the rest. The paywall event names are for
  RevenueCat's own hosted paywalls, which this app does not use. Events land
  under the `app_user_id` — the Better Auth user id (`purchases.ts`), the same
  id the app identifies with — so a Play subscriber and a Stripe subscriber
  are one person in one funnel. As set up, no `rc_*` event has ever arrived in
  the project — the configuration above is what should produce them, and why
  it does not is not yet diagnosed.
- **The store forms**, before the first build with a key ships: the answers
  in [`store/privacy-forms-checklist.md`](store/privacy-forms-checklist.md) §5.

## Deletion

Events are keyed by our user id, which is what makes them findable — and, since
9 September 2026, deletable. When the 30-day grace period expires and
`purgeExpiredAccounts` runs, the same tick asks PostHog to delete the person,
their events and their recordings, keyed by that id.

It goes through a queue rather than a direct call, and the reason is the shape
of the purge. Everywhere else in `deletion.ts` a failed third-party call leaves
an orphan we can live with: a file in a bucket nobody points at. PostHog is not
like that. The purge is driven by `deletedAt <= cutoff` on a row it then
deletes, so a failed call would leave a _person_ with the profile already gone
and nothing left to find it from — the obligation has to outlive the account.
So the purge writes one row into `analyticsDeletions`, keyed by the distinct id,
in the same `Promise.all` as the deletions themselves; `drainAnalyticsDeletions`
empties it hourly, one `bulk_delete` batch at a time, and leaves every row in
place with `attempts` incremented when PostHog says no.

Two consequences worth knowing. The row is written whether or not a key is
configured — an instance that gains one later still honours what it recorded
without one — so an unconfigured deployment accumulates rows it never sends,
which costs a string and a date per deleted account. And the key the API needs
is **not** the one `pnpm insight` uses: that is a read key on a laptop, this
one needs `person:write` and lives on the server.

PostHog's own deletion is asynchronous — `bulk_delete` answers `202` and the
event data is cleared out of hours — so "accepted" is the strongest answer the
call can get, and it is what clears the queue row.

## Reading it without the dashboard

```bash
pnpm insight        # the last 30 days
pnpm insight 90     # a longer window
```

`scripts/insight.mjs` asks the query API the one question this tool was chosen
for — where in install → onboarding → first conversation → paywall people stop
— and writes a single HTML file: the funnel, active people per day, the most
seen screens, how many people finished onboarding per sign-up method, and the
split by `langx_surface`. The funnel walks the wizard a step at a time, so the
five screens between the install and the profile are no longer one number that
only says how many came out. It exists because the answer
was a dashboard that had to be assembled before it could be read, and because
the page anyone can read ([`insight.md`](insight.md)) deliberately carries
none of this.

Under the funnel are three more questions, each its own query and each
degrading on its own — a query PostHog refuses as malformed puts its error on
its card, while a bad key still stops the run. **Coming back** is day 1, 7 and
30 by the week people first appeared, from PostHog's own `person.created_at`
and screen views; a week counts toward day _N_ only once it is _N_ days old,
which is why the cohorts reach back at least 90 days whatever window is asked
for. **Session length** is the median from a session's first event to its last,
over sessions of more than one event. **Activation** is a _proxy_: two messages
sent and two received within 72 hours of first appearing. The goal is two
two-way _conversations_, and PostHog cannot count those — its events carry no
conversation id, on purpose — so the page over-counts one long exchange and
under-counts replies read from a notification, and neither error is measured.
The exact figure lives on the server, in the ledger's mutual-conversation rows.

It writes to a temporary directory, never into the repository, and the page
says on its face that it must not be published — every number on it is in the
right-hand column of that document's table. The two variables it needs are in
`.env.example`; the key is a **personal** API key, which reads everything the
account can and therefore stays on one machine.

### Three things about the funnel that look like bugs

**It disagrees with `insight.langx.io`, and both are right.** The public page
counts rows in our own database, all of them, since the beginning. The funnel
is _ordered_ and _windowed_: a person is on step three only if they did steps
one and two first, and all of it inside the window. Somebody who joined last
year and wrote today is a message on the public page and nothing at all in the
funnel. The two answer different questions and will never match — a message
total far above the funnel's message step is the normal shape, not a fault.

**It counts measured installs, not installs.** Only a build with
`EXPO_PUBLIC_POSTHOG_KEY` sends anything, and anyone who turned the Settings
switch off sends nothing after that. Development builds are invisible by
design. So the top of the funnel is the population the SDK could see, and
every rate below it is a rate within that population.

**A step nobody can reach zeroes everything under it.** The funnel is ordered,
so a step whose event no build fires reports 0 — and every step after it too.
That is the reason the wizard's `photo` step is not in it (it comes after
`onboarding_completed`) and the reason the intro was taken out of the plan's
event list rather than left in unfired when the intro screen was removed.

Neither of the first two is worth writing a number down for: run the command,
the numbers are current. What is worth writing down is that both of these look like broken
instrumentation the first time, and neither is.

## Checking it works

```bash
cd apps/mobile
EXPO_PUBLIC_POSTHOG_KEY=phc_… pnpm dev
```

PostHog → Activity shows events within seconds. On the web build the anonymous
id is kept in `localStorage`; on a phone, in the SDK's own file. Nothing
arrives at all with the key unset — that is the intended state, not a bug.

Recordings are outside that check. `pnpm dev` is Expo Go and the browser,
neither of which carries the native plugin, so replay needs a development build
(`pnpm ios`, `pnpm android`) and lands under PostHog → Replay rather than
Activity. A build with the plugin missing says so in the log — _Session replay
enabled but not installed_ — and goes on sending events.
