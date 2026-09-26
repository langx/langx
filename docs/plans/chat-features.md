# Making the chat feel current — roadmap

## Status on 26 September 2026

**Stage 1 under way.** Sixteen pull requests in three stages, each one
separate. Every PR below has a `Status:` line of its own under its heading,
and the PR that does the work updates that line and no other — so two PRs in
flight never edit the same lines of this file.

## Context

Behic wants the chat to feel as alive as WhatsApp, Telegram, Instagram and
HelloTalk. Link previews were already on `main` (`modules/linkPreview`,
`LinkPreviewCard`). A survey of those apps produced a list of twenty features;
each was checked against the code. Some turned out to exist already and some
merged into one another. This file orders what is left, one pull request per
section.

**Already exists**, and dropped from the plan:

- The name and avatar in the chat header open the profile
  (`ChatScreen.tsx:2018` at the time of writing).
- Big emoji (`lib/singleEmoji.ts`, `MessageBubble.tsx:742`).
- A "jump to latest" button with the count of what was missed
  (`ChatScreen.tsx:2347`).
- Archive (`archivedBy`, `setConversationFlag`).

**Not doing, on purpose:** a "who reacted" list — a one-to-one conversation
has two people in it, as the comment at `MessageBubble.tsx:368` says — and
vanish mode or view-once messages.

**Behic's decisions:** voice transcripts run on **our own Whisper service**;
**GIFs stay, through Giphy**, and come last; this plan lives in the repository
as `docs/plans/chat-features.md`, in English like everything else here, and
each PR marks its own item.

## Rules every PR follows

- Every string a person reads goes in `apps/mobile/src/i18n/messages/en.ts`
  and the seven other locales (`catalogs.test.ts` enforces it); a count is a
  plural entry.
- Limits and thresholds live in `packages/shared`. If `PLAN_LIMITS` changes,
  the website and GitBook copies change with it (`CLAUDE.md`).
- Logic goes where it can be tested: `packages/shared/src/*.ts` or
  `apps/mobile/src/lib/*.ts`, with a `*.test.ts` beside it. The mobile vitest
  does not run component tests.
- A new socket event goes through the same guards, quota and rate limit as
  its REST twin.
- Indexes only in `apps/api/src/db/indexes.ts`.
- When an optional service is missing, the feature hides; the app does not
  crash.
- Before every PR: `pnpm -r typecheck && pnpm lint && pnpm format:check && pnpm test`.

---

## Stage 1 — Quick wins

### PR 1 — `@handle` links, in-app langx.io links, and this document

Status: in review

- `docs/plans/chat-features.md`: this plan, in English.
- `packages/shared/src/mentions.ts` (+ test): `findMentions(text)` returns
  `{ start, end, handle }[]`. It follows `HANDLE_PATTERN`; the `@` may not be
  preceded by a letter, a digit or `_ . @ /`, so the email address
  `anna@gmail.com` does not match, nor followed by `[a-z0-9_]`; the handle is
  lowercased. Tests: email addresses, `@deniz.com`, punctuation, an `@` inside
  a URL, overlap with `findLinks`.
- `apps/mobile/src/lib/internalLink.ts` (+ test): `internalTarget(href)`
  returns `{ kind: 'profile', handle } | { kind: 'post', id } | null`. It
  generalises the `WEB_ORIGINS` and handle logic in `scanTarget.ts`, rules out
  route segments with `isReservedHandle`, and builds on `WEB_HOST` from
  `appIdentity.ts`.
- `LinkedText.tsx`: its runs come from `findLinks` and `findMentions` merged
  by start, with a link winning where the two overlap. A mention opens
  `openProfile(handle, from)`; an internal link navigates in the app; anything
  else goes to `openExternal`. New prop `from`.
- `MessageBubble.tsx:770`: when the first link is an internal profile link, a
  new `ProfileLinkCard` (avatar, name, languages) replaces `LinkPreviewCard`.
  An unknown handle draws no card, and the link still works.
- The profile screen already handles an unknown handle
  (`ProfileScreen.tsx:109`).

As built, four things differ from the list above:

- **The card reads `GET /public/profiles/:handle`**, not the member read
  behind `useProfile`. The member read records a profile visit, and a card
  scrolling past in somebody's thread is not a visit. The public read carries
  everything the card draws.
- **`internalTarget` also reads `/profile/<handle>`**, which is what the web
  address bar shows while a profile is open, and it keeps `@langx` and
  `@copilot`, which are real profiles under reserved names. `scanTarget` now
  uses it for web links, so a scanned `/discover` is no longer read as a
  person called "discover".
- **A mention may not be followed by a letter in any script**, not just
  `[a-z0-9_]`: `@ahmetçan` is one word and not the handle `ahmet`.
- **A post link gets no card.** The web build ships the same empty shell for
  every route, so a page preview of it says "LangX" and nothing else; the
  link itself opens the post in the app.

### PR 2 — A "new messages" divider

Status: planned

- `lib/messageGroups.ts`: `MessageRow` gains `{ kind: 'unread' }`, and
  `messageRows(items, unreadCount)` puts the divider above the oldest unread
  incoming message (+ test).
