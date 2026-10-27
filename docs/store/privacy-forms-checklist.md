# Store privacy forms — what to select, field by field

A transcription target, not an explanation: open Play Console and App Store
Connect next to this page and copy the answers across. The reasoning for every
answer is in [`privacy-data-safety.md`](privacy-data-safety.md); this file only
says which box to tick. If the two disagree, `privacy-data-safety.md` is the
source and this page is stale.

**Both forms were read back box by box on 20 September 2026 and already match
this page.** Nothing was changed; the boxes below are ticked as a record of
what the consoles actually say, not as a plan. The paragraph that used to open
this file — and the _Location changes both privacy forms_ section of
`release-runbook.md`, which says two live answers are wrong — described the
state before someone transcribed it. Read the consoles before believing either
of them again.

One answer deliberately reads "no", and it is the one this page states most
loosely. Play asks whether users can request that **some or all of their data
be deleted _without deleting their account_**. There is no such path: the app
offers account deletion, which is declared separately through the **Delete
account URL** (`https://langx.io/data-deletion`, already set), and that is what
puts the deletion line on the store listing. Answering yes would claim a
mechanism that does not exist.

## 1. Play Data Safety — corrections to what is live today

Read off the published Data safety page on 31 August 2026 and compared against
HelloTalk, Tandem and Hilokal.

- [x] **Personal info → Race and ethnicity: uncheck.** Nothing in the app asks
      for it and nothing stores it — the profile holds gender, date of birth,
      country, city and languages. None of the three comparable apps declares
      it. Declaring data we do not collect is as wrong as omitting data we do.
- [~] **Security practices → "You can request that data be deleted".** Already
  carried by the Delete account URL, which is set. The separate Play
  question about deleting data _without_ deleting the account correctly
  reads "no" — see the note at the top of this page.
  It is implemented — Settings → "Hesabımı sil" hides the account
  immediately and purges it after 30 days, photos included. LangX is
  currently the only one of the four without this line, and the line is
  true.

## 2. Play Data Safety — the new location answers

Nearby (Pro, then Polyglot) added the app's first location permission, so two answers
that were "no" are now "yes".

- [x] **Location → Approximate location: collected.**
  - Shared with third parties: **no**
  - Required or optional: **optional** — the user turns it on in Settings or
    from the Nearby tab's prompt; nothing writes it at sign-up or in the
    background
  - Purpose: **App functionality** (only)
  - Processed ephemerally: **no** — it is stored on the profile until the user
    turns it off
- [x] **Location → Precise location: leave unchecked.** The client asks the OS
      for `Accuracy.Lowest` and the server rounds to two decimals (~1 km)
      before storing, so no precise value is ever written.
- [ ] Everything else on the form stays as it is, except the analytics rows
      in §5 below.

## 3. Apple App Privacy — the same change

- [x] **Location → Coarse Location: collected.**
  - Linked to the user: **yes**
  - Used for tracking: **no**
  - Purpose: **App Functionality** (only)
- [x] **Location → Precise Location: leave unchecked.**
- [ ] **Tracking: stays "no".** No IDFA, no ad SDK, no data broker, nothing
      linked to other companies' data for advertising.

## 4. The privacy policy has to say it too

A form answer with no matching sentence in the policy is a finding waiting to
happen. Four points, in plain words, source text in
[`privacy-data-safety.md`](privacy-data-safety.md) → _Location_:

- [ ] It is **optional** and off until turned on, and the permission is
      **when-in-use only** — there is no background location.
- [ ] What is stored is **rounded to about a kilometre before it is written**,
      not at display time; the precise reading is never persisted anywhere.
- [ ] **No one is shown a position** — other users see only a bucketed distance
      ("under 5 km away") on the Nearby list.
- [ ] **Turning it off deletes it**, which also removes the profile from
      everyone else's Nearby results. No retention period to declare.

## 5. Analytics — new answers on both forms

The app ships a PostHog SDK with an opt-out in Settings (source:
[`privacy-data-safety.md`](privacy-data-safety.md) → _Analytics_). Both forms
gain rows. None of them is "shared" — PostHog processes for us — and all of
them are optional. **These answers go in before the first build carrying
`EXPO_PUBLIC_POSTHOG_KEY` is submitted**, not after.

Since 11 September 2026 the SDK also records the screen on iOS and Android,
masked on the device. It adds no category to either form — a recording of
behaviour is App interactions and Product Interaction, which are already
ticked below — but it does change the privacy policy, and it is the reason the
crash-log line below is worth re-reading rather than copying.

### Play Data Safety

