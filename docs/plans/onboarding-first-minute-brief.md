# Onboarding, the first minute — implementation brief

**One PR.** Everything here ships together, to everyone. There is no A/B test
and no variant flag: at today's volume two arms would report a coin toss, so
this is read before/after in PostHog instead. It has to be live **before the
print campaign starts**, so that the campaign's whole cohort is measured on
the new flow.

The reasoning behind every choice — where the funnel leaks, what was measured,
the three scenarios not being built yet — is in
[`onboarding-funnel-scenarios.md`](onboarding-funnel-scenarios.md) beside this
file. This brief is the buildable subset and stands alone; read the other one
only when a decision here looks arbitrary.

Read `CLAUDE.md` first. The rules that bite hardest in this change: no
user-facing string in a component (`src/i18n/messages/en.ts`, then seven
locales, and a count takes a plural entry), no threshold hard-coded (it goes in
`packages/shared`), no handler touching a collection directly, and comments
explain _why_.

## What is being changed, and why

An email sign-up walks eleven screens, leaves the app twice and types a
password twice before seeing a single person. Five wizard screens ask eleven
questions and give nothing back. The wizard ends on a text screen, and a new
account can go weeks without ever learning that a paid tier exists. This PR
removes three of those screens, gives the last one a job, and adds the counters
that will say whether any of it worked.

Order of work — deliberate, not arbitrary:

1. **A1′** first, because it rests on one assumption that must be confirmed
   before anything is built on it.
2. **The events**, so every screen touched afterwards is written with its event
   already in place.
3. **A3, A4, A2, A5**, then the copy in eight locales.

## 1. A1′ — the verification link lands in the app, signed in

**Today.** `apps/api/src/auth.ts` sets `requireEmailVerification: true` and
`autoSignIn: false`. Sign-up ends on `(auth)/check-email`. The mailed link
points at Better Auth's own verify endpoint, so whatever opens it — the mail
client's browser — is where `autoSignInAfterVerification` puts the session
cookie. The app never sees it. `(auth)/verify-email-success.tsx` therefore
sends the person to `(auth)/sign-in` to type the password a second time.

**After.** The mail carries the app's own page. The app spends the token
itself, so the session lands in the app's own store. Two screens disappear
(`verify-email-success` as a success state, and the second sign-in); the inbox
trip stays.

This is exactly the shape `apps/mobile/app/magic-link.tsx` already has for
sign-in links, and `sendMagicLink` in `apps/api/src/auth.ts` already builds its
own URL rather than forwarding Better Auth's. Copy both.

**Confirm before building.** That Better Auth 1.7's `verifyEmail` sets the
session cookie on the _caller's_ response when `autoSignInAfterVerification` is
on. The magic-link plugin does this and the email-verification docs say the
same, but this item stands on it. Check the installed package's source, or
prove it with one manual sign-up. If it turns out false, stop and say so —
the rest of the PR does not depend on this item.

- `apps/api/src/auth.ts` → `emailVerification.sendVerificationEmail`: build the
  URL from the `token` argument as `webUrl('/verify-email?token=…')` instead of
  passing Better Auth's `url` through to `verificationEmail()`.
- New `apps/mobile/app/verify-email.tsx`, at the root for the reason
  `magic-link.tsx` documents (a signed-in member can tap the link too, and
  `(auth)` is unmounted for them). Native verifies on mount; the web build
  waits for a tap, because link previewers run JavaScript. On success notify
  the session store and `router.replace('/')` — the gate then routes to the
  languages step by itself.
- `apps/mobile/app/(auth)/verify-email-success.tsx` keeps only its failure
  branch.
- The app scheme link is the escape hatch, as `src/lib/magicLink.ts` provides
  for magic links.

**Not in scope:** letting an unverified account browse. `POST /profiles`, the
handle reservation and the availability check all sit behind
`requireVerifiedEmail`, whose comment says an unverified account has no
business claiming a handle or existing in discovery — and turning
`requireEmailVerification` off would reintroduce account enumeration on the
sign-up form, which `onExistingUserSignUp` currently prevents. That is a
product decision, not a refactor, and it is not this PR's.

## 2. The events

All of them go in `apps/mobile/src/lib/analyticsEvents.ts`, which is a closed
union on purpose: it is the file the store privacy forms are answered from. No
new property may carry text a person typed, and
`EVENTS_CARRY_NO_FORBIDDEN_KEYS` must keep compiling.

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

`onboarding_step_completed` is the one that cannot be replaced by `$screen`: a
view of `levels` counts a person going backwards, and counts somebody who
abandoned the screen the same as somebody who finished it.

Where each fires:

