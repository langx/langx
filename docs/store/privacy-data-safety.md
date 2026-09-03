# Data collection — answers for Play Data Safety and Apple Privacy Labels

Written from the code, not from a template. Every row below names the field
and the file that writes it, so this stays checkable as the app changes.
Both stores treat a wrong answer here as a policy violation, and both accept
"collected but not shared" — which is almost everything LangX does.

## What is collected

| Data                                            | Where it is stored                      | Why                                                                                                                                                                                                               | Optional?                             |
| ----------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Email address                                   | `user` (Better Auth)                    | Sign-in, verification, password reset                                                                                                                                                                             | Required                              |
| Email address of a v1 account its owner deleted | `v1DeletedContacts`                     | One announcement that the new app exists, then the collection is dropped; the mail's unsubscribe link deletes the address on the spot (`docs/decisions.md` → _Every v1 account has a v2 `user` row_)              | Temporary — gone after that one send  |
| Name / display name                             | `profiles.displayName`                  | Shown on your profile                                                                                                                                                                                             | Required                              |
| Username                                        | `profiles.handle`                       | Your public identity                                                                                                                                                                                              | Required                              |
| Date of birth                                   | `profiles.birthDate`                    | 18+ age gate, and birthdays; only the **age** is ever shown to others (`toPublicProfile`)                                                                                                                         | Required                              |
| Gender                                          | `profiles.gender`                       | Shown on profile; used by the Pro gender filter                                                                                                                                                                   | `undisclosed` is a valid answer       |
| Country                                         | `profiles.country`                      | Shown on profile; Pro country filter. Derived from the connection's IP at sign-up (Cloudflare's `CF-IPCountry`); the address itself is never stored                                                               | Required, not editable by hand        |
| City                                            | `profiles.cityName`                     | Shown on profile, and the Pro city filter. **Derived**, not entered: read off the shared location against a fixed list of places. Nothing to fill in, and removable from the profile with Settings → Hide my city | Only exists if location sharing is on |
| Photos                                          | `profiles.avatarUrl`, `.photos[]`       | Your profile picture and gallery                                                                                                                                                                                  | Optional                              |
| Free text about you                             | `profiles.bio`                          | Shown on profile                                                                                                                                                                                                  | Optional                              |
| Languages and levels                            | `profiles.nativeLanguages`, `.learning` | The entire matching mechanism                                                                                                                                                                                     | Required                              |
| Messages                                        | `messages.body`                         | Delivering your conversations                                                                                                                                                                                     | Required to chat                      |
| Timezone                                        | `profiles.timezone`                     | Streak "today" and reminder timing, both in your local day                                                                                                                                                        | Optional (falls back to UTC)          |
| Approximate activity time                       | `profiles.stats.lastActiveAt`           | "Online now" indicator                                                                                                                                                                                            | Required                              |
| Approximate location                            | `profiles.location`                     | The Pro+ "Nearby" sort. Rounded to ~1 km before storage; see below                                                                                                                                                | Only if you turn it on in Settings    |

> The location rows above now produce **two** things, not one: the coarse
> distance shown on a profile, and the city name derived from the same point.
> Answer the form's location questions with both in mind.

| Push token | `devices.pushToken` | Sending notifications | Only if you grant permission |
| Notification record | `notificationLedger`, `stats.notifiedBadgeIds`, `emailCampaigns` | Not telling you the same thing twice — which day you were nudged, which badges you have been told about, which campaigns reached you | Automatic; the ledger is deleted after 30 days (TTL index) |
| Purchase state | `subscriptions` | Knowing whether you have Pro | Only if you subscribe |
| Profile views | `profileViews` | "Who viewed me". Not written at all if the viewer has incognito on | Automatic; deleted after 90 days (TTL index) |
| Reports you file | `reports` | Moderation | Only if you report someone |

**Analytics are not collected, and must not be declared.** This table used to
list PostHog events as "automatic, opt-out in Settings". There is no PostHog in
the code and no opt-out in Settings — the declaration described a system that
was planned and never built, which on a store privacy form is a false
declaration rather than a stale note. If analytics are added
(`langx2-marketing-funnel.md`, B0), this row goes back **with** the opt-out
control, and not before: the form has to follow the code, never lead it.

## What is NOT collected

Answering this precisely is what makes the rest credible:

- **No precise location.** Coarse location _is_ collected now (see the table
  above and the section below), but the precise kind never is — the app asks
  the OS for its lowest accuracy and the server rounds what it gets before
  storing it, so no precise position exists to declare, share or hand over.
  Both forms distinguish the two, and the honest answers are **approximate
  location: yes, optional**, **precise location: no**.
- **No contacts, no calendar, no photos beyond the ones you pick, no
  microphone, no health data, no financial data.** Payment happens entirely
  inside Apple's, Google's or Stripe's flow; the server only ever sees an
  entitlement state from a RevenueCat webhook, never a card number.
- **No advertising identifiers.** No IDFA, no Android Advertising ID, no ad
  SDK, and nothing is sold or passed to a data broker.
- **No tracking across apps or websites.** There is a third-party analytics
  SDK (see below), but Apple's "Tracking" means linking our data to data
  from other companies' apps or sites for advertising, or handing it to a
  broker. Neither happens, so the category stays **not** applicable — which
  holds only as long as no ad network or attribution SDK is added later.

## Location — approximate, optional, and never shown to anyone

The one row in the table above that people will actually ask about, so it is
worth stating exactly what happens.