- [x] **App activity → App interactions: collected.**
  - Shared with third parties: **no**
  - Required or optional: **optional** — Settings → Privacy → _Share usage
    data_
  - Purpose: **Analytics** (only)
  - Processed ephemerally: **no**
  - This covers the masked session recording too. Play has no screen-recording
    category; what is recorded is which screens and taps, with all text and
    every image masked before the frame leaves the phone, so it belongs here
    and not under Messages or Photos.
- [x] **Device or other IDs: collected.** PostHog's own anonymous id before
      sign-in, our account id after. Not shared, optional, purpose Analytics.
- [x] **App info and performance → Crash logs, Diagnostics: leave unchecked.**
      Error tracking is not enabled in the SDK. The native plugin that arrived
      with session replay _can_ capture native crashes; it is off
      (`errorTracking.autocapture` is unset), so this answer holds — but it is
      now a choice rather than a missing capability, and turning it on ticks
      this box.

### Apple App Privacy

- [x] **Usage Data → Product Interaction: collected.** Linked to the user:
      **yes**. Used for tracking: **no**. Purpose: **Analytics** (only). The
      masked session recording is declared here: Apple's nearest categories are
      Product Interaction for behaviour and "Other Data" for anything else, and
      a recording in which all text and every image is masked on the device is
      behaviour. Nothing about it is linked to another company's data, so
      Tracking stays **no**.
- [x] **Identifiers → User ID: collected.** Linked, Analytics, not tracking.
- [x] **Identifiers → Device ID: collected.** Linked, Analytics, not tracking.
      It is the SDK's random id, not IDFA — there is still no IDFA and no
      `NSUserTrackingUsageDescription`.
- [ ] **Tracking: stays "no".** Nothing is linked to other companies' data and
      nothing goes to a broker.

### The privacy policy

- [ ] It names PostHog and the EU region, says it is optional and where the
      switch is, says message bodies are never sent, and says deletion of
      analytics data is on request until it is automated
      ([`analytics.md`](../analytics.md) → _Deletion_).
- [ ] It says the app records the screen on iOS and Android, that every word
      and image in the recording is masked on the device before it is sent,
      that the same Settings switch turns it off, and that the web app records
      nothing. A recording is the one thing in this document a person would be
      surprised to learn about after the fact, so the policy says it plainly
      rather than inside the analytics sentence.

## 6. The hourly gift — no new answers

The wallet's store gained a free hourly gift on 5 September 2026: a random
number of tokens, 0–250, decided on the server. It changes nothing on either
form. Nothing is purchased or staked, the token has no cash value and cannot
be redeemed, and the outcome is a free grant rather than a wager — so Apple's
"Simulated Gambling" and "Contests" answers stay **No** and Play's content
questionnaire (gambling, loot boxes bought with money) stays as it is. The
messaging rules that keep it that way are in `docs/token-messaging-brief.md`.

## 7. Copilot — live, and the two forms still to update

**The flag is on.** `flags.copilotEnabled` is on in production and Copilot
answers every account with a verified email address that agrees to it; a
guest account cannot use it (`privacy-data-safety.md` → _Copilot_). The
privacy policy came first and is published; the two forms below are Behic's to
transcribe. No new data type appears on either: chat text is already
collected, and what changes is that a processor (Anthropic) sees some of it.

