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
| **Notification**  | yes, per kind per channel  | yes, one click | They asked for it by installing the app. Push leaves when it happens; **mail leaves once a day**, as one digest — see below.                                                                      |
| **Campaign**      | `promotions` must allow it | yes, one click | A decision somebody makes on a particular day. Queued by hand, dripped by the API.                                                                                                                |

### One mail a day

Every notification email is a **section of one letter**, sent at 19:00 on the
reader's own clock, and only when something is actually pending. Two rules make
that true rather than aspirational:

- **Nothing pending, nothing sent.** A section is either a _trigger_ —
  something happened — or a _passenger_, which rides along in a mail that is
  going anyway and may never summon one. The suggestions are a passenger, and
  so is anything a push has already delivered to a phone.
- **Read is read, whichever screen read it.** The four sections that also have
  a row in the notification centre ask it before they claim to be news, and a
  pile with nothing unread left in it is a passenger for the same reason a
  push already sent is — see _Reading counts_ below.
- **Marketing runs an hour later and stands down.** The nine nudges and the
  monthly recap moved to 20:00 local, and both skip anybody whose digest has
  already gone out today.

Security and transactional mail sit outside all of this: they answer something
that just happened, and are never batched or held back.

The assembler is `modules/notifications/digest.ts`; each section is built by
the module that owns its subject.

## The eight kinds

`NOTIFICATION_TYPES` in `packages/shared/src/notifications.ts`. Every kind has
two channels and both are real.

| Kind            | Push    | Email   | Covers                                                                                                     |
| --------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `messages`      | on      | on      | Chat, and the unread section                                                                               |
| `streak`        | on      | on      | The evening nudge, and the repair offer                                                                    |
| `badges`        | on      | on      | A badge earned                                                                                             |
| `profileVisits` | on      | on      | Who looked at you                                                                                          |
| `meetings`      | on      | on      | Push: an hour before. Mail: what tomorrow's diary holds                                                    |
| `social`        | on      | on      | The feed reacting to you                                                                                   |
| `wallet`        | on      | on      | Tokens arriving                                                                                            |
| `promotions`    | **off** | **on**  | Marketing, the newsletter, campaigns, and the suggestions                                                  |
| `echo`          | on      | **off** | Cards due in Echo. The only service kind with mail off — the 19:00 digest is already a letter at that hour |

`promotions.email` defaults **on** since 10 September 2026 — the reversal is
in `decisions.md`. `promotions.push` stays off: nobody asked to be buzzed at
by marketing.

`badges`, `meetings` and `wallet` email moved from off to on when the digest
landed. What kept them off was never the content — it was that none of them is
worth _a letter_. A paragraph in one that was going out anyway costs no
envelope, so the objection went away with the envelopes.

An email switch now decides whether a kind gets a **paragraph**, not whether it
gets a message of its own. Turn them all off and no digest is sent at all —
which is also what the footer's one-click unsubscribe does, since a letter
carrying every kind cannot honestly offer to stop one of them.

---

## 1. Transactional — no switch, no unsubscribe

| Message                            | Fires on                                          | Channels                      | Once because                                    |
| ---------------------------------- | ------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| Verify your email                  | sign-up                                           | email                         | Better Auth mints the link                      |
| Reset your password                | forgot password                                   | email                         | —                                               |
| Sign-in link                       | magic-link request                                | email                         | single-use, 15 min                              |
| You already have an account        | sign-up over an existing address                  | email                         | —                                               |
| Confirm account deletion           | delete request                                    | email                         | token burned on use                             |
| **Welcome to LangX**               | onboarding completes                              | email                         | `createProfile` refuses a second profile        |
| **Confirm your email** (reminder)  | unverified 24 h after sign-up, never after a week | email                         | ledger `verifyReminder:<id>:once`               |
| **Finish your profile** (reminder) | signed up, no profile, 24 h–7 days old            | email                         | ledger `onboardingReminder:<id>:once`           |
| Bounty paid                        | a report is confirmed                             | @langx message + push + email | the ledger's unique `{userId, kind, refId}`     |
| **Thanks for a report**            | an operator rewards whoever reported somebody     | @langx message + push         | the ledger's unique `{userId, kind, refId}`     |
| **The v1 lifetime gift**           | a restore grants a lifetime tier                  | @langx message + push + email | ledger `lifetimeGift:<id>:once`                 |
| **Welcome back from v1**           | first session on a `precreatedFromV1` row         | @langx message                | `sender_client_id_unique` on `welcomeback:<id>` |
| Report received / feedback         | somebody reports or writes in                     | email to support              | —                                               |

