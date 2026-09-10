# Onboarding — where the funnel leaks, and four scenarios to close it

Written on 10 September 2026. **Analysis and proposals only; nothing here is
built.** Behic's brief: analytics show people being lost in onboarding; make
the first minute friendlier, use motion, think like a funnel, and end with the
paywall — this is where a potential customer is hooked.

The current funnel (`scripts/insight.mjs`) has four steps: _Installed →
Finished onboarding → Sent a message → Saw the paywall → Bought_. Everything
between the first two steps is a black box. This plan opens the box by reading
the code, names the likely leaks in order, says how to measure each one before
believing it, and then lays out four onboarding scenarios that can be compared
on the same numbers.

## 1. The flow as the code walks it today

Cold start, no session, first launch:

| #   | Screen                            | Asks                                              | Gives                                    |
| --- | --------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| 0   | `AppSplash`                       | —                                                 | logo, ≥700 ms                            |
| 1   | `(auth)/intro` — 3 slides         | 3 taps (or Skip)                                  | what the app is, in words                |
| 2   | `(auth)/welcome`                  | one of three choices                              | 3 language-pair pills, animated in       |
| 3a  | `(auth)/sign-up`                  | email, password, terms tick — or Google/Apple     | —                                        |
| 3b  | `(auth)/check-email`              | **leave the app**, open mail, tap link            | —                                        |
| 3c  | `(auth)/verify-email-success`     | tap "Sign in"                                     | —                                        |
| 3d  | `(auth)/sign-in`                  | **email and password again**                      | —                                        |
| 4   | `(onboarding)/languages` — 2 tabs | native language, then learning language           | —                                        |
| 5   | `(onboarding)/levels`             | a level per learning language, no default         | —                                        |
| 6   | `(onboarding)/about-you`          | display name, **birth date**, **gender** (+ note) | —                                        |
| 7   | `(onboarding)/handle`             | a username, availability check, invite code       | `POST /profiles`, `onboarding_completed` |
| 8   | `(onboarding)/photo`              | photo and bio, both skippable                     | the drawn face                           |
| 9   | `(onboarding)/done`               | notification permission                           | a check mark, three sentences            |
| 10  | `(app)/(tabs)/discover`           | —                                                 | the product                              |

The guest branch ("Look around first") is 2 → 4 → 5 → 10, with every write
gated by `requireAccount`, which pushes `(auth)/sign-up` and then runs 3a–3d
before landing on step 6 (the languages travel in the device draft).

Counted from the store listing: an email sign-up needs **eleven screens, two
context switches out of the app and one password typed twice** before seeing a
single person. Google/Apple sign-up skips 3b–3d. A guest sees people after
three screens but hits a form the moment they try to act.

Steps 4–8 ask eleven questions and give nothing back until step 9, and step 9
gives text. The 250-token signup bonus (`TOKEN_RULES.signupBonus`, granted in
`createProfile`) is never mentioned to the person who just received it.

## 2. Where people are probably lost, in order

Ranked by how much of the flow each one blocks, not by certainty. Each comes
with the measurement that would confirm it (§3), because the repository holds
no numbers and this plan must not invent any.

### L1. Email verification is a wall, and the wall has a second wall behind it

`requireEmailVerification: true` with `autoSignIn: false` means sign-up ends
with "go to your inbox". The link opens the **system browser** — Better Auth's
`autoSignInAfterVerification` sets a cookie there, not in the app — so
`verify-email-success` sends them to `sign-in` to type the password again. Two
exits from the app and one re-entry, on a first launch, before any value.

The referral programme already only pays for a _verified_ invitee, so
verification can stay a requirement for **earning** without being a
requirement for **seeing**.

Confirm with: `$screen` views of `(auth)/check-email` against `(onboarding)/languages`
for the same anonymous ids, and `signup_submitted{method}` split by
email vs Google/Apple. If the social share is high and the email path leaks
most, L1 is real and the fix is §4.1.

### L2. The intro is a toll booth in front of the value

Three slides of copy (each body ~30 words), before the welcome screen, which
itself shows three pills and a paragraph. Two screens describe an exchange
before one is offered. `introSeen` is a device flag, so it plays once — but
once is the launch that decides whether there is a second.

