import { ERROR_CODES, echoSynthVoicesFor, type EchoCard, type EchoVoice } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import type { TtsProvider } from '../../tts/TtsProvider'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { lookupVoices, synthesiseInto, voiceKey } from '../tts/speech'
import { toEchoCard, type EchoCardDoc } from './documents'

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

  const keys = voices.map((voice) => ({ voice, key: voiceKey(card.lang, voice, card.front) }))
  const known = await lookupVoices(
    db,
    keys.map((entry) => entry.key),
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
    const url =
      known.get(key) ??
      (await synthesiseInto(db, storage, tts, key, {
        text: card.front,
        lang: card.lang,
        voice,
      }))
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