The lifetime gift and the bounty receipt are the two transactional messages
that also arrive as a **message in the app**: news with no action attached,
which a screen cannot hold onto and a thread can. The receipt says in the
thread exactly what its mail says, and its push still opens the wallet, where
the number is. The gift's push is the only one in this table that opens a
conversation rather than a screen, because there the letter is the news: it
quotes what they finished v1 with, what converted at `legacyTokenDivisor`, and
the balance as it stands when the letter is written — three numbers from three
sources, which is why `lifetimeGiftNotice.ts` reads them itself rather than
being handed them.

The welcome-back is the third message in the app here, and the only line in
this table with **no push at all**. Two reasons, and either alone would be
enough. It is sent from `session.create.after`, which runs on every sign-in and
not only the first — `deliverOfficialMessage` answers a repeated `clientId`
with the message it already wrote, so a fan-out would push the same greeting
forever, and a ledger claim would not stop it because those rows expire after
thirty days. And the badge it is about pushes that evening anyway: two knocks
for one piece of news is one too many.

Whoever earned a rung and has **not** come back is not in this table at all:
there is nothing to notify an account nobody has opened. The same goes for the
welcome-back — a `precreatedFromV1` row nobody has ever signed into has no
languages to be written to in. That population's channel is the email
win-back, `audiencePlan(db, 'v1')`.

**Finish your profile** waits on the clock rather than on an event, because
the event it waits for is one that never came: a `user` row is written at
sign-in and a `profiles` row when the wizard ends, so somebody who stopped in
between has an address and no profile, and an absence has nothing to fire on.
Consent lives on the profile too, which is why this sits in this table rather
than under promotions — there is no switch to respect and no consent to have,
so what goes out has to be the service message it claims to be: one letter
about the account they opened themselves. The ledger's `once` key is what makes
"never a second one" true rather than intended.

It splits in two on `emailVerified`: an unverified address cannot sign in at
all, so telling that person to finish their profile would point them at a wall
the server raises on purpose.

Bounded at **both** ends. The floor is a day, so nobody who is mid-wizard hears
from us; the ceiling is a week, so switching the pass on does not write to every
abandoned sign-up there has ever been. Catching up on a backlog outside that
window is a decision somebody makes once, and
`scripts/send-onboarding-reminder.ts` is where it is made — the same cohort and
the same two letters, with no upper bound and nothing sent until `--confirm`.
The two share one copy of the letters, in `email/onboardingReminderLetters.ts`:
the pass runs from `dist/` and cannot read a file under `scripts/`.

It is the only mail here that is not translated. `localeFor` answers English for
everybody in this cohort — it returns `null` when there is no profile yet, and
having no profile is what defines them — so eight locales would be sixteen
translations nothing could select.

**Thanks for a report** is the bounty receipt for a report about a person
rather than a bug — `moderation/reward.ts`, pressed from the report's screen in
the panel — and it has no email. Nobody files a report expecting tokens, so it
is a thank-you rather than a payment somebody is waiting to hear about, and the
thread is the durable record either way. Its push carries `bountyPaid`, which
every installed app already opens on the wallet. Neither says what was decided:
that belongs to the person the report was about, as the reporter's name is
kept from them.

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

| Message                             | Fires on                                                                   | Note                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Your payment did not go through** | `BILLING_ISSUE`, unless the period is already over                         | Access is untouched; the store will retry                             |
| **Your plan has ended**             | Half an hour after the fall, if the account is still free — `planEnded.ts` | An expiry on a Pro+ subscription whose plain Pro runs on ends nothing |

A renewal that succeeds says nothing — the store already mails a receipt.

Two things this deliberately does not do, both learned on 12 September 2026,
when an account was told twice that it had lost a subscription it still had:

- **The expiry letter waits half an hour.** The entitlement drops to free the
  moment RevenueCat says so, but a store retrying a card sends `EXPIRATION` and
  then, minutes later, the `RENEWAL` that undoes it — seven minutes, that day.
  So the webhook records `churnedFrom` and says nothing; `runPlanEndedPass`, on
  the half-hourly timer, looks again and writes only to accounts still free.
  That is also what keeps the Pro+-lapsing-onto-Pro case quiet, without a rule
  of its own.
