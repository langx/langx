# Echo — spaced repetition, fed by real conversations

**Status: phases 1 and 2 are built, except the content itself.** This superseded `learn-module.md`, a plan for
the same module under a generic name and with the chat-to-card path scheduled
last; that document was deleted when this one was accepted. Echo turns the
order around: the card you make from a real message is the product, and the
curated packs are what make the tab worth opening before you have any.

Where this document and the code disagree, the code is right and the
paragraph is marked. Three things moved during the build and are corrected
in place below: the server voice, what `audio` and `image` hold, and how the
top answer on a post is chosen.

The design it fits into is [`architecture.md`](./architecture.md); the reasons
the surrounding pieces are shaped the way they are are in
[`decisions.md`](./decisions.md).

## What this is

A Memrise/Anki-shaped review loop with one difference that nothing else in the
category has: **the cards come out of conversations with real people.** While
you are chatting, one tap on a message — theirs or your own, a correction they
wrote, a phrase they used — makes an Echo card. The front is the sentence as it
was written; the back is what it means in your language. The scheduler brings
it back tomorrow, then in three days, then in a week.

Curated packs (English and French first) exist so a new user has something to
review on day one, and so the empty tab does not read as "come back after you
have made friends". They are the same cards in the same queue. A card from a
pack and a card from a chat differ only in `source`.

**Any language, not only the pack languages.** A card's `lang` is any code in
`languages.ts`. The packs are the one thing limited to English and French;
a Russian sentence echoed from a chat lives beside a French pack card, and the
tab groups by language. Nothing about capture knows which packs exist.

**Why now, and why free.** We are in the cold start. A person who signs up
tonight may find nobody to talk to tonight, and a chat app with nobody online
gives them no reason to open it tomorrow. Echo does: a due count is a reason to
come back that does not depend on anyone else being awake. So the whole module
is free on every tier at launch. The plan-limit row exists from day one so that
metering _new_ cards later is a config change, but nothing in the app, on the
website or in the store copy says "forever".

## The name, and what it replaces

`Echo` everywhere — the tab, the routes, the collections, the token kind, the
i18n section. It is the thing coming back to you. The word is not used
anywhere in the codebase or the docs today, so it is safe as an identifier.

What it absorbs:

- **`learn-module.md`**: the scheduler placement, the four-collection split,
  the idempotent review ledger, the token rule and the plan-limit reasoning all
  carried over. The "fifth tab" became the middle tab. The document was
  deleted when this one was accepted.
- **The "vocabulary notebook"** line in `architecture.md`'s P2 list.
- **Phrase cards** stay as they are. A phrase card is a message — both people
  see it, it is written on purpose, with a meaning and an example typed by
  hand. That is a social act and it keeps its place in the composer. What
  changes: every phrase card saved also becomes an Echo card for its author,
  and Echo does not replace the deck screen or its CSV export.

What it does **not** touch: starring (a bookmark, no structure), quizzes as a
message type between two people, the token pool.

## The Add echo gesture

This is the feature. Everything else is the machinery under it.

**One tap, no form.** The existing "Save as a phrase" action pushes a
three-field form, which is right for a phrase card — it is being written for
another person. Echo is written for yourself, so the fields are filled in for
you:

| Field     | From                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `front`   | The message body, as written. A correction message uses the **corrected** text. Media, stickers, meetings and quizzes are not offered the action.                                                    |
| `back`    | The translation into the reader's own language. If the message was already translated in the thread, that translation, with no second request. Otherwise the server translates once at capture time. |
| `lang`    | The language the front is in: the partner's first native language with a written form — the same `translateTargetFor` rule the Translate and phrase actions already use, pointed at the partner.     |
| `example` | Empty. A chat card's front _is_ the example; the sentence was said to you.                                                                                                                           |
| `source`  | `{ kind: 'chat', conversationId, messageId, partnerId }`. Kept so the session can say "Marie, 3 days ago" and deep-link back to the thread with `?at=`.                                              |
| `audio`   | The voice note that answers a `pronunciation` ask on this message, if there is one (Phase 2); otherwise the server voice. See "Audio".                                                               |
| `image`   | The photo the message carried, if it carried one. See "Images".                                                                                                                                      |

Two places to tap, both cheap, both in the first pass:

1. **The long-press menu, on the primary page** — not behind "More…". The row
   is one `actions.push` in `messageActionsFor` and one branch in
   `openActions`; `phrase` is the template.
2. **The translation line under a bubble.** The moment somebody translates a
   message is the moment they met a word they did not know. A small `+ Echo`
   at the end of the translation is the tap that costs nothing to find.

The response is a toast — `Added to Echo` — and the message shows a small mark
so it is not added twice. It cannot be added twice anyway: see the unique
index below. Tapping an already-echoed message offers `Remove from Echo`.

**Text limits.** `front` is capped at `ECHO_FRONT_MAX_LENGTH` (200, the same
as a phrase meaning). A longer message is offered the action with the first
200 characters and a trailing ellipsis in the preview; a person who wants a
specific clause has the phrase-card form.

**Translation cost.** Capture is not a Translate action. A translation that is
already on the message is copied; a missing one is fetched server-side and
metered by `PLAN_LIMITS.echoCapturesPerDay`, not by `translationsPer24h`. The
capture cap is an abuse ceiling — Add echo must not become a free translator —
and is the same on every tier (50). It is not a paywall and it should not be
sold as one.

**The card survives the message.** `front` and `back` are copied at capture,
not referenced. An edited or deleted message, a deleted account, a left
conversation: the card stands, the deep link simply stops resolving.

