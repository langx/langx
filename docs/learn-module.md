# The learning module — spaced repetition, courses and levels

**Status: a plan, nothing is built.** This is post-MVP work. It is written down
now so that the decisions it forces — most of them about content and about the
token economy, not about code — are visible before anyone starts.

The design it has to fit into is [`architecture.md`](./architecture.md); the
reasons the surrounding pieces are shaped the way they are are in
[`decisions.md`](./decisions.md).

## What this is

A Memrise/Anki-shaped module: curated courses per language and per level, built
from the most frequent words and from ready-made phrases, reviewed on a spaced
repetition schedule.

It **replaces the "vocabulary notebook"** line in the P2 list. That entry
described a personal word list; this is bigger — a content product with a
scheduler under it. They are not two features. A saved word from a chat and an
item from a curated course are the same card in the same scheduler, differing
only in where they came from. Modelling them separately would mean two review
queues in one app, and the user would have to remember which one they had done
today.

That shared queue is also the only thing here that Memrise cannot do. A generic
frequency course is a commodity; the words you actually met in a conversation
yesterday are not. The course is what makes the module usable on day one, and
the notebook is what makes it ours.

## What the existing codebase already decides

Four constraints come from code that is already written, and each one has a way
of being violated by accident.

**Levels are not CEFR.** `LANGUAGE_LEVELS` is
`absoluteBeginner | beginner | intermediate | fluent` — four tiers, chosen over
CEFR because v1 stored a 0–3 scale and because a self-declared field should ask
a question people can answer honestly (`packages/shared/src/level.ts`). Course
levels reuse that enum. Inventing a second scale for course content would
recreate exactly the lossy mapping that decision removed, and the two scales
would then have to be reconciled in the one place it matters most: picking the
course a new user starts in.

**Eight interface locales, one hundred and eighty content languages.** The app
speaks `en, tr, de, es, fr, pt-BR, ru, ar`; `languages.ts` lists the full ISO
639-1 set. A card has two sides and the far side has to be in a language the
learner already knows, so the second side is drawn from the eight, not the one
hundred and eighty. See "The content problem".

**No handler queries a collection directly**, indexes are declared in
`apps/api/src/db/indexes.ts`, thresholds live in `packages/shared`, and no
user-facing string is written in a component. All four apply here unchanged.
The last one has a wrinkle worth stating: card _content_ is data, not interface
copy. `t('learn.session.done')` is a message key; the Spanish word on the card
is not, and must never be pushed through the i18n files.

**There is no local persistence in the client.** `apps/mobile` has
`expo-secure-store` and nothing else — no AsyncStorage, no SQLite. Offline
review, which is half of what people expect from an Anki-shaped app, is
therefore a new dependency and a new failure mode, not a detail. It is deferred
on purpose; see the phase table.

## The content problem

This is the hard part, and it is not an engineering problem.

### The matrix does not close

A course is a triple: the language being learned, the level, and **the language
the learner already speaks**. At full generality that is 180 × 4 × 180, which
is not a backlog, it is a refusal. Two cuts make it finite:

- **Target languages: five or six in the first wave**, chosen from the actual
  distribution of `profiles.learning[].code`. v1 left 3479 populated profiles
  behind and the ETL already stages them, so this is a query, not a guess. Do
  not pick by intuition — the intuitive list is the list of big languages,
  which is not the same as the list our users are learning.
- **Known side: the eight interface locales only.** An item carries
  `gloss: Record<Locale, string>`, eight fields at most. The fallback chain when
  a learner's own language is not among them is `nativeLanguages[0]` → interface
  locale → `en`, and it lives in exactly one function. Three call sites each
  doing "or English" is how one screen ends up showing a Turkish gloss and the
  next one an English gloss on the same card.

Levels map onto frequency bands: roughly 0–300 lemmas for `absoluteBeginner`,
300–1500 for `beginner`, 1500–4000 for `intermediate`, 4000–8000 for `fluent`.
The band is a starting point and not a specification, because frequency stops
being a good curriculum at the top: at `fluent` the useful material is idiom,
collocation and register, and a course built there out of rank-ordered lemmas
teaches rare nouns instead. Phrases should dominate that level.

### Licensing is a real constraint, not paperwork