- **A `BILLING_ISSUE` whose period has already ended says nothing.** A store
  that has given up sends both events together — twenty-four milliseconds
  apart, that day — and "the store will retry" is then simply false.

And nothing at all is said about a **sandbox or TestFlight** event: those move
the entitlement so a tester can see the paid app, and write no `churnedFrom`,
send no mail and no push. None of it is anybody's money.

---

## 2. Notifications — a switch each, two very different channels

All of these run on the half-hourly pass in
`modules/notifications/scheduler.ts` unless the trigger says otherwise, and
every one claims a row in `notificationLedger` before it sends.

**Push, the moment it happens:**

| Message                                          | Kind            | When           | Period key                                        |
| ------------------------------------------------ | --------------- | -------------- | ------------------------------------------------- |
| A message arrived                                | `messages`      | on the message | — (fan-out)                                       |
| Streak reminder — only while still savable today | `streak`        | 20:00 local    | local day                                         |
| Badge round-up                                   | `badges`        | 18:00 local    | badge ids                                         |
| Profile visits                                   | `profileVisits` | 12:00 local    | local day                                         |
| Meeting reminder                                 | `meetings`      | an hour before | message id                                        |
| **Somebody followed you**                        | `social`        | on the follow  | one per follower, **ever**                        |
| **A correction, answer or comment on your post** | `social`        | on the reply   | one per post per **hour**                         |
| **Your posts' likes**                            | `social`        | daily batch    | UTC day, and not if the bell's rows are read      |
| **Yesterday's pool paid you N tokens**           | `wallet`        | 09:00 local    | pool day, and not if the bell's row is read       |
| **Your hourly gift is ready**                    | `wallet`        | waking hours   | UTC day, and only if they have taken one before   |
| **Cards are due in Echo**                        | `echo`          | 19:00 local    | local day, and only if nothing was reviewed today |

**Email, all of it in one letter at 19:00 local.** The order is the order in
the mail, and the first section that survives gives the letter its subject —
so it runs from what cannot wait to what could have waited a fortnight. A
_passenger_ never causes the mail to be sent; it is only ever included in one
that was going anyway.

| Section                            | Kind            | Trigger?                | Period key                               |
| ---------------------------------- | --------------- | ----------------------- | ---------------------------------------- |
| Unread messages, with faces        | `messages`      | yes                     | `lastActiveAt` — one absence, one saying |
| Your streak breaks tonight         | `streak`        | no push device, savable | local day                                |
| Tomorrow's calls                   | `meetings`      | yes                     | tomorrow's local day                     |
| The day's replies to your posts    | `social`        | unless read in the app  | local day                                |
| Badges earned                      | `badges`        | no push, and unread     | local day                                |
| Yesterday's pool paid you N tokens | `wallet`        | no push device, unread  | pool day                                 |
| Who looked at you                  | `profileVisits` | Mondays, unless read    | ISO week                                 |
| People you could practise with     | `promotions`    | **no — passenger**      | fortnight                                |

Two of those sections say something the phone has already said, and that is
what the trigger column is for: they are worth a line in a letter that is
going out, and never worth one of their own. The hourly gift is in neither
table — a button becoming available is not something that happened.

### Reading counts

The four sections whose news also sits in the notification centre — replies,
badges, the pool, the visitors — ask `alreadySeenInApp` before they claim to
be a trigger, and so do the two pushes that fire hours after their own row was
written: the pool at nine, and the likes batch. A pile with nothing unread
left in it stops being a reason to send.

It answers three ways, not two, and the third is the load-bearing one:

| What it finds          | Answer   | Why                                                                                 |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| something still unread | not seen | That is the thing worth saying, and saying it is the point                          |
| every row read         | seen     | Tonight's letter would be a repeat of a screen they closed                          |
| **no rows at all**     | not seen | An absence is not consent to go quiet — every writer swallows its own failures here |

The window is each caller's own — a badge's ids, a pool day, the same
twenty-four hours the reply collector gathered, the seven days the visitors
section counts — so what is weighed is what is being written about. One unread
day inside it and the mail goes as it always did.