| File                                                                  | Change                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/lib/analyticsEvents.test.ts`                         | One case per new event, asserting `sanitizeEventProperties` passes its properties through unchanged. This is the test that catches a property named `handle` or `email`                                 |
| `apps/mobile/src/components/IntroCarousel.tsx`, `(auth)/intro.tsx`    | `onDone` gains `{ slide, skipped }`; the screen tracks it. **Note A3 deletes `(auth)/intro.tsx`** — the carousel keeps the callback for `(app)/intro.tsx`, the Settings replay, which tracks nothing    |
| `apps/mobile/app/(auth)/welcome.tsx`                                  | `welcome_chosen` on all three actions                                                                                                                                                                   |
| `(auth)/sign-up.tsx`, `src/components/SocialAuthButtons.tsx`          | `signup_submitted{method, from_guest}` before the request; the method has to be threaded into the social buttons                                                                                        |
| `apps/mobile/app/_layout.tsx`                                         | `signup_verified{method}` once, on the first identified session after a device flag written at submit; clear the flag there. Simpler alternative if that proves fiddly: fire it from `verify-email.tsx` |
| `apps/mobile/src/lib/requireAccount.ts`                               | `guest_gate_hit{action}` — the six call sites pass their action                                                                                                                                         |
| The wizard steps under `apps/mobile/app/(onboarding)/`                | `onboarding_step_completed` on each Continue. `resumed` means the draft already held that step's answers when the screen mounted                                                                        |
| `(onboarding)/handle.tsx`                                             | `onboarding_completed` gains `method`, `from_guest`, `seconds_since_install`                                                                                                                            |
| `apps/mobile/src/lib/paywall.ts`, `apps/mobile/app/(app)/paywall.tsx` | `openPaywall` takes `source`; every call site passes one; the screen tracks `paywall_dismissed` on close                                                                                                |
| `scripts/insight.mjs`                                                 | `FUNNEL` becomes: Installed → Intro finished → Welcome chosen → Sign-up submitted → each wizard step → Onboarding completed → Message sent → Paywall viewed → Bought. One breakdown by `method`         |
| `docs/analytics.md`                                                   | The event table, which is the document the store forms are answered from                                                                                                                                |

## 3. A3 — one welcome screen instead of an intro plus a welcome

Three slides of copy stand in front of a welcome screen that already shows what
the first slide shows. Two screens describe an exchange before one is offered.

- `apps/mobile/src/lib/authLanding.ts`: `authLandingHref` returns
  `/(auth)/welcome` always. Update `authLanding.test.ts`.
- `apps/mobile/app/(auth)/welcome.tsx`: two one-line rows under the language
  pairs, carrying what slides 2 and 3 said — corrections, and the streak.
- Delete `apps/mobile/app/(auth)/intro.tsx`. `(app)/intro.tsx` and Settings'
  "Show intro again" stay exactly as they are.
- Leave the `introSeen` flag in `localFlags.ts` in place, read by nothing, so
  that an OTA downgrade is harmless.
- `docs/decisions.md` documents the intro-then-welcome shape. Add a **dated
  addendum**; do not rewrite the entry.

## 4. A4 — a guest keeps the intent that sent them to sign up

A guest browsing discovery taps to message somebody and gets a blank sign-up
form. Nothing remembers who they wanted to talk to, so after registering they
land on `done` rather than on that person. That is the strongest motivation the
app ever has, dropped at its peak.

- `apps/mobile/src/lib/localFlags.ts`: a `pendingIntent` key holding
  `{ kind: 'message', toUserId }`. Same shape and lifetime as `pendingReferrer`
  beside it, which already solves this problem for invite links.
- `apps/mobile/src/lib/requireAccount.ts` writes it, taking the intent from the
  caller.
- `apps/mobile/app/(onboarding)/done.tsx` reads it and swaps its primary button
  for "Say hello to {name}" → `/(app)/chat/new?to=…`. Resolve the name through
  the profile cache the profile screen already uses.
- `resetDraft()` in `src/hooks/useOnboardingDraft.ts` clears it, for the reason
  it already clears `pendingReferrer`: it must not attach itself to whoever
  signs up on this device next.
- Only the two message entry points write an intent. A like or a follow does
  not — "you wanted to like Yuki" is not a first action worth resuming.

## 5. A2 — social sign-in above the email form

`apps/mobile/app/(auth)/sign-up.tsx`: `SocialAuthButtons` above the fields, the
"or" divider kept. Google and Apple are the only paths with no trip to an
inbox, so they lead. Sign-in is unchanged. The terms tick stays where it is and
stays required.

## 6. A5 — the paywall at the end of onboarding

`apps/mobile/app/(onboarding)/done.tsx`, after its CTA. Rules, each of which is
either a store rejection reason or a trust cost:

- **Never for a guest.** `identifyForPurchases` is skipped for anonymous
  sessions, so a purchase made there would be orphaned.
- **Only when the store returned a trial.** `getOffers()` carries
  `freeTrialDays`; with none, skip the paywall entirely and go to discover. A
  first-session paywall with no trial is a price tag on an empty room.
- **Once.** A device flag (`onboardingPaywallShown`), written when the screen
  opens, not when it closes.
- **Dismissible in one tap, and the free path is named.** A secondary
  "Continue free" — not "No thanks", not "Maybe later" — that goes to discover.
- **Trial terms beside the price**, which `paywall.trialTerms` already draws
  (App Review 3.1.2). Restore purchases stays in the header.
- Opens as `openPaywall(undefined, '/(onboarding)/done', 'onboarding')`, so
  `paywall_viewed{source:'onboarding'}` separates it from the quota-hit
  exposure, which is unchanged.

**The trial to configure is 7 days**, on App Store Connect, Play and
RevenueCat's web offering. Nothing in the code ships a number — the paywall
reads whatever the store returns — but with no trial configured this section
renders nothing.

## 7. Copy

`onboarding.whatNextBody` shortens to one sentence. New keys for the two
welcome rows, "Say hello to {name}" and "Continue free". English defines them
in `apps/mobile/src/i18n/messages/en.ts`; the other seven locales are typed
against it, so a missing translation does not compile.

## Done looks like

- `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` all
  pass. CI runs exactly these four.
- A real sign-up on a device: the mailed link opens the app, the app is signed
  in when it lands, and the next screen is the languages step. No second
  password.
- A guest who taps "message" on a profile, registers, and finds that person's
  name on the button at the end of the wizard.
- The paywall appears once after `done` when a trial exists, and never for a
  guest.
- PostHog shows the new events within seconds of each action, with
  `EXPO_PUBLIC_POSTHOG_KEY` set.
- `docs/analytics.md` and the `docs/decisions.md` addendum are in the same PR
  as the code they describe.

Ship as one OTA update plus one API deploy.