## Feed posts are a source too

The feed is the other place a learner meets a sentence worth keeping — their
own, once somebody has corrected it, or a stranger's that a native reader
recorded. Both become Echo cards with the same tap.

| Field    | From                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `front`  | The post body. If the post has corrections, the **top correction's `corrected` text** — the corrected sentence is the thing to learn, and the top one is what the feed already ranks first.                                                                                |
| `back`   | The translation of the original body into the reader's language, by the same rule as a chat capture.                                                                                                                                                                       |
| `lang`   | `post.language` — the language the author is learning, which the post already carries.                                                                                                                                                                                     |
| `audio`  | On a pronunciation post, the top answer's `media` and, if recorded, `slowMedia`. A native speaker saying the sentence, already uploaded. "Top" is the **oldest**, not the most-liked — `readAnswerSummary` sorts by `createdAt`, on the feed's own "first, not best" rule. |
| `source` | `{ kind: 'post', postId, authorId }`, `sourceKey: post:<id>`. Deep-links to the post detail.                                                                                                                                                                               |

Entry points: the post's action row in the feed and the detail screen. Same
capture cap, same repository gate (`listPost` access rules apply before the
card is written).

## A card you write yourself

The four sources above all name something that already exists; this one does
not. A word heard out loud, read on a sign, or remembered from a lesson has
nothing to be captured from, and until `manual` arrived there was no way to
keep it.

`+` on the cards screen opens a form with three fields: the sentence, what it
means, and which language it is in. The language is asked for here because
this is the one card that cannot be told — every other path reads it off the
message or the post.

**Leaving the meaning empty asks for it.** `captureManual` runs the same
`backFor` every other capture runs — the offered translation, then the shared
cache, then the provider — so writing down a single word still produces a
whole card, and an unconfigured provider leaves the back empty rather than
failing the save. A card already in the reader's own language skips the call:
the answer would be the sentence back again.

**It is one capture like any other.** Same `echoCapturesPerDay` ceiling, same
402 and the same alert, which offers nothing to buy.

**Idempotent on a client-minted id.** A hand-written card has no natural key,
so the screen mints a `clientId` once and it becomes `manual:<id>`. A save that
times out and is retried lands on the card the first attempt may already have
written; `card_source_unique` decides, exactly as it does for a message
captured twice. The same device and the same argument as `reviewId`.

### The language became editable

The edit screen used to change only the two lines, on the argument that the
language is a _fact_ about the message rather than a choice. On a manual card
it is a choice, and a choice made wrongly has to be correctable.

The field is offered on **every** card rather than only manual ones — a product
decision, recorded here with its cost rather than hidden: relabelling a card
made from a chat message leaves it disagreeing with the thread it links to.
Nothing breaks. `lang` is read only by the language chips and the summary's
grouping, so the card moves between chips, which is what somebody correcting
it wants. The picker is drawn only when the card's current language is among
the ones you are learning and there is more than one to choose from.

## Audio

Every card can be heard. One field — `audio?: { url, slowUrl?, origin: 'post'
| 'chat' | 'pack', speakerName? }` — and the sources the session prefers, in
order:

**A URL, not a storage key**, and this document said key until the code was
written. Every piece of media in this app is a `Media` with a `url`;
`keyFromPublicUrl` returns null for every attachment imported from v1, and
neither the app nor the API has anything that turns a key back into
something `expo-audio` can play. `image` holds a URL for the same reason.

1. **A real person who already recorded it.** A pronunciation post's answer
   (`pronunciationAnswerSchema.media`, `slowMedia`). Nothing new is recorded
   and no new interface exists for it; capture copies the URL. This is the
   differentiator: Memrise plays a stranger's sample, Echo plays the person
   you were talking to. Phase 1.
2. **A voice note in the chat, answering a `pronunciation` ask.** Phase 1,
   and it replaced the server voice below. The link used to be a guess — any
   audio message quoting the sentence, resolved in the client from whatever
   was on screen — so a recording now says which ask it answers
   (`answersMessageId`) and the asked message is stamped `answeredAt`, the
   way `sendCorrection` already stamps `correctedAt`. Capture copies the
   URL, so the card keeps playing after the recording is deleted. A card
   with no recording offers **Ask the feed how it is said** — see _Later,
   without adding a screen_; it used to open the conversation and now opens a
   pronunciation post, and an answer to that post can be kept on the card in
   one tap.