- `ChatScreen.tsx`: before `markConversationRead` is called, take the
  conversation's `unread` count from the conversations cache and hold it in a
  ref; it resets when the screen is left. No scrolling to the divider on first
  open — just the line. Keep it simple.

### PR 3 — A speed picker for voice notes

Status: planned

- `lib/playbackRate.ts`: `PLAYBACK_RATES = [0.5, 1, 1.5]` and `nextRate()`
  (+ test).
- `MediaBubble.tsx:178`: the two-state toggle becomes a 0.5× → 1× → 1.5×
  cycle, shown in the label badge. The `'high'` pitch correction stays.
- `docs/decisions.md` → _A voice note plays at half speed_ gets a note.

### PR 4 — The other person's local time

Status: planned

- `PresenceLine.tsx`, which the chat header uses: when `partner.timezone` is
  present and differs from the reader's own, append "· 23:14". Reuses
  `lib/meetingClock.ts` and updates once a minute. Somebody who hides their
  city already sends no timezone.

---

## Stage 2 — For learning a language

### PR 5 — Reply to, or correct, part of a message

Status: planned

A bubble has no text selection, and one would fight the long-press menu, so:

- `packages/shared/src/sentences.ts` (+ test): `splitSentences(text)` and
  `splitWords(text)`. Hermes has no `Intl.Segmenter`, so these are regular
  expressions, character by character for CJK.
- A new `components/MessagePartsSheet.tsx` shows the message as sentence chips.
- The menu gains "Quote part of it" and "Correct part of it"
  (`lib/messageActions.ts`).
- Schema (`packages/shared/src/chat.ts`): `quote?` on `sendTextMessageSchema`
  and `original?` on `sendCorrectionSchema`, each at most
  `REPLY_PREVIEW_MAX_LENGTH`. The server (`resolveReplyTo` and
  `sendCorrection` in `modules/chat/messages.ts`) **refuses anything for which
  `target.body.includes(x)` is false**, and stores a valid one as
  `replyTo.preview` or `correction.original`. A client that sends neither
  behaves exactly as before.
- Correcting fills the composer with the chosen sentence rather than the
  whole message.

### PR 6 — Tap a word: its translation, and Echo

Status: planned

- The menu gains "Words", which opens `MessagePartsSheet` in word mode
  (`splitWords` from PR 5).
- Tapping a word calls the existing `/translate` — it accepts a single word,
  is cached, and counts against `translationsPer24h` — and shows the
  translation in a card at the bottom with "Add to Echo".
- Echo: the `manual` kind of `captureEchoSchema` (`front` is the word, `back`
  the translation, plus `lang`). It cannot collide with the sentence card
  stored under `msg:<id>`. No new Echo kind.

### PR 7 — Transliteration: how it reads

Status: planned

- An optional `romanize(text, lang)` on `TranslationProvider`, backed by
  Google Cloud Translation v3 `romanizeText` with the same service account.
  **First step: confirm which languages that endpoint supports.** A language
  it does not support gets no button.
- `packages/shared`: `needsRomanization(text)` — whether the text has any
  non-Latin letters, with `\p{Script=...}` compiled inside a `try` the way
  `singleEmoji.ts` does it.
- Route `/translate/romanize`, in the same module as translate, with its own
  cache key and the `translations` quota. The menu gains "Show pronunciation",
  and the result sits under the message the way a translation does.

### PR 8 — Voice note transcripts, on a Whisper service

Status: planned

- A new `apps/stt/` on the `apps/tts` pattern: Python, faster-whisper (MIT),
  the `small` model in int8, `POST /transcribe` taking audio and a language
  hint, an `X-STT-Secret` header, scale-to-zero on Fly, with `fly.toml`,
  `Dockerfile` and `selftest.py`.
- API: `STT_URL` and `STT_SECRET` (`env.ts`, `.env.example`), and
  `createSttProvider` in `apps/api/src/stt/`, which is null when they are
  unset — and then the feature is hidden.
- Quota: `transcriptsPerDay` in `limits.ts` (`PlanLimits`, all three plans,
  `QUOTA_KINDS`, `QUOTA_LIMIT_KEY`) and `TrackedQuotaKind` in `quota.ts`; the
  website and GitBook copies follow.
- Route `POST /messages/:id/transcript`, on the `speak.ts` pattern: cache,
  then consume, then refund on failure. The transcript is written onto the
  message's attachment, so both people see it a second time for free.
- `MediaBubble.tsx`: a "Show text" button. `docs/architecture.md` and
  `docs/self-host.md` are updated.

### PR 9 — "Send later" and "Send in their morning"

Status: planned

- A new `scheduledMessages` collection (`collections.ts`) with its repository
  in `modules/chat/scheduled.ts`. Indexes `{ status, sendAt }` and
  `{ senderId, conversationId }`.
- Config in `packages/shared`: `MAX_SCHEDULED_PER_CONVERSATION` and the
  morning hour (`09:00`).
- Only in an existing conversation and only for text, so the initiation quota
  never comes into it.
