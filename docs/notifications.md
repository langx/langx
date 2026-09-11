# Everything this app sends

One page listing every message that leaves LangX — mail and push — with what
triggers it, which switch gates it, and what stops it arriving twice. The
reasoning behind the shape of it is in [`decisions.md`](decisions.md); the
operational side (schedulers, secrets, the campaign warm-up) is in
[`self-host.md`](self-host.md). This is the catalogue.

## The three classes

Everything here is one of three things, and which one it is decides whether
there is a switch, an unsubscribe link, or neither.

| Class             | Asks a preference?         | Unsubscribe?   | Why                                                                                                                                                                                               |
| ----------------- | -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transactional** | no                         | no             | It answers something the person just did, or it is about their money or their account's safety. A switch whose honest label is "do not tell me when somebody signs in as me" is not one to offer. |
| **Notification**  | yes, per kind per channel  | yes, one click | They asked for it by installing the app. `sendNotificationEmail` is the only way one leaves.                                                                                                      |
| **Campaign**      | `promotions` must allow it | yes, one click | A decision somebody makes on a particular day. Queued by hand, dripped by the API.                                                                                                                |

## The eight kinds

`NOTIFICATION_TYPES` in `packages/shared/src/notifications.ts`. Every kind has
two channels and both are real.

| Kind            | Push    | Email  | Covers                                  |
| --------------- | ------- | ------ | --------------------------------------- |
| `messages`      | on      | on     | Chat, and the unread digest             |
| `streak`        | on      | on     | The evening nudge, and the repair offer |
| `badges`        | on      | off    | A badge earned                          |
| `profileVisits` | on      | on     | Who looked at you                       |
| `meetings`      | on      | off    | An hour before a call you agreed to     |
| `social`        | on      | on     | The feed reacting to you                |
| `wallet`        | on      | off    | Tokens arriving                         |
| `promotions`    | **off** | **on** | Marketing, the newsletter, campaigns    |

`promotions.email` defaults **on** since 10 September 2026 — the reversal is
in `decisions.md`. `promotions.push` stays off: nobody asked to be buzzed at
by marketing.

---

## 1. Transactional — no switch, no unsubscribe

| Message                           | Fires on                                          | Channels         | Once because                                |
| --------------------------------- | ------------------------------------------------- | ---------------- | ------------------------------------------- |
| Verify your email                 | sign-up                                           | email            | Better Auth mints the link                  |
| Reset your password               | forgot password                                   | email            | —                                           |
| Sign-in link                      | magic-link request                                | email            | single-use, 15 min                          |
| You already have an account       | sign-up over an existing address                  | email            | —                                           |
| Confirm account deletion          | delete request                                    | email            | token burned on use                         |
| **Welcome to LangX**              | onboarding completes                              | email            | `createProfile` refuses a second profile    |
| **Confirm your email** (reminder) | unverified 24 h after sign-up, never after a week | email            | ledger `verifyReminder:<id>:once`           |
| Bounty paid                       | a report is confirmed                             | email + push     | the ledger's unique `{userId, kind, refId}` |
| Report received / feedback        | somebody reports or writes in                     | email to support | —                                           |

### Security — the same class, and never gated

`modules/security/notify.ts`. Both channels fire, and neither is a fallback
for the other: an attacker holding the phone must not be able to keep the
mail from arriving, and a phone that is off must not cost somebody the
notice. No `List-Unsubscribe` header — it is not a list.

| Message                          | Fires on                                                                       | Once because                                    |
| -------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| **New sign-in to your account**  | any endpoint that created a session, from a device `knownDevices` has not seen | `knownDevices` `<userId>:<fingerprint>`, no TTL |
| **Your password was changed**    | `/change-password`, `/set-password`, `/reset-password`                         | —                                               |
| **A sign-in method was added**   | `/link-social`                                                                 | —                                               |
| **A sign-in method was removed** | `/unlink-account`                                                              | —                                               |

The mail names the device (`Safari on iPhone`, `the LangX app on Android`),
the country the edge reported, and the time **in UTC, labelled** — guessing a
timezone from an IP is how a notice tells somebody in Toronto they signed in
at an hour they were asleep. One button: change the password, which signs
every other device out.

Sign-up is excluded: being told you signed in seconds after creating the
account is noise.