3. **Text-to-speech, on the server — on request, from the card.** Built, and
   it was refused first. Google Cloud Text-to-Speech was costed before it was
   written: $4 per million characters for a Standard voice, $16 for Neural2,
   and the problem was the ceiling — `echoCapturesPerDay` bounds how many
   cards a person makes and not what they cost, and a thousand daily users at
   the cap is thousands of dollars a month for a synthetic voice that is worse
   than the real one. What changed is who pays per character: nobody. The
   packs had already settled on Kokoro-82M (Apache-2.0; see source 4), the
   same model now runs in `apps/tts`, a private Fly app that sleeps between
   requests, and a reading costs a few CPU seconds on a machine of ours. The
   ceiling that was the objection became `echoVoicesPerDay`: one unit per
   card, however many voices — a ceiling on how long that machine stays
   awake, not a meter on a bill.

   The shape is the one this paragraph reserved before anything existed: an
   optional `tts/` provider beside `translation/`, `POST /echo/cards/:id/voices`,
   and `echo/tts/<lang>/<voice>/<sha1(text)>.m4a` in storage, looked up first
   through `echoVoiceCache` so a sentence somebody else already had read costs
   the next person nothing — not even a quota unit. The readings land in
   `voices`, the same field a pack fills, under the people and labelled by
   register only. **On request, never on capture**: the button sits on a card
   that has no readings, and a person who already got the sentence from the
   partner who said it has no reason to press it. Rewriting the sentence, or
   its language, takes the readings off the card — they read a line that is
   gone — and the button comes back for the new one; the files stay, because
   they are content-addressed and may be on somebody else's card.
   **Thirty languages** since chat started reading messages aloud
   too: Kokoro still reads the six it was trained for, and Piper reads the
   other twenty-four (`SPEECH_VOICES` is the list, and `ECHO_SYNTH_VOICES`
   remains Kokoro's half of it). The app hides the button elsewhere — and
   "elsewhere" is a licence question rather than a modelling one, since the
   catalogue's only Turkish, Arabic, Japanese and Korean voices are
   CC BY-NC. A person who already recorded the sentence is still both
   cheaper and the actual differentiator.

4. **Pack recordings. Built.** A Wikimedia Commons file on the pack item,
   played from Commons rather than copied into our storage — the decision
   `build-pack.mjs` said nobody had taken. **Its cost, stated rather than
   absorbed:** a file renamed or deleted on Commons silences that card. That is
   the opposite of the rule the other three sources follow, and it is accepted
   only here, because a pack is content we can re-seed where a captured
   sentence is somebody's own.

   Nothing is assumed from a filename. `add-audio.mjs` looks every candidate up
   and keeps only permissive terms — the three English drafts came back with
   **six different licences across 130 files**, so treating Commons audio as
   uniformly CC BY-SA would have been wrong about more than half of them. A
   file whose author cannot be read is refused rather than played uncredited,
   and the speaker's name travels to `EchoAudio.speakerName`, which the session
   already draws as "Spoken by {name}". See `content/echo/ATTRIBUTION.md`.

   133 of 870 items in the English drafts have one. The rest keep no audio:
   phrases mostly have no recording anywhere, and Common Voice (CC0) or our own
   is the answer for them.

5. **A recording the owner made for the card**, from the edit screen. The one
   source that is not a copy of something else, and `origin` says so: `post`,
   `chat` and `pack` all name a file something else still plays, and `self` is
   the card's own. That distinction is what `updateCard` reads before deleting
   an object — see "A card's own files" below.

Not on the device. `expo-speech` would do the same job for free, but it is a
native module, so it waits for a store build and speaks with whatever voice
the phone happens to have. A reading made on the server is a file like every
other recording — the same on iOS, Android and the web, and there the next
time the card comes up without being made again.

Playback goes through `expo-audio`, which the app already uses for voice
notes. The session says who is speaking — "Léa" or "synthetic voice" — so a
human recording is never mistaken for a machine and the reverse. A listening
card type — hear it, then reveal — rides on the same field in Phase 3.

## Images

One field, `image?: { url, width?, height?, origin: 'chat' | 'pack' | 'self' }`:

- **The photo that came with the sentence.** A chat message that carried a
  photo and a caption gives the card the photo; capture copies the URL.
  Marie's picture of the market above "On y va demain ?" is a better cue than
  any illustration, and it costs nothing. Phase 1.

  This is why the **Add echo action is offered on an `image` message**, which
  the table above says it is not. A photo with a caption is typed `image`;
  refusing the type would have left the field with no way to be filled from a
  chat and this section untrue. The caption is the front, the photo is the
  cue, and a photo with no caption is still refused.

- **A cue for every pack item.** Each item carries `image: 'cue:<slug>'`, and
  the slug names a picture in the bucket. A slug rather than a file per item,
  because the cue is the _concept_: one drawing of a handshake serves the
  sixteen phrases that are about agreeing, so 808 cards resolve to 348
  pictures.

  `tools/echo-content/images/cues.<lang>.json` says which phrase points at
  which, one file per pack language and one line each, and is the half worth
  reviewing. `build.mjs` beside it derives
  everything else: the pictures, the `image` fields, `credits.json`, and the
  `contentVersion` bump when a cue actually changed.

  **All 348 are drawn for this app**, their shapes in `drawings.mjs` to
  `ILLUSTRATION.md`. The set began as OpenMoji glyphs on our own plate and was
  replaced a batch at a time; what is left of that is `concepts.json`, a table
  of what each emoji is called. Nothing borrowed means nothing share-alike —
  see `content/echo/LICENSE`.

  **They ship as PNG**, though they are drawn as vector. expo-image hands an
  SVG to each platform's own decoder, and iOS's mishandles elliptical-arc
  commands whose flags are packed — the form every minifier emits, and so the
  form most of OpenMoji is written in. A flat raster has no decoder to
  disagree about.

  **Nothing rendered is committed.** The PNGs go to `out/`, which is ignored,
  and from there to the bucket by `upload-echo-cues.ts` — the same shape as
  the synthesised readings. The repository keeps the decision, the geometry
  and the provenance; twelve megabytes of regenerable binary in a public repo
  buys nothing.

  **The plate is inside the picture**, not drawn by the app. A card's picture
  is one URL with no theme to it, and every drawing is bounded by a dark ink
  contour; unplated on a dark background the contour goes and the picture with
  it. One light plate baked in is correct in both themes, and is why this
  needed no change in `session.tsx` at all.

  This section used to read _"nouns you can point at — bread, train, dog"_,
  with abstract words left plain. There are no nouns in these packs — eight
  hundred phrases, every one of them `kind: 'phrase'` — so that rule never
  fired once and the field stayed empty from the day it was specified. A cue
  for the meaning is the thing a phrase can actually have. Where no honest
  picture exists the item still keeps none.

- **A picture the owner put there**, from the edit screen. `origin: 'self'`.

**Still not generated.** An image per card costs money and moderation on every
capture and drifts in style. That one stays out.

~~**Not uploaded either.**~~ This section used to rule that out too, on the
argument that a form is the wrong price for a gesture whose whole point is one
tap — and said it would stay out "until somebody asks for them twice". Somebody
asked. The argument survives intact because the form is not on the capture:
**Add echo is still one tap and still asks nothing.** Attaching is on the edit
screen, which is a different place, reached on purpose, by somebody who has
already decided this particular card needs a picture or a voice.

### A card's own files

The edit screen attaches, replaces and removes both the picture and the
recording. Three things make that safe to have added:

- **`origin: 'self'` is a fact, not a label.** Every other origin names a copy
  of an object a message, a post or a pack still plays. `updateCard` deletes
  the object behind a replaced or cleared file **only when its origin was
  `self`** — a bare `deleteObjects(previous.url)` there would look right and
  would take a recording out of somebody's thread because a card stopped
  pointing at it.
- **The server builds the field.** A client sends the `Media` an upload
  returned and nothing else; `origin` is stamped here, so nobody can file their
  own recording under a partner's name.
- **One prefix, one purge.** Uploads are signed into `echo/<userId>/` by
  `POST /echo/upload-url`, and the account purge sweeps that prefix beside
  `feedback/`. The card rows are deleted by the same purge, so a prefix is the
  handle that does not depend on which runs first.

`image` and `audio` are three-state on the wire — absent leaves the file alone,
`null` takes it off, a `Media` replaces it. A photo and a recording saved
together cost **one** unit of the daily media budget, as a pronunciation
answer's two takes do.

## What the existing codebase already decides

Unchanged from the earlier plan, restated because each one has a way of being
violated by accident:

- **Levels are not CEFR.** Pack levels reuse `LANGUAGE_LEVELS`
  (`absoluteBeginner | beginner | intermediate | fluent`). No second scale.
- **Eight interface locales, one hundred and eighty languages.** A pack item's
  `gloss` is `Record<Locale, string>` — the known side is drawn from the
  eight, never the hundred and eighty. The fallback when a learner's own
  language is not among them is `nativeLanguages[0]` → interface locale →
  `en`, in exactly one function.
- **No handler queries a collection directly**; indexes live in
  `apps/api/src/db/indexes.ts`; thresholds live in `packages/shared`; no
  user-facing string is written in a component. Card _content_ is data, not
  interface copy: `t('echo.session.done')` is a key; the French on the card is
  not, and never goes through the i18n files.
- **Local persistence is one JSON file**, written with `expo-file-system`,
  which was already in the binary. It holds the due queue, the counts and any
  grades waiting for a network — see "Offline review needs no build". There is
  still no local _copy of the card library_, and no offline capture.
- **Socket events pass through the same guards as REST.** Capture goes over
  REST; there is no realtime need, and REST is where the quota check already
  lives.

## Data model

Four collections, registered in `collections.ts`:

| Collection      | Holds                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `echoCards`     | Per-user: `{ userId, lang, front, back, example?, audio?, image?, askedPostId?, source, sourceKey, srs: { state, due, interval, ease, reps, lapses, lastReviewedAt }, createdAt }` |
| `echoReviews`   | One row per graded card: `{ userId, reviewId, cardId, grade, at, durationMs }`                                                                                                     |
| `echoPacks`     | Content: `{ _id: 'fr:beginner', lang, level, itemCount, contentVersion, glossLocales }`                                                                                            |
| `echoPackItems` | Content: `{ packId, index, kind: 'word' \| 'phrase', text, gloss: Record<Locale, string>, example?, freqRank, contentVersion }`                                                    |

`source` is a tagged union:

```
{ kind: 'chat',   conversationId, messageId, partnerId }
{ kind: 'post',   postId, authorId }
{ kind: 'phrase', phraseCardId, conversationId }
{ kind: 'pack',   packId, itemId }
{ kind: 'manual', id }
```

`sourceKey` is the string form of it — `msg:<messageId>`, `post:<postId>`,
`phrase:<id>`, `pack:<itemId>`, `manual:<id>` — and exists for one index.

The card carries its own text even when it came from a pack. Content gets
re-seeded (a fixed gloss, a better example) and a re-seed must never touch
anybody's schedule; copying the text at intake is what makes the two
independent. The price is that a corrected gloss does not reach cards already
made. That is the right price: a card somebody has reviewed six times is theirs.

Indexes, in `indexes.ts`:

- **unique `{ userId, sourceKey }` on `echoCards`** — one card per message,
  per post, per phrase card, per pack item. Add echo twice is a no-op, not a duplicate.
  An invariant, like `conversation_term_unique` on `phraseCards`.
- `{ userId, srs.due }` on `echoCards` — the due queue, the only hot read.
- `{ userId, lang, createdAt: -1 }` on `echoCards` — the "from your chats"
  list on the tab.
- **unique `{ userId, askedPostId }` on `echoCards`**, partial on
  `askedPostId: { $exists: true }` — which of your cards asked this post. One
  card per post per person, which is what makes the reverse lookup a point
  read. Partial and not sparse: almost no card has ever asked anything, and a
  plain unique index would collide on the missing value.
- **unique `{ userId, reviewId }` on `echoReviews`**, `reviewId` minted by the
  client. A session submitted twice because the network dropped and the app
  retried must be physically incapable of advancing a card twice or paying
  twice. Idempotency by index, not by the handler remembering to check. Same
  device as `{ job, periodKey }` on `jobRuns`.
- unique `{ packId, index }` on `echoPackItems`, so the seed script is
  idempotent by construction.

## The scheduler

`packages/shared/src/srs.ts`: a pure `schedule(card, grade, now)` plus an
`SRS_RULES` config — starting ease, floor ease, interval multipliers, the
lapse penalty, `sessionSize`, `learningSteps`. No dependency; unit-tested in
vitest without a database.

**SM-2 first, FSRS later.** FSRS schedules better but wants parameters fitted
to a review history that does not exist yet. The algorithm sits behind one
function so replacing it is contained.

**One implementation, both sides.** The client computes the next due date
optimistically so a session feels instant; the server is authoritative and
recomputes from the ledger. They are the same function in `shared`, for the
reason `effectivePlanTier` is in `shared`: two implementations of one rule is
how the app says "due tomorrow" and the API says "due in three days", and the
mismatch reads as a bug in the feature rather than a duplicated rule.

**Four grades: Again · Hard · Good · Easy.** Self-graded reveal cards, not
multiple choice, in the first pass. A chat card has no distractors to draw from
— the alternatives would have to be invented, and a wrong invented alternative
teaches the wrong thing. Recognition (front → back) came first; **production — writing the sentence
from its meaning — is built**, and pack-only multiple choice is still Phase 3.

Production is a _presentation_ of the same card, not a second schedule: one
row, one `srs`, one queue. It is asked only once a card has graduated out of
the learning steps, only when the front is short enough to type on a phone
(`ECHO_PRODUCTION_MAX_LENGTH`), and only on every other review, by parity of
`reps` — deterministic, so leaving a session and coming back does not change
what the card asks. The typed answer is compared with diacritics, case,
punctuation and spacing stripped, and the result is **reported, never
graded**: only the person knows whether they knew it or guessed it.

## Client

Five tabs, Echo in the middle: **Discover · Chats · Echo · Feed · Me**. The
tab-layout comment said "the four tabs, and only the four tabs"; the number
was never the rule — the rule is that nothing which is not a tab may be
registered there — and it now says five and states the rule instead.
Icon: Feather `repeat` — the same glyph carries the toast and the bubble mark.

| Route                | Screen                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `(tabs)/echo.tsx`    | The tab root: due count and the one yellow button, then "From your chats" (latest cards, partner face, tap to open the thread), then Packs |
| `echo/session.tsx`   | The review: card, reveal, four grades, progress; the end-of-queue screen                                                                   |
| `echo/pack/[id].tsx` | A pack: progress, "Start" / "Continue", and the session's worth of items the button would add — not a page of the whole pack               |
| `echo/cards.tsx`     | Every card, filter by language and source, edit or remove                                                                                  |
| `echo/new.tsx`       | A card written by hand: the sentence, what it means, the language                                                                          |
| `echo/edit.tsx`      | Everything but the source: the two lines, the language, the picture and the recording                                                      |

**Review asks which language.** A deck drawn across every language at once is
not a study session — it is a French word, then a Russian one, then French
again, with the reader switching alphabets between cards. The chips on the tab
filter the _list_, and "All" is a reasonable thing to browse; it was never a
reasonable thing to be quizzed on, and passing it straight through to the
session is what made it one. So the button asks, and only when it has something
to ask: a chip already chosen is an answer, and one language with cards due is
not a question. There is deliberately **no "All languages" row** — the mixed
deck is what this removes, not a choice it offers. The pack screen passes
`pack.lang` for the same reason: you pressed start on a French pack.

The session screen is the whole feature as far as a user is concerned. What
decides whether it is opened twice is how it ends — a done screen that says
what happened and when to come back — and how it behaves on a bad connection:
grades are queued in memory and submitted as one idempotent batch at the end,
so a dropped socket in the middle of a session loses nothing.

**Guests** see the tab with the packs and are gated on the first review, like
every other guest gate.

**i18n**: one `echo.*` section in `en.ts`, translated into the other seven
before it compiles. Plurals for the due count.

## Content: English and French first

**The machine cannot pick the sense, and that is measured rather than
feared.** The first `tools/echo-content/build-pack.mjs` pulled the
sense-carrying translation tables out of the English Wiktionary as raw
wikitext, which is the right source — but taking the first block gave the wrong
sense for three of the six beginner words that resolved at all: _train_ as the
back of a dress, _dog_ as a verb, _water_ as watering a garden. Scoping the
search to the word's part of speech made it worse, turning three wrong answers
into no answer, because the tables are not reliably inside the section they
belong to.

**It reads kaikki.org now, and drafts the most-translated sense.** Two changes,
and the paragraph above is the reason for both. wiktextract gives the same
tables already parsed — each translation tagged with its sense, beside the
definition and the examples — so nothing depends on where the markup put a
table. And the draft is no longer the first sense but the one the most
languages have a word for, which is the only usage signal the data carries;
Wiktionary's own order is by etymology and age, which is how the dress came
before the vehicle. On those six words it is six out of six, measured in
`content/echo/ATTRIBUTION.md`.

**The gate does not move.** Six is six, not a guarantee: `be` drafts as _to
occupy a place_ rather than as the copula, and no count decides that. What
changed is that the reviewer now reads a definition and the runner-up senses
instead of a bare word.

So the pipeline drafts, writing the sense it chose beside every gloss, and
marks the file `"reviewed": false`. `apps/api/scripts/seed-echo-packs.ts`
refuses to write a file that still says that. The gate lives in the seed
because the seed is the last thing that runs before a learner reads the
content, and a wrong gloss is worse than no pack.

What remains for the first pack is therefore a **reading**, not a build: pick
the phrases, read the draft, fix what is wrong, set `"reviewed": true`. `content/echo/en/absoluteBeginner.json` is that draft — 289
phrases, 154 from the phrasebook and 135 from Tatoeba, `"reviewed": false` and
unreadable by the seed until somebody has been through it. Every one of them is
inside `ECHO_PRODUCTION_MAX_LENGTH`, so a pack card can be asked for by typing
as well as by recognition, which a three-hundred-character sentence from a chat
never can.

The first wave is two languages, chosen by hand rather than from the v1
distribution, because two is what can be read end to end by a human before it
ships. The matrix is 2 languages × 4 levels × 8 gloss locales.

**A pack is phrases, at every level.** This section said "words and short
phrases from a frequency list" and the first draft built to it was three
hundred single words. That is a different product wearing the same shape. A
card in Echo is a sentence somebody said to you — the front is "On y va
demain ?", not _demain_ — and the packs exist so that the tab is worth opening
before you have any of those. A pack of bare words teaches the tab to be a
dictionary and then hands the learner something else entirely on their first
real card. This section already said phrases and idiom have to dominate at the
two upper levels; the correction is that they dominate at all four.

So: set expressions and short sentence patterns. _Excuse me_, _be careful_,
_can I come in_ from Wiktionary's English phrasebook, which is a curated
category with translations; and short sentences — _Are you sure?_, _Why do you
ask?_, _I miss you._ — from Tatoeba, where the translation into each of the
eight locales was written by a person. No dictionary has an entry for "Why do
you ask?", and the gloss of a sentence is exactly the thing a machine must not
invent.

**Levelling a phrase is levelling its hardest word.** The CEFR-J band of the
rarest word in it, through the same `CEFR_TO_LANGUAGE_LEVEL` that
`packages/shared/src/level.ts` already holds — so a phrase all of whose words
are A1 is an `absoluteBeginner` phrase, and no second scale appears anywhere. A
word CEFR-J does not list counts as **above** the band rather than below it,
which is what keeps _beware of the dog_ and _bon voyage_ out of a first pack.

**A phrase is more than one word.** The phrasebook category carries `hello`,
`yes` and `sorry`, expressions in the sense a phrasebook means and single words
in the sense this does. Six of them opened the first draft, which is the
dictionary the module exists not to be; the picker now requires a space.
Nothing is lost that a learner does not meet in the first sentence that greets
them.

**Scope**: three packs per language, at `absoluteBeginner`, `beginner` and
`intermediate`, about 300 phrases each with a gloss in eight locales. A
sentence is its own example, so `example` is filled only for a phrasebook
entry, where the dictionary has one. Each is read end to end by a person before
its `"reviewed": true`; they are drafted together because the Tatoeba exports
are two hundred megabytes and one pass answers every level.

**`fluent` has no pack, and the reason is the eight locales rather than the
level.** Requiring a human translation in all eight is what makes a gloss
trustworthy, and Arabic is where it binds: across every level Tatoeba links
Arabic to 16,322 of the 657,063 candidate sentences, 2.5%. At A1 a pool that
large still leaves a thousand; at C1 and C2 it leaves four. Filling the top
level means either sourcing it somewhere other than Tatoeba or letting a pack
ship in fewer locales than eight — both decisions, neither a default, and
neither needed before the three below it have been read.

**Sources and licence** — verify at the version downloaded, record it:

| Source                            | Gives                                          | Licence                            | Use                                                 |
| --------------------------------- | ---------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Lexique 3 (lexique.org)           | FR: 142k words, frequency, IPA, part of speech | CC BY-SA 4.0                       | French ranking and phonetics                        |
| CEFR-J Vocabulary Profile 1.5     | EN: 7,798 headwords with a CEFR level          | Free commercially, **if cited**    | Which English words are in which pack               |
| NGSL (Browne, Culligan, Phillips) | EN: 2,801 core words with a frequency rank     | CC BY-SA 4.0                       | The order they go in, and `freqRank`                |
| Wiktionary frequency lists        | EN / FR / RU subtitle-derived lists            | CC BY-SA                           | Cross-check; the Russian list when a RU pack comes  |
| Wiktextract (kaikki.org)          | Senses, definitions, examples, IPA, recordings | CC BY-SA 4.0                       | Glosses and examples for a phrasebook entry         |
| Wiktionary `English phrasebook`   | 460 curated everyday expressions               | CC BY-SA 4.0                       | Half the phrases in a pack                          |
| Tatoeba                           | Short sentences, translated by people          | CC BY 2.0 FR                       | The other half: sentence patterns and their glosses |
| Lingua Libre (Wikimedia Commons)  | Human word recordings, per language            | CC BY-SA 4.0                       | Pack audio for single words                         |
| Common Voice                      | Sentence recordings                            | CC0                                | Sentence audio, later                               |
| CEFRLex — EFLLex, FLELex          | EN / FR lemmas by CEFR level                   | CC BY-NC-SA 4.0                    | **Out** — non-commercial. The French levels problem |
| Kelly lists (Leeds)               | EN / RU learner lists by CEFR                  | CC BY-NC-ND-SA, offline since 2026 | **Out** — non-commercial, no derivatives            |
| Oxford 3000 / EVP (Cambridge)     | EN word lists by CEFR                          | none granted                       | **Out** — no licence; the MIT mirrors have no right |
| Anki shared decks                 | —                                              | none stated                        | **Out** — no provenance                             |

Glosses are drafted from the sense-carrying source, never machine-translated
from a bare lemma — `light`, `bank` and `right` come back as whichever sense
the machine guessed. Example sentences are written by us where we can, so
nothing share-alike binds the text; Tatoeba is the fallback.

The pipeline is two scripts: `tools/echo-content/pick-phrases.mjs` chooses the
phrases and carries Tatoeba's glosses out with them, and
`tools/echo-content/build-pack.mjs` writes the pack, glossing from kaikki
anything the first did not already gloss. Both need `bzip2` on the path, which
is what Tatoeba publishes into and what node cannot decode. Every input is a
file somebody downloaded — the CEFR-J profile, the NGSL lists, and the
phrasebook category listing, which was a request the tool made until Wikimedia
answered 429 to it three times running.

`ts-fsrs` (MIT) is the obvious later replacement for the scheduler; it is
noted here so nobody writes a second FSRS.

**Where it lives**: `content/echo/<lang>/<level>.json` in this repo, with its
own `LICENSE` and `ATTRIBUTION.md`. A share-alike source binds the derived
content, not the code; the directory's licence file is what says so. One repo
keeps the seed script and the data it seeds in one commit. Loaded by an
idempotent seed script keyed on `{ packId, index }`, run at deploy like the
ETL.

Not in `packages/shared` — that package is config, and a thousand cards would
be a data blob every consumer parses at import.

## Plan limits, tokens, streak, push

**Plan limits** — four rows in `PLAN_LIMITS`, three of them present from day one:

| Row                  | free | pro  | pro_plus | Why                                                      |
| -------------------- | ---- | ---- | -------- | -------------------------------------------------------- |
| `echoNewCardsPerDay` | null | null | null     | The one row that may be metered later. Free at launch.   |
| `echoCapturesPerDay` | 250  | 250  | 250      | Abuse ceiling on server-side translation. Not a paywall. |
| `echoReviewsPerDay`  | null | null | null     | Reviews are **never** capped, on any tier, ever.         |
| `echoVoicesPerDay`   | 10   | 50   | 100      | Cards read aloud by the server voice; one unit per card. |

If a number changes it changes by hand in three more places —
`website/src/lib/data/plans.ts`, `website/src/lib/data/features.ts`, and the
GitBook docs. Nothing checks that.

**Tokens.** Reviews must not enter the daily pool split: everything scored
there is done with another person, the pool is zero-sum, and a solitary,
repeatable action would dilute the people it exists to reward. Instead a new
`TOKEN_KIND` `'echo'`: **5 tokens per completed session** of
`SRS_RULES.sessionSize` cards, capped at **5 sessions a day** in
`TOKEN_RULES.caps.echoSessionsPerDay` — 25 a day, an eighth of the message cap,
so it can never outpay talking to a person. Awarded on the review batch, so the
unique `{ userId, reviewId }` is what makes double payment impossible.

**Streak.** Opening the app already holds the streak (`POST /me/check-in`);
what a meaningful action does is pay the milestone. **A completed session is a
meaningful action.** The milestone tokens do not come from the pool, so nobody
is diluted, and in a cold start a session is the one kind of practice that
does not require somebody else to be online. A single card is never enough —
that would be "open the app and tap once" under another name. This changes
what the streak means, from a social commitment to a practice commitment, and
it is taken on purpose.

**Push.** One new notification kind, `echo` — push on, mail off — firing at
19:00 local when cards are due and the person has not reviewed that day,
period key the local day. Adding a kind means a preference row and copy in
eight locales; folding it into `streak` would mislabel it. Goes into
[`notifications.md`](./notifications.md) when built.

## Phases

| Phase | Output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Done when                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `srs.ts` + `SRS_RULES`; the four collections and indexes; `POST /echo/cards` (capture from a message or a post), `GET /echo/queue`, `POST /echo/reviews` (batch, idempotent), `GET /echo/summary`; Add echo in chat (menu + translation line) and on feed posts; the tab, session, done and cards screens; phrase cards mirrored into Echo; a post's pronunciation answer and a chat voice note attached as the card's audio; a message's photo attached as the card's image. **Not** the server voice — see "Audio" | A card made from a message in one chat is reviewed, graded, and comes back on the day `srs.ts` said. A review batch sent twice advances once. |
| 2     | **Built:** content pipeline and licence file; seed script; pack screen; `echoNewCardsPerDay` intake; token kind and cap; the streak rule; the 19:00 push; the tour step. pack audio, from Commons with its licence checked per file; the three **English packs**, 809 items, read in two passes and marked `"reviewed": true` — see `content/echo/ATTRIBUTION.md` for what that review covered and what it only sampled. **Not built:** the `fr` packs and OpenMoji icons                                            | A new account with no conversations opens Echo and has something to do within ten seconds.                                                    |
| 3     | **Built:** production cards, offline review. **Left:** pack multiple choice, listening cards, the upper two levels, more languages, FSRS                                                                                                                                                                                                                                                                                                                                                                             | Each is its own decision; none blocks 1 or 2.                                                                                                 |

Phase 1 is the whole promise and is deliberately content-free, so it cannot be
blocked by licensing. Phase 2 is where content can fail; nothing in 3 is worth
starting until one pack exists end to end.

## Over the air, or a build

`architecture.md` → "Over-the-air updates": screens, logic, copy and the API
go out by EAS Update; a new native module, a new permission or an SDK bump
needs a build, and `runtimeVersion` is a fingerprint, so a bundle that changed
the native side reaches nobody until the matching build ships.

| Piece                                                                  | Ships by | Why                                                             |
| ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| The tab, capture, session, cards, feed capture, API, `packages/shared` | Update   | JavaScript and the server                                       |
| Audio playback — post answers, chat voice notes, the server voice      | Update   | `expo-audio` is already in the binary; synthesis is server-side |
| Card images — message photos, OpenMoji SVGs                            | Update   | Storage keys and inline SVG                                     |
| Packs, tokens, streak rule, the `echo` push                            | Update   | Data, rules and the existing push path                          |
| Offline review (`expo-file-system`)                                    | Update   | **Not** a new native module — see below. Echo needs none        |

## Offline review needs no build

This document said offline meant `expo-sqlite`, and therefore a store build,
and that it was the one native module Echo would ever want. That was wrong,
and the correction is worth stating because the wrong version is the
expensive one.

A due queue is ten cards and a summary is four numbers. That is a few
kilobytes of JSON, and `expo-file-system` has been in the binary since the
meeting file and the deck export — three call sites predating Echo. So the
whole of offline review ships **over the air**: the queue and the counts are
written on every successful fetch, a session with no network draws from that
copy, and grades given in a tunnel are written to the device before the
screen says anything.

SQLite would have bought a migration story, a native module and a build, to
hold less data than one chat thread.

Two rules make it honest rather than merely possible:

- **A saved queue expires after three days.** The schedule is the point of the
  module, and a queue from last month would put a card in front of somebody
  that the server thinks is not due for a fortnight. Showing nothing is better
  than teaching the wrong thing about when cards come back.
- **A grade is never dropped for being old.** It is work somebody did. The
  `reviewId` is minted when the grade is given, so the batch sent a day later
  is the same idempotent batch, and `user_review_unique` decides.

The one thing still deliberately absent is offline _capture_. Adding a card
needs the server to translate it, and a card with no back is not a card.

## Decisions taken

**A pack is phrases, not words** — 14 September 2026, after the first draft
came back as three hundred single words and read as a dictionary. Set
expressions and short sentence patterns at all four levels; a phrase's level is
the level of its hardest word. The reasoning is in "Content" above, and it is
here because it is the kind of thing that gets quietly undone by whoever next
finds a good frequency list.

Four questions the first draft left open, closed on 13 September 2026:

1. **Streak** — a completed session is a meaningful action. Never a single
   card.
2. **Tokens** — 5 per completed session, 5 sessions a day, outside the pool.
   Shipping with a small award beats adding one later only if it never has to
   be taken back; 25 a day is small enough to keep.
3. **Tour** — no Echo step in Phase 1. A step is added when the packs land,
   because introducing an empty tab is an empty promise.
4. **First pack** — 300 items at `absoluteBeginner` per language first; the
   700-item `beginner` pack when a human has read it end to end.

## Later, without adding a screen

Three things the first three phases do not need and that ride on machinery
already there. None adds a screen; each is one branch in code that exists.

1. ~~**Ask the partner from a card.**~~ **Built in phase 1, and since
   replaced.** It opened the conversation the card came from, with the
   composer armed for a `pronunciation` ask. Two things were wrong with that.
   It existed only for cards whose `source.kind` is `chat`, so a pack card —
   the kind most likely to have no recording — was offered nothing. And it
   asked one person, who may never answer.

   **Now it asks the feed.** A card with no recording offers "Ask the feed how
   it is said", which opens `compose` as a `pronunciation` post with the
   sentence, the card's language and the card's id already in it. Nothing new
   was written for the composer; the section and the screen were both already
   there. `echoAsk.ts` decides whether the button is drawn at all, refusing a
   front longer than `MAX_POST_LENGTH` and a language its owner is not
   learning — the two things `createPost` would reject — because a composer
   that silently falls back to another language would file the sentence under
   the wrong one.

   **And the answer comes back.** The card remembers the post it asked on in
   `askedPostId`, written by `POST /echo/cards/:id/ask` once the post exists —
   a second call rather than a field on `createPostSchema`, so the feed module
   keeps knowing nothing about Echo. On that post, every answer then carries
   one more action: keep this recording on the card that asked. It replaces
   whatever the card had, deliberately — the reason to tap it on a card that
   already speaks is that the first voice was hard to follow.

   The client sends an **answer id, never a URL**. `attachAnswerAudio` reads
   the media off the answer itself and requires
   `answer.postId === card.askedPostId`, which is the whole authorisation
   story: you can only ever attach an answer written on a post one of your own
   cards asked.

   One limitation, left on purpose: a card asked twice keeps only the newer
   post, and the older one stops offering the button. A list of every question
   a card ever asked is machinery for something nobody would read.

2. **A card from a quiz message.** A `quiz` message already carries the
   question and the option its author marked correct. Add echo on it makes
   `front` the question and `back` the correct option — one more
   `source.kind`, no new interface, and the quiz stays what it is between the
   two people.
3. ~~**One tile on Me.**~~ **Built.** Cards reviewed this week, a `StatTile`
   on its own row above the weekly chart on the Me tab, read from
   `GET /echo/summary`. The number a person looks at when deciding whether the
   week counted.

   Two things the sentence above did not say. The window is a rolling seven
   days rather than a calendar week, because `reviewedToday` beside it is a
   rolling twenty-four hours and two windows counted differently on one
   screen read as one of them being wrong. And the tile has a row to itself
   rather than joining the four already there: five across leaves 59px each
   at 375px, which is narrower than the word `Corrections` in four of the
   eight languages.
