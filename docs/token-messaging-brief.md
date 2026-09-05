# LangX Token — messaging brief

For anyone writing public copy about the token: the marketing site, the
litepaper at docs.langx.io, langx.io itself, and the store listings.

The app and the website have to describe the same thing. Today they do not:
the app calls it a non-transferable in-app point, and the website advertises
**"Staking and Trading"** and a **"Future Marketplace"**. That gap is the whole
reason this document exists.

## What the token is

**LangX Token is an in-app point.** You earn it by using the app and you spend
it inside the app. That is the entire definition.

- **Not transferable.** It cannot be sent to another user.
- **Not purchasable.** There is no way to buy tokens, with money or anything else.
- **Not withdrawable.** It does not leave the app.
- **Not tradable, not staked, not listed.** There is no exchange, no market, no
  marketplace, and no plan to build one.
- **Not on a blockchain.** There is no chain, no contract, no wallet address.
- **It cannot unlock a paid plan.** Fluent and Polyglot are subscriptions;
  tokens buy no part of either.

## Words we do and do not use

"Wallet" as the name of the in-app screen holding a point balance is **fine**,
and it is what that screen is called. What is ruled out is a _crypto_ wallet:
wallet **addresses**, "connect wallet", coin and chain iconography, and any
wording that implies custody, transfer or an external holder of value. The
distinction is not pedantry — `release-runbook.md` cites this document on the
App Review question (3.1.5(b)), and a reviewer's concern is whether the app is
crypto-adjacent, not whether a screen has a common English name.

So the in-app disclaimer no longer says "no wallet", which would have
contradicted the screen it sits on. It says what is actually true and actually
load-bearing: no chain, no contract, no market, cannot be bought, cannot be
traded, cannot unlock a paid plan.

New screens use Feather `award`/`gift`, never a coin.

Call it **"LangX Token"**. Drop "Test Token" — v1 used that because the token
was framed as a preview of something real, and there is nothing to preview any
more. Keeping "test" would now be misleading in the opposite direction.

## What must come off the site

These are not stale phrasing, they are claims the product does not meet:

| Currently on the site                | Status                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| "Staking and Trading"                | **Remove.** Neither exists nor is planned.                                                   |
| "Future Marketplace"                 | **Remove.** No marketplace is planned.                                                       |
| crypto / exchange / withdraw framing | **Remove.** None of it applies.                                                              |
| "Learn to Earn"                      | Keep only if it clearly means "earn points by learning". If it reads as earn-money, rewrite. |

The litepaper needs an explicit note saying the on-chain design described in it
**is not being built**. Leaving it up unqualified is worse than deleting it —
it reads as a roadmap.

## Why this matters more than wording

**Store review.** Apple regulates crypto-adjacent apps separately (guideline
3.1.5(b)), and a reviewer follows the listing's own website link. An in-app
currency called "Token" whose official site advertises staking and trading is
a rejection waiting to happen, and v1 was free with no in-app purchases — so
v2 is walking into a fresh, thorough review regardless.

**Promise integrity.** v1's public position was "free forever, no in-app
purchases" plus a Learn-to-Earn token. v2 breaks the first half already (see
`legal/promise-change.md`). Breaking the second half quietly, by leaving a
trading promise up while shipping something that cannot trade, is the version
that damages trust.

## What can be said, accurately

- Earn tokens by sending messages and by **correcting other people's** — teaching
  is weighted higher than talking, deliberately.
- A fixed daily pool is shared out among that day's active users, in proportion
  to how active they were. Your share depends on everyone else's day, which is
  what keeps it worth watching.
- Keep a daily streak; hitting 7, 30, 100 and 365 days pays a bonus.
- Weekly, monthly, yearly and all-time leaderboards.
- Spend tokens on a **streak freeze** (rescues one missed day), on **filling in
  a missed day** on your activity map (300 tokens, last 14 days, two a month),
  and on **cosmetic frames and titles** — ten of each, worn one at a time. That
  is the complete list of things to spend on, and it is complete on purpose: if
  tokens could buy a paid feature, farming tokens would become a substitute for
  subscribing.