**It is off until the user turns it on.** The only two things that write it are
the Settings toggle and the Nearby tab's own prompt, both of which run the OS
permission flow first. Nothing writes it at sign-up, at onboarding, or in the
background. The permission requested is **when-in-use only** — there is no
background location permission in the manifest, and adding one would change the
answers on both forms.

**Precision is destroyed before storage, not at display time.** The client asks
for `Accuracy.Lowest`, and `toGeoPoint` rounds the reading to two decimal
places — roughly a kilometre — on the way into `profiles.location`. The precise
value is never written to any field, log or cache, so there is no version of
this data that could later be leaked, exported or subpoenaed at street level.

**Nobody is ever shown a position.** `toPublicProfile` does not carry
`location`, and the only thing derived from it that reaches another user is a
**bucketed** distance ("under 5 km away") on the Nearby list. Distances are
reported as band edges rather than measured values specifically so that
repeated readings from a moving account cannot be intersected back into a
point.

**Turning it off deletes it.** The Settings toggle `$unset`s the field rather
than clearing a flag, which also removes the profile from the geo index and so
from everyone else's Nearby results. There is no retention period to declare
because there is nothing retained.

For the forms: Play Data Safety → **Location → Approximate location**,
collected, not shared, optional, "App functionality". Apple → **Location →
Coarse Location**, linked to the user, purpose **App Functionality**. Precise
Location stays unchecked on both.

## Analytics — PostHog, **not built yet**

> **Nothing in this section is shipped.** There is no PostHog SDK in the app,
> no events are sent, and there is no opt-out control. It is written here as
> the specification to satisfy _before_ analytics may be declared on either
> store form — every paragraph below is a requirement, not a description.
>
> Until it is built, both forms must say no analytics are collected.

v1 self-hosted Plausible and published the dashboard. v2 will use PostHog's EU
Cloud and keep the dashboard internal; the reasoning is in
[`decisions.md`](../decisions.md). For the store forms what matters is that
this will be the app's **only** third-party SDK that sees user behaviour, and
it must then be declared: Play Data Safety wants "App activity — app
interactions",
Apple wants **Product Interaction** and **Device ID** under the **Analytics**
purpose.

Three configuration facts belong in the declaration rather than in the code,
because the honest answer on the forms changes if any of them changes:

- **Message bodies never reach it.** Events carry screen and action names
  only. Session replay masks all text input, so a recording of the chat
  screen shows that someone typed, not what they typed.
- **The id is ours, not the device's.** PostHog is identified with the same
  user id the API uses, so a deleted account's events are deletable with it.
- **IP-derived location is coarse, and off unless deliberately enabled.**
  PostHog resolves an IP to a country, and that is what "approximate
  location" means on the forms if it is left on. Precise location remains
  not collected either way.

Purchase events reach PostHog through RevenueCat's server-side integration,
not through a second SDK in the app.

## Sharing with third parties

| Recipient                    | What it receives                                                                                                                                               | Why                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Resend                       | Your email address, and — for notification mail — how many messages are waiting and the display names of who wrote or looked. **Never the text of a message.** | Verification and password-reset mail, and the notification emails you have switched on |
| Google Cloud Translation     | The text you asked to translate                                                                                                                                | Machine translation. Results are cached by a hash of the source text                   |
| RevenueCat                   | Your user id and purchase events                                                                                                                               | Subscription state                                                                     |
| Expo push service            | Your push token and the notification text                                                                                                                      | Delivering notifications                                                               |
| Cloudflare R2 / Backblaze B2 | Your photos                                                                                                                                                    | Hosting them                                                                           |
| ~~PostHog (EU Cloud)~~       | _Nothing — not integrated. Listed only so it is not forgotten when it is._                                                                                     | _See "Analytics" above: not built, and must not be declared until it is._              |

None of these receive data for their own advertising or profiling. There are no
data brokers.

## Deletion and export

Both required by both stores, and both implemented in-app:

- **Delete** — Settings → "Hesabımı sil". The account becomes invisible
  immediately and every session is destroyed; the data is permanently removed
  30 days later. Signing back in within those 30 days cancels it.
- **Export** — Settings → "Verilerimi indir" returns one JSON document with
  everything the app holds about you.

Photos go too — the avatar and every gallery image are removed from storage,
not just from the database, so nothing stays fetchable by URL. The export
carries the stored `location` point, which is the coarsened one and the only
one there has ever been; the purge removes the whole profile document, so it
goes with everything else. Withdrawing location alone does not require either
flow — the Settings toggle deletes it on its own.

Two deliberate exceptions, both worth stating in the policy in plain words.

The token ledger survives as an audit record, with your identity replaced by a
random value stored nowhere else: the totals still reconcile, and the rows no
longer identify anyone. Your leaderboard entries are deleted outright.

And messages you **sent** are not deleted from the other person's conversation. Their
content is removed and they are marked as belonging to a deleted account.
Deleting them outright would rewrite a conversation someone else is also a
party to.

## Security

- Passwords are hashed by Better Auth; the server never stores plaintext.
- All traffic is TLS.
- Every listing and every conversation is authorised server-side against the
  session, including over the WebSocket — the realtime transport goes through
  the same guards as REST so it cannot become a way around them.

## Play "target audience and content"

LangX is **18+** and the age gate is enforced server-side at profile creation
(`meetsMinimumAge`, `packages/shared/src/age.ts`) for all three sign-up paths.
Do not declare a Families audience: it contradicts the 18+ policy and changes
which SDKs and data practices are permitted.

## Age rating inputs

Unrestricted user-to-user text communication and user-generated photos, with
in-app blocking and reporting. That combination normally lands at 17+/18+ on
both stores, which matches the age gate.
