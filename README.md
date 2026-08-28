> [!NOTE]\
> **v2 is in pre-release.** It ships as an update to the existing App Store and
> Play Store listings, not as a new app. The version currently on the stores is
> [v0.15](https://github.com/langx/langx/releases/tag/v0.15); the code it was
> built from is on the [`v1`](https://github.com/langx/langx/tree/v1) branch.

 <h1 align="center"> LangX | Practice, Learn, Succeed! </h1>
<p align="center">
  <a href="https://github.com/langx/langx/actions/workflows/ci.yml" target="_blank"><img src="https://github.com/langx/langx/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://status.langx.io/" target="_blank"><img src="https://uptime.betterstack.com/status-badges/v1/monitor/vrew.svg" alt="Better Stack Badge"></a>
  <a href="https://github.com/langx/langx/releases" target="_blank"><img src="https://img.shields.io/github/release/langx/langx.svg" alt="GitHub release"></a>
  <a href="https://github.com/langx/langx/pulse" target="_blank"><img src="https://img.shields.io/github/commit-activity/m/langx/langx" alt="Activity"></a>
  <a href="https://github.com/langx/langx/graphs/contributors" target="_blank"><img src="https://img.shields.io/github/contributors/langx/langx.svg" alt="GitHub contributors"></a>
  <a href="https://github.com/langx/langx/issues" target="_blank"><img src="https://img.shields.io/github/issues/langx/langx.svg" alt="GitHub issues"></a>
  <a href="https://github.com/langx/langx/blob/main/LICENSE" target="_blank"><img src="https://img.shields.io/github/license/langx/langx.svg" alt="GitHub license"></a>
</p>
<p align="center">
  <a href="https://discord.langx.io" target="_blank"><img src="https://img.shields.io/badge/-Discord-5865F2?style=flat&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://reddit.com/r/langx" target="_blank"><img src="https://img.shields.io/badge/-Reddit-FF5700?style=flat&logo=reddit&logoColor=white" alt="Reddit"></a>
  <a href="https://x.com/langx_io" target="_blank"><img src="https://img.shields.io/badge/-Twitter-1DA1F2?style=flat&logo=twitter&logoColor=white" alt="Twitter"></a>
  <a href="https://t.me/langxapp" target="_blank"><img src="https://img.shields.io/badge/-Telegram-2CA5E0?style=flat&logo=telegram&logoColor=white" alt="Telegram"></a>
  <a href="https://instagram.com/langxapp" target="_blank"><img src="https://img.shields.io/badge/-Instagram-E4405F?style=flat&logo=instagram&logoColor=white" alt="Instagram"></a>
  <a href="https://tiktok.com/@langxapp" target="_blank"><img src="https://img.shields.io/badge/-TikTok-000000?style=flat&logo=tiktok&logoColor=white" alt="TikTok"></a>
  <a href="https://www.facebook.com/langxapp" target="_blank"><img src="https://img.shields.io/badge/-Facebook-1877F2?style=flat&logo=facebook&logoColor=white" alt="Facebook"></a>
  <a href="https://www.youtube.com/@langxapp" target="_blank"><img src="https://img.shields.io/badge/-YouTube-FF0000?style=flat&logo=youtube&logoColor=white" alt="YouTube"></a>
  <a href="https://bsky.app/profile/langx.io" target="_blank"><img src="https://img.shields.io/badge/-Bluesky-1DA1F2?style=flat&logo=bluesky&logoColor=white" alt="Bluesky"></a>
  <a href="https://www.linkedin.com/products/new-chapter-technology-limited-liability-company-languagexchange-practice-learn-succeed/" target="_blank"><img src="https://img.shields.io/badge/-LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
</p>
<p align="center">
  <a href="https://discord.langx.io" target="_blank"><img src="https://img.shields.io/discord/1211339989967970375?logo=discord" alt="chat on Discord"></a>
</p>
<p align="center">
  <a href='https://apps.apple.com/app/languagexchange/id6474187141' target='_blank'><img src="https://raw.githubusercontent.com/langx/.github/main/assets/ios.png" height="50" alt="Download on the App Store"></a>
  <a href='https://play.google.com/store/apps/details?id=tech.newchapter.languageXchange' target='_blank'><img src="https://raw.githubusercontent.com/langx/.github/main/assets/android.png" height="50" alt="Get it on Google Play"></a>
  <a href='https://app.langx.io' target='_blank'><img src="https://raw.githubusercontent.com/langx/.github/main/assets/pwa.png" height="50" alt="Open the web app"></a>
</p>
<p align="center">
  <a href="https://langx.io" target="_blank">
  <img alt="Featured Image" src="https://raw.githubusercontent.com/langx/.github/main/assets/featured_image.png" />
  </a>
</p>

LangX connects you with native speakers so you can practise the language you are
learning by teaching the one you already know. Speak, chat, correct each other's
sentences — and keep a streak while doing it.

iOS, Android and the web all come out of one Expo codebase, with a single
Fastify API behind them. BSD-3, open source, same as v1.

## Official Links

**:computer: Website:** [https://langx.io/](https://langx.io/)

**:calling: Apps:** [https://get.langx.io](https://get.langx.io)

:coin: **Token Website:** [https://token.langx.io/](https://token.langx.io/)

:scroll: **Litepaper:** [https://docs.langx.io](https://docs.langx.io)

**:bar_chart: Insights:** [https://insight.langx.io](https://insight.langx.io)

**:green_circle: Status :** [https://status.langx.io/](https://status.langx.io/)

**:wrench: Backlog:** [https://backlog.langx.io/](https://backlog.langx.io/)

**:envelope: Mail:** [hi@langx.io](mailto:hi@langx.io)

## Tech Stack

| Layer      | Choice                                                             |
| ---------- | ------------------------------------------------------------------ |
| Mobile/web | Expo SDK 57 · expo-router · TanStack Query + Zustand · NativeWind  |
| API        | Node 24 · Fastify 5 · Better Auth · Socket.io — a single container |
| Data       | MongoDB Atlas, official driver (no Mongoose)                       |
| Storage    | S3-compatible (Cloudflare R2; Backblaze B2 via config)             |
| Billing    | RevenueCat — StoreKit / Play Billing / RevenueCat Web + Stripe     |

### Other Repos

- 🟢 [website](https://github.com/langx/website) _Svelte_
- 🟢 [token-website](https://github.com/langx/token-website) _HTML/CSS_
- 🟢 [api](https://github.com/langx/api) _Express, Node.js — v1's API, still
  serving `api.langx.io`; retired after the v2 rollout_
- 🟢 [copilot](https://github.com/langx/copilot) _JavaScript_
- 🟢 [docs](https://github.com/langx/docs)
- 🟢 [insight](https://github.com/langx/insight)
- 🟢 [branding](https://github.com/langx/branding)

#### Previous versions

- 🌱 [`v1` branch](https://github.com/langx/langx/tree/v1) — this repository before
  v2; the Expo rewrite that was never released
- 📦️ [langx-angular](https://github.com/langx/langx-angular) (Archived) _Originally
  developed, and what [v0.15](https://github.com/langx/langx/releases/tag/v0.15)
  on the stores is built from_
- 📦️ [langx-flutter](https://github.com/langx/langx-flutter) (Archived) _(Not
  completed)_

## Get started

MongoDB has to run as a replica set — Better Auth wraps its writes in
transactions, which standalone `mongod` does not support. Full setup, including
the one-line Docker version, is in
[CONTRIBUTING.md](CONTRIBUTING.md#getting-set-up).

```bash
pnpm install
cp .env.example .env      # set MONGODB_URI and BETTER_AUTH_SECRET
pnpm dev                  # API on :4000, Expo on :8081
```

- `pnpm dev:api` — API only
- `pnpm dev:web` — Expo web only
- `pnpm typecheck` · `pnpm lint` · `pnpm test`

Press `i` or `a` in the Expo output for a simulator, or open
[http://localhost:8081](http://localhost:8081) for the web build. Running on a
physical phone needs a development build rather than Expo Go — see
[CONTRIBUTING.md](CONTRIBUTING.md#running-on-a-phone).

## Layout

```
apps/api          Fastify API — auth, REST, realtime, scheduled jobs
apps/mobile       Expo app (iOS + Android + web)
packages/shared   zod schemas, language + level tables, PLAN_LIMITS, TOKEN_RULES
```

[`docs/architecture.md`](docs/architecture.md) describes how they fit together
and [`docs/decisions.md`](docs/decisions.md) says why — several choices look
arbitrary until you know what went wrong the first time.

## Self-hosting

Your own instance needs MongoDB, an S3-compatible bucket and an email key.
Billing, translation and analytics are optional and degrade cleanly when they
are not configured. See [`docs/self-host.md`](docs/self-host.md).

## Contributing

We welcome contributions. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and say
hello in the **#codebase** channel on [Discord](https://discord.langx.io).

## Security

If you find a security vulnerability, please email
[hi@langx.io](mailto:hi@langx.io) rather than opening a public issue. See
[SECURITY.md](SECURITY.md).

## Stats

### Stargazers

[![Stargazers over time](https://starchart.cc/langx/langx.svg?variant=adaptive)](https://github.com/langx/langx/stargazers)

### Contributors

[![GitHub Contributors Image](https://contrib.rocks/image?repo=langx/langx)](https://github.com/langx/langx/graphs/contributors)

## Support Us

- **Be A Patron:** https://backer.langx.io/

- **Github Sponsor:** https://github.com/sponsors/langx

## License

This project is licensed under the BSD-3-Clause License - see the
[LICENSE](./LICENSE) file for details.