- One frame, **Aurora**, cannot be bought at any balance: it needs a 365-day
  streak _and_ 5,000 corrections written. Say it as an achievement, never as a
  premium tier — the difference is that everybody can see the requirement and
  nobody can pay past it.

## Subscribing: what a paid plan includes, and what it cannot

Fluent and Polyglot include a one-off **welcome pack** — a profile frame or two, and
two streak freezes. Items, never token.

That is not a stylistic preference. "There is no way to buy tokens, with money
or anything else" is the claim above, and a token grant for a subscription
would make it false. It is also not only wording: a balance is
`tokenAggregates.all` minus spending, and that aggregate is exactly what the
all-time leaderboard ranks — so granting token for money would sell rank on a
table other people climb by writing corrections.

Nothing in the pack is subscriber-only. Every item in it is buyable with token by
anybody; subscribing skips the saving, it does not unlock a shelf. Say it that
way: **"a head start, not a shortcut"**, never "earn tokens faster".

Cosmetics are not taken back when a subscription lapses.

One amendment, since the referral programme shipped: the sentence above is
"money never produces token" and it is now, precisely, **"money never produces
token for the person who paid"**. If somebody was invited and then subscribes,
their _inviter_ earns a one-off top-up. Nobody can buy their own token, no
purchase raises the buyer's own balance or rank, and every bullet in "what the
token is not" stays literally true — that is the list a reviewer checks, and it
is unchanged.

## Referrals: what to say

You cannot buy tokens. You can earn them by bringing somebody to LangX who then
actually uses it — including if they go on to subscribe. The tokens go to the
person who did the inviting, never to the person who paid.

Two things to keep in the copy, because they are what make it defensible:

- **Nothing is paid for signing up.** An invite earns only once the invited
  person has verified an email, finished their profile and written to somebody.
  Do not write "get 1000 tokens per sign-up"; write "when they start talking".
- **It is capped per person, forever.** One invitee is worth
  `TOKEN_RULES.referral.maxPerInvitee` at most, ever — not per month, not per
  renewal.
- **The invited person gets a welcome, too** (since 5 September 2026):
  `TOKEN_RULES.referral.inviteeActivation` at the same activation moment —
  never at sign-up — so that, with the sign-up bonus, they start on
  `TOKEN_RULES.referral.inviteeTotal`. Quote the total ("start with 1000"),
  and say when: "once you write to somebody", not "for joining". The first
  sentence above still holds for both sides.

Never: "refer and earn", "affiliate", "commission", "payout". They are the
vocabulary of a scheme that pays money, and this pays a point that buys streak
freezes and frames.

## Returning v1 users: what to tell them

**Balances carry over.** Nothing in v1 was ever bought or sold — what looked
like a purchase log was a daily payout calculation — so balances are entirely
earned and there is no reason not to honour them.

They are **divided by 100** on the way in. The two economies were never on the
same scale: v1 balances run to a maximum of 2.28 million while a very active
day in v2 is about 700 tokens. Credited one-for-one, the largest v1 balance
would sit roughly nine years ahead of anyone new and the all-time table would
never move again. Divided, it starts about 32 days ahead — a real head start
that someone can actually close.

Say the ratio plainly rather than burying it. "Your balance carries over,
scaled to the new economy" is honest and holds up; discovering the division
afterwards does not.

Returning users also get a **welcome-back bonus**, and any streak they had is
frozen and can be restored by spending tokens.

## One-line version

> LangX Token is an in-app point you earn by practising, teaching and bringing
> people in, and spend on streak freezes and cosmetics. It is not a cryptocurrency: it cannot be
> bought, sold, traded, staked or withdrawn, and it never will be.
