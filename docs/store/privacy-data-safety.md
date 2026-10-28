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
| Date of birth                                   | `profiles.birthDate`                    | 16+ age gate, and birthdays; only the **age** is ever shown to others (`toPublicProfile`)                                                                                                                         | Required                              |
| Gender                                          | `profiles.gender`                       | Shown on profile; used by the Pro gender filter. Changeable once every 180 days (`profiles.genderChangedAt` records the last change)                                                                              | `undisclosed` is a valid answer       |
| Country                                         | `profiles.country`                      | Shown on profile; Pro country filter. Derived from the connection's IP at sign-up (Cloudflare's `CF-IPCountry`); the address itself is never stored                                                               | Required, not editable by hand        |
| City                                            | `profiles.cityName`                     | Shown on profile, and the Pro city filter. **Derived**, not entered: read off the shared location against a fixed list of places. Nothing to fill in, and removable from the profile with Settings → Hide my city | Only exists if location sharing is on |
| Photos                                          | `profiles.avatarUrl`, `.photos[]`       | Your profile picture and gallery                                                                                                                                                                                  | Optional                              |
| Free text about you                             | `profiles.bio`                          | Shown on profile                                                                                                                                                                                                  | Optional                              |
| Pronouns                                        | `profiles.pronouns`                     | Shown on profile, and on the signed-out share link. Free text, 24 characters; nothing filters or sorts on it                                                                                                      | Optional                              |
| Languages and levels                            | `profiles.nativeLanguages`, `.learning` | The entire matching mechanism                                                                                                                                                                                     | Required                              |
| Messages                                        | `messages.body`                         | Delivering your conversations                                                                                                                                                                                     | Required to chat                      |
| Reviews you write about somebody                | `testimonials.body`                     | Shown on their profile, inside the app only, with your name and photo. They can hide it; you can edit or delete it; it goes with either account and is in both people's export                                    | Optional                              |
| Timezone                                        | `profiles.timezone`                     | Streak "today" and reminder timing, both in your local day                                                                                                                                                        | Optional (falls back to UTC)          |
| Approximate activity time                       | `profiles.stats.lastActiveAt`           | "Online now" indicator                                                                                                                                                                                            | Required                              |
| Reply record                                    | `profiles.stats`, `conversations`       | How many first messages you received and answered, from message times (`stats.openers*`, `firstReplyAt`). Read only by Discover, behind a switch that starts off; never shown as a number                         | Automatic                             |
| Newcomer hellos                                 | `profiles.newcomerHellos`               | Which new accounts you said a free hello to, and when, so each counts once and the daily ceiling holds. Each new one drops those older than a week; behind a switch that starts off                               | Automatic                             |
| Approximate location                            | `profiles.location`                     | The Pro "Nearby" sort. Rounded to ~1 km before storage; see below                                                                                                                                                 | Only if you turn it on in Settings    |

> The location rows above now produce **two** things, not one: the coarse
> distance shown on a profile, and the city name derived from the same point.
> Answer the form's location questions with both in mind.

| Push token | `devices.pushToken` | Sending notifications | Only if you grant permission |
| Notification record | `notificationLedger`, `stats.notifiedBadgeIds`, `emailCampaigns` | Not telling you the same thing twice — which day you were nudged, which badges you have been told about, which campaigns reached you | Automatic; the ledger is deleted after 30 days (TTL index) |
| Purchase state | `subscriptions` | Knowing whether you have Pro | Only if you subscribe |
| Profile views | `profileViews` | "Who viewed me". Not written at all if the viewer has incognito on | Automatic; deleted after 90 days (TTL index) |
| Reports you file | `reports` | Moderation | Only if you report someone |
| Copilot consent | `profiles.copilotConsent` | Which version of the Copilot consent sheet you agreed to, and when — the only thing that lets your text reach the AI provider. See _Copilot_ below | Only if you agree; withdrawing removes it |
| Copilot reports | `feedback` (`kind: 'copilot'`) | An AI answer you reported and which Copilot help wrote it. The answer can quote what it was about — a Check answer is your sentence, corrected — and the sheet says so; your original sentence goes only if you switch that on, and nothing else from the chat is sent. Read by the operators in their feedback queue; no mail, no public issue. See _Copilot_ below | Only if you report one; in the data export since #1948; deleted with your account |
| Copilot answers | `copilotCache` | An answer kept under a hash of the question, so the same question is not paid for twice. Linked to no account. See _Copilot_ below | Automatic once you use Copilot; deleted after 7 days (TTL index) |
| Usage analytics | PostHog (EU Cloud), not our database | Which screens and buttons are used, so the funnel from install to first conversation can be read, and a recording of the screen on iOS and Android with every word and image masked on the device before it is sent. Keyed by our user id; never a message body — `docs/analytics.md` | Optional — on by default, off in Settings → Privacy → Share usage data |