This does not turn the centre into a ninth switch, which is the rule directly
above the one it borrows from. Nothing here gates what the app _records_;
reading is a thing the reader did, and the channels declining to repeat it
back is the only reasonable answer to it.

The unread section and the suggestions carry **faces**: up to three people,
photo fetched from our own bucket and attached to the mail, initials on a
coloured disc when there is none. Each face links to `app.langx.io/<handle>`.

The badge section is the one that cannot be recomputed at seven o'clock: the
round-up overwrites `notifiedBadgeIds` at six, so it leaves what it found in
`stats.digestBadges` for the digest to collect.

One badge in the catalogue is a **cohort** rather than a counter — `origin.v1`,
"Early Adopter", derived from `user.precreatedFromV1`. It behaves like any other
here: the round-up finds it missing from `notifiedBadgeIds`, writes the inbox
row and pushes once. Two things about it are worth knowing. It is omitted from
`GET /me/badges` entirely for everybody it is not true of, rather than sent
locked, so nobody is ever shown a goal they cannot reach. And because first
sight is never news, an account returning from v1 _after_ this shipped is never
pushed about it — the @langx welcome-back is that person's greeting, and the
badge push was for the people who had already come back.

### The three throttles that matter

- **One push per post per hour.** Three people correcting the same sentence
  within a minute is the good case, not the rare one.
- **Likes are a daily batch, never an event.** A like is the cheapest thing
  anybody can do here.
- **One follow notice per follower, ever.** Unfollowing and following again
  is not news.
- **One mail per local day, and one section per its own period.** The letter
  is daily; almost nothing in it is. An absence produces one unread section
  however many evenings it spans, visitors stay weekly, and a reply landing
  after the letter has gone waits for tomorrow's — the push already said it.

---

## 3. Promotions — `promotions.email` must allow it

### The nine nudges

`modules/notifications/promotions.ts` — a table walked in **priority order**
for each candidate. The first match is sent, the loop breaks, and
`MARKETING_MIN_GAP_DAYS` (7) keeps the next one a week off.

The pass runs at **20:00 on the reader's clock and nowhere else in the day**,
an hour after the digest, and skips anybody whose digest has already gone out.
It used to run any time between nine and nine, which with a daily mail in the
picture would have let a nudge at ten in the morning take the day's one slot
and leave the evening's real news with nowhere to go.

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
any of the first seven days of a month at 20:00 local — the same marketing
slot the nudges use, which it outranks — once per reader per month, and never
on a day the digest has written.

Monthly rather than weekly, and the numbers are the reason: a week of a
language exchange is three conversations and a correction, which reads as an
accusation rather than a summary.

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
1000 / 4000 / 8000 a day, 08–20 UTC. `--pause` stops the next
tick.

---

## What stops a message arriving twice

Four mechanisms, and each is in the database rather than in a caller's care.

| Mechanism                                                 | Used by                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `notificationLedger` `_id` = `<job>:<userId>:<periodKey>` | every scheduled pass; insert failing **is** the check                         |
| `dailyDigest:<userId>:<localDay>`                         | the one mail a day — and what the nudges and the recap check before they send |
| `emailCampaigns` unique `{campaignId, userId}`            | campaigns, claimed before each batch; a claim the provider rejects is kept    |
| `knownDevices` `_id` = `<userId>:<fingerprint>`           | the new-device notice                                                         |
| `jobRuns` unique `{job, periodKey}`                       | the daily pool, and the campaign drip's per-tick lock                         |

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
- **Having read it already.** `alreadySeenInApp` — the four digest sections
  and the two delayed pushes whose news also has a row in the notification
  centre. It stops a mail from being _sent_, never a paragraph from being
  written: a section it silences still rides along in a letter going out for
  something else. See _Reading counts_.
- **A muted thread.** `mutedBy.<userId>` on the conversation, set from the
  chat list or the thread's own menu, and kept until it is unset — there is no
  timed mute. For that reader and that thread it silences the message push
  (an operator's note to one person included — it goes through the same
  fan-out), the digest's unread section, the in-app banner, and the push of a
  broadcast when the thread is @langx's. Nothing else changes: the message is
  delivered and ticked, the thread keeps its place, and its unread count, the
  Chats badge and the icon's number all go on counting it — muting is not
  reading.
  The transactional pushes that also write into the @langx thread (the bounty,
  the thanks for a report, the lifetime gift) do not ask, for the reason
  nothing in that class asks a switch. The banner reads the flag from the
  app's caches, so a muted thread that no loaded page holds can still draw one
  banner; the refetch that message causes brings the flag back for the next.

