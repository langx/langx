# Campaign bodies

The broadcasts `scripts/send-campaign.ts` queues, as the HTML and plain-text
pairs it takes. Table-based, inline-styled, 600px — mail clients, not
browsers. Images are `cid:` references to `src/email/assets/`, attached
inline by the sender so they show in every client without a remote fetch;
`scripts/inline-email-assets.ts` regenerates the module after an image
changes.

Every body carries three tokens, filled per person when the API sends:

| Token                | Becomes                                                       |
| -------------------- | ------------------------------------------------------------- |
| `{{unsubscribeUrl}}` | A signed one-click unsubscribe link. **Required.**            |
| `{{firstName}}`      | The display name, or the name the v1 row carries, or "there". |
| `{{email}}`          | The address, URL-encoded — for `sign-in-link?email=`.         |
| `{{plan}}`           | `Fluent` or `Polyglot` — **`--source v1lifetime` only.**      |
| `{{v1Tokens}}`       | The v1 balance that earned it — **`v1lifetime` only.**        |

The last two are left in the body unreplaced by every other source, on
purpose: a letter that names a tier its audience cannot be told they hold
should be visible in a dry run rather than go out with a blank sentence.

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

## The lifetime letter

Its own mail, to about a hundred people, and the only one in here that can
tell somebody something they do not already know: a v1 balance over a
`LOYALTY_LIFETIME_GRANTS` rung earns a paid tier for life, the restore hands
it over, and somebody who has not come back has therefore earned something
nobody has ever told them about.

```bash
pnpm exec tsx $ENV scripts/send-campaign.ts \
  --campaign 2026-09-v1-lifetime \
  --subject "You have a LangX plan waiting — for life" \
  --html-file campaigns/v1-lifetime.html --text-file campaigns/v1-lifetime.txt \
  --source v1lifetime --confirm
```

No `--exclude-returned`: the audience is read from the staged v1 records and
whoever restored is already gone from it, which is the same fact as "has been
told" — `modules/handles/lifetimeGiftNotice.ts` says it as the grant lands.

The subject cannot name the tier, because a subject is not personalised;
`{{plan}}` and `{{v1Tokens}}` in the body do that. Ten of them hold Polyglot
and the rest Fluent, so a subject naming either would be wrong for somebody.

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