Confirm with: `intro_finished{slide, skipped}` — how many skip, and at which
slide.

### L3. The guest path loses the intent it was built to capture

A guest browses discovery, finds somebody, taps to message — and gets a blank
sign-up form. Nothing remembers who they wanted to talk to. After 3a–3d and
steps 6–9 they land on `done`, not on that person. The single strongest
motivation the app ever has is dropped on the floor at the exact moment it
peaks.

Confirm with: `guest_gate_hit{action}` and whether the same id reaches
`onboarding_completed` within the hour.

### L4. Five screens of questions with no reward in between

Nothing shows people, counts or faces until step 10. The birth date and the
gender question (with its irreversible-consequence note) arrive at step 6, when
the app has still shown nothing. The username step adds an availability check
and a text field with rules.

Confirm with: `onboarding_step_completed{step}` per step — the step with the
biggest gap to the one before it is where the reward is missing.

### L5. `done` is a text screen, and the paywall is never part of onboarding

The wizard ends with a check mark, three sentences and a notification prompt.
The paywall is reachable only from Me and from gate hits (`nearby`, quota,
filters), so a new account that never hits 5 initiations in a day never sees
what Fluent is. That is the thing the brief asks for and the thing the flow
does not do.

Confirm with: `paywall_viewed` split by a new `source` property — today it has
`feature` and `tier`, and a `from` route param that is not sent.

### L6. Motion is used to decorate, not to reward

`welcome`'s pills stagger in, `IntroCarousel` rises, `done` pops a check. All
three are entrances. Nothing responds to the person: picking a language does
not change the screen, finishing a step does not celebrate, the token grant
does not count up. `react-native-reanimated` 4.5 is installed and unused here;
the launch path deliberately uses `Animated`, which is enough for everything in
§5.

## 3. Instrument first — one week before any redesign

Everything below in one PR, because a redesign shipped without it cannot be
judged. All of it lands in `analyticsEvents.ts` (the closed union), and
`scripts/insight.mjs` grows the steps. No new property carries text a person
typed.

| Event                       | Properties                                                                             | Fires                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `intro_finished`            | `slide` (0–2), `skipped`                                                               | leaving the carousel, either way                       |
| `welcome_chosen`            | `choice`: `browse` \| `create` \| `sign_in`                                            | the welcome screen's three buttons                     |
| `signup_submitted`          | `method`: `email` \| `google` \| `apple`; `from_guest`                                 | the request is sent                                    |
| `signup_verified`           | `method`                                                                               | the first session after verification (email path only) |
| `guest_gate_hit`            | `action`: `message` \| `like` \| `follow` \| `post` \| `other`                         | `requireAccount` refuses                               |
| `onboarding_step_completed` | `step` (from `ONBOARDING_STEPS`), `guest`, `resumed`                                   | each Continue                                          |
| `onboarding_completed`      | existing, plus `method`, `from_guest`, `seconds_since_install`                         | unchanged trigger                                      |
| `paywall_viewed`            | existing, plus `source`: `onboarding` \| `gate` \| `me` \| `deeplink` \| `first_reply` | unchanged trigger                                      |
| `paywall_dismissed`         | `source`, `seconds_open`                                                               | the X, back, or "Continue free"                        |

`onboarding_step_completed` is what `$screen` cannot be: a view of `levels`
counts a person going back as well as forward, and counts nobody who left the
screen unfinished any differently from somebody who finished it.

Funnel in `insight.mjs` becomes: Installed → Intro finished → Welcome chosen →
Sign-up submitted → Onboarding step 1 → … → step 5 → Onboarding completed →
Message sent → Paywall viewed → Bought. Plus one breakdown by `method`, and
one by `onboarding_variant` (see §6).

## 4. Scenarios

Each scenario is an end-to-end flow. They are not exclusive — A is the floor
the others stand on — but each can be measured on its own. Effort is S/M/L in
the sense `design-handoff-follow-ups.md` used.

### Scenario A — "The short road": remove the walls, change no screen

The hypothesis: most of the loss is friction, not persuasion. Fix the four
mechanical leaks and measure before drawing anything.