The repo is public and BSD-3. Content shipped in it, or served from it, has to
be traceable to a licence that permits both.

- **Anki shared decks are out.** The overwhelming majority carry no stated
  licence, and a large fraction are themselves copies of copyrighted
  coursebooks. "It was on the internet" is not provenance.
- Candidate sources worth evaluating: Tatoeba (sentences, CC-BY), Wiktionary
  and Wiktextract-derived lexical data (CC BY-SA), Wikidata lexemes (CC0),
  subtitle-derived frequency lists (licence varies by list, often CC BY-SA),
  and Lingua Libre / Wikimedia Commons for audio.
- **Verify each licence at the version you actually download**, and record it.
  The list above is where to look, not a clearance. A share-alike source does
  not infect the code, but it does bind the derived content, which means the
  content directory needs its own `LICENSE` and an attribution file naming each
  source. That obligation is permanent and someone has to be able to satisfy it
  two years from now without archaeology.

### Glosses are the expensive part

Translating an item into eight locales is where the money and the time go, and
machine translation is the obvious shortcut that quietly ruins the product:
polysemy. A frequency list gives a lemma with no sense attached, so `light`,
`bank` and `right` come back from any MT system as whichever sense it guessed,
and the learner memorises the wrong one confidently. Glosses should be taken
from a structured lexical source that carries senses, and the first course
should be read by a human end to end before it ships.

### Where content lives

Not in `packages/shared`. That package is config — limits, rules, enums — and a
few thousand cards per course would make it a data blob that every consumer
parses at import time.

Content is JSON, versioned with a `contentVersion`, and loaded into MongoDB by
an idempotent seed script modelled on the ETL. Whether that JSON sits in a
`content/` directory here or in a separate repository is an open decision (see
below); everything else in this document is the same either way.

## Data model

Four collections, registered in `apps/api/src/db/collections.ts`.

| Collection     | Holds                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `learnCourses` | `{ _id: 'es:beginner', lang, level, unitCount, itemCount, contentVersion, glossLocales }`                                                       |
| `learnItems`   | `{ courseId, unitIndex, kind: 'word' \| 'phrase', target: { text, ipa?, audioKey? }, gloss: Record<Locale, string>, examples, freqRank, tags }` |
| `learnCards`   | Per-user scheduling state: `{ userId, itemId, courseId, due, interval, ease, reps, lapses, state, lastReviewedAt }`                             |
| `learnReviews` | One row per graded card: `{ userId, reviewId, itemId, grade, at, durationMs }`                                                                  |

Courses and items are content and are the same for everyone; cards and reviews
are user state. The split matters because content gets re-seeded — a fixed
typo, a better example sentence — and re-seeding must never touch anybody's
schedule.

Indexes, in `indexes.ts` as always:

- unique `{ userId, itemId }` on `learnCards` — one schedule per card per user.
- `{ userId, courseId, due }` on `learnCards` — the due queue is the only hot
  read in the module.
- unique `{ userId, reviewId }` on `learnReviews`, where `reviewId` is generated
  by the client. This is the same device as the unique `{ job, periodKey }` on
  `jobRuns`: a session submitted twice, because the network dropped and the app
  retried, must be physically incapable of advancing a card twice or paying for
  the same review twice. Idempotency by index, not by the handler remembering
  to check.

## The scheduler

`packages/shared/src/srs.ts`: a pure function plus an `SRS_RULES` config —
interval multipliers, starting and floor ease, the lapse penalty, the daily
ceiling on new cards. No dependency, and unit-testable in vitest without a
database, which is what a scheduler needs most.

**SM-2 first, with the door left open for FSRS.** FSRS schedules measurably
better, but it wants parameters fitted to a review history that does not exist
until the module has been live for a while, and it is a dependency. Putting the
algorithm behind a small interface makes swapping it a contained change later;
adopting it now means shipping untuned parameters and calling it an
improvement.

**One implementation, shared by both sides.** The client computes optimistically
so a session feels instant, and the server is authoritative. Those two must be
the same function, in `shared`, for the reason `effectivePlanTier` is in
`shared`: when the same rule was implemented twice, the client showed one answer
and the server enforced another, and the mismatch looked like a bug in the
feature rather than a duplicated rule. Here the symptom would be a card the app
says is due tomorrow and the API says is due in three days.

