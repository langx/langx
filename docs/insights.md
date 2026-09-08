# insights.langx.io — the public stats page

One page, no login, built entirely from our own database: how many people are
here, how much they write, how much they correct, and in which languages.

It exists because v1 published its numbers and v2 stopped being able to. The
reasoning is in [`decisions.md`](decisions.md) → _The analytics dashboard is
private, and that decides the tool_, and the short version is that the internal
dashboard now reads out conversion and churn, which cannot be published, while
the transparency v1's `insight.langx.io` was carrying still can be. This is
that transparency as a separate artefact: **a different page, a different
audience, and a different source of data** — not the private dashboard with a
lock removed.

## The line

| On the page                                                | Never on the page                                       |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| Members, messages, corrections, languages                  | Revenue, subscriptions, plan mix                        |
| New members / messages / corrections per day, last 30 days | Conversion, retention, funnel steps, churn              |
| The most-learned and most-spoken languages                 | Channels, campaigns, where installs come from           |
| Longest streak ever, how many members are on one today     | Anything keyed to a person: handles, ids, cities, dates |

The right-hand column is not a backlog. Publishing it hands pricing and channel
strategy to anyone who asks, permanently — a share link can be switched off,
what has already been read cannot be unread.

Everything on the left is a count over a whole collection. No document is read
out, the smallest group is a language, and guests and deleted accounts are
excluded from every number — a guest is a browsing session with no account
behind it, and would inflate all of them.

## Where it lives

| Part    | Where                                                                           |
| ------- | ------------------------------------------------------------------------------- |
| Numbers | `apps/api/src/modules/insights/publicStats.ts`, served as `GET /public/stats`   |
| Page    | `apps/api/assets/insights.html`, served as `GET /public/insights`               |
| Routes  | `apps/api/src/routes/public.ts`, beside the newsletter form and the token board |

The page is a static document that fetches `/public/stats` for its numbers, so
it ships with the endpoint it reads and can never be a version behind it. It is
served by the API rather than from Cloudflare Pages for that reason, and
because it needs no build step of its own: `fly deploy -a langx-api` is the
whole deployment.

The numbers are recomputed at most every ten minutes and held in memory, and
the response says so in `cache-control`. Every field is a collection scan, and
nothing on a public page is worth a database pass per visitor.

## Pointing the domain at it

Not in this repo, and not automated — the same kind of by-hand step as
everything in [`repo-map.md`](repo-map.md):

1. **Fly**: `fly certs add insights.langx.io -a langx-api`, then add the
   `_acme-challenge` record it prints.
2. **Cloudflare DNS**: `insights` as a CNAME to `langx-api.fly.dev`, proxied.
3. **Cloudflare redirect rule**: `insights.langx.io/` → `/public/insights`, 301. Without it the bare hostname answers with the API's 404 body, because
   `/` is not a route.

`api.langx.io/public/insights` keeps working either way; the domain is a nicer
address for the same page, not a second deployment of it.

## Changing what is on it

The numbers are typed in `publicStats.ts` and drawn in `insights.html`, and the
two are the whole of it — there is no dashboard to configure and nothing to
click. Adding a field means adding it to the table at the top of this file
first, because that table is the promise; if a proposed field belongs in the
right-hand column, the answer is no, and the place it belongs is the private
PostHog project ([`analytics.md`](analytics.md)).

The page is English-only. It is not the app: the eight-locale rule applies to
`apps/mobile/src/i18n`, and this is a public web page like langx.io, which is
also English.
