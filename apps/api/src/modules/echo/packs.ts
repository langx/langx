import {
  ERROR_CODES,
  glossFor,
  matchLocale,
  newCardSrs,
  sourceKeyOf,
  type EchoGloss,
  type EchoPack,
  type EchoPackItemKind,
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
  audioUrl?: string
  contentVersion: number
}

export function packItemId(packId: string, index: number): string {
  return `${packId}#${index}`
}

/**
 * Every pack, with how far this person has got into each.
 *
 * Two queries for the whole list rather than one per pack: the started count
 * is a group over the cards whose `sourceKey` begins `pack:`, which is exactly
 * the prefix `card_source_unique` is sorted by within a user.
 */
export async function listPacks(db: Db, userId: string): Promise<{ items: EchoPack[] }> {
  const packs = await db
    .collection<EchoPackDoc>(COLLECTIONS.echoPacks)
    .find({})
    .sort({ lang: 1, level: 1 })
    .toArray()
  if (packs.length === 0) return { items: [] }

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
 * Turns the next few items of a pack into cards.
 *
 * "Next" is by `index` among the items this person has no card for, so
 * pressing Start again continues rather than restarting, and a re-seed that
 * inserted items in the middle is picked up on the next press.
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
  const held = await cards
    .find({ userId, 'source.kind': 'pack', 'source.packId': pack._id })
    .project<{ sourceKey: string }>({ sourceKey: 1 })
    .toArray()
  const alreadyHeld = new Set(held.map((row) => row.sourceKey))

  const items = await db
    .collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems)
    .find({ packId: pack._id })
    .sort({ index: 1 })
    .toArray()

  // The reader's own language decides the back; the app's language is the
  // fallback, and English the last resort. One chain, in `glossFor`.
  const nativeLocale = matchLocale(profile.nativeLanguages.map((l) => l.code)) ?? undefined

  let started = 0
  for (const item of items) {
    if (started >= input.count) break
    const source: EchoSource = { kind: 'pack', packId: pack._id, itemId: item._id }
    const sourceKey = sourceKeyOf(source)
    if (alreadyHeld.has(sourceKey)) continue

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
        ...(item.audioUrl ? { audio: { url: item.audioUrl, origin: 'pack' as const } } : {}),
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
