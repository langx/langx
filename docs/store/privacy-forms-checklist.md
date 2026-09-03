# Store privacy forms — what to select, field by field

A transcription target, not an explanation: open Play Console and App Store
Connect next to this page and copy the answers across. The reasoning for every
answer is in [`privacy-data-safety.md`](privacy-data-safety.md); this file only
says which box to tick. If the two disagree, `privacy-data-safety.md` is the
source and this page is stale.

Four things need to change in the same sitting. Two of them are corrections to
answers that are already live and wrong; the third is the new location
permission; the fourth is analytics, which the app did not have when this page
was first written.

## 1. Play Data Safety — corrections to what is live today

Read off the published Data safety page on 31 August 2026 and compared against
HelloTalk, Tandem and Hilokal.

- [ ] **Personal info → Race and ethnicity: uncheck.** Nothing in the app asks
      for it and nothing stores it — the profile holds gender, date of birth,
      country, city and languages. None of the three comparable apps declares
      it. Declaring data we do not collect is as wrong as omitting data we do.
- [ ] **Security practices → "You can request that data be deleted": check.**
      It is implemented — Settings → "Hesabımı sil" hides the account
      immediately and purges it after 30 days, photos included. LangX is
      currently the only one of the four without this line, and the line is
      true.

## 2. Play Data Safety — the new location answers

Nearby (Polyglot) added the app's first location permission, so two answers
that were "no" are now "yes".

- [ ] **Location → Approximate location: collected.**
  - Shared with third parties: **no**
  - Required or optional: **optional** — the user turns it on in Settings or
    from the Nearby tab's prompt; nothing writes it at sign-up or in the
    background
  - Purpose: **App functionality** (only)
  - Processed ephemerally: **no** — it is stored on the profile until the user
    turns it off
- [ ] **Location → Precise location: leave unchecked.** The client asks the OS
      for `Accuracy.Lowest` and the server rounds to two decimals (~1 km)
      before storing, so no precise value is ever written.
- [ ] Everything else on the form stays as it is, except the analytics rows
      in §5 below.

## 3. Apple App Privacy — the same change

- [ ] **Location → Coarse Location: collected.**
  - Linked to the user: **yes**
  - Used for tracking: **no**
  - Purpose: **App Functionality** (only)
- [ ] **Location → Precise Location: leave unchecked.**
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

### Play Data Safety

- [ ] **App activity → App interactions: collected.**
  - Shared with third parties: **no**
  - Required or optional: **optional** — Settings → Privacy → _Share usage
    data_
  - Purpose: **Analytics** (only)
  - Processed ephemerally: **no**
- [ ] **Device or other IDs: collected.** PostHog's own anonymous id before
      sign-in, our account id after. Not shared, optional, purpose Analytics.
- [ ] **App info and performance → Crash logs, Diagnostics: leave unchecked.**
      Error tracking is not enabled in the SDK.

### Apple App Privacy

- [ ] **Usage Data → Product Interaction: collected.** Linked to the user:
      **yes**. Used for tracking: **no**. Purpose: **Analytics** (only).
- [ ] **Identifiers → User ID: collected.** Linked, Analytics, not tracking.
- [ ] **Identifiers → Device ID: collected.** Linked, Analytics, not tracking.
      It is the SDK's random id, not IDFA — there is still no IDFA and no
      `NSUserTrackingUsageDescription`.
- [ ] **Tracking: stays "no".** Nothing is linked to other companies' data and
      nothing goes to a broker.

### The privacy policy

- [ ] It names PostHog and the EU region, says it is optional and where the
      switch is, says message bodies are never sent, and says deletion of
      analytics data is on request until it is automated
      ([`analytics.md`](../analytics.md) → _Deletion_).

## Reference — the rest of the Play form

Unchanged by this pass; listed so a full re-verification does not need a second
document. Every row is "collected, not shared".

| Play category                                 | Ours                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Personal info → Name, Email address           | display name, handle, sign-in email — required                     |
| Personal info → User IDs                      | account id                                                         |
| Personal info → Other info                    | date of birth (18+ gate; only the age is shown), gender, bio, city |
| Location → Approximate location               | optional, see above                                                |
| Photos and videos → Photos                    | avatar and gallery — optional                                      |
| Messages → Other in-app messages              | chat bodies                                                        |
| App activity → App interactions               | screen names and funnel events — optional, see §5                  |
| Device or other IDs                           | PostHog's anonymous id, then the account id — optional, see §5     |
| App info and performance                      | nothing                                                            |
| Financial info                                | nothing — purchase state only, never a card number                 |
| Contacts, Calendar, Health, Microphone, Ad ID | nothing                                                            |

Target audience: **18+**, enforced server-side at profile creation. Do not
declare a Families audience — it contradicts the age gate and changes which
SDKs are permitted.

> **City is collected, and that is all the form asks.** `privacy-data-safety.md`
> describes it as "shown on profile", which is not true today — nothing renders
> `profiles.city` — and there is an approved plan to derive it from location and
> put it behind a privacy toggle. Neither the current gap nor the planned change
> alters any answer above: the form asks what is _collected_, and it is, as an
> optional field. Revisit this note if that work lands, since deriving city from
> location would make it a second consumer of the location permission.
