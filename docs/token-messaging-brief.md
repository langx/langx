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
- **It cannot unlock Pro.** LangX Pro is a subscription; tokens buy none of it.

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
traded, cannot unlock Pro.

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
  and on **cosmetic frames and titles**. That is the complete list of things to spend
  on, and it is complete on purpose: if tokens could buy a Pro feature, farming
  tokens would become a substitute for subscribing.

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

> LangX Token is an in-app point you earn by practising and teaching, and spend
> on streak freezes and cosmetics. It is not a cryptocurrency: it cannot be
> bought, sold, traded, staked or withdrawn, and it never will be.