---

## 4. The notification centre — the one that does not leave

Everything above leaves the app and is then forgotten. `notificationLedger`
keeps a row so nobody is told twice, but it holds `{_id, sentOn}` and is
unreadable by design, so somebody who missed the push had no way of ever
learning what it said.

The `notifications` collection is the other half: a row per thing that
happened, read by a bell in the Me header and a screen behind it.

| Kind                                                     | Written where                      | `refId` — what makes it arrive once |
| -------------------------------------------------------- | ---------------------------------- | ----------------------------------- |
| `follow`                                                 | `routes/follows.ts`                | the follower's id                   |
| `postComment` / `postCorrection` / `pronunciationAnswer` | `routes/feed.ts` → `tellTheAuthor` | the reply's own id                  |
| `like`                                                   | `routes/likes.ts`                  | `<targetType>:<targetId>:<actorId>` |
| `badgeEarned`                                            | `notifications/badges.ts`          | the badge id                        |
| `walletPool`                                             | `tokens/pool.ts`, at the payout    | the pool day                        |
| `profileVisits`                                          | `notifications/profileVisits.ts`   | the local day                       |

### The five rules it runs on

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

- **The kinds that repeat fold onto themselves.** `badgeEarned`, `walletPool`
  and `profileVisits` each have a ceiling of one row a day, which looked like
  enough and was not: a week of them is the app saying the same three
  sentences seven times over. There is no post to key them on, so the key is
  the kind.

  What a fold shows is **not** what a post pile shows, and the difference is in
  the sentence. A pile's count _is_ the sentence — "and 3 others commented" —
  while these carry a quantity the sentence needs, so the newest speaks
  unchanged and the days behind it travel beside it, as `earlier`, rendered as
  a `+N more` next to the time. Adding them up was the other candidate and is
  wrong on the middle one: **yesterday's pool did not pay 750**. It is a
  sentence about a day, and three days summed is a figure nobody was given.

  Opening the row reads every day behind it, exactly as a pile does. That is
  what makes the fold honest rather than a way of hiding unread rows under a
  read one.

  A consequence worth knowing before writing a test: those three kinds can no
  longer supply a fixture of many rows. The keyset-tiebreak test uses
  **follows** now, which are the one kind nothing collapses.

- **Not gated by the switches.** `notificationsAllowed` is never called on this
  path. Those two channels are about what _leaves_; turning off social push is
  a request not to be buzzed, not a request to be blinded. The badge write in
  `badges.ts` sits deliberately **above** the `wantsPush`/`wantsEmail` check,
  and a test pins it there.

  It reads the other way round, though, and only the other way round: having
  read a row here is what stops the evening repeating it, through
  `alreadySeenInApp`. The arrow matters. A switch must never decide what is
  recorded; what was recorded and then dealt with may perfectly well decide
  whether anything still needs to leave.

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
| `echo`                       | `/echo`                                   |
| `promotion`                  | `/discover`                               |

## What a read clears from the shade

`apps/mobile/src/lib/trayScope.ts`. The OS keeps a drawn notification until it
is swiped away, so without this a message answered at night was still on the
lock screen in the morning.

- **Opening a thread** clears that thread's `message` pushes. So does a read on
  another of the same person's devices, through `conversation:read`, while this
  one holds a socket. A `meetingReminder` stays: it is about a time.
- **Answering from the notification** marks the thread read, so it clears the
  same way and the icon's count drops with it.
- **Opening the wallet** clears `wallet` and `bountyPaid`: the gift, the pool
  and a bounty's tokens are all drawn there.
- **"Mark all read"** clears `social`, `badgeEarned`, `profileVisits` and
  `wallet`.
- **Tapping a row** clears the pushes behind it, read or not. A push carries no
  notification id, so the match is on its `data`: a follow by the follower's
  `handle`, a reply or like row by `postId` (every push about that post), and
  the repeating kinds by kind.

Only a device with the app running can clear its own shade. So the rules above
miss everything dealt with while this device was not looking: read on another
device while this one was asleep, or announced by a push that landed after the
read. Two things cover that: a silent push, which reaches a phone whose app is
closed, and a sweep when the app opens, which catches whatever the silent push
did not.