**Analytics are collected, and declared.** A PostHog SDK ships in the app with
an opt-out in Settings; the row above and the section below are written from
the code (`apps/mobile/src/lib/analytics.ts`, `analyticsEvents.ts`). An earlier
version of this file declared the same row for a system that had been planned
and never built, and had to take it back: the form follows the code, never
leads it — in both directions, so if the SDK is ever removed the row goes with
it.

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

## Analytics — PostHog

One third-party SDK sees user behaviour: PostHog, on its EU Cloud, with the
dashboard internal (the reasoning is in [`decisions.md`](../decisions.md)). What
it receives is listed in [`analytics.md`](../analytics.md); for the forms it is
**screen names, a short list of funnel events, our user id, and — on iOS and
Android since 11 September 2026 — a masked recording of the screen**, and it
must be declared: Play Data Safety wants **App activity → App interactions** and
**Device or other IDs**, Apple wants **Product Interaction**, **User ID** and
**Device ID** under the **Analytics** purpose. All of it "collected, not
shared" — PostHog processes it for us and for nothing of its own — and all of
it **optional**: Settings → Privacy → _Share usage data_ turns it off, and a
refusal is honoured before sign-in.

**Placeholder avatars are generated on our own API**, from the account id, and
neither collect nor disclose anything: no third party sees a user, no email
hash leaves the device, and nothing new is stored. They are not a data
practice and belong in neither form.

Four configuration facts belong in the declaration rather than in the code,
because the honest answer on the forms changes if any of them changes. Each is
set in `apps/mobile/src/lib/analytics.ts`, and the file says so:

- **Message bodies never reach it.** Events carry screen and action names
  only, and the event list is a closed type (`analyticsEvents.ts`) with the
  obvious keys — body, text, email, handle — refused at compile time and
  stripped at runtime.
- **Session replay is on, and masked.** It was off until 11 September 2026 on
  the grounds that this is a messaging app; what makes the reversal answerable
  on a form is that the masking happens on the device, before a frame is sent.
  All text is masked, not only fields somebody types into, and so is every
  image, so a chat records as grey blocks. Console logs and network telemetry —
  the two ways text would get past the masking, and both on by default — are
  off. It is iOS and Android only; the web build records nothing. For Play this
  stays **App activity → App interactions** and for Apple **Product
  Interaction**: it is behaviour, not content, and there is no screen-recording
  category to tick on either form. Crash logs stay unchecked — the same plugin
  could capture them, and does not.
- **The id is ours, not the device's.** PostHog is identified with the same
  user id the API uses, and with nothing else, so a deleted account's events
  are findable by that id. Before sign-in the SDK's own anonymous id stands
  in — that is the "Device ID" Apple asks about; it is a random value the SDK
  makes, not IDFA or the Android advertising id.
- **IP-derived location is off.** `disableGeoip: true`: PostHog does not turn
  the address into a country, so analytics adds no location, coarse or
  otherwise, to the location row above. Precise location remains not
  collected either way.

Purchase events reach PostHog through RevenueCat's server-side integration, not
through a second SDK in the app; what RevenueCat sends is its own subscription
events, under the same user id.

**Deletion is automatic since 9 September 2026.** When the 30-day grace period
expires, the purge asks PostHog to delete the person, their events and their
recordings, keyed by the same user id. It goes through a queue that survives a
failed call, because by then the account itself is gone
([`analytics.md`](../analytics.md) → _Deletion_). PostHog processes the request
asynchronously, so the privacy policy should say the data is _requested for
deletion_ at that point rather than erased the same second.

## Copilot — an AI provider, live for every account with a verified email

**Live in production.** `flags.copilotEnabled` is on (`GET /app-config`, read
on 27 October 2026), and with an `ANTHROPIC_API_KEY` Copilot answers every
account with a verified email address, after that person's consent — a key
alone never turns it on (`docs/decisions.md` → _Copilot ships dark, behind two
switches and a consent_). A guest account cannot use it: every Copilot route
is behind `requireVerifiedEmail`, which refuses a guest with `GUEST_ACCOUNT`,
and the app does not offer it to one. Until 25 October 2026 it answered only
accounts on the operator's allow-list (`decisions.md` → _Copilot opens to
every account; the flag is the off switch_).

