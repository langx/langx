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

| Event                       | Properties                                                                                            | Fired                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `welcome_chosen`            | `choice` (browse, create, sign_in)                                                                    | One of the welcome screen's three actions                           |
| `signup_submitted`          | `method` (email, google, apple), `from_guest`                                                         | The sign-up request leaves the device. Not that it succeeded        |
| `signup_verified`           | `method`                                                                                              | The mailed link was opened and spent by the app. Email only         |
| `guest_gate_hit`            | `action` (message, like, follow, post, other)                                                         | A guest was refused a write and sent to sign-up                     |
| `onboarding_step_completed` | `step`, `guest`, `resumed`                                                                            | One wizard step was finished — what `$screen` cannot say            |
| `onboarding_completed`      | `referred`, `native_languages`, `learning_languages`, `method`, `from_guest`, `seconds_since_install` | The profile is created                                              |
| `message_sent`              | `kind` (text, correction, image, audio), `reply`                                                      | The server acknowledged a send. Never the body                      |
| `paywall_viewed`            | `feature` (what sent them there, or null), `tier`, `source`                                           | The paywall opens                                                   |
| `paywall_dismissed`         | `source`, `seconds_open`                                                                              | It was closed without a purchase — the X, or "Continue free"        |
| `purchase_started`          | `offer`, `tier`, `period`                                                                             | A buy button is tapped                                              |
| `purchase_finished`         | the same, plus `outcome`                                                                              | The store sheet closes: purchased, cancelled, failed or unavailable |
| `review_prompted`           | `trigger` (streakMilestone or correction)                                                             | The OS review sheet was requested; whether it showed is unknowable  |
| `boosted_strip_shown`       | `count` (1–12)                                                                                        | Discover is focused with a non-empty Boosted strip                  |
| `boosted_strip_tapped`      | `slot` (0-based), `tier`                                                                              | A Boosted card is tapped                                            |
| `discovery_card_tapped`     | `slot` (0-based)                                                                                      | A row in the discovery list below the strip is tapped               |

Four of these carry a number that needs a caveat rather than a footnote:

- **`seconds_since_install`** counts from the first launch the device recorded,
  which is `FLAG_KEYS.installedAt` (`src/lib/installedAt.ts`) rather than
  PostHog's own `Application Installed` — that one is stamped server-side and
  cannot be read back on the phone. A device that was already running the app
  when this shipped mints the stamp on its next launch, so the number is only
  meaningful for installs from that release onwards. It is `null` where nothing
  was recorded.
- **`paywall_dismissed`** does not fire for a hardware back on Android. That
  exposure shows up as a view with no dismissal, which is a countable gap
  rather than a wrong number.
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

Purchases themselves — renewals, refunds, what was actually charged — come
from RevenueCat's server-side PostHog integration (below), not from the app.
`purchase_finished` is the client's view of the sheet, for the funnel.

**Identity.** After sign-in, `identify(userId)` with the Better Auth user id
and nothing else — no email, no name, no handle. Before sign-in, and for a
guest, the SDK's own anonymous id; the two are merged on identify. Sign-out
resets to a fresh anonymous id.

**Never:** message bodies, free text, email, handle, display name, location,
the IP-derived country (`disableGeoip`), session recordings
(`enableSessionReplay: false`). The first four are enforced twice — by the
type of `AnalyticsEvent`, and by `sanitizeEventProperties` at runtime; the
last two are SDK options in `analytics.ts`, and changing either changes the
store forms.

## Opting out

Settings → Privacy → **Share usage data**. Default on; the refusal is stored on
the device (`analyticsOptOut` in `localFlags.ts`), read before the SDK is
started, and honoured before there is an account. Turning it off resets the
anonymous id and discards the SDK's queue, so nothing captured before the
switch is sent afterwards. Turning it back on starts from a new id.

## Outside the repo

Set up once, in dashboards, not in code:

- **PostHog project** on EU Cloud, with the key above. Autocapture, session
  replay, surveys and heatmaps stay off in the project settings as well — the
  app does not enable them, but a project-level default is one fewer thing to
  rely on the app for.
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
  are one person in one funnel.
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
