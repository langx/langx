# Student discount — 50% off yearly, and what the stores allow

## Status on 11 September 2026

**Not started, and parked.** Behic's call: after the MVP. Nothing below is
built. No student product exists in any store, and `student`, `edu`,
`university` and `academic` return nothing across `apps/`, `packages/`,
`docs/`, the website repo or the GitBook.

What makes this worth keeping is not the idea. It is §2: three constraints read
out of this codebase and the store consoles, each of which closes off an
implementation that looks obvious from outside. Anyone picking this up later
will otherwise rediscover them in the same order and at the same cost.

## 1. The idea

Half price on a yearly subscription for anyone who can prove they read an
academic mailbox. Yearly only — the monthly plans stay at full price, since a
discount on the cancellable plan removes the reason to take the year.

Both tiers, at today's US prices:

|          | Yearly | Student yearly | Per month |
| -------- | ------ | -------------- | --------- |
| Fluent   | $59.90 | $29.90         | $2.49     |
| Polyglot | $95.90 | $47.90         | $3.99     |

Those two halves are not arbitrary. `release-runbook.md` → _The yearly price is
chosen backwards from the monthly one_ requires a yearly price that divides into
a price-shaped monthly, and both halved figures survive it: `29.90 ÷ 12 = 2.4917`
formats as **$2.49**, `47.90 ÷ 12 = 3.9917` formats as **$3.99**. The `.90`
ending halves cleanly where `.99` would not. It is luck, but it is the kind
worth writing down, because the alternative is discovering in the console that
no valid price point works.

## 2. What the stores actually allow

### The introductory offer is already spent

`apps/mobile/src/lib/purchases.ts:151` records the rule: the App Store gives one
introductory offer per subscription group per Apple ID, and both tiers share one
group. That offer is the seven-day free trial. So "a discounted first period for
students" — the shape this feature wants — cannot be an introductory offer for
anybody who has ever started a trial, which after a while is most of the people
who would ask.

Two ways round it remain, and only two: a **separate product** at the lower
price, or an **offer code** that carries its own discount. §3 weighs them.

### RevenueCat is the only authority on entitlement

`applyEntitlement` (`apps/api/src/modules/billing/refresh.ts:47`) overwrites
`profiles.entitlement` with whatever RevenueCat reports, and the paywall calls
`/billing/refresh` after every purchase, every "Restore purchases" and every
return from the web portal. A tier written straight into Mongo is gone by the
next screen. `decisions.md:1539` says the same thing about the v1 loyalty gift,
which is why that gift is a promotional grant through RevenueCat's API rather
than a database write.

For a discount this mostly does not bite — a discounted purchase is still a
purchase, and the existing webhook path handles it untouched. It bites the
tempting shortcut: "just give verified students Fluent for a year in the
database" does not work, and `grantLifetimeEntitlement`
(`apps/api/src/modules/billing/revenueCatClient.ts:190`) is hardcoded to
`duration: 'lifetime'` and to free. It models a gift, not a price.

### The percentage may not be written down

`apps/mobile/src/lib/planSaving.ts` computes the saving badge from two prices in
the same offering and refuses anything under 5%, and its comment is explicit:
_"The percentage is never written down anywhere."_ The reason is in
`release-runbook.md` — yearly prices are set one storefront at a time, so a
literal in the bundle stops being true the first time somebody edits one country
in a console, silently, in a build nobody rebuilt.

A "50% off" label is the same trap with a shorter fuse. Whatever ships, the
number a student reads has to come from the two prices the store reported.

### There is no second email address on an account

Better Auth owns `user.email` and there is one of it. There is no change-email
flow, no secondary address, nothing that models "this person also controls that
mailbox". Most people sign up with a personal address, so verifying a `.edu` one
is a genuinely new mechanism rather than a lookup — and it is the larger half of
the work.

## 3. Two ways to deliver the price

|                      | One-time discount codes                                                  | Separate student products                                     |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Store setup          | A "50% for 12 months" offer on each yearly product, then generated codes | Two new products, priced **by hand in ~90 territories**       |
| Price correctness    | A percentage — right in every currency, for free                         | The `.90 → .99` ladder re-derived per storefront              |
| Duration             | Ends after 12 months; re-verify to renew it                              | Renews at the student price forever, graduation included      |
| Existing subscribers | Can redeem                                                               | Cannot — the price only applies to a new purchase             |
| Open-repo exposure   | A single-use bearer token mailed to a proven address                     | Product ids are public; a patched client can buy one directly |
| App code             | Paywall untouched — the store applies it                                 | Paywall untouched — RevenueCat Targeting picks the offering   |
| Recurring chore      | **The pool must be refilled from a console CSV each quarter**            | None                                                          |

Quarterly caps are not the constraint either way: as of September 2026 Apple
allows up to a million redemptions per app per quarter, and Play allows ten
thousand one-time codes per subscription product per quarter.