**A1. Sign-up signs you in.** `autoSignIn: true`. Verification stays required
and `sendOnSignUp` stays on, but the profile can be created and discovery
browsed unverified; the first _send_ is what verification gates, with a banner
in the thread ("Verify your email to send — we sent the link to …"). The
referral award, the token grant and campaigns already key on verification and
need no change. What changes for review: none — Apple and Google do not require
email verification before use.

If Behic wants verification to stay a hard gate, the fallback is **A1′**: the
verification mail carries the app's own page, the way `magic-link.tsx` already
does for sign-in links, so the app spends the token and the session lands in
the app's store rather than the browser's. Then `verify-email-success` opens
_signed in_ and goes straight to the languages step. This removes 3c and 3d
without changing the policy.

**A2. Social first.** On sign-up, Google/Apple above the email form, not below
it — they are the only path with zero context switches. Keep email, keep the
terms tick (it is required).

**A3. Intro and welcome become one screen.** The welcome screen already shows
what the intro's first slide shows. Fold slides 2 and 3 into two short lines
under the pills ("Correct and be corrected · Show up and it adds up"), keep
the carousel only behind Settings → "Show intro again". One screen fewer for
everybody.

**A4. Guests keep their intent.** `requireAccount` writes
`FLAG_KEYS.pendingIntent = { kind: 'message', toUserId }` before pushing
sign-up. `done` reads it and the primary button becomes "Say hello to {name}"
→ `/(app)/chat/new?to=…`. The flag clears when spent or on `resetDraft`. Same
mechanism `pendingReferrer` uses today.

**A5. The paywall at the end, dismissible.** §5 below. Fires from `done`.

Motion: none new. Copy: `whatNextBody` shortened to one sentence.

Measure: `signup_submitted → onboarding_completed` by `method`; `guest_gate_hit
→ onboarding_completed`; time from install to first `message_sent`.

Effort: **M** (A1 is one auth option plus one banner; A4 is a flag and a
button; A3 is deleting). Risk: A1 changes what an unverified account can do —
browse and be seen — so the sweep that deletes unverified accounts (if any)
must not delete one that has a profile.

### Scenario B — "Show the goods": the questions become the intro

The hypothesis: people leave because they are asked before they are shown. So
the first two onboarding questions _are_ the intro, and the answer to them is
the first thing worth seeing.

Flow:

1. **Splash → "What are you learning?"** Eight chips of the most-learned
   languages (from `GET /public/stats`, which already ranks them), each in its
   own script, plus "More…" opening the full picker. One tap.
2. **"What do you speak?"** The same, ranked by most-spoken, the learning
   language disabled. One tap.
3. **The preview.** The exchange pill the two taps just made — "Türkçe ↔
   English" — settles into the top of the screen (the chips fly into it), and
   under it: "**1,240** people speak English and are learning Turkish. **37**
   were here today." Then a row of six faces with first name, level bars and
   country flag, blurred beyond the third for a guest. Primary: "Say hello" →
   sign-up with the intent captured (A4). Secondary: "Look around first" →
   guest discovery, as today.
4. After the account exists: levels → about-you → handle → photo → done →
   paywall. The languages are already in the draft, exactly like today's guest
   path.

Why this is safe to show unauthenticated: the guest discover list already
shows the same cards to anyone who taps "Look around", and the counts are the
same kind `insight.langx.io` publishes. New API: one route,
`GET /public/discovery/preview?native=&learning=` returning `{ count, today,
people: PublicProfileCard[6] }` through the discovery repository (block- and
guest-filtered, no ids that are not already public). Cached one minute.

If a pair has fewer than, say, 20 people, the preview says so honestly and
leads with the faces rather than the number — a small count next to a
sign-up button reads as a dead app, the same reason `decisions.md` keeps the
dashboard private. The threshold is config in `packages/shared`.

Motion: the chip-to-pill flight is the one animation that carries meaning
(your choice became your search); the count rolls up from 0; faces deal in
with the stagger `welcome.tsx` already has.

Copy: two questions and one sentence. No paragraphs before step 4.

Measure: `onboarding_step_completed{step:'languages'}` rate from install
(was: after sign-up, now: before); `welcome_chosen` → `signup_submitted`
conversion with the preview in view vs without.

Effort: **L** (one public endpoint, two new screens, `index.tsx` gate learns a
fourth state — "languages picked, no session", which is what
`GUEST_ONBOARDING_STEPS` already models). Risk: showing people to a stranger
raises the bar on the guest sweep and on what a card exposes — today's guest
discover sets that bar and this must not go past it.