### Billing — money, so also no switch

`modules/billing/notify.ts`, fired from the RevenueCat webhook.

| Message                             | Fires on                                               | Note                                                                  |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| **Your payment did not go through** | `BILLING_ISSUE`                                        | Access is untouched; the store will retry                             |
| **Your plan has ended**             | `EXPIRATION` **and** the tier actually dropped to free | An expiry on a Pro+ subscription whose plain Pro runs on ends nothing |

A renewal that succeeds says nothing — the store already mails a receipt.

---

## 2. Notifications — a switch each, both channels

All of these run on the half-hourly pass in
`modules/notifications/scheduler.ts` unless the trigger says otherwise, and
every one claims a row in `notificationLedger` before it sends.

| Message                                          | Kind            | Channel                       | When                                        | Period key                                      |
| ------------------------------------------------ | --------------- | ----------------------------- | ------------------------------------------- | ----------------------------------------------- |
| A message arrived                                | `messages`      | push                          | on the message                              | — (fan-out)                                     |
| Unread digest                                    | `messages`      | email                         | 8 h–14 d after `lastActiveAt`, waking hours | `lastActiveAt` — one absence, one letter        |
| Streak reminder                                  | `streak`        | push, or email with no device | 20:00 local                                 | local day                                       |
| Badge round-up                                   | `badges`        | push                          | 18:00 local                                 | badge ids                                       |
| Profile visits                                   | `profileVisits` | push daily / email weekly     | 12:00 local / Monday                        | local day / ISO week                            |
| Meeting reminder                                 | `meetings`      | push                          | an hour before                              | message id                                      |
| **Somebody followed you**                        | `social`        | push                          | on the follow                               | one per follower, **ever**                      |
| **A correction, answer or comment on your post** | `social`        | push                          | on the reply                                | one per post per **hour**                       |
| **Your posts' likes**                            | `social`        | push                          | daily batch                                 | UTC day                                         |
| **The day's replies to your posts**              | `social`        | email                         | 19:00 local                                 | local day                                       |
| **Yesterday's pool paid you N tokens**           | `wallet`        | push                          | 09:00 local                                 | pool day                                        |
| **Your hourly gift is ready**                    | `wallet`        | push                          | waking hours                                | UTC day, and only if they have taken one before |

The unread digest carries **faces**: up to three writers, photo fetched from
our own bucket and attached to the mail, initials on a coloured disc when
there is none. Each face links to `app.langx.io/<handle>`.

### The three throttles that matter

- **One push per post per hour.** Three people correcting the same sentence
  within a minute is the good case, not the rare one.
- **Likes are a daily batch, never an event.** A like is the cheapest thing
  anybody can do here.
- **One follow notice per follower, ever.** Unfollowing and following again
  is not news.
- **One digest per local day.** A reply landing after the letter has gone
  waits for tomorrow's — the push already said it.

---

## 3. Promotions — `promotions.email` must allow it

### The nine nudges

`modules/notifications/promotions.ts` — a table walked in **priority order**
for each candidate. The first match is sent, the loop breaks, and
`MARKETING_MIN_GAP_DAYS` (7) keeps the next one a week off. Quiet hours are
the reader's own clock.

| #   | Nudge                                   | Trigger                                               | Kind       |
| --- | --------------------------------------- | ----------------------------------------------------- | ---------- |
| 1   | Add a photo, and people will find you   | no `avatarUrl`, account > 48 h                        | promotions |
| 2   | Your streak broke — repair it           | streak ≥ 3 that lapsed **yesterday**                  | **streak** |
| 3   | People are still practising without you | `lastActiveAt` 7–8 days ago                           | promotions |
| 4   | We will stop writing after this         | `lastActiveAt` 30–31 days ago                         | promotions |
| 5   | Your free week ends in two days         | `periodType: trial`, not renewing, ends within 2 days | promotions |
| 6   | Your plan ended a week ago              | `churnedFrom` 7–8 days ago, still on free             | promotions |
| 7   | You are running into the free limits    | refused 3 times in 3 days, still on free              | promotions |
| 8   | You have N tokens waiting               | balance ≥ 200, nothing spent in a fortnight           | promotions |
| 9   | Invite a friend                         | 14 days old, active, has invited nobody               | promotions |

