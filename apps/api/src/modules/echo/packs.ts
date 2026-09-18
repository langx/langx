import {
  ERROR_CODES,
  glossFor,
  levelRank,
  matchLocale,
  newCardSrs,
  sourceKeyOf,
  type EchoGloss,
  type EchoPack,
  type EchoPackPreview,
  type EchoPackPreviewQuery,
  type EchoPackItem,
  type EchoPackItemKind,
  type EchoVoice,
  type EchoSource,
  type StartPackInput,
  type StartPackResult,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import type { EchoCardDoc } from './documents'

/**
 * A pack, as the seed script writes it.
 *
 * `_id` is `<lang>:<level>` rather than an ObjectId, so the seed is keyed by
 * the file it came from and re-running it updates the row it already wrote.
 */
export interface EchoPackDoc {
  _id: string
  lang: string
  level: string
  itemCount: number
  contentVersion: number
  glossLocales: string[]
  updatedAt: Date
}

/**
 * `_id` is `<packId>#<index>` — deterministic, and that is the whole point.
 *
 * A card made from a pack item carries `pack:<itemId>` as its `sourceKey`, and
 * that key has to survive a re-seed: content gets corrected, the script runs
 * again, and nobody's schedule may move because a row was rewritten with a
 * fresh ObjectId.
 */
export interface EchoPackItemDoc {
  _id: string
  packId: string
  index: number
  kind: EchoPackItemKind
  text: string
  gloss: EchoGloss
  example?: string
  freqRank?: number
  image?: string
  audio?: EchoPackItem['audio']
  /*
   * A URL, where the pack file holds a key: the environment's base is applied
   * once, by the seed, so nothing downstream has to know a bucket exists.
   */
  voices?: EchoVoice[]
  contentVersion: number
}

export function packItemId(packId: string, index: number): string {
  return `${packId}#${index}`
}

/**
 * The packs for the languages this person is learning, with how far they have
 * got into each.
 *
 * **Their languages, not every language.** Somebody who speaks Spanish and is
 * learning Italian has no use for an English pack, and once there is a pack
 * per level per language the unfiltered list is dozens of rows of other
 * people's languages. `learning` is the right source rather than the cards
 * they hold: a language they have not started is exactly the one a pack is for.
 * Guests are covered by the same field — `/profiles/guest` writes it from the
 * onboarding levels screen, so browsing before signing up still finds packs.
 *
 * **Every level of those languages, not the one they declared.** The level on
 * a profile is self-reported and often wrong by one, and a pack has no other
 * route in, so hiding the rest would put the one they actually want out of
 * reach. The order is the ladder — absolute beginner first — and they start
 * wherever they like.
 *
 * Two queries for the whole list rather than one per pack: the started count
 * is a group over the cards whose `sourceKey` begins `pack:`, which is exactly
 * the prefix `card_source_unique` is sorted by within a user.
 */
export async function listPacks(db: Db, userId: string): Promise<{ items: EchoPack[] }> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { learning: 1 } })
  // No profile yet, so no languages to match. A listing is not the place to
  // demand onboarding — `startPack` is, and it already does.
  const learning = profile?.learning ?? []
  if (learning.length === 0) return { items: [] }

  // Onboarding's first pick is priority 1, and that is the order the tab
  // should read in: the language they came for, then the rest.
  const priority = new Map(learning.map((entry) => [entry.code, entry.priority]))

  const packs = await db
    .collection<EchoPackDoc>(COLLECTIONS.echoPacks)
    .find({ lang: { $in: [...priority.keys()] } })
    .toArray()
  if (packs.length === 0) return { items: [] }

  // Sorted here rather than in the query: `level` is a word, so Mongo would
  // sort it alphabetically and put `fluent` ahead of `intermediate`.
  packs.sort(
    (a, b) =>
      (priority.get(a.lang) ?? 0) - (priority.get(b.lang) ?? 0) ||
      levelRank(a.level as EchoPack['level']) - levelRank(b.level as EchoPack['level']),
  )

  const started = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .aggregate<{ _id: string; count: number }>([
      { $match: { userId, 'source.kind': 'pack' } },
      { $group: { _id: '$source.packId', count: { $sum: 1 } } },
    ])
    .toArray()
  const byPack = new Map(started.map((row) => [row._id, row.count]))

  return {
    items: packs.map((pack) => ({
      _id: pack._id,
      lang: pack.lang,
      level: pack.level as EchoPack['level'],
      itemCount: pack.itemCount,
      startedCount: byPack.get(pack._id) ?? 0,
      glossLocales: pack.glossLocales as EchoPack['glossLocales'],
      contentVersion: pack.contentVersion,
    })),
  }
}

/**
 * The next items of a pack this person holds no card for, in index order.
 *
 * "Next" is by `index` among the items with no card, so pressing Start again
 * continues rather than restarting, and a re-seed that inserted items in the
 * middle is picked up on the next press. One function because two screens
 * depend on agreeing about it: `startPack` writes these rows, and
 * `previewPack` shows them first — a preview that paged the pack from the top
 * showed cards already held and never the ones about to arrive.
 */