### Scenario C — "Mission: first message": the wizard ends with a person

The hypothesis: an account that never sends a first message never comes back
(`done.tsx` says so in its own comment). So every screen after the profile
exists is about one thing: the first hello, within the first session.

Flow, after `handle` (steps 1–4 unchanged, or B's version):

1. **Photo step gets a reason.** The drawn face is "drawn" — the avatar's
   strokes animate in over half a second — with the line "People with a photo
   get replies 3× as often" _only if_ the number is measured (a
   `profileViews`-to-reply query the API can answer; until then the line stays
   the current one). Photo optional, as today.
2. **Done becomes "Three people for you".** Instead of a paragraph: the token
   counter rolls 0 → 250 ("you start with 250 tokens; a first message earns
   more"), and under it three cards from discovery — best mutual fit, online
   most recently, with a "Say hello" that opens `chat/new` with an **opener
   already in the composer** in the partner's language ("Merhaba! I'm learning
   Turkish, you're learning English — want to practise together?" — from
   `en.ts`, translated per locale, never machine-translated). The notification
   priming panel moves under the cards, worded as "know when they reply".
3. **The paywall waits for the first reply.** Not at `done`: at the first
   inbound message from a partner, the thread shows a one-line card — "Your
   first reply. Fluent gives you unlimited new chats, 30 days free" — that
   opens the paywall with `source: 'first_reply'`. `done` carries only a quiet
   pill: "30 days of Fluent free · later".

Motion: the counter, the drawn face, cards dealing in. The check mark stays.

Copy: `whatNextBody` goes; the three cards are the "what next".

Measure: `onboarding_completed → message_sent` within 10 minutes; `message_sent
→ first inbound` within 24 h; `paywall_viewed{source:'first_reply'}` → purchase
vs `source:'onboarding'`.

Effort: **L** for the cards (a `GET /discovery?limit=3` the tab already makes,
plus the opener copy in eight locales), **S** for the counter, **M** for the
first-reply card (one listener on the socket's `message:new`, once per account,
flag on the device). Risk: the opener must be clearly editable and clearly
_theirs_ — a wall of identical openers in partners' inboxes is a spam pattern,
so it goes into the composer, not out of it.

### Scenario D — "The loop": invite-personalised entry and the day-0 sequence

The hypothesis: the best first minute is the one somebody you know set up for
you. This layers on A, B or C; it does not replace them.

1. **A link is a welcome.** `pendingReferrer` is already captured before there
   is an account. The welcome screen reads it and opens with the inviter: their
   face, "Ahmet invited you. He speaks Turkish and is learning English." The
   first exchange pill is the _inverse_ of the inviter's pair, pre-selected —
   one tap confirms it, one tap changes it. Referral code field on the handle
   step stays as the fallback.
2. **The welcome pack is shown, not just granted.** `done` says what the
   invitee got (`TOKEN_RULES.referral.inviteeTotal`) and what sending the
   first message does for the inviter — reciprocity is a reason to write.
3. **Day-0 mail and push.** The campaign queue (`campaignQueue.ts`, Resend) and
   the notification matrix already exist. A three-step sequence for accounts
   with no `message_sent` yet: +2 h "Three people who fit you" (faces, deep
   link to `chat/new`), +1 d "Your streak starts with one message", +3 d the
   trial, once, with the real trial length from the store. Nothing counts down
   that is not real; no "offer ends" copy.
4. **Re-exposure of the paywall** on the quota hit stays exactly as it is —
   that is the one moment the pitch is an answer to a question the person just
   asked.

Motion: the inviter's face arriving before the wordmark.

Measure: `onboarding_completed{referred:true}` → `message_sent` vs
unreferred; campaign step → open → `message_sent` (Resend gives opens; the
deep link would carry a `src` param that `notificationRoute.ts` does not read
yet — one more property on `message_sent`).

Effort: **M** for 1–2 (all data exists), **M** for 3 (three templates in eight
locales, one audience rule). Risk: none new on the wire — the sequence sends
to people who consented to product mail, which the matrix already enforces.

## 5. The paywall at the end of onboarding — rules before variants