- [x] **Privacy policy (langx.io), first.** Published 22 October 2026
      (langx/website #292) and revised on 25 and 26 October (#294, #299); the
      text in force is dated 26 October 2026. §2.6 names Anthropic as
      processor and model provider and says, per help, what it receives and
      what it never does; the training and 30-day retention terms Anthropic
      publishes; our 7-day answer cache, linked to no account; the daily
      limit's answer times, kept for 24 hours, and the time the limit was
      reached, kept for 3 days; server logs that never hold the text, and a
      failed answer's error sent to Sentry with the user id; consent on first
      use, versioned, withdrawn in Settings → Privacy → Copilot; what a report
      carries; a beta open to every account with a verified email address,
      not to guests, whose answers can be wrong and which can be switched off
      for everyone; no age rule beyond the app's 16+. §5, §6, §10.7 and §11
      carry the matching lines. (Until 27 October this item quoted the policy
      as "beta, allow-list only"; the allow-list was removed on 25 October
      2026, and the policy's sentence with it. An earlier draft said 16- and
      17-year-olds were excluded; that has not been true since #1927.)

### Play Data Safety — answers to paste

Play asks per data type; Copilot changes the answers on two existing rows and
adds none.

- [ ] **Messages → Other in-app messages** — already declared; confirm:
  - Collected: **Yes**
  - Shared: **No**. Anthropic is a service provider processing the text on our
    behalf, which Play's definition of sharing excludes — the same reasoning
    as PostHog.
  - Processed ephemerally: **No** (chat messages are stored; Copilot's answer
    cache keeps an answer for 7 days)
  - Required or optional: **unchanged** (chat itself is core; Copilot is an
    opt-in on top of it)
  - Purposes: **App functionality** (only). Copilot's answers are app
    functionality; nothing goes to analytics, advertising, personalisation or
    account management.
  - This also covers the draft a person asks Check or Say it about, and the
    answer and optional draft in a Copilot report: they are message text.
- [ ] **App activity → App interactions** — already declared for Analytics;
      add one purpose:
  - Collected: **Yes**. Shared: **No**. Processed ephemerally: **No**.
  - Required or optional: **Optional** (unchanged: Copilot is opt-in, and
    analytics has its own switch)
  - Purposes: **Analytics** (existing) **+ App functionality** (new). The
    daily Copilot limit stores, on the account, when each answer was used in
    the last 24 hours (`profiles.quota.copilot`). That is a usage record kept
    to run a feature, not to measure it.
- [ ] **Security practices** — unchanged: data is encrypted in transit
      (**Yes**); deletion is by the Delete account URL.

### Apple App Privacy — answers to paste

- [ ] **User Content → Other User Content** (or **Emails or Text Messages**,
      whichever already carries chat messages — keep the same one) — confirm:
  - Collected: **Yes**
  - Linked to the user: **Yes**. Anthropic receives the text without any
    identifier, but the same text is stored in our database against the
    account, and Apple asks about the data, not about one copy of it.
  - Used for tracking: **No**. Nothing is combined with other companies' data
    and nothing goes to a broker or an ad network.
  - Purposes: **App Functionality** (only)
- [ ] **Usage Data → Product Interaction** — already declared for Analytics;
      add one purpose:
  - Linked to the user: **Yes**. Used for tracking: **No**.
  - Purposes: **Analytics** (existing) **+ App Functionality** (new), for the
    same per-account timestamps behind the daily Copilot limit.
- [ ] **Tracking: stays "No"** for the app as a whole. No IDFA, no
      `NSUserTrackingUsageDescription`.

- [ ] **App Review notes**, with the build whose screens offer Copilot:
      describe it and its consent sheet (guideline 5.1.2(i)).
- [x] **Before the flag, in the app:** a Settings control to withdraw consent,
      and a way to report an AI answer (Play's AI-generated content policy).
      Both exist now. Settings → Privacy → **Copilot** (v3, shown only to an
      account Copilot is on for) says whether it is on and turns it off,
      which calls `DELETE /copilot/consent`; Copilot asks again next time.
      Every answer card and the Explain sheet have **Report**, which sends
      the answer (which can quote what it was about, as the sheet says) and
      which help wrote it — and the person's original draft only if they
      switch that on in the confirm sheet — to the operator panel's
      feedback queue (`POST /copilot/report`). Tick it again on the build
      sent for review: both arrive with the over-the-air update.
- [ ] **A spend limit** on the key's workspace with the provider —
      `COPILOT_RULES.globalCallsPerDay` is our ceiling; that one is theirs.
- [x] **Then the flag:** `scripts/maintenance.ts flag copilotEnabled true`.
      On in production, for every account since 25 October 2026.

## Reference — the rest of the Play form

Unchanged by this pass; listed so a full re-verification does not need a second
document. Every row is "collected, not shared".

| Play category                                 | Ours                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Personal info → Name, Email address           | display name, handle, sign-in email — required                     |
| Personal info → User IDs                      | account id                                                         |
| Personal info → Other info                    | date of birth (16+ gate; only the age is shown), gender, bio, city |
| Location → Approximate location               | optional, see above                                                |
| Photos and videos → Photos                    | avatar and gallery — optional                                      |
| Messages → Other in-app messages              | chat bodies                                                        |
| App activity → App interactions               | screen names, funnel events, masked screen recording — see §5      |
| Device or other IDs                           | PostHog's anonymous id, then the account id — optional, see §5     |
| App info and performance                      | nothing                                                            |
| Financial info                                | nothing — purchase state only, never a card number                 |
| Contacts, Calendar, Health, Microphone, Ad ID | nothing                                                            |

Target audience: **16+**, enforced server-side at profile creation. Declare the
**16–17** and **18 and over** groups and nothing younger. Do not declare a
Families audience — it applies once any under-13 group is ticked, contradicts
the age gate and changes which SDKs are permitted.

> **City is collected, and that is all the form asks.** `privacy-data-safety.md`
> describes it as "shown on profile", which is not true today — nothing renders
> `profiles.city` — and there is an approved plan to derive it from location and
> put it behind a privacy toggle. Neither the current gap nor the planned change
> alters any answer above: the form asks what is _collected_, and it is, as an
> optional field. Revisit this note if that work lands, since deriving city from
> location would make it a second consumer of the location permission.