The privacy policy has named Anthropic since 22 October 2026 (langx/website
#292); it described the allow-list until 25 October (#294), and the text in
force, dated 26 October 2026 (#299), says Copilot is a beta open to every
account with a verified email address and that guest accounts cannot use it
(langx.io §2.6, with §5, §6, §10.7 and §11). The two store forms are Behic's
to update; the answers to paste are in
[`privacy-forms-checklist.md`](privacy-forms-checklist.md) §7.

What reaches the provider (Anthropic, which runs the model), and only after the
person has agreed to the in-app consent sheet (`profiles.copilotConsent`;
App Review guideline 5.1.2(i)):

- **Check** — the sentence the person asked about, their languages and levels,
  and the name of their app language.
- **Reply ideas** — the last six text lines of that chat, each cut to 200
  characters and labelled only "me" or "them", plus the person's languages and
  levels. This is the other person's text as well: the same shape as tapping
  Translate on their message, and it is what the sheet says.
- **Explain** — the one message the person picked, plus their level and app
  language. Either a text message the partner sent (cut to 500 characters), or
  a correction either of them gave: the original, the fix and the corrector's
  note.
- **Say it** — what the person wrote in their own language, the language they
  want it in, their level in it, and their app language. Never the thread.

Never sent: names, handles, user ids, email, photos, voice notes, view-once
messages, lines deleted for everyone or hidden by the reader — unless the text
itself contains them. The request carries no identifier of ours — no user id,
and no metadata naming one. Text only, by construction
(`modules/copilot/copilot.ts`). One caveat the policy states: a correction
keeps its own copy of the sentence it corrected, so Explain on a correction
can send a sentence whose original message was deleted since.

While `copilotEnabled` is off the Settings row is not drawn, and the policy
offers hi@langx.io for withdrawing meanwhile.

**Withdrawing and reporting.** Settings → Privacy → **Copilot** shows whether
it is on and turns it off; that removes `profiles.copilotConsent`
(`DELETE /copilot/consent`), nothing more of the person's reaches the provider,
and the next use asks again. Every answer has **Report**: after a confirm sheet
that says what goes, the answer and the help that wrote it go to the operators'
feedback queue, with the person's own draft (Check, Say it) only if they turn
that on. The answer itself can quote what it was about — a Check answer is the
sentence corrected, an explanation may quote the message it explains — and the
sheet says so. Explain and Reply ideas never offer the switch: what they were
asked about is the other person's message, and the server refuses it. A report reaches our operators only, not the
provider, so it changes nothing on the forms beyond what is already declared
as collected.

No age rule of its own: Copilot is open to anybody the app's 16+ minimum lets
in, and a partner's age is not checked (see `decisions.md` → _Copilot has no
age rule of its own, and 24 a day for Pro_).

**On the provider's side.** Anthropic's commercial terms (§B) say it may not
train models on customer content, and its published retention page
(privacy.claude.com, article 7996866, read 21 October 2026) says API inputs
and outputs are deleted within 30 days, longer only for usage-policy
enforcement or by law. Nothing in our code asks for a different arrangement.
The policy links both pages; re-read them if either changes.

For the forms: the data is message content, which is already collected; what
changes is that a processor sees it. Anthropic processes it for us under its
commercial terms, which makes it **collected, not shared** on Play's definition
(a service provider acting on our behalf), the same answer PostHog gets. The
provider's own retention is stated in the policy as it publishes it (above).

## Sharing with third parties

| Recipient                    | What it receives                                                                                                                                                                            | Why                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Resend                       | Your email address, and — for notification mail — how many messages are waiting and the display names of who wrote or looked. **Never the text of a message.**                              | Verification and password-reset mail, and the notification emails you have switched on       |
| Google Cloud Translation     | The text you asked to translate                                                                                                                                                             | Machine translation. Results are cached by a hash of the source text                         |
| RevenueCat                   | Your user id and purchase events                                                                                                                                                            | Subscription state                                                                           |
| Expo push service            | Your push token and the notification text                                                                                                                                                   | Delivering notifications                                                                     |
| Cloudflare R2 / Backblaze B2 | Your photos                                                                                                                                                                                 | Hosting them                                                                                 |
| PostHog (EU Cloud)           | Screen names, the funnel events in `docs/analytics.md`, and our user id — never a message body                                                                                              | Product analytics. A processor acting for us, which is "collected, not shared" on both forms |
| Anthropic                    | Only with Copilot switched on and the person's consent: the text they asked Copilot about, their languages and levels, and for Reply ideas the last lines of the chat. No id, name or email | Copilot's answers. A processor acting for us — see _Copilot_ above                           |

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

LangX is **16+** and the age gate is enforced server-side at profile creation
(`meetsMinimumAge`, `packages/shared/src/age.ts`) for all three sign-up paths.
Declare the **16–17** and **18 and over** age groups and nothing younger. Do not
declare a Families audience: it applies as soon as an under-13 group is ticked,
contradicts the 16+ policy and changes which SDKs and data practices are
permitted.

## Age rating inputs

Unrestricted user-to-user text communication and user-generated photos, with
in-app blocking and reporting. The questionnaires rated that **13+ on Apple**
and **Teen on Google** (September 2026). A rating describes the content; the
16+ floor is a term of use enforced at profile creation. The two are allowed to
differ, and they do: a 14-year-old can install the app and is refused at
onboarding.
