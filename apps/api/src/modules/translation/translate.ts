import { createHash } from 'node:crypto'
import { ERROR_CODES, type TranslateRequestInput } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import type { TranslationProvider } from '../../translation/TranslationProvider'
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
 * Cache key is `{sourceHash, targetLang}` only, per the plan — `sourceLang`
 * (even auto-detected) doesn't participate. A cache hit costs nothing:
 * no quota check, no provider call. Only a genuine miss consumes the
 * caller's daily quota (unlimited on Pro) and reaches the network.
 */
export async function translateText(
  db: Db,
  provider: TranslationProvider,
  userId: string,
  input: TranslateRequestInput,
): Promise<TranslateOutcome> {
  const sourceHash = hashSourceText(input.text)
  const cache = db.collection<TranslationCacheDoc>(COLLECTIONS.translationCache)

  const hit = await cache.findOne({ sourceHash, targetLang: input.targetLang })
  if (hit) return { translatedText: hit.translatedText, sourceLang: hit.sourceLang, cached: true }

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const quota = await consumeQuota(db, userId, profile.entitlement.tier, 'translations')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily translation limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }

  const result = await provider.translate(input)
  const now = new Date()

  // upsert, not insertOne — a concurrent miss for the same brand-new text can
  // land here twice (each already paid its own quota slot, accepted the same
  // way Faz 4's rare pairKey race is); `$setOnInsert` makes the loser a no-op
  // instead of a duplicate-key error.
  await cache.updateOne(
    { sourceHash, targetLang: input.targetLang },
    {
      $setOnInsert: {
        sourceHash,
        targetLang: input.targetLang,
        translatedText: result.translatedText,
        sourceLang: result.sourceLang,
        createdAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
    },
    { upsert: true },
  )

  return { translatedText: result.translatedText, sourceLang: result.sourceLang, cached: false }
}
