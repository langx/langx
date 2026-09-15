import { createHash } from 'node:crypto'
import { ERROR_CODES, echoSynthVoicesFor, type EchoCard, type EchoVoice } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import type { TtsProvider } from '../../tts/TtsProvider'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { toEchoCard, type EchoCardDoc } from './documents'

/**
 * A sentence the voice service has already read, so the next card holding it
 * is served the file instead of waking the machine. The `_id` is the storage
 * key, which is derived from the text — see `voiceKey`.
 */
interface EchoVoiceCacheDoc {
  _id: string
  url: string
  createdAt: Date
}

/**
 * `echo/tts/<lang>/<voice>/<sha1 of the text>.m4a` — the shape `docs/echo.md`
 * reserved for a server voice before one existed. Content-addressed so that
 * two people keeping "on y va demain ?" share one object, and so a retry after
 * a timed-out upload overwrites the same key rather than leaving a stray.
 * Under `echo/tts/`, not `echo/packs/`, because a pack's readings are content
 * we re-seed and these are made on demand for whoever asked.
 */
function voiceKey(lang: string, voice: string, text: string): string {
  const hash = createHash('sha1').update(text).digest('hex')
  return `echo/tts/${lang}/${voice}/${hash}.m4a`
}

/**
 * Read the caller's card aloud, in every voice the model has for its language.
 *
 * **One quota unit per card, however many voices.** The limit is a ceiling on
 * how long our machine stays awake, and one card is one wake — two readings
 * of the same sentence in one call cost a second or so more, not a second
 * request. A card that already has readings is returned as it is, and spends
 * nothing: the button is on every card that lacks them, and a second tap from
 * a stale screen must not pay again for a file the card already holds.
 *
 * **The cache is looked up before the quota is spent.** A sentence somebody
 * else already had read costs us nothing, so it should not cost the caller a
 * unit either. Synchronous, inside the request, for the reason
 * `transcodeAudio` is: two machines, no queue, no claim to get wrong. The cold
 * start is the app's spinner, not a job to poll.
 *
 * Refuses a language the model cannot read rather than guessing a voice — the
 * app hides the button for those, so reaching here with one is a stale build,
 * and a wrong-accent reading would be worse than the refusal.
 */
export async function synthesiseCard(
  db: Db,
  storage: StorageProvider,
  tts: TtsProvider,
  userId: string,
  cardId: string,
): Promise<EchoCard> {
  if (!ObjectId.isValid(cardId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Card not found')
  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const card = await cards.findOne({ _id: new ObjectId(cardId), userId })
  if (!card) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Card not found')
  if (card.voices?.length) return toEchoCard(card)

  const voices = echoSynthVoicesFor(card.lang)
  if (voices.length === 0)
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No synthetic voice for this language')
  if (!supportsPut(storage))
    throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured for readings')

  const cache = db.collection<EchoVoiceCacheDoc>(COLLECTIONS.echoVoiceCache)
  const keys = voices.map((voice) => ({ voice, key: voiceKey(card.lang, voice, card.front) }))
  const known = new Map(
    (await cache.find({ _id: { $in: keys.map((entry) => entry.key) } }).toArray()).map(
      (row) => [row._id, row.url] as const,
    ),
  )

  if (keys.some((entry) => !known.has(entry.key))) {
    const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
    const quota = await consumeQuota(db, userId, effectiveTier(profile), 'echoVoices')
    if (!quota.consumed) {
      throw new ApiError(
        ERROR_CODES.QUOTA_EXCEEDED,
        'Daily reading limit reached',
        quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
      )
    }
  }

  const readings: EchoVoice[] = []
  for (const { voice, key } of keys) {
    let url = known.get(key)
    if (!url) {
      const bytes = await tts.synthesize({ text: card.front, lang: card.lang, voice })
      url = await storage.putObject(key, bytes, 'audio/mp4')
      try {
        await cache.insertOne({ _id: key, url, createdAt: new Date() })
      } catch (caught) {
        // Two cards with the same sentence read at once; both wrote the same
        // bytes under the same key, and the row is the same either way.
        if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
      }
    }
    readings.push({ url, voice })
  }

  const updated = await cards.findOneAndUpdate(
    { _id: card._id, userId },
    { $set: { voices: readings } },
    { returnDocument: 'after' },
  )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Card not found')
  return toEchoCard(updated)
}