`periodType` and `churnedFrom` are written from 10 September 2026 onward and
**cannot be backfilled** — so nudges 5 and 6 reach only people whose trial
began, or whose plan ended, after that deploy.

The streak repair sits under the **streak** switch, not promotions: it is
about the streak, and hiding it behind the marketing switch would hide it
from the people it is for.

### The monthly recap

`modules/notifications/newsletter.ts`. "Your **September 2026** on LangX", on
any of the first seven days of a month at 10:00 local, once per reader per
month.

- **Your month** — messages, corrections, tokens, streak. A month somebody
  sat out swaps all four for one sentence.
- **Everybody's month** — new members, messages, corrections. Computed once
  per tick.
- **What shipped** — optional, from `apps/api/src/email/newsletters/YYYY-MM.ts`,
  drafted by a scheduled routine, approved by **merging its pull request**.
  No note, no block; the recap still goes.

### Campaigns

`scripts/send-campaign.ts` **queues**; the API drips. See
`apps/api/campaigns/README.md` for the commands and
[`release-runbook.md`](release-runbook.md) for the rules.

| Source      | Who                                                                       |
| ----------- | ------------------------------------------------------------------------- |
| `consented` | `promotions.email` allows it                                              |
| `v1`        | the pre-created v1 rows **and nobody else** — a population, not a consent |
| `all`       | plus every verified address                                               |
| `v1deleted` | the addresses v1's deleted accounts left in `v1DeletedContacts`           |

`--exclude-returned` drops anybody who has since onboarded. Warm-up ramp:
500 / 1000 / 2000 / 4000 / 8000 a day, 08–20 UTC. `--pause` stops the next
tick.

---

## What stops a message arriving twice

Four mechanisms, and each is in the database rather than in a caller's care.

| Mechanism                                                 | Used by                                               |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `notificationLedger` `_id` = `<job>:<userId>:<periodKey>` | every scheduled pass; insert failing **is** the check |
| `emailCampaigns` unique `{campaignId, userId}`            | campaigns, claimed before each batch                  |
| `knownDevices` `_id` = `<userId>:<fingerprint>`           | the new-device notice                                 |
| `jobRuns` unique `{job, periodKey}`                       | the daily pool, and the campaign drip's per-tick lock |

## What stops a message arriving at all

- **The switch.** `notificationsAllowed(prefs, kind, channel)` — the only
  reader, and it knows all three stored shapes the field has ever had.
- **`emailSuppressions`.** Keyed by address. Written by the unsubscribe route
  when there is no profile to hold the preference, and by Resend's webhook on
  a permanent bounce or a complaint. Read before **every** send, service mail
  included: a bounced address is a dead one.
- **The marketing cap.** `MARKETING_MIN_GAP_DAYS` across campaigns and every
  `promo.*` pass, both channels.
- **Quiet hours.** `NOTIFICATION_EMAIL_LOCAL_HOURS` (09–21) on the reader's
  own clock, for everything promotional.
- **An unverified address.** Nothing is ever sent to one — it may belong to
  somebody else.

---

## 4. The notification centre — the one that does not leave

Everything above leaves the app and is then forgotten. `notificationLedger`
keeps a row so nobody is told twice, but it holds `{_id, sentOn}` and is
unreadable by design, so somebody who missed the push had no way of ever
learning what it said.

The `notifications` collection is the other half: a row per thing that
happened, read by a bell in the Feed header and a screen behind it.

| Kind                                                     | Written where                      | `refId` — what makes it arrive once |
| -------------------------------------------------------- | ---------------------------------- | ----------------------------------- |
| `follow`                                                 | `routes/follows.ts`                | the follower's id                   |
| `postComment` / `postCorrection` / `pronunciationAnswer` | `routes/feed.ts` → `tellTheAuthor` | the reply's own id                  |
| `like`                                                   | `routes/likes.ts`                  | `<targetType>:<targetId>:<actorId>` |
| `badgeEarned`                                            | `notifications/badges.ts`          | the badge id                        |
| `walletPool`                                             | `tokens/pool.ts`, at the payout    | the pool day                        |
| `profileVisits`                                          | `notifications/profileVisits.ts`   | the local day                       |

### The four rules it runs on

