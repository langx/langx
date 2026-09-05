# Repo map

LangX is more than this repository. This page says what the other `langx/*`
repositories are, which of them are still worked on, and — the part that
matters most — which values are copied between them by hand. Nothing checks
those copies; when one side changes, the other silently becomes wrong.

The working assumption in these docs is that the sibling repos are checked out
**next to** this one, in one parent folder:

```
<parent>/
  langx/          this repo
  website/        langx.io
  token-website/  token.langx.io
  docs/           docs.langx.io (GitBook source)
  api/            v1's API, api.langx.io
```

Paths such as `website/src/lib/data/plans.ts` in this repo's docs mean that
sibling checkout. Older documents and commit messages sometimes call this repo
`langx2`; that was a second checkout of the same repository and is gone — they
mean this folder.

## In scope

| Repo                                                            | What                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`langx/langx`](https://github.com/langx/langx)                 | **The v2 product.** Expo + Fastify + MongoDB, one pnpm workspace                                |
| [`langx/website`](https://github.com/langx/website)             | langx.io — SvelteKit, deployed by its own GitHub Actions workflow                               |
| [`langx/token-website`](https://github.com/langx/token-website) | token.langx.io — plain HTML/CSS/JS, no build step                                               |
| [`langx/docs`](https://github.com/langx/docs)                   | GitBook source for docs.langx.io; `SUMMARY.md` is the entry point                               |
| [`langx/api`](https://github.com/langx/api)                     | v1's API on api.langx.io. Code frozen since June 2024, **still serving production** — see below |

### `langx/api` — frozen, not dead

Express + Appwrite, replaced in v2 by `apps/api`. Nothing has been committed
to it since June 2024, but three callers still hit it in production: v0.15 on
the stores, the newsletter form on the website, and the token leaderboard on
token.langx.io. Its `/api/update` endpoint is also the only channel that can
tell a v1 install to update or that the service is down.

It is frozen, not archived: the repo is live on GitHub and the deploy is up.
Do not archive it or stop the deploy before the checklist in
[`release-runbook.md`](release-runbook.md) → **Retiring the v1 API** is done.
Treat the code as read-only in the meantime.

## Where each site is hosted

Verified on 5 September 2026. Written down because none of it is visible from
the repos themselves.

| Host             | Hosting                                                       | How a change gets there                                                    |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `app.langx.io`   | Cloudflare Pages project `langx-web` (direct upload)          | `pnpm --filter @langx/mobile deploy:web` from this repo, by hand           |
| `api.langx.io`   | Fly.io app `langx-api`, behind Cloudflare                     | `fly deploy -a langx-api` from this repo, by hand                          |
| `langx.io`       | Cloudflare Pages project `website` (direct upload)            | push to `main` of `langx/website`; its workflow builds, uploads and purges |
| `token.langx.io` | Cloudflare Pages project `token-website` (**Git-integrated**) | push to `main` of `langx/token-website`; Pages builds it                   |
| `docs.langx.io`  | GitBook, Git Sync on `langx/docs`                             | push to `main` of `langx/docs`                                             |

`token-website` is the only one Cloudflare builds from Git; moving or renaming
that repo means reconnecting the Pages project in the dashboard first.

## Links between repos, kept by hand

| Source of truth in this repo                   | Copy elsewhere                                               |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `packages/shared/src/limits.ts`                | `website/src/lib/data/plans.ts`                              |
| `packages/shared/src/limits.ts`                | `website/src/lib/data/features.ts`                           |
| `packages/shared/src/token.ts`                 | `website/src/lib/data/token.ts`                              |
| `packages/shared/src/cosmetics.ts`             | `website/src/lib/data/token.ts`                              |
| `docs/store/listing.md`                        | `website/src/lib/data/meta.ts`                               |
| `packages/shared/src/token.ts`, `cosmetics.ts` | the numbers on token.langx.io and the token pages in `docs/` |

One more runs the other way: the app's link table
`apps/mobile/src/lib/externalLinks.ts` (Settings → Legal, and the "Our Kitchen"
screen) holds the same social and legal addresses as
`website/src/lib/components/molecules/Socials.svelte`. A handle that changes on
the site goes stale in the app until someone edits both.

The product claims on the site are also constrained by
[`legal/promise-change.md`](legal/promise-change.md) and
[`token-messaging-brief.md`](token-messaging-brief.md). The same rules are
explained to users again in the GitBook docs — a token or plan change usually
touches all three places.

One hand-kept link runs entirely outside these repos, recorded so it is not
rediscovered the hard way: the Discord channel and role ids hard-coded in
`langx-angular/functions/discord-sync/src/main.js` (badge sync) and
`copilot/discord/bot.js` are the same ids. If they change, in-app badges break
silently.

## Out of scope

Still readable, worth reading to understand how things got here, but not
developed and not swept.

Archived on GitHub (verified 5 September 2026): `langx-angular` (v1 —
Ionic/Angular + Capacitor + Appwrite; v0.15 on the stores was built from it),
`langx-flutter`, `db-bulk-update`, `rss-to-medium-autopublish`, `insight`,
`insight-counterscale`, `capacitor-voice-recorder`, `db`, `sdk`, `cepix`.

Live on GitHub but out of scope: `copilot` (OpenAI-backed Discord assistant),
`branding` (logos, store screenshots, press kit — no code), `.github` (the
organisation profile). `langx-react-native`, the first RN sketch of v2, moved
into this repo; its remote no longer resolves.

To understand how v1 worked, read `langx-angular`, `api`, and
[`v1-reference.md`](v1-reference.md).

## Working folders outside git

A few things are deliberately kept in no repository at all: credential files
and `.env`s (every `langx/*` repo is public), the Discord server tooling that
needs a fully privileged bot token, what was salvaged from a decommissioned
server, and raw backups. They live next to the checkouts on the working
machine and travel by hand. [`workstation-move.md`](workstation-move.md) lists
them by name so a machine change does not lose them again.
