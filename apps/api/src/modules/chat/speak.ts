import {
  detectSpeechLanguage,
  ERROR_CODES,
  isSpeakableLength,
  SPEECH_MIN_DETECT_LENGTH,
  speechVoicesFor,
  type LanguageCode,
  type MessageSpeech,
} from '@langx/shared'
import { franc } from 'franc'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import type { TtsProvider } from '../../tts/TtsProvider'
import { lookupVoices, synthesiseInto, voiceKey } from '../tts/speech'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import type { Conversation, Message } from './conversations'
import { loadMutableMessage } from './mutations'

/** Message types that carry a sentence worth reading. Mirrors the menu's rule. */
const SPEAKABLE_TYPES = new Set(['text', 'correction', 'image'])

/**
 * The languages this pair could plausibly be writing in, for the last-resort
 * guess in `detectSpeechLanguage`.
 *
 * Both people's, not just the sender's: a thread between a Turkish speaker
 * learning English and an English speaker learning Turkish has two candidates
 * and no answer, which is the truth and is what the caller should hear. One
 * person's languages alone would narrow to one and be confidently wrong half
 * the time.
 */
async function conversationLanguages(
  db: Db,
  conversation: Conversation,
): Promise<readonly string[]> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: [...conversation.participants] } })
    .project<Pick<Profile, 'nativeLanguages' | 'learning'>>({ nativeLanguages: 1, learning: 1 })
    .toArray()
  return profiles.flatMap((profile) => [
    ...profile.nativeLanguages.map((language) => language.code),
    ...profile.learning.map((language) => language.code),
  ])
}

/**
 * Which language a message would be read in, decided here and never by the
 * caller.
 *
 * The app runs `detectSpeechLanguage` too, to decide whether to draw the menu
 * row at all, but its answer is advisory: this one picks the cache key, and a
 * client that could name the language could write an object of its choosing
 * under a language it does not speak.
 *
 * `franc` is asked openly rather than confined to the languages we can read.
 * Confining it looks like the tighter choice and is the opposite: a detector
 * restricted to a list always answers from the list, so it can never say the
 * sentence is in none of them — Turkish came back as Norwegian, the nearest of
 * the thirty-seven it was allowed. `detectSpeechLanguage` drops an answer
 * nothing reads, which is the behaviour that makes the refusal possible.
 */
function languageOf(message: Message, contextLangs: readonly string[]): LanguageCode | undefined {
  const text = message.body.trim()
  return detectSpeechLanguage(text, {
    sourceLang: message.translation?.sourceLang,
    contextLangs,
    detected: text.length >= SPEECH_MIN_DETECT_LENGTH ? franc(text) : undefined,
  })
}

/**
 * Read one message of a thread you are in aloud.
 *
 * `loadMutableMessage` is the gate, the same one every socket mutation takes,
 * so this cannot become a way to read a message out of a thread you were
 * blocked from — and a message id from elsewhere reads as "not found" rather
 * than as a permission error.
 *
 * **The cache is looked up before the quota is spent**, for the reason
 * `synthesiseCard` gives: a sentence somebody else already had read costs us
 * nothing, so it must not cost the caller a unit. The two surfaces share one
 * key space, so a sentence read on an Echo card is free in chat and the other
 * way round.
 *
 * **One voice, the one the language leads with** — which is also the voice
 * Echo synthesises first, so the two surfaces cannot write two objects for the
 * same sentence. Echo reads a card in both registers because a card is
 * replayed while studying and a lone synthetic voice is heard as *the*
 * pronunciation; a chat bubble is read once, to find out what it says, and the
 * honest answer to "how is this really said" is already in the thread as the
 * `pronunciation` ask a person answers.
 *
 * The bytes of a private message land in a public bucket under `sha1(text)`.
 * That is already true of every Echo card front and every attachment, and the
 * hash is a cache key rather than a security boundary: somebody who knows the
 * exact sentence can confirm an object exists. Stated so it is a decision.
 */
export async function speakMessage(
  db: Db,
  storage: StorageProvider,
  tts: TtsProvider,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<MessageSpeech> {
  const { conversation, message } = await loadMutableMessage(db, userId, conversationId, messageId)

  // A withdrawn message keeps its row and loses its body; reading it aloud
  // would be the one way to hear what somebody took back.
  if (message.deletedAt) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That message was withdrawn')
  }
  if (!SPEAKABLE_TYPES.has(message.type) || !isSpeakableLength(message.body)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is no sentence here to read')
  }

  const lang = languageOf(message, await conversationLanguages(db, conversation))
  if (!lang) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Could not tell what language this is')
  }

  const voice = speechVoicesFor(lang)[0]
  if (!voice) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No synthetic voice for this language')
  }
  if (!supportsPut(storage)) {
    throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured for readings')
  }

  const text = message.body.trim()
  const key = voiceKey(lang, voice.id, text)
  const known = await lookupVoices(db, [key])
  const cached = known.get(key)
  if (cached) return { url: cached, voice: voice.id, lang, cached: true }

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  const quota = await consumeQuota(db, userId, effectiveTier(profile), 'chatVoices')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily reading limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }

  const url = await synthesiseInto(db, storage, tts, key, { text, lang, voice: voice.id })
  return { url, voice: voice.id, lang, cached: false }
}
