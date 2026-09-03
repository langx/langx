# Analytics — PostHog

What the app sends, where it goes, and what has to be true outside the repo for
it to work. The _why_ — a private dashboard, PostHog over a self-hosted
Plausible, EU Cloud — is in [`decisions.md`](decisions.md) → _The analytics
dashboard is private_. The store-form consequences are in
[`store/privacy-data-safety.md`](store/privacy-data-safety.md).

## Where it lives

| File                                              | What                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/mobile/src/lib/analyticsEvents.ts`          | The closed list of events and their properties. **The only place a new event can be added.** |
| `apps/mobile/src/lib/analyticsCore.ts`            | Consent, the queue that holds calls until the flag is read, identity. Pure, and tested       |
| `apps/mobile/src/lib/analytics.ts`                | The SDK, its configuration, and the exports screens use                                      |
| `apps/mobile/src/hooks/useScreenTracking.ts`      | One `$screen` per route change, named after the route file                                   |
| `apps/mobile/src/hooks/useAnalyticsPreference.ts` | The Settings switch                                                                          |
| `apps/mobile/app/_layout.tsx`                     | Starts the SDK; binds and unbinds the user id in the same effect that does it for RevenueCat |

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

| Event                  | Properties                                           | Fired                                                               |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `onboarding_completed` | `referred`, `native_languages`, `learning_languages` | The profile is created                                              |
| `message_sent`         | `kind` (text, correction, image, audio), `reply`     | The server acknowledged a send. Never the body                      |
| `paywall_viewed`       | `feature` (what sent them there, or null), `tier`    | The paywall opens                                                   |
| `purchase_started`     | `offer`, `tier`, `period`                            | A buy button is tapped                                              |
| `purchase_finished`    | the same, plus `outcome`                             | The store sheet closes: purchased, cancelled, failed or unavailable |

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
- **RevenueCat → Integrations → PostHog**, with the same project key.
  RevenueCat sends `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`
  and the rest as events under the `app_user_id` — which is the Better Auth
  user id (`purchases.ts`), the same id the app identifies with — so a Play
  subscriber and a Stripe subscriber land in one funnel.
- **The store forms**, before the first build with a key ships: the answers
  in [`store/privacy-forms-checklist.md`](store/privacy-forms-checklist.md) §5.

## Deletion

Events are keyed by our user id, which is what makes them findable. What is not
built yet is the removal: account deletion (`/me/delete`, 30-day grace) does
not call PostHog's person-deletion API. Until it does, a deletion request that
asks for analytics as well is handled by hand in the PostHog UI (Persons → the
id → Delete), and the privacy policy must not promise more than that.

## Checking it works

```bash
cd apps/mobile
EXPO_PUBLIC_POSTHOG_KEY=phc_… pnpm dev
```

PostHog → Activity shows events within seconds. On the web build the anonymous
id is kept in `localStorage`; on a phone, in the SDK's own file. Nothing
arrives at all with the key unset — that is the intended state, not a bug.
