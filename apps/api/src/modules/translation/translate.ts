import { createHash } from 'node:crypto'
import { ERROR_CODES, type PlanLimits, type TranslateRequestInput } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import type { TranslationProvider } from '../../translation/TranslationProvider'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'

export interface TranslationCacheDoc {
  sourceHash: string
  targetLang: string
  translatedText: string
  sourceLang: string
  createdAt: Date
  expiresAt: Date
}

// Long enough that a common phrase ("how are you", "good morning") actually
// gets reused across many pairs of strangers before it falls out of cache.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function hashSourceText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export interface TranslateOutcome {
  translatedText: string
  sourceLang: string
  cached: boolean
}

/**
 * The cached translation, or null.
 *
 * Split out from `translateText` so that Echo can share the cache without
 * sharing the meter. A capture is charged `echoCapturesPerDay`, deliberately
 * not `translationsPer24h` — but a sentence translated in a chat must still
 * be free to echo, and one translated at capture must still be free to read
 * in the thread, so both paths read and write the same rows.
 *
 * Cache key is `{sourceHash, targetLang}` only, per the plan — `sourceLang`
 * (even auto-detected) doesn't participate.
 */
export async function lookupTranslation(
  db: Db,
  input: TranslateRequestInput,
): Promise<TranslateOutcome | null> {
  const hit = await db
    .collection<TranslationCacheDoc>(COLLECTIONS.translationCache)
    .findOne({ sourceHash: hashSourceText(input.text), targetLang: input.targetLang })
  if (!hit) return null
  return { translatedText: hit.translatedText, sourceLang: hit.sourceLang, cached: true }
}

/**
 * Writes what the provider said, for whoever asks next.
 *
 * upsert, not insertOne — a concurrent miss for the same brand-new text can
 * land here twice (each already paid its own quota slot, accepted the same
 * way Faz 4's rare pairKey race is); `$setOnInsert` makes the loser a no-op
 * instead of a duplicate-key error.
 */
export async function rememberTranslation(
  db: Db,
  input: TranslateRequestInput,
  result: { translatedText: string; sourceLang: string },
): Promise<void> {
  const now = new Date()
  await db.collection<TranslationCacheDoc>(COLLECTIONS.translationCache).updateOne(
    { sourceHash: hashSourceText(input.text), targetLang: input.targetLang },
    {
      $setOnInsert: {
        sourceHash: hashSourceText(input.text),
        targetLang: input.targetLang,
        translatedText: result.translatedText,
        sourceLang: result.sourceLang,
        createdAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
    },
    { upsert: true },
  )
}

/**
 * A cache hit costs nothing: no quota check, no provider call. Only a genuine
 * miss consumes the caller's daily quota (unlimited on Pro) and the fair-use
 * ceiling (the same on every plan), and reaches the network.
 */
export async function translateText(
  db: Db,
  provider: TranslationProvider,
  userId: string,
  input: TranslateRequestInput,
): Promise<TranslateOutcome> {
  const hit = await lookupTranslation(db, input)
  if (hit) return hit

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const tier = effectiveTier(profile)
  const quota = await consumeQuota(db, userId, tier, 'translations')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily translation limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }

  /*
   * Second, so a free account refused its allowance spends nothing here. The
   * allowance is not given back when this refuses, because it cannot: the
   * ceiling sits above it (`rules.test.ts`), so only an account with no
   * allowance to spend ever gets this far and is turned away.
   *
   * `limit` is what tells the app this is fair use and not the free plan's
   * allowance — the post cap is told apart the same way. A build that predates
   * it sees a plain `QUOTA_EXCEEDED` at the same count Pro's old daily limit
   * stood at, and says what it said about that limit.
   */
  const fairUse = await consumeQuota(db, userId, tier, 'translationFairUse')
  if (!fairUse.consumed) {
    throw new ApiError(ERROR_CODES.QUOTA_EXCEEDED, 'Translation fair-use limit reached', {
      limit: 'translationFairUsePer24h' satisfies keyof PlanLimits,
      ...(fairUse.nextAvailableAt ? { retryAt: fairUse.nextAvailableAt.toISOString() } : {}),
    })
  }

  const result = await provider.translate(input)
  await rememberTranslation(db, input, result)

  return { translatedText: result.translatedText, sourceLang: result.sourceLang, cached: false }
}