Whatever scenario ships, the paywall that ends it obeys these, because every
one of them is a rejection reason or a trust cost:

- **Never for a guest.** `requireAccount` already guards buying; the screen
  itself must not open for an anonymous session (`identifyForPurchases` is
  skipped for guests, so a purchase there would be orphaned).
- **Only when there is a trial to offer.** `getOffers()` returns
  `freeTrialDays`; if the store returns none, the onboarding paywall does not
  show at all and the person goes to discover. A first-session paywall without
  a free trial is a price tag on an empty room.
- **Dismissible in one tap, with the free path named.** The X stays; the
  secondary button reads "Continue free" — not "No thanks", not "Maybe later".
  The person must know the app works without it, because it does.
- **Trial terms beside the price**, as `paywall.trialTerms` already draws
  them (App Review 3.1.2). Restore purchases stays in the header.
- **Once.** A device flag (`onboardingPaywallShown`) so a cold start after
  `done` does not show it twice, and the quota-hit paywall remains the second
  exposure.
- **Tracked**: `paywall_viewed{source:'onboarding'}` and `paywall_dismissed`.

Three placements to compare, one per variant (§6):

| Variant | When                                                    | Copy lead                                                       |
| ------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| P1      | Full screen, immediately after `done`'s CTA             | "Start with 30 days of Fluent free" — the trial is the headline |
| P2      | A card on `done`, full paywall only on tap              | "30 days free · unlimited new chats" under the primary CTA      |
| P3      | Value-first: after the first inbound reply (Scenario C) | "Your first reply. Keep going without limits — 30 days free"    |

P1 will show the most paywalls and the worst conversion _per view_; P3 the
fewest and the best. The number that decides is **purchases per onboarding
completed**, per variant, at 30 days — and its shadow, `message_sent` within
the first session, which P1 can hurt by putting a screen between `done` and
the first hello.

## 6. How to compare them without PostHog flags

`analytics.ts` turns off feature flags and remote config on purpose (a request
on boot for an answer nothing reads). Two ways to bucket that do not turn them
on:

- **Server-side**: `GET /app-config` (already fetched at boot for the auth
  providers) gains `onboardingVariant: 'a' | 'b' | 'c'`, decided per anonymous
  device id hash. One switch to change the split, nothing shipped to change
  it.
- **Client-side**: a stable hash of the analytics anonymous id, modulo the
  variant count, stored on the device the first time it is drawn.

Either way the variant goes on every event as a property
(`onboarding_variant`) — a property, not a person field, so the breakdown in
`insight.mjs` is one line.

## 7. Recommendation and order

1. **§3 instrumentation now**, alone, one PR. Read it for a week. If the email
   path leaks as badly as L1 predicts, the rest of the order is confirmed; if
   it does not, B moves up.
2. **Scenario A**, all five items. It removes screens and adds none, and every
   item traces to a leak in §2. Ship it to everyone — there is no variant of
   "fewer walls" worth holding back as a control.
3. **Scenario B** as the first variant against A. It is the one genuinely
   different hypothesis (show before asking) and the one with a new endpoint.
4. **Scenario C's `done`** — cards and counter — as the second variant, with
   **P3** as its paywall against A's **P1**.
5. **Scenario D** on top of whichever wins, because it is mostly copy,
   templates and one welcome-screen branch.

Motion, throughout: only where it carries meaning (a choice becoming a search,
a grant being counted, a face being drawn). The launch path stays on
`Animated`, per `AppSplash`'s reasoning; Reanimated is fine after `done`.

## 8. Questions for Behic

1. **Verification policy.** A1 (browse unverified, verify to send) or A1′
   (keep the gate, land the link in the app)? A1 is the bigger win and the
   bigger policy change.
2. **Showing people before sign-up (B).** Today's guest already sees them
   after two taps; B moves it to zero taps. Fine, or is the guest step the
   line?
3. **The onboarding paywall.** P1 (full screen at `done`) is what the brief
   asks for. Is P3 (after the first reply) acceptable as the variant to test
   against it, or must every variant show the paywall at `done`?
4. **The "3× replies" line** in C — only with a measured number. Worth the
   query, or drop the claim?
5. **Trial length** — is a 30-day trial configured on both stores and the
   web? The whole of §5 assumes the store returns one.