## Client

A fifth tab, `app/(app)/learn.tsx`, with `learn/[courseId].tsx` for a course and
`learn/session.tsx` for the review itself. Card types: recognition (multiple
choice), production (typing), listening, and phrase completion.

The session screen is the whole feature as far as a user is concerned, and the
thing that decides whether it is used twice is how it behaves at the end of the
queue and on a bad connection — not how many card types it has.

Offline is **out of the first pass**, deliberately. Doing it means
`expo-sqlite`, a local queue of ungraded reviews, and a merge rule for a card
graded on two devices before either synced. That is a phase of its own and it
should not be smuggled into the phase that establishes the format.

## Tokens and the streak

The daily pool is a fixed 10 000 tokens split by activity score
(`TOKEN_RULES.pool`). **Reviews must not enter that split.** Everything
currently scored there is something done with another person — mutual
conversations, corrections, messages, distinct partners — and the pool being
zero-sum means the moment a solitary, endlessly repeatable action earns a share,
it dilutes the people the economy exists to reward. It is also the easiest thing
in the app to automate.

Instead: a new `TOKEN_KIND` of `'review'`, a small fixed award, and a hard daily
cap in `TOKEN_RULES.caps` alongside `messagesPerDay`. Awarded on the review
ledger row, so the unique index above is what makes double payment impossible.

**Whether a review session extends the streak is a product decision, not a
technical one, and it is open.** The current condition is one meaningful action
per day, where meaningful was defined as sending a message or writing a
correction, and opening the app explicitly does not count. That definition makes
the streak a social commitment. Letting a solo review satisfy it changes what
the streak means — which may well be the right trade for retention, but it
should be made on purpose. If it is taken, the unit should be a completed
session of `SRS_RULES.sessionSize` cards, never a single card, or the condition
becomes "open the app and tap once" under another name.

No leaderboard of its own. The token board has four period tabs and the streak
page carries a streak table (added 3 September 2026 — current run and longest,
see `modules/tokens/streakLeaderboard.ts`); a review count ranked beside them
would split attention rather than add any.

## Plan limits

One row in `PLAN_LIMITS`:

| Tier       | `learnNewCardsPerDay` |
| ---------- | --------------------- |
| `free`     | 20                    |
| `pro`      | `null` (unlimited)    |
| `pro_plus` | `null` (unlimited)    |

Reviews themselves are never capped on any tier. Metering the review of
something already learned would break the one promise a spaced repetition system
makes, and it would break it for the users most committed to the app. Only the
intake of _new_ material is metered.

This does not repeat the problem in
[`legal/promise-change.md`](./legal/promise-change.md): that document is about
features that were free in v1 becoming paid in v2. Nothing here existed in v1,
so there is no promise to withdraw.

If the number changes it has to be changed by hand in three more places —
`website/src/lib/data/plans.ts`, `website/src/lib/data/features.ts`, and the
GitBook docs. Nothing checks that, which is how a pricing page starts lying.

## Phases

| Phase | Output                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------- |
| A     | Content schema, licence clearance, one proof course (one language × four levels), idempotent seed script |
| B     | `srs.ts`, the four collections, the indexes, review submission through repository functions              |
| C     | The Learn tab, course screen, session flow, card types, progress                                         |
| D     | Token award and cap, the streak decision, a "N cards due" push                                           |
| E     | Offline, audio, the second wave of languages, the chat-to-notebook path                                  |

Phase A is the one that can fail. B through E are ordinary work; A is where a
licence turns out to be unusable, or where the first course reveals that eight
sets of glosses cost more than expected. Nothing after it is worth starting
until one course exists end to end.

## Open decisions

Three, all of them the owner's:

1. **Which target languages in the first wave** — derived from
   `profiles.learning[].code` in the v1 data, or picked by hand.
2. **Does a completed review session extend the streak** — see above. This
   changes what the streak means.
3. **Where content lives** — `content/` in this repo, or a separate
   `langx/learn-content` repository. A separate repo keeps a share-alike licence
   and a large data blob out of a BSD-3 codebase and off every clone; one repo
   keeps the seed script and the data it seeds in the same commit.