- **Per event, where the push is batched — but collapsed into one row.**
  Nothing is dropped: the push sends one an hour and likes go out once a day,
  because a phone buzzing interrupts, while a list somebody chose to open does
  not. Ten comments on one post are ten rows in the collection and **one** row
  on the screen, reading "and 9 others" — ten rows saying the same thing is a
  list nobody can scan. A follow is never collapsed: each is a different
  person, and the row opens that person. No sender, ledger claim or throttle
  changed.

  The grouping happens when the list is **read**, never by keeping a counter on
  a row: a row whose count grew would have to move its `createdAt` to be
  noticed, and a row that moves inside a keyset page makes a cursor skip or
  repeat. The unread count groups identically, so the badge and the list can
  never disagree.

- **Not gated by the switches.** `notificationsAllowed` is never called on this
  path. Those two channels are about what _leaves_; turning off social push is
  a request not to be buzzed, not a request to be blinded. The badge write in
  `badges.ts` sits deliberately **above** the `wantsPush`/`wantsEmail` check,
  and a test pins it there.
- **Unique for ninety days.** `{userId, kind, refId}` is unique and the insert
  failing _is_ the check; `ttl_90d` then bounds it, so refollowing next season
  is news again. That is right for a feed and wrong for a send-ledger — which
  is why these are two collections.
- **No prose on the wire.** The row carries data — an actor, a post, a count —
  and the app composes the sentence from `messages/en.ts`, so a count reaches a
  plural entry in the reader's own language.
- **Reading is not marking; acting is.** Opening the centre changes nothing.
  Tapping a row reads that row — and the whole pile behind it, since the row
  was already speaking for all of it — so the count falls as things are dealt
  with, which is what makes it mean anything. A **Mark all read** button in the
  header clears the rest, and is offered only when there is something to clear.

  The middle option, marking everything the moment the screen opens, was tried
  and removed: somebody who came to check one name had then dealt with the
  other eleven whether they meant to or not.

### What it does not carry

- **Chat messages.** The Chats tab, its per-row counts and its badge are
  already that inbox.
- **The hourly gift.** "Your gift is ready" is a statement about a button being
  available, not a record of something that happened; a row saying it was ready
  three days ago is noise. The wallet screen draws the cooldown from
  `giftReadyAt`.
- **Who viewed you.** The visit row is a **count**, with no actor: identities
  are the paid half of that feature, and a row carrying a name and a face would
  hand them out to everyone. The tap lands on `/viewers`, which draws its own
  line.

Badges and visits are recorded inside their existing passes because neither has
an event to hang off — a badge is derived rather than stored, and a visit row
per viewer would be both spam and a paywall leak. Both therefore inherit their
pass's hour: a badge earned at breakfast appears that evening, a visit at 13:00
appears at noon the next day.

---

## Where a tapped push lands

`apps/mobile/src/lib/notificationRoute.ts`.

| Kind                         | Opens                                     |
| ---------------------------- | ----------------------------------------- |
| `message`, `meetingReminder` | the conversation, or `/chats`             |
| `streakReminder`             | `/chats`                                  |
| `badgeEarned`                | `/me`                                     |
| `profileVisits`              | `/viewers`                                |
| `social`                     | the post, the person, or `/notifications` |
| `wallet`, `bountyPaid`       | `/wallet`                                 |
| `billing`                    | `/settings/plan`                          |
| `security`                   | `/settings/password`                      |
| `promotion`                  | `/discover`                               |

## Not built

Written down so the next person does not have to re-derive them.

| Scenario                                 | Blocked on                                      |
| ---------------------------------------- | ----------------------------------------------- |
| Editor's note as a standalone broadcast  | the monthly note covers it                      |
| Chat messages in the notification centre | the Chats tab is already that inbox             |
| Backfilled history in the centre         | nothing — it starts empty at deploy, on purpose |

## Every message is one format

One shell, one button, one footer — a verification link and a campaign read
as the same sender. Every image travels **inside** the mail as a `cid:`
attachment (`src/email/inlineAssets.ts`), because Outlook and a
remote-content-off Apple Mail do not fetch remote images and Gmail strips
`data:` URIs. Regenerate with `scripts/inline-email-assets.ts` after changing
one.

Nothing user-facing is written in a template. Every string is a key in
`apps/api/src/i18n/messages/en.ts` and the seven locales typed against it.
