# Campaign bodies

The broadcasts `scripts/send-campaign.ts` queues, as the HTML and plain-text
pairs it takes. Table-based, inline-styled, 600px — mail clients, not
browsers. Images are served from `https://langx.io/email/` (the website
repo, `static/email/`).

Every body carries three tokens, filled per person when the API sends:

| Token                | Becomes                                                       |
| -------------------- | ------------------------------------------------------------- |
| `{{unsubscribeUrl}}` | A signed one-click unsubscribe link. **Required.**            |
| `{{firstName}}`      | The display name, or the name the v1 row carries, or "there". |
| `{{email}}`          | The address, URL-encoded — for `sign-in-link?email=`.         |

## The v1 win-back sequence

Three mails to the accounts pre-created from v1, ten and thirty days apart,
each excluding whoever has onboarded since. Run each from `apps/api` with
the production env; the dry run prints the audience and queues nothing.

```bash
ENV="--env-file=../../.env --env-file=../../.env.prod"

# Day 0 — "v2 is live". Everybody from v1, and the deleted accounts too.
pnpm exec tsx $ENV scripts/send-campaign.ts \
  --campaign 2026-09-v1-launch \
  --subject "LangX v2 is live — your username, tokens and streak are waiting" \
  --html-file campaigns/v1-launch.html --text-file campaigns/v1-launch.txt \
  --source v1 --confirm
pnpm exec tsx $ENV scripts/send-campaign.ts \
  --campaign 2026-09-v1-launch-deleted \
  --subject "LangX v2 is live — your username, tokens and streak are waiting" \
  --html-file campaigns/v1-launch.html --text-file campaigns/v1-launch.txt \
  --source v1deleted --confirm

# Day +10 — "still reserved". Only those who have not come back.
pnpm exec tsx $ENV scripts/send-campaign.ts \
  --campaign 2026-09-v1-reserved \
  --subject "Your LangX username is still waiting for you" \
  --html-file campaigns/v1-handle-reserved.html --text-file campaigns/v1-handle-reserved.txt \
  --source v1 --exclude-returned --confirm

# Day +30 — "last one from us".
pnpm exec tsx $ENV scripts/send-campaign.ts \
  --campaign 2026-10-v1-last-call \
  --subject "Last one from us" \
  --html-file campaigns/v1-last-call.html --text-file campaigns/v1-last-call.txt \
  --source v1 --exclude-returned --confirm

# Any time:
pnpm exec tsx $ENV scripts/send-campaign.ts --status
```

The deleted-account list (`--source v1deleted`) has no accounts behind it, so
`--exclude-returned` means nothing there and its unsubscribe forgets the
address outright. Whether it gets the follow-ups is a judgement call — these
are people who once left — and the day-0 mail is the one they were kept for.

Before the first real send: `--limit` is gone, so send one to yourself by
queuing against a database where only your own profile has promotions on,
or read the rendering by leaving `RESEND_API_KEY` unset and letting the
console sender print it.

`docs/release-runbook.md` → _Sending a campaign_ has the rules; the warm-up
ramp and the send window are in `packages/shared/src/campaigns.ts`.
