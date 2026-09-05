# What changed between v1 and v2, and why

**Status: written, not yet published.** These are the changes that have to
reach langx.io, the Terms, the privacy policy, the litepaper and both store
listings _before_ v2 ships. Publishing needs access this repo does not have.

## What v1 promised in public, and what changes

### 1. "Free forever"

v1's homepage said LangX was free. v2 introduces a paid tier, and three things
that were free become Pro:

- gender / country / age / level filters in discovery
- seeing **who** viewed your profile (the count stays free)
- browsing without leaving a trace (incognito)

Plus two new limits on the free tier: **5 new conversations you start per
rolling 24 hours**, and **20 machine translations per rolling 24 hours**.

**What stays free, permanently, and must be said in the same breath:** reading
and replying to _every_ message anyone sends you, with no cap. The free tier is
limited in how many conversations you can _open_, never in how much you can
talk. Writing corrections is unlimited on both tiers — teaching someone is the
point of the product, and rate-limiting it would shrink what a paying user
receives as much as what a free user gives.

Anyone who used v1 will read a paywall as a broken promise unless the change is
stated plainly. Do not bury it in a Terms diff.

### 2. The token — kept, but stripped of everything it implied

This one is a change of _meaning_, not a withdrawal, and that distinction is
the whole message.

v1 shipped a token with wallets, a token leaderboard, and a litepaper
describing something tradable, staked and eventually listed. **The name stays.
The trading does not.** LangX Token in v2 is an in-app point: earned by
practising and teaching, spent on a streak freeze, on filling in a missed day,
and on cosmetics, and nothing
else. It cannot be bought, sold, traded, staked, withdrawn or transferred, and
it can never unlock a Pro feature — the moment it could, farming tokens would
become a substitute for subscribing, and the subscription is what funds the app.

**Balances carry over.** Nothing in v1 was ever bought or sold: what looked
like a purchase log (`CHECKOUT_COLLECTION`) is a daily payout calculation, and
there was never a purchase flow. So balances are entirely earned, and there is
no reason not to honour them.

They are **divided by 100** on the way in. Say this plainly rather than letting
people discover it. The two economies were never on the same scale — v1
balances run to a maximum of 2.28 million, while a very active day in v2 is
about 700 tokens. One-for-one, the largest v1 balance would sit roughly nine
years ahead of anyone new and the all-time table would never move again.
Divided, it starts about 32 days ahead: a real head start that someone can
actually close.

Returning users also get a welcome-back bonus, and a streak they had in v1 is
frozen and can be restored by spending tokens.

**The litepaper is the liability.** It needs an explicit note that the on-chain
design in it is not being built — leaving it up unqualified reads as a
roadmap, and an app whose official site advertises staking and trading invites
a store rejection under Apple's crypto rules (3.1.5(b)). If an on-chain layer
is ever revisited it will be a new document after legal review, not a
continuation of that one.

Full constraints for whoever writes this copy: `docs/token-messaging-brief.md`.

## Copy to publish

### langx.io homepage

Two things to fix here: the "free forever" claim, and the Learn-to-Earn
section, which currently advertises staking and a future marketplace.

Replace "free forever" with something that is true and still generous:

> **Free to use. Always.** Reply to every message you get, with no limits, and
> correct as many as you like. LangX Pro adds filters, unlimited translation,
> and the ability to start as many new conversations as you want.

And for the token section:

> **Earn tokens by practising — and by teaching.** Correcting someone else's
> sentence is worth more than sending one. Spend them on a streak freeze, on
> filling in a day you missed, or on cosmetics for your profile. LangX Token is
> an in-app point: it cannot be
> bought, sold, traded or withdrawn, and it never will be.

### Terms — clauses that must change

| Clause           | Change                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pricing          | Add the subscription, the free-tier limits, and that they are per rolling 24 hours (not per calendar day)                                                                                                                                                                                                                                                                            |
| Token            | Redefine it: an in-app point with no cash value. Non-transferable, cannot be purchased, sold, traded, staked or withdrawn. State that v1 balances carry over at 1:100 and that nothing is redeemable for money. Say that small amounts may also be granted at random at fixed intervals (the hourly gift) — free, with nothing staked, and not a prize, sweepstake or game of chance |
| Virtual items    | Cover the streak freeze, filled-in activity days and cosmetics; forfeited on account deletion                                                                                                                                                                                                                                                                                        |
| Account deletion | 30-day grace period, then permanent. Messages you sent stay in the other person's conversation with their content removed                                                                                                                                                                                                                                                            |
| Minimum age      | 16+ (was 18+), enforced at profile creation                                                                                                                                                                                                                                                                                                                                          |

### Store listings

Both listings currently describe v1. Two things are now **wrong**, not just
stale:

- **Voice messages and badges are in v1 and not in v2's first release.** They
  are planned for the next release. A listing that still advertises them is a
  feature claim the app does not meet — remove them.
- The listing must declare in-app purchases; v1 had none.

### 3. What v2 collects that v1 did not say it collected

Three of these landed on 30 August 2026 and none of them is covered by v1's
published texts. All three are already live in `website/` (langx/website#119);
the store forms and the GitBook copy still need them.

- **A date of birth, not a year.** v1 stored a full birthdate and only ever
  used the year; v2 now keeps and uses the whole day, so that birthdays can
  exist. The arithmetic is unchanged — whole years, so somebody who reaches
  the minimum age in December is admitted in January — but the floor itself
  moved from 18 to **16** in September 2026, once the store questionnaires
  rated the content 13+/Teen. A v1 account whose holder is 16 or 17 can now
  finish the restore; under 16 still cannot. Only the age is ever shown to
  another user; the date is visible to nobody but its owner.
- **The country is derived from the connection's IP** at profile creation,
  rather than typed. A country filter anybody can set by hand is not a filter.
  The address is not stored — only the two-letter code it resolved to — and the
  only thing that can change it afterwards is a location fix from the device.
  This has to be said out loud: "we do not build a profile from your IP" stays
  true, and would be misleading next to a stored country if it stood alone.
- **Notification preferences are four kinds by two channels**, and promotions
  are **off** until somebody turns them on. Consent to be marketed at has to be
  given rather than withdrawn; the email column exists and nothing sends to it
  yet.

One more that is a promise rather than a disclosure: **passwords are 6 to 64
characters, with no composition rule**. Anything published that describes the
old requirement should say this instead.

## Privacy policy

Derive it from `docs/store/privacy-data-safety.md`, which is written from what
the code actually stores rather than from what a template assumes.