- The scheduler follows `modules/push/meetingReminders.ts`: a one-minute
  `setInterval` under `withJobHealth`. A row is claimed atomically from
  `pending` to `sending` with `findOneAndUpdate`, so nothing is sent twice,
  and it is sent **through `sendTextMessage` and `fanOutMessage`** — the same
  guards, so a block or a deleted account is checked again at that moment.
  Started from `index.ts`.
- A long press on the composer's send button offers "In their morning (09:00
  their time)", hidden when there is no timezone, and "Pick a time". Pending
  messages sit under the thread as rows that can be cancelled.

---

## Stage 3 — What a modern chat is expected to do

### PR 10 — Formatting and spoilers

Status: planned

- `packages/shared/src/formatting.ts` (+ test): `*bold*`, `_italic_`,
  `~strikethrough~` and `||spoiler||` become a list of spans — word-boundary
  rules, no nesting, and never inside a link or a mention.
- `LinkedText.tsx` draws the spans; a spoiler opens when tapped.
- `previewFor`, the chat list preview and the push body strip the markers and
  hide what a spoiler covers (`stripFormatting`).

### PR 11 — React with any emoji

Status: planned

- `reactToMessageSchema`: `z.enum(MESSAGE_REACTIONS)` becomes a single-emoji
  check (the `isBigEmoji` / `bigEmojiCount === 1` logic moves to shared, or is
  copied there). `MESSAGE_REACTIONS` stays as the quick strip.
- A "+" on the strip in `MessageMenuHost.tsx` opens an emoji picker — a light
  picker package, with its bundle size checked before one is chosen.

### PR 12 — Muting a conversation

Status: planned

- `mutedBy` joins `setConversationFlag`'s flags; `conversationView` gains
  `muted`.
- Checked in `ws/fanOut.ts:159`, before the push, and in
  `notifications/unreadDigest.ts`. In-app banners go quiet too; the unread
  count keeps counting.
- A swipe and menu entry in `chats.tsx`, and one in the chat header menu; a
  🔕 icon in the list.
- `docs/notifications.md` is updated.

### PR 13 — Search within a conversation

Status: planned

- `GET /conversations/:id/search?q=`: a repository function with a
  participant check and an escaped, case-insensitive regex, scanning one
  conversation through the `conversation_created` index, with a limit and
  pagination, and a rate limit of its own like `discovery/handleSearch.ts`.
  Messages in `hiddenFor` and deleted ones are left out.
- "Search" in the header menu leads to a result list, and a result jumps to
  its message through the existing `listMessagesAround` (the jump logic in
  `ChatScreen.tsx`).

### PR 14 — A conversation picker, forwarding, and sharing a profile into a chat

Status: planned

- A new `components/ConversationPicker`: a sheet over the `chats.tsx` data,
  with search.
- Forwarding: `forward` in the menu (on the `more` page, off in channels).
  Text goes through `sendTextMessage` with a new `forwarded: true` field;
  media reuses the existing attachment, with no second upload. The bubble
  says "Forwarded". The media lock
  (`MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES`) and the quotas apply unchanged.
- Sharing a profile: "Send to a chat" in the profile page menu opens the
  picker and sends the `profileUrl(handle)` text, which PR 1's
  `ProfileLinkCard` draws as a card. **No new message type.**

### PR 15 — Conversation starters

Status: planned

- `packages/shared`: a list of topic ids; their wording lives in i18n
  (`chat.topics.*`).
- In an empty conversation, or one whose last message is N days old (N is
  config in shared), three chips above the composer. A tap writes the topic
  into the composer; sending stays with the person. They sit where the
  existing `ComposerHint` does, and only one of the two shows at a time.

### PR 16 — GIFs, through Giphy

Status: planned

- `GIPHY_API_KEY` is optional (`env.ts`, `.env.example`); without it there is
  no button.
- An API proxy, `GET /gifs/search?q=` plus trending, so the key stays on the
  server; rate-limited, with Giphy's `rating=pg-13`.
- A new `gif` message type, through every place a message type touches:
  `MESSAGE_TYPES`, `sendGifSchema` (`{ giphyId }`), `Message.gif`, `sendGif`
  (which checks the id with Giphy and stores the URLs), `previewFor`, the
  `message:gif` socket event, `messageView`, `MessageDto`, a `MessageBubble`
  branch, the attach menu, and i18n. The media quota and lock apply.
- Giphy's terms: the "Powered by GIPHY" attribution, and GIFs shown from
  Giphy's own URLs.

---

## Verification

- Every PR: `pnpm -r typecheck && pnpm lint && pnpm format:check && pnpm test`.
- A unit test for every piece of new pure logic: mentions, `internalTarget`,
  the unread row in `messageRows`, `playbackRate`, sentences and words,
  formatting, `needsRomanization`, quote validation.
- API changes get integration tests in the existing route and socket style:
  a quote that is not a substring is refused, a muted conversation sends no
  push, a scheduled message is not sent twice, search refuses a
  non-participant, a failed transcript refunds its quota.
- UI: the web build opened in Chromium with two accounts, and screenshots of
  the flow attached to the PR description.
- Every PR marks its own item in this file.
