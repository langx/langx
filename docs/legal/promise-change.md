# What changed between v1 and v2, and why

**Status: written, not yet published.** These are the changes that have to
reach langx.io, the Terms, the privacy policy, the litepaper and both store
listings _before_ v2 ships. Publishing needs access this repo does not have.

## The two promises v1 made in public that v2 does not keep

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

### 2. The token

v1 shipped a token: wallets, checkouts, a token leaderboard, and a litepaper
describing something tradable. v2 **retires it**. Balances are not migrated and
are not redeemable.

In its place: **XP**. XP cannot be bought, sold, traded, withdrawn, or
transferred, and it can never unlock a Pro feature. It buys exactly two things:
a streak freeze, and cosmetic frames and titles. That restriction is
deliberate — the moment XP can buy a subscription feature, farming XP becomes a
substitute for paying, and the subscription is what funds the app.

The litepaper needs an explicit note saying the on-chain design is not being
built, rather than being left up as if it were still the plan. If an on-chain
distribution layer is ever revisited it will be a new document after legal
review, not a continuation of that one.

## Copy to publish

### langx.io homepage

Replace "free forever" with something that is true and still generous:

> **Free to use. Always.** Reply to every message you get, with no limits, and
> correct as many as you like. LangX Pro adds filters, unlimited translation,
> and the ability to start as many new conversations as you want.

### Terms — clauses that must change

| Clause           | Change                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pricing          | Add the subscription, the free-tier limits, and that they are per rolling 24 hours (not per calendar day)                 |
| Token            | Remove the token entirely; state that v1 balances are void and not redeemable                                             |
| Virtual items    | Add XP: non-transferable, no cash value, cannot be purchased, forfeited on account deletion                               |
| Account deletion | 30-day grace period, then permanent. Messages you sent stay in the other person's conversation with their content removed |
| Minimum age      | 18+, enforced at profile creation                                                                                         |

### Store listings

Both listings currently describe v1. Two things are now **wrong**, not just
stale:

- **Voice messages and badges are in v1 and not in v2's first release.** They
  are planned for the next release. A listing that still advertises them is a
  feature claim the app does not meet — remove them.
- The listing must declare in-app purchases; v1 had none.

## Privacy policy

Derive it from `docs/store/privacy-data-safety.md`, which is written from what
the code actually stores rather than from what a template assumes.
