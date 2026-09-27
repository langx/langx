import { createHash } from 'node:crypto'
import {
  ERROR_CODES,
  ROMANIZE_MAX_TEXT_LENGTH,
  romanizationFor,
  type MessageRomanization,
  type RomanizationServiceLang,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { TtsBusyError, type TtsProvider } from '../../tts/TtsProvider'
import type { Profile } from '../profiles/profiles'
import type { Conversation, Message } from './conversations'
import { loadMutableMessage } from './mutations'

export interface RomanizationCacheDoc {
  /** `<lang>:<sha1 of the text>`. */
  _id: string
  text: string
  lang: RomanizationServiceLang
  createdAt: Date
  expiresAt: Date
}

/**
 * Ninety days: long enough that a sentence shared by many threads is read
 * once, short enough that a better dictionary in a later image of the voice
 * service reaches old sentences without anyone clearing anything.
 */
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000

/**
 * The languages that could tell Chinese from Japanese in a line of Han alone,
 * in the order the app asks them: the message's known source, then the
 * author's own languages, then the other person's. Kept in step with the chat
 * screen's `romanizationFor` call so the row appears exactly when this agrees.
 */
async function languageHints(
  db: Db,
  conversation: Conversation,
  message: Message,
): Promise<(string | undefined)[]> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: [...conversation.participants] } })
    .project<Pick<Profile, '_id' | 'nativeLanguages' | 'learning'>>({
      nativeLanguages: 1,
      learning: 1,
    })
    .toArray()
  profiles.sort((a, b) => Number(b._id === message.senderId) - Number(a._id === message.senderId))
  return [
    message.translation?.sourceLang,
    ...profiles.flatMap((profile) => [
      ...profile.nativeLanguages.map((language) => language.code),
      ...profile.learning.map((language) => language.code),
    ]),
  ]
}

/**
 * One Chinese or Japanese message of a thread you are in, in Latin letters.
 *
 * `loadMutableMessage` is the gate, as it is for reading aloud: a message id
 * from a thread you are not in, or were blocked from, reads as not found.
 *
 * **Which language is decided here**, from the text, never taken from the
 * caller — it picks the cache key, and a client naming it could store a
 * Japanese reading of a Chinese sentence for everybody after.
 *
 * **No quota.** Quotas in this codebase count what costs money per unit —
 * translated characters, synthesised audio. This is a few milliseconds of
 * dictionary lookups on a machine that is already running for the voices,
 * and it is cached; the route's rate limit bounds the rest. Every other
 * script is romanized on the phone for nothing, and these two should not be
 * the ones that run out.
 */
export async function romanizeMessage(
  db: Db,
  tts: TtsProvider,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<MessageRomanization> {
  const { conversation, message } = await loadMutableMessage(db, userId, conversationId, messageId)

  // A withdrawn message keeps its row and loses its body; there is nothing to
  // read, and nothing somebody took back should come back through here.
  if (message.deletedAt) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That message was withdrawn')
  }
  const text = message.body.trim()
  if (message.type !== 'text' || text.length === 0 || text.length > ROMANIZE_MAX_TEXT_LENGTH) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is no sentence here to romanize')
  }

  const engine = romanizationFor(text, await languageHints(db, conversation, message))
  if (engine?.engine !== 'service') {
    // Either nothing to do, or a script the app romanizes on its own.
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'This message is not Chinese or Japanese')
  }
  const { lang } = engine

  const cache = db.collection<RomanizationCacheDoc>(COLLECTIONS.romanizationCache)
  const key = `${lang}:${createHash('sha1').update(text).digest('hex')}`
  const known = await cache.findOne({ _id: key })
  if (known) return { text: known.text, lang, cached: true }

  let latin: string
  try {
    latin = await tts.romanize({ text, lang })
  } catch (caught) {
    if (caught instanceof TtsBusyError) {
      throw new ApiError(ERROR_CODES.RATE_LIMITED, 'The voice service is busy — try again shortly')
    }
    throw caught
  }

  const now = new Date()
  try {
    await cache.insertOne({
      _id: key,
      text: latin,
      lang,
      createdAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    })
  } catch (caught) {
    // Two readers asked at once; both got the same reading.
    if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
  }
  return { text: latin, lang, cached: false }
}
