import {
  attachmentsOf,
  ERROR_CODES,
  isAudioContentType,
  type MessageTranscript,
  type VoiceTranscript,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota, refundQuota } from '../../lib/quota'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import { SttBusyError, type SttProvider } from '../../stt/SttProvider'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import type { Conversation, Message } from './conversations'
import { loadMutableMessage } from './mutations'

/**
 * The languages a note is likely to be in: its sender's first, then the other
 * person's, each native before learning.
 *
 * The service picks the likeliest of these rather than letting Whisper choose
 * among a hundred, which is where a short note goes wrong — see `apps/tts`.
 * Both people's, because a learner's note is as often in the language they are
 * learning as in their own, and that language is usually the other person's.
 */
async function likelyLanguages(
  db: Db,
  conversation: Conversation,
  senderId: string,
): Promise<string[]> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: [...conversation.participants] } })
    .project<Pick<Profile, '_id' | 'nativeLanguages' | 'learning'>>({
      nativeLanguages: 1,
      learning: 1,
    })
    .toArray()
  profiles.sort((a, b) => Number(b._id === senderId) - Number(a._id === senderId))
  const codes = profiles.flatMap((profile) => [
    ...profile.nativeLanguages.map((language) => language.code),
    ...profile.learning.map((language) => language.code),
  ])
  return [...new Set(codes)]
}

/**
 * The voice note of one message of a thread you are in, as text.
 *
 * `loadMutableMessage` is the gate, as it is for reading aloud: a message id
 * from a thread you are not in, or were blocked from, reads as not found.
 *
 * **The transcript is kept on the attachment and looked up before the quota
 * is spent.** Both people see the same recording, so whoever asks first pays
 * one unit and the other reads it for nothing — as does the first person on
 * their other device, or next week. `speakMessage` makes the same bargain with
 * its cache, for the same reason: work somebody already paid for must not cost
 * anyone again.
 *
 * **Refunded on any failure after the spend**, not only on a busy service.
 * Whatever went wrong — a note we could not read back, a machine that would
 * not answer — nothing was written, so nothing was bought.
 *
 * Two people asking at the same moment can both pay and both write; the words
 * are the same and the second write replaces the first with them. A lock for
 * that would cost more than the unit it saves.
 */
export async function transcribeMessage(
  db: Db,
  storage: StorageProvider,
  stt: SttProvider,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<MessageTranscript> {
  const { conversation, message } = await loadMutableMessage(db, userId, conversationId, messageId)

  // A withdrawn note keeps its row and loses its attachment; writing it out
  // would be the one way to read what somebody took back.
  if (message.deletedAt) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That message was withdrawn')
  }
  const attachments = attachmentsOf(message)
  const index = attachments.findIndex((media) => isAudioContentType(media.contentType))
  const note = attachments[index]
  if (message.type !== 'audio' || !note) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is no voice note here to write out')
  }
  if (note.transcript) return { ...note.transcript, cached: true }

  if (!supportsPut(storage)) {
    throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured for transcripts')
  }
  // Only a note in our own bucket is ever fetched by this server. A v1 note
  // that still lives elsewhere is not something to reach out for.
  const key = storage.keyFromPublicUrl(note.url)
  if (!key) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'This voice note cannot be written out')
  }

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  const quota = await consumeQuota(db, userId, effectiveTier(profile), 'transcripts')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily transcript limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }

  let transcript: VoiceTranscript
  try {
    const [audio, langs] = await Promise.all([
      storage.getObject(key),
      likelyLanguages(db, conversation, message.senderId),
    ])
    const heard = await stt.transcribe({ audio, langs })
    transcript = { text: heard.text.trim(), lang: heard.lang }
  } catch (caught) {
    await refundQuota(db, userId, 'transcripts', quota.spentAt)
    if (caught instanceof SttBusyError) {
      throw new ApiError(
        ERROR_CODES.RATE_LIMITED,
        'The transcript service is busy — try again shortly',
      )
    }
    throw caught
  }

  await writeTranscript(db, message, index, transcript)
  return { ...transcript, cached: false }
}

/**
 * Onto the attachment it describes, in both places a row may hold it.
 *
 * `attachments` is the field and `media` is its first entry repeated for older
 * builds (see `attachmentsOf`); a v1 row has only `media`. Writing only one of
 * them would leave an older build reading a note that was never written out.
 */
async function writeTranscript(
  db: Db,
  message: Message,
  index: number,
  transcript: VoiceTranscript,
): Promise<void> {
  const set: Record<string, VoiceTranscript> = {}
  if (message.attachments?.length) set[`attachments.${String(index)}.transcript`] = transcript
  if (message.media && (index === 0 || !message.attachments?.length)) {
    set['media.transcript'] = transcript
  }
  await db.collection<Message>(COLLECTIONS.messages).updateOne({ _id: message._id }, { $set: set })
}