**Codes look like the better trade**, mainly because of the second row. Hand-
pricing two products across ~90 territories is the work `release-runbook.md`
describes at length and it would have to be redone for every future price
change; a percentage is correct everywhere at no cost. The twelve-month expiry
is a second, unearned win — students graduate, and a discount that has to be
re-verified each year is the honest shape.

The cost is real and belongs in the decision: **a code pool empties silently.**
Nothing would surface it. If this is built, an alert below a threshold is part
of the feature, not a nicety.

## 4. Proving someone is a student

An academic domain rule plus a single-use link to that address. Not perfect —
see §6 — but free, and it ships without a third party.

**The rule** belongs in a new `packages/shared/src/student.ts`: `.edu`,
`*.edu.<cc>` (which is where Türkiye's `.edu.tr` lands), `*.ac.<cc>`, and a
short, explicit list of commercial domains the pattern would otherwise wave
through. Thresholds and rules are config and live in `packages/shared`; this is
one of them.

**The token** is `apps/api/src/modules/account/deletionTokens.ts`, almost
verbatim: 32 random bytes, only the SHA-256 kept, `_id: userId` so minting a
second link replaces the first, a TTL index so an unspent link stops existing
without a sweeper, and verify/burn split so that opening the mail does not spend
it. One difference worth the deviation — the row carries the address, so the
link cannot be redirected to verify a mailbox other than the one that was
mailed.

**"One academic address, one account, ever"** has to be a unique index on
`profiles`, not a check. Everything in `indexes.ts` that means "only once" is an
index whose failing write _is_ the check; a read-then-write would let two
concurrent requests claim the same address. It needs
`partialFilterExpression: { 'student.email': { $exists: true } }` — the trap the
`tokenLedger` and `notifications` comments in that file both warn about is that a
missing field indexes as `null`, and one absent value then becomes the constraint
for the whole collection.

**On the profile**, a subdocument rather than a boolean:

```ts
student?: { email: string; domain: string; verifiedAt: Date }
```

A date for the reason `suspension` has one: it answers "is this still true" and
"since when" with a single comparison and no cron. An academic address outlives
graduation, so the day this has to lapse, only a date can express it. The address
is stored in the clear, as `user.email` already is — hashing a low-entropy string
buys nothing, and a re-verification mail needs somewhere to go.

## 5. What it would touch

Roughly, if the code path in §3 is the one taken:

- `packages/shared` — `student.ts` (new) with its test; four codes in `errors.ts`.
- `apps/api` — a token module beside `deletionTokens.ts`; two entries in
  `collections.ts` (the tokens, and the code pool); three indexes; a
  `routes/student.ts` with the request route and a session-less confirm page
  built from the `page()` helper in `routes/email.ts`; one transactional mail in
  `email/templates.ts`, modelled on `verificationEmail`; a row in
  `notifications.md` §1; an import script for the console's code CSV.
- `apps/mobile` — a registry entry in `settingsRegistry.ts`, a case in
  `SettingsRow.tsx`, and one screen shaped like `delete-account.tsx` (two states:
  form, then "check your inbox"). The paywall is not touched.
- **Sixteen message catalogues** — eight in the API for the mail, eight in the
  app for the screen. They are typed against English, so all sixteen move in the
  same commit or nothing compiles.

The entitlement path — `refresh.ts`, `webhook.ts`, `revenueCatClient.ts`,
`PACKAGES`, `planChangeFor` — is untouched. A redeemed code produces an ordinary
`INITIAL_PURCHASE`.

## 6. Known holes

- **Alumni.** Most universities leave an address live for years after
  graduation, so a domain rule cannot separate "is a student" from "was one".
  The twelve-month code softens it; the real fix is a verification service such
  as SheerID, which checks enrolment rather than a mailbox. That is the upgrade
  path, not the MVP.
- **The pool empties silently.** Said in §3 and repeated here because it is the
  failure nobody would notice.
- **Throwaway `.edu` generators** exist. Few, and the answer is the same as
  everywhere else in `architecture.md` → _Anti-abuse_: server-side enforcement
  and a unique index, not secrecy. The exception list being public changes
  nothing.
- **App Review.** v1 shipped with no IAP, so anything touching subscriptions
  invites a fresh review, and 2.1(b) and 3.1.2 have both been hit before. The
  store-side setup wants to ride an existing release round rather than start one.

## 7. If it ships, three repos move

`CLAUDE.md` → _Sibling repos_: a pricing claim is copied by hand. The line in
`plans.ts` that reads _"Fluent and Polyglot are monthly or yearly, with a free
trial. Prices are set per region and shown in the app."_ would no longer be the
whole truth, and the same sentence is repeated in the GitBook. A pricing page
that drifts is a false claim, not a stale one.