**The silent push** (`traySync`, `apps/api/src/ws/traySync.ts`) goes out after
every read that changed something, a thread that had unread messages or a row
in the centre, to the reader's devices that hold no socket. It draws nothing.
It wakes the app in the background (`src/lib/traySyncTask.ts`), which clears
what it says is finished and sets the icon's count:

- `message` pushes of threads not in its list of unread threads. Past
  `TRAY_SYNC_MAX_THREADS` it carries no list and leaves every message;
- `social`, `badgeEarned` and `profileVisits` when the centre has nothing
  unread;
- `security` by the same day rule as the sweep below.

It states the whole unread picture rather than naming what was just read,
because iOS delivers only the newest of a burst of background pushes and a push
that named one thread would lose the rest. It carries facts rather than asking
the phone to fetch them, because a locked iPhone cannot read the session cookie
out of the Keychain. Nothing that arrived after its `at` is touched, because a
background push can be held back for minutes and a message that arrived
meanwhile is newer than what it says.

It is best effort by the platforms' own rules. iOS allows a few background
pushes an hour and none at all to an app the person swiped away; Android may
hold one back while the phone sleeps. On Android the background task also runs
for every other push that arrives while the app is closed, and ignores it. It
needs a store build: the background mode and `expo-task-manager` are native.

**The sweep** catches the rest. It asks the server and clears what the answers
say is finished. It runs when the app opens, from cold or from the background, and on
every device holding a socket when another device reads something in the centre
(`notification:read`, which says only that something was read, not what):

- `message` pushes of a thread with nothing unread, or one this reader can no
  longer open;
- `social`, `badgeEarned`, `profileVisits` and `wallet` pushes once every row
  they belong to in the centre is read, by the same match a tapped row uses. A
  push whose rows are not in the newest page stays: not found is not read;
- `security` a day after it arrived (`SECURITY_PUSH_TRAY_MS`). It has no row in
  the centre, so nothing can mark it read, and without a limit a sign-in from
  last month stayed on the lock screen. The day is counted at the next open,
  not to the minute.

Everything else stays until it is tapped or swiped: the streak, Echo and meeting
reminders are about a time or a habit, `billing` is money, and `bountyPaid` goes
when the wallet is opened.

## Not built

Written down so the next person does not have to re-derive them.

| Scenario                                 | Blocked on                                      |
| ---------------------------------------- | ----------------------------------------------- |
| Editor's note as a standalone broadcast  | the monthly note covers it                      |
| Two-way support in the @langx thread     | `OFFICIAL_WRITABLE.langx` is false on purpose   |
| Chat messages in the notification centre | the Chats tab is already that inbox             |
| Backfilled history in the centre         | nothing — it starts empty at deploy, on purpose |

## Messages sent by hand

Two of them, both from `@langx`, both landing in the same chat thread the
welcome did — not an email and not a push-only broadcast, so they are still
there next week.

| Message                  | Sent from                                             | Once because                                                      |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| **A broadcast**          | the operator panel, or `scripts/send-announcement.ts` | `messages.sender_client_id_unique` on `broadcast:<slug>:<userId>` |
| **A note to one person** | the operator panel's user screen                      | nothing — the same words twice are two messages here              |

A broadcast is a row in `broadcastQueue` that the notification scheduler works
through, 500 recipients a tick inside 07–21 UTC. That ceiling is **not** a
deliverability ramp like `campaignDayBudget` — an in-app message has no domain
reputation to warm up; it bounds the Expo relay, the write rate, and how much
of a broadcast is already gone by the time somebody presses stop.

Neither can be replied to: `@langx` is a channel, `OFFICIAL_WRITABLE.langx` is
false, and the chat screen draws no composer on that thread. So a note to one
person is right for "we got your report" and wrong for a conversation — what
is written should say where a reply goes.

## Every message is one format

One shell, one button, one footer — a verification link and a campaign read
as the same sender. Every image travels **inside** the mail as a `cid:`
attachment (`src/email/inlineAssets.ts`), because Outlook and a
remote-content-off Apple Mail do not fetch remote images and Gmail strips
`data:` URIs. Regenerate with `scripts/inline-email-assets.ts` after changing
one.

Nothing user-facing is written in a template. Every string is a key in
`apps/api/src/i18n/messages/en.ts` and the seven locales typed against it.