async function unheldItems(db: Db, userId: string, packId: string): Promise<EchoPackItemDoc[]> {
  const held = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .find({ userId, 'source.kind': 'pack', 'source.packId': packId })
    .project<{ sourceKey: string }>({ sourceKey: 1 })
    .toArray()
  const alreadyHeld = new Set(held.map((row) => row.sourceKey))

  const items = await db
    .collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems)
    .find({ packId })
    .sort({ index: 1 })
    .toArray()

  return items.filter(
    (item) => !alreadyHeld.has(sourceKeyOf({ kind: 'pack', packId, itemId: item._id })),
  )
}

/**
 * What a pack would give you next, before you press Start.
 *
 * Reads the same way a card would: the back is resolved through `glossFor`
 * with this reader's own languages, so the preview is not a different rendering
 * of the content from the thing they are deciding whether to begin. The rows
 * are `unheldItems` cut to `limit`, which is what `startPack` would write
 * for the same count.
 *
 * Open to a guest, like the listing it is reached from. Looking is the whole
 * offer before an account; `startPack` is where the account is asked for.
 */
export async function previewPack(
  db: Db,
  userId: string,
  packId: string,
  query: EchoPackPreviewQuery,
  interfaceLocale: string,
): Promise<EchoPackPreview> {
  const pack = await db.collection<EchoPackDoc>(COLLECTIONS.echoPacks).findOne({ _id: packId })
  if (!pack) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Pack not found')

  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { nativeLanguages: 1 } })
  const nativeLocale = matchLocale(profile?.nativeLanguages?.map((l) => l.code) ?? []) ?? undefined

  const items: EchoPackPreview['items'] = []
  for (const item of await unheldItems(db, userId, packId)) {
    if (items.length >= query.limit) break
    // An item whose gloss resolves to nothing is skipped rather than shown
    // blank — `startPack` skips it too, so the preview matches what arrives.
    const back = glossFor(item.gloss, nativeLocale, interfaceLocale)
    if (back) items.push({ index: item.index, text: item.text, back })
  }

  return { items, total: pack.itemCount }
}

/**
 * Turns the next few items of a pack into cards — `unheldItems`, cut to
 * `count`.
 *
 * The gloss is resolved **here**, at intake, and copied onto the card. The
 * same argument the chat path makes: content gets re-seeded, and a corrected
 * gloss must not rewrite the back of a card somebody has already reviewed six
 * times. The price is that the correction does not reach cards already made,
 * which is the price worth paying.
 */
export async function startPack(
  db: Db,
  userId: string,
  input: StartPackInput,
  interfaceLocale: string,
): Promise<StartPackResult> {
  const pack = await db
    .collection<EchoPackDoc>(COLLECTIONS.echoPacks)
    .findOne({ _id: input.packId })
  if (!pack) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Pack not found')

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const items = await unheldItems(db, userId, pack._id)

  // The reader's own language decides the back; the app's language is the
  // fallback, and English the last resort. One chain, in `glossFor`.
  const nativeLocale = matchLocale(profile.nativeLanguages.map((l) => l.code)) ?? undefined

  let started = 0
  for (const item of items) {
    if (started >= input.count) break
    const source: EchoSource = { kind: 'pack', packId: pack._id, itemId: item._id }
    const sourceKey = sourceKeyOf(source)

    /*
     * Charged per card rather than per press, and before the write. The limit
     * is null on every tier today, so this is one comparison and no storage —
     * see `TrackedQuotaKind`. It is here rather than nowhere so that the day
     * somebody sets a number, intake obeys it without a new code path.
     */
    const quota = await consumeQuota(db, userId, effectiveTier(profile), 'echoNewCards')
    if (!quota.consumed) {
      return { started, remainingToday: 0 }
    }

    const back = glossFor(item.gloss, nativeLocale, interfaceLocale)
    if (!back) continue

    const now = new Date()
    try {
      await cards.insertOne({
        _id: new ObjectId(),
        userId,
        lang: pack.lang,
        front: item.text,
        back,
        ...(item.example ? { example: item.example } : {}),
        /*
         * The speaker's name travels with the recording, because the licence
         * asks for it: every Commons file on the allowlist but CC0 requires
         * attribution, and `speakerName` is what the session draws as
         * "Spoken by {name}". A pack recording that played anonymously would
         * be the one place this app used somebody's work without crediting it.
         */
        ...(item.audio
          ? {
              audio: {
                url: item.audio.url,
                origin: 'pack' as const,
                ...(item.audio.speaker ? { speakerName: item.audio.speaker } : {}),
              },
            }
          : {}),
        // Synthesised readings travel the same way and carry no name, because
        // there is nobody to credit — see `echoVoiceSchema`.
        ...(item.voices?.length ? { voices: item.voices } : {}),
        /*
         * The cue, with its size written down. Every one of these files is the
         * same 4:3 plate, so the shape is known here and does not have to be
         * discovered by loading the image — which is what `CardPicture` falls
         * back to, and what makes a card jump once the picture arrives.
         *
         * `origin: 'pack'` is doing real work further on: `updateCard` deletes
         * the object behind a replaced picture **only** for `origin: 'self'`,
         * so somebody attaching their own photo to a pack card cannot take the
         * cue away from the eight hundred other cards that share it.
         */
        ...(item.image
          ? { image: { url: item.image, width: 400, height: 300, origin: 'pack' as const } }
          : {}),
        source,
        sourceKey,
        srs: newCardSrs(now),
        createdAt: now,
      })
      started += 1
    } catch (caught) {
      // Two devices pressing Start at once. The index decided; carry on.
      if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
    }
  }

  return { started, remainingToday: null }
}
