import {
  ERROR_CODES,
  MAX_PINNED_CONVERSATIONS,
  REPLY_PREVIEW_MAX_LENGTH,
  attachmentsOf,
  type ConversationFilter,
  type AnswerQuizInput,
  type RespondToMeetingInput,
  type SendCorrectionInput,
  type SendMediaMessageInput,
  type SendMeetingInput,
  UPCOMING_MEETING_LOOKAHEAD_HOURS,
  type UpcomingMeeting,
  type SendPhraseInput,
  type SendQuizInput,
  type SendStickerInput,
  findCosmetic,
  hasFeature,
  type SendTextMessageInput,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { ApiError } from '../../lib/ApiError'
import { assertAttachmentsAllowed } from '../media/assertMedia'
import type { AttachmentNormalizer } from '../media/transcodeAudio'
import { blockedUserIds } from '../moderation/blocks'
import { isSuspended } from '../moderation/suspension'
import { acceptsMessages, isOfficialId, unwritableOfficialIds } from '../official/accounts'
import { awardForSend } from '../tokens/awards'
import { assertConversationAccess, assertMediaUnlocked } from './access'
import { readEchoedMessageIds } from '../echo/echoed'
import { mirrorPhraseToEcho } from '../echo/phraseMirror'
import { toMessageView, type MessageView } from './messageView'
import type { Conversation, Message } from './conversations'
import { conversationPartners, type Profile } from '../profiles/profiles'
import { effectiveTier } from '../profiles/entitlement'
import { mediaLockedFor, toConversationView, type ConversationView } from './conversationView'

export interface SendResult {
  message: Message
  conversation: Conversation
}

/**
 * Every send (text or correction) is: write the message, update the
 * conversation's denormalized `lastMessage`/`unread`/`bothSpoke`, then pay
 * out token and advance the streak — the same sequence regardless of type,
 * factored here so `sendTextMessage` and `sendCorrection` can't drift on what
 * "sending a message" means for the conversation document, and so the socket
 * transport earns tokens through exactly the same code REST does.
 */
/**
 * The line the chat list and a reply quote show for a message with no words
 * of its own.
 *
 * English, from the server, and so the one string in a message that does not
 * come from the app's catalogues — it is denormalized into
 * `conversations.lastMessage` at send time, where the reader's language is not
 * known and cannot be. Localising it would mean either storing it per reader
 * or re-deriving the list's preview on every read.
 */
export function previewFor(type: Message['type'], count = 1): string {
  if (type === 'image') return count > 1 ? `📷 ${count} photos` : '📷 Photo'
  if (type === 'video') return count > 1 ? `🎬 ${count} videos` : '🎬 Video'
  if (type === 'audio') return '🎤 Voice message'
  // Every type that carries no `body` needs a line here. Forget one and the
  // chat list row and the push notification are both blank — the message
  // arrives and says nothing.
  if (type === 'phrase') return '🗂️ Phrase'
  if (type === 'meeting') return '📅 Meeting'
  if (type === 'quiz') return '❓ Quiz'
  if (type === 'sticker') return '🩷 Sticker'
  return ''
}

/**
 * The quoted message, resolved once at send time.
 *
 * Scoped to the conversation exactly the way `sendCorrection` scopes its
 * target: an id from another thread must read as "not found" rather than as a
 * permission error, because the two are indistinguishable to someone guessing
 * ids and only one of them confirms the message exists.
 */
async function resolveReplyTo(
  db: Db,
  conversation: Conversation,
  replyToMessageId: string | undefined,
  quote?: string,
): Promise<Message['replyTo'] | undefined> {
  if (!replyToMessageId) {
    if (quote) throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'A quote needs a reply target')
    return undefined
  }

  let targetId: ObjectId
  try {
    targetId = new ObjectId(replyToMessageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed reply target id')
  }

  const target = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: targetId, conversationId: conversation._id })
  if (!target) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Reply target not found in this conversation')
  }

  // Refused rather than dropped: the preview is what the other person reads
  // as "you said this", and a reply quoting words the message does not
  // contain would put them in its author's mouth. A withdrawn message has an
  // empty body, so nothing can be quoted from it either.
  if (quote !== undefined && !target.body.includes(quote)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'The quote is not part of that message')
  }

  return {
    messageId: target._id,
    senderId: target.senderId,
    preview: (
      quote ??
      (target.body || previewFor(target.type, attachmentsOf(target).length))
    ).slice(0, REPLY_PREVIEW_MAX_LENGTH),
  }
}

/**
 * The message this recording answers, if it is answering one.
 *
 * Validated the way `resolveReplyTo` validates its target and then some: the
 * message has to be in this conversation, it has to have actually asked to be
 * said out loud, and the person answering cannot be the person who asked.
 * Reading your own sentence back to yourself is not an answer, and the
 * client-side guess this replaces counted it as one.
 *
 * A target that fails any of those is dropped rather than refused. The
 * recording is a real message either way, and failing the send because a
 * pointer went stale would lose it.
 */
async function resolveAnswerTarget(
  db: Db,
  conversation: Conversation,
  senderId: string,
  answersMessageId: string | undefined,
): Promise<Message | null> {
  if (!answersMessageId || !ObjectId.isValid(answersMessageId)) return null

  const target = await db.collection<Message>(COLLECTIONS.messages).findOne({
    _id: new ObjectId(answersMessageId),
    conversationId: conversation._id,
    ask: 'pronunciation',
  })
  if (!target || target.senderId === senderId) return null
  return target
}

/**
 * The single write every message goes through: the insert, the conversation's
 * counters and last-message line, and the award.
 *
 * Exported for `modules/official/deliver.ts`, which is the one caller outside
 * this file. It writes on behalf of an account nobody is signed in to, and
 * doing that by hand would mean a second copy of the counter arithmetic that
 * could drift from this one — the chat list quietly showing the wrong preview
 * or an unread badge that never clears.
 */
export async function recordMessage(
  db: Db,
  conversation: Conversation,
  message: Message,
): Promise<Conversation> {
  const recipientId = conversation.participants.find((id) => id !== message.senderId)

  /*
   * A channel has nothing at the other end to read a reply. `@langx` welcomes
   * and announces; there is no composer for it in the app, and this is the
   * guard behind that — every message of every type lands here, so refusing
   * once refuses all of them rather than one screen's worth.
   *
   * The official account writing *out* is unaffected: the recipient there is a
   * person.
   */
  if (recipientId !== undefined && !acceptsMessages(recipientId)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'This account does not take messages')
  }

  /*
   * Nor does a suspended account. It cannot sign in to read what arrives, and
   * the person writing is owed that answer rather than a thread that looks
   * alive and never replies. Here rather than in `assertConversationAccess`,
   * which reads as well as writes: the history stays readable, only the next
   * message is refused. The suspended side needs no check of its own —
   * `requireAuth` and the socket handshake already refuse everything it asks.
   *
   * One keyed read per send, projected to the one field. `acceptsMessages`
   * above is a map lookup; this cannot be, because a suspension is decided
   * while the recipient's thread is open.
   *
   * Our own accounts are exempt. A receipt or a note from @langx is not what
   * a suspension protects anybody from, and the panel's one message to a
   * person is how somebody we suspended can be told something before a lift.
   */
  if (recipientId !== undefined && !isOfficialId(message.senderId)) {
    const recipient = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: recipientId }, { projection: { suspension: 1 } })
    if (isSuspended(recipient)) {
      throw new ApiError(ERROR_CODES.RECIPIENT_SUSPENDED, 'This account is suspended')
    }
  }

  await db.collection<Message>(COLLECTIONS.messages).insertOne(message)
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  /*
   * The reciprocity transition, claimed rather than derived.
   *
   * `becameMutual` used to be `!conversation.bothSpoke && bothSpoke`, read off
   * the copy this call was handed — so two replies from the second speaker
   * landing together both saw `bothSpoke` false and both called themselves the
   * transition. The *payment* survived that, because `awardForSend` files it
   * under `mutual:<conversationId>` and the ledger's unique index caps it. The
   * pool score did not: `recordActivity` is a plain `$inc`, and
   * `mutualConversations` is the heaviest term in `activityScore` and the only
   * one with no cap. Two simultaneous replies bought five points of somebody
   * else's share of the day.
   *
   * A conditional `$set` is the whole fix: exactly one writer can move the
   * field from unset-or-false to true, and that one is the transition. It is
   * also the only write that ever changed `bothSpoke` — the old unconditional
   * `$set` wrote the value it already had on every other send — so this is
   * where it belongs rather than an extra write. The round trip is paid at
   * most once per conversation, and never again on the hot path: the guard in
   * front of it is false for every message after the second speaker's first.
   */
  const becameMutual =
    !conversation.bothSpoke &&
    message.senderId !== conversation.firstMessageBy &&
    (
      await conversations.updateOne(
        { _id: conversation._id, bothSpoke: { $ne: true } },
        {
          $set: { bothSpoke: true },
        },
      )
    ).modifiedCount === 1

  const updated = await conversations.findOneAndUpdate(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: {
          // The chat list shows this verbatim, so an attachment needs a label
          // rather than the empty string a caption-less voice note carries.
          body: message.body || previewFor(message.type, attachmentsOf(message).length),
          senderId: message.senderId,
          createdAt: message.createdAt,
        },
        updatedAt: message.createdAt,
      },
      // Riding the write that was already happening. The media gate reads this
      // and must not pay for a `countDocuments` on the send path.
      $inc: {
        messageCount: 1,
        [`messageCountBy.${message.senderId}`]: 1,
        ...(recipientId ? { [`unread.${recipientId}`]: 1 } : {}),
      },
      /*
       * A new message brings a deleted thread back, on both sides. Deleting is
       * "I am done with this conversation", not "block me from it" — the other
       * person knows nothing about it and writing again has to reach somebody.
       *
       * It comes back empty for whoever deleted it: the messages it used to
       * hold carry their id in `hiddenFor`, and only the new one does not.
       * Unconditional because `$unset` on an absent key is free, which is
       * cheaper than reading the document to decide.
       */
      $unset: Object.fromEntries(conversation.participants.map((id) => [`deletedBy.${id}`, ''])),
    },
    { returnDocument: 'after' },
  )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')

  await awardForSend(db, {
    conversation: updated,
    message,
    // The transition, not the state: `bothSpoke` stays true forever after, so
    // the reciprocity bonus has to fire on the send that flipped it — and on
    // that one only, which is what the claim above establishes.
    becameMutual,
  })

  return updated
}

export async function sendTextMessage(
  db: Db,
  senderId: string,
  input: SendTextMessageInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  /*
   * Sending a translation is paid; reading one is not.
   *
   * Checked here rather than only in the composer because the client asks
   * `POST /translate` first and then sends the result — a build that skipped
   * the row would still be able to attach one. Refused before the message is
   * written, so a message is never half-sent: the caller is told to upgrade
   * and can send the same sentence without the translation.
   */
  if (input.translation) {
    const sender = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: senderId }, { projection: { entitlement: 1 } })
    if (!sender || !hasFeature(effectiveTier(sender), 'sendTranslation')) {
      throw new ApiError(ERROR_CODES.UPGRADE_REQUIRED, 'Sending a translation requires Pro+', {
        feature: 'sendTranslation',
      })
    }
  }

  const replyTo = await resolveReplyTo(db, conversation, input.replyToMessageId, input.quote)

  /**
   * A send whose ack was lost looks exactly like one that never arrived, so the
   * client retries it. `sender_client_id_unique` is what makes that safe: the
   * second write is refused by the index rather than by a prior read, which is
   * the only version that holds under a race.
   */
  if (input.clientId) {
    const already = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ senderId, clientId: input.clientId })
    if (already) return { message: already, conversation }
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'text',
    body: input.body,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(input.ask ? { ask: input.ask } : {}),
    ...(input.translation ? { translation: input.translation } : {}),
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

/**
 * A phrase card: the message, and the deck row it is readable from.
 *
 * The message is written first and the card second. If the card write loses
 * the unique index — the same term already saved in this conversation — the
 * message still stands: the card was sent, and saying so twice in the thread
 * is honest, while a message that vanished because a word was already in the
 * deck would look like a failed send.
 */
export async function sendPhrase(
  db: Db,
  senderId: string,
  input: SendPhraseInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  if (input.clientId) {
    const already = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ senderId, clientId: input.clientId })
    if (already) return { message: already, conversation }
  }

  const phrase = {
    term: input.term,
    meaning: input.meaning,
    lang: input.lang,
    ...(input.example ? { example: input.example } : {}),
  }
  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'phrase',
    // The card is the message, so there is no sentence beside it.
    body: '',
    phrase,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)

  // Minted here rather than left to Mongo, so the Echo mirror below has a key
  // on both the success and the duplicate path.
  let phraseCardId = new ObjectId()
  try {
    await db.collection(COLLECTIONS.phraseCards).insertOne({
      _id: phraseCardId,
      conversationId: conversation._id,
      messageId: message._id,
      authorId: senderId,
      ...phrase,
      createdAt: message.createdAt,
    })
  } catch (caught) {
    // `conversation_term_unique` refusing a repeat is the expected outcome, not
    // a failure. Anything else is.
    if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
    /*
     * The deck row already exists, written by whoever saved this word first —
     * the index is per *conversation*, not per author, so the loser here is
     * often the other person. Their Echo card is still theirs to have, and
     * `card_source_unique` is per user, so both people end up with one card
     * each against the same phrase. Without this the second person would
     * silently get nothing.
     */
    const existing = await db
      .collection<{ _id: ObjectId }>(COLLECTIONS.phraseCards)
      .findOne({ conversationId: conversation._id, term: phrase.term })
    if (!existing) return { message, conversation: updatedConversation }
    phraseCardId = existing._id
  }

  /*
   * Awaited rather than fired off, so a test sees a deterministic outcome —
   * it is one insert. It cannot throw: saving a phrase is what the person
   * asked for, and a mirror that failed must not turn that into an error.
   */
  await mirrorPhraseToEcho(db, {
    phraseCardId,
    conversationId: conversation._id,
    authorId: senderId,
    phrase,
  })

  return { message, conversation: updatedConversation }
}

/**
 * Every call this person has agreed to that has not started yet.
 *
 * Read by one client for one reason: the Live Activity needs a start, an end
 * and somebody to name, and it cannot get them by walking the conversation
 * list — a meeting card can be any distance up a thread, and the phone holds
 * only the pages it has opened.
 *
 * Both sides of the card are returned, because both sides agreed to it. The
 * proposer is as likely to have forgotten as the invitee, which is the same
 * reasoning the hour-before push already follows in
 * `modules/notifications/meetings.ts`.
 *
 * Sorted by start, and capped by a lookahead rather than a count: a client
 * that asked for "the next one" and got a call three weeks away would start a
 * countdown nobody wants to look at for three weeks.
 */
export async function upcomingMeetingsFor(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<UpcomingMeeting[]> {
  const conversations = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: userId }, { projection: { _id: 1, participants: 1 } })
    .toArray()
  if (conversations.length === 0) return []

  const participantsOf = new Map(
    conversations.map((conversation) => [
      conversation._id.toHexString(),
      conversation.participants,
    ]),
  )

  const horizon = new Date(now.getTime() + UPCOMING_MEETING_LOOKAHEAD_HOURS * 60 * 60 * 1000)
  const messages = await db
    .collection<Message>(COLLECTIONS.messages)
    .find({
      conversationId: { $in: conversations.map((conversation) => conversation._id) },
      type: 'meeting',
      // Agreed, not merely offered. A proposal nobody answered is not a
      // commitment and a withdrawn one is not either.
      'meeting.status': 'accepted',
      'meeting.startsAt': { $gte: now, $lt: horizon },
      deletedAt: { $exists: false },
    })
    .sort({ 'meeting.startsAt': 1 })
    .toArray()

  const upcoming: UpcomingMeeting[] = []
  for (const message of messages) {
    const meeting = message.meeting
    if (!meeting) continue
    const conversationId = message.conversationId.toHexString()
    const withUserId = participantsOf.get(conversationId)?.find((id) => id !== userId)
    if (withUserId === undefined) continue
    upcoming.push({
      conversationId,
      messageId: message._id.toHexString(),
      withUserId,
      startsAt: meeting.startsAt.toISOString(),
      durationMinutes: meeting.durationMinutes,
    })
  }
  return upcoming
}

/**
 * A proposed time to talk.
 *
 * It arranges and nothing else — there is no calling in this app, and the card
 * must not look like it could start one.
 */
export async function sendMeeting(
  db: Db,
  senderId: string,
  input: SendMeetingInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  const startsAt = new Date(input.startsAt)
  // A time already gone is not a proposal, and the client's clock is not the
  // one that decides.
  if (startsAt.getTime() <= Date.now()) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'A meeting has to be in the future')
  }

  if (input.clientId) {
    const already = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ senderId, clientId: input.clientId })
    if (already) return { message: already, conversation }
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'meeting',
    body: '',
    meeting: {
      startsAt,
      durationMinutes: input.durationMinutes,
      status: 'proposed',
      ...(input.note ? { note: input.note } : {}),
    },
    ...(input.clientId ? { clientId: input.clientId } : {}),
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

/**
 * Accepts, declines or cancels a proposal.
 *
 * Who may do what is decided here rather than in the schema, which cannot see
 * who is asking: the proposer can only withdraw, and only the other person can
 * answer. A proposal that has already been answered stays answered — changing
 * your mind is a new proposal, not an edit of somebody's record of the old one.
 */
export async function respondToMeeting(
  db: Db,
  userId: string,
  input: RespondToMeetingInput,
): Promise<{ message: Message; conversation: Conversation }> {
  const conversation = await assertConversationAccess(db, input.conversationId, userId)

  let messageId: ObjectId
  try {
    messageId = new ObjectId(input.messageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
  }

  const message = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: messageId, conversationId: conversation._id, type: 'meeting' })
  if (!message?.meeting) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such meeting')

  const mine = message.senderId === userId
  if (input.status === 'cancelled' ? !mine : mine) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      mine ? 'Only the other person can answer this' : 'Only the proposer can cancel this',
    )
  }
  if (message.meeting.status !== 'proposed') {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'This meeting has already been answered')
  }

  const updated = await db.collection<Message>(COLLECTIONS.messages).findOneAndUpdate(
    // `status` in the filter, not just the read above: two taps racing must
    // not both win, and only the write can decide that.
    { _id: messageId, 'meeting.status': 'proposed' },
    { $set: { 'meeting.status': input.status, 'meeting.respondedAt': new Date() } },
    { returnDocument: 'after' },
  )
  if (!updated) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'This meeting has already been answered')
  }
  return { message: updated, conversation }
}

export async function sendQuiz(
  db: Db,
  senderId: string,
  input: SendQuizInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  if (input.clientId) {
    const already = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ senderId, clientId: input.clientId })
    if (already) return { message: already, conversation }
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'quiz',
    body: '',
    quiz: {
      question: input.question,
      options: input.options,
      correctIndex: input.correctIndex,
    },
    ...(input.clientId ? { clientId: input.clientId } : {}),
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

/**
 * Answering one, once.
 *
 * The asker cannot answer their own question — they already know — and an
 * answered quiz stays answered: a second go would find the right option by
 * elimination, which is not an answer to anything. `quiz.answer` is in the
 * update filter as well as the read, so two taps racing cannot both win.
 *
 * No token is paid. Two accounts asking and answering each other would be the
 * easiest farm in the app; `awardForSend` already pays the ordinary 2 for the
 * send, and that is the whole of it.
 */
export async function answerQuiz(
  db: Db,
  userId: string,
  input: AnswerQuizInput,
): Promise<{ message: Message; conversation: Conversation }> {
  const conversation = await assertConversationAccess(db, input.conversationId, userId)

  let messageId: ObjectId
  try {
    messageId = new ObjectId(input.messageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
  }

  const message = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: messageId, conversationId: conversation._id, type: 'quiz' })
  if (!message?.quiz) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such quiz')
  if (message.senderId === userId) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'You wrote this one')
  }
  if (input.index >= message.quiz.options.length) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No such option')
  }

  const updated = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOneAndUpdate(
      { _id: messageId, 'quiz.answer': { $exists: false } },
      { $set: { 'quiz.answer': { index: input.index, at: new Date() } } },
      { returnDocument: 'after' },
    )
  if (!updated) throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Already answered')
  return { message: updated, conversation }
}

/**
 * A sticker from a pack the sender owns.
 *
 * Ownership is checked here, not trusted from the client: the pack is the
 * thing token buys, and a send that skipped the check would make buying one
 * optional. `assertOwnsCosmetic` is the same guard equipping a frame uses.
 *
 * No media quota and no media gate. Nothing is uploaded and nothing is
 * stored — only an id travels — so neither has anything to weigh or protect.
 */
export async function sendSticker(
  db: Db,
  senderId: string,
  input: SendStickerInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  const pack = findCosmetic(input.packId)
  if (!pack || pack.kind !== 'stickers' || !pack.stickers?.includes(input.stickerId)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No such sticker')
  }
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: senderId }, { projection: { cosmetics: 1 } })
  if (!profile?.cosmetics?.includes(input.packId)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, `You do not own ${input.packId}`)
  }

  if (input.clientId) {
    const already = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ senderId, clientId: input.clientId })
    if (already) return { message: already, conversation }
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'sticker',
    body: '',
    sticker: { packId: input.packId, stickerId: input.stickerId },
    ...(input.clientId ? { clientId: input.clientId } : {}),
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

/**
 * Unlimited on both tiers by design — see `PLAN_LIMITS.correctionsPer24h`'s
 * doc comment. No quota call anywhere in this path.
 */
export async function sendCorrection(
  db: Db,
  senderId: string,
  input: SendCorrectionInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  let targetId: ObjectId
  try {
    targetId = new ObjectId(input.targetMessageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed target message id')
  }

  const target = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: targetId, conversationId: conversation._id })
  if (!target) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Target message not found in this conversation')
  }

  // The same rule as a reply's quote: `original` is shown as what the other
  // person wrote, so it has to be something they did write.
  if (input.original !== undefined && !target.body.includes(input.original)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'The original is not part of that message')
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'correction',
    body: input.corrected,
    correction: {
      targetMessageId: targetId,
      original: input.original ?? target.body,
      corrected: input.corrected,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    createdAt: new Date(),
  }

  /**
   * The target is already loaded, so stamping it costs nothing — and it is
   * what makes `canEditMessage` a field read rather than a second query. The
   * sentence someone has just taught about must stop being editable, or the
   * `original` snapshot above ends up quoting something that no longer exists.
   */
  await db
    .collection<Message>(COLLECTIONS.messages)
    .updateOne({ _id: target._id }, { $set: { correctedAt: message.createdAt } })

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

/**
 * An image or a voice note. Restores v1 parity, and is what lets the message
 * migration bring a whole thread across instead of a text-only skeleton.
 *
 * The attachment is already in the bucket by the time this runs — the client
 * uploaded it through a presigned URL — so this validates that what it is
 * telling us matches what it asked to upload, and refuses anything else. The
 * checks are cheap and the alternative is a message pointing at a file we
 * never agreed to host.
 */
export async function sendMediaMessage(
  db: Db,
  senderId: string,
  input: SendMediaMessageInput,
  storagePublicBaseUrl: string | undefined,
  normalizeAttachments?: AttachmentNormalizer,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)
  // The belt to the upload URL's braces. A URL signed a moment before the
  // fifth message was deleted would otherwise still land, and any future
  // transport that forgets the first check lands here instead of nowhere.
  await assertMediaUnlocked(db, conversation, senderId)

  // Shared with the feed — see `assertMediaAllowed`. The ceilings are the real
  // cost control, and there must be exactly one copy of them. The kind comes
  // from the bytes rather than from the sender, so the two cannot disagree.
  const kind = assertAttachmentsAllowed(
    input.attachments,
    storagePublicBaseUrl,
    // Keyed by conversation, not by sender — see the upload route. So the
    // ownership this checks is "a file uploaded for *this thread*", which is
    // the same guarantee for a pair as a user prefix is for one person.
    `messages/${conversation._id.toHexString()}/`,
  )

  const replyTo = await resolveReplyTo(db, conversation, input.replyToMessageId)
  const answers = await resolveAnswerTarget(db, conversation, senderId, input.answersMessageId)

  /*
   * After the checks above and before the insert, which is the only correct
   * place for it: a URL that is not ours must never be fetched by this server,
   * and the row must not name a file that does not exist yet. In practice this
   * changes exactly one thing — a voice note recorded in a browser becomes AAC
   * so an iPhone can play it. Everything else comes back as it went in.
   */
  const attachments = normalizeAttachments
    ? await normalizeAttachments(input.attachments)
    : input.attachments

  // Non-empty by schema; the guard is for `noUncheckedIndexedAccess`.
  const first = attachments[0]

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: kind,
    body: input.body ?? '',
    attachments,
    /*
     * Written twice, on purpose, and only for as long as binaries that predate
     * `attachments` are installed: they read `media` and would show an empty
     * bubble otherwise. They see the first file of a gallery rather than all of
     * it, which is the honest degradation. Dropping this field is a migration
     * of its own, not a line in this one.
     */
    ...(first ? { media: first } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(answers ? { answersMessageId: answers._id } : {}),
    createdAt: new Date(),
  }

  if (answers) {
    /*
     * Stamped on the asked message for the same reason `sendCorrection`
     * stamps `correctedAt`: the target is already loaded, so this costs
     * nothing, and it turns "has this been said out loud" into a field read
     * for every reader instead of a scan of whatever happens to be on screen.
     *
     * First answer wins. A second recording is still a message and still
     * plays; it just does not rewrite who answered first.
     */
    await db
      .collection<Message>(COLLECTIONS.messages)
      .updateOne(
        { _id: answers._id, answeredAt: { $exists: false } },
        { $set: { answeredAt: message.createdAt, answeredBy: senderId } },
      )
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

export interface MessagePage {
  /**
   * Projected, never raw. Per-user state lives on the same document now, so a
   * page has to be built for the person asking for it — see `toMessageView`.
   */
  items: MessageView[]
  /** Feed to `cursor` for the page *before* this one. Null at the beginning of history. */
  nextCursor: string | null
  /**
   * Feed to `after` for the page *after* this one. Null means this page
   * already reaches the live tail, which is what lets a client know whether a
   * newly arrived message belongs in it.
   */
  prevCursor: string | null
  participants: string[]
  /**
   * The pinned message, on the page for the same reason `participants` is: the
   * thread's banner needs it before anything else has loaded, and the client
   * never fetches the conversation document on its own.
   */
  pinned: { messageId: string; byUserId: string; at: string } | null
  /**
   * How many more messages before an attachment is allowed here, or 0. On the
   * page for the same reason `participants` and `pinned` are: the composer
   * needs it before anything else has loaded, and the client never fetches the
   * conversation document on its own.
   */
  mediaLockedFor: number
  /** Set only by `listMessagesAround`, so a client knows what to scroll to. */
  anchorId?: string
}

/**
 * The page a thread that is one message old would answer with, built without
 * asking for it.
 *
 * `startConversation` writes the conversation and its opening message in one
 * request, and the client that made it then has to draw that thread. It used
 * to fetch the page — a second round trip, on a screen that had already
 * cleared its composer and was showing nothing, for a page whose every field
 * is known here: one message, no history in either direction, no pin, and the
 * participants and media countdown off the conversation just written.
 *
 * Built here rather than in the route because `MessagePage` is this file's
 * shape, and a second place constructing one is how the two start to
 * disagree. Pure and synchronous, like `toMessageView` underneath it.
 */
export function openingPage(
  conversation: Conversation,
  message: Message,
  viewerId: string,
): MessagePage {
  return {
    items: [toMessageView(message, viewerId)],
    // Nothing older and nothing newer: this message is the whole thread.
    nextCursor: null,
    prevCursor: null,
    participants: conversation.participants,
    pinned: null,
    mediaLockedFor: mediaLockedFor(conversation, viewerId),
  }
}

/**
 * Newest page first, but each page's `items` come back oldest-first.
 *
 * `cursor` walks backwards into history and `after` walks forwards toward the
 * newest; only one of the two, and neither means "the newest page". Forwards
 * exists for `listMessagesAround`'s window, which starts in the middle of a
 * thread and has to be able to page in both directions to reach the tail.
 */
export async function listMessages(
  db: Db,
  userId: string,
  conversationId: string,
  query: { cursor?: string | undefined; after?: string | undefined; limit: number },
): Promise<MessagePage> {
  if (query.cursor && query.after) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Pass cursor or after, not both')
  }
  const conversation = await assertConversationAccess(db, conversationId, userId)
  const messages = db.collection<Message>(COLLECTIONS.messages)

  const forwards = Boolean(query.after)
  const filter: Document = { conversationId: conversation._id }
  const boundary = query.after ?? query.cursor
  if (boundary) {
    const { date, id } = decodeDateIdCursor(boundary)
    filter.$or = forwards
      ? [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }]
      : [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  const direction = forwards ? 1 : -1
  const page = await messages
    .find(filter)
    .sort({ createdAt: direction, _id: direction })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const window = hasMore ? page.slice(0, query.limit) : page
  // Descending queries come back newest-first; the wire format is oldest-first.
  const items = forwards ? window : window.reverse()

  const oldest = items[0]
  const newest = items.at(-1)
  /*
   * One query for the page, never one per message. The mark on a bubble is
   * per viewer and lives in another collection, so it cannot ride along on the
   * document the way `starred` does — this is the feed's `readLikeSummary`
   * shape, applied to a thread.
   */
  const echoed = await readEchoedMessageIds(
    db,
    userId,
    items.map((message) => message._id),
  )
  return {
    items: items.map((message) => toMessageView(message, userId, echoed)),
    // Only the direction actually being paged reports more: the caller already
    // holds everything on the side it came from, and claiming otherwise would
    // have an infinite query walk back over pages it has.
    nextCursor:
      !forwards && hasMore && oldest ? encodeDateIdCursor(oldest.createdAt, oldest._id) : null,
    prevCursor:
      forwards && hasMore && newest ? encodeDateIdCursor(newest.createdAt, newest._id) : null,
    // The thread header needs the counterpart even before anyone has replied,
    // and a one-sided thread has no message to read a partner id off.
    participants: conversation.participants,
    mediaLockedFor: mediaLockedFor(conversation, userId),
    pinned: conversation.pinned
      ? {
          messageId: conversation.pinned.messageId.toHexString(),
          byUserId: conversation.pinned.byUserId,
          at: conversation.pinned.at.toISOString(),
        }
      : null,
  }
}

/**
 * A window centred on one message, for jumping to it.
 *
 * Two queries rather than one because a keyset cursor only walks one way: the
 * anchor's neighbours on either side are two different scans off the same
 * `(createdAt, _id)` key. Both cursors come back, so the window can then be
 * paged in either direction until it meets the tail.
 *
 * Used by a reply's quote, and later by the pinned banner and the starred
 * list — all three are "show me this message in its context".
 */
export async function listMessagesAround(
  db: Db,
  userId: string,
  conversationId: string,
  query: { around: string; limit: number },
): Promise<MessagePage> {
  const conversation = await assertConversationAccess(db, conversationId, userId)
  const messages = db.collection<Message>(COLLECTIONS.messages)

  let anchorId: ObjectId
  try {
    anchorId = new ObjectId(query.around)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
  }

  const anchor = await messages.findOne({ _id: anchorId, conversationId: conversation._id })
  if (!anchor) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found in this conversation')
  }

  const half = Math.max(1, Math.floor(query.limit / 2))
  const [olderPage, newerPage] = await Promise.all([
    messages
      .find({
        conversationId: conversation._id,
        $or: [
          { createdAt: { $lt: anchor.createdAt } },
          { createdAt: anchor.createdAt, _id: { $lt: anchor._id } },
        ],
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(half + 1)
      .toArray(),
    messages
      .find({
        conversationId: conversation._id,
        $or: [
          { createdAt: { $gt: anchor.createdAt } },
          { createdAt: anchor.createdAt, _id: { $gt: anchor._id } },
        ],
      })
      .sort({ createdAt: 1, _id: 1 })
      .limit(half + 1)
      .toArray(),
  ])

  const hasOlder = olderPage.length > half
  const hasNewer = newerPage.length > half
  const older = (hasOlder ? olderPage.slice(0, half) : olderPage).reverse()
  const newer = hasNewer ? newerPage.slice(0, half) : newerPage

  const items = [...older, anchor, ...newer]
  const oldest = items[0]
  const newest = items.at(-1)
  const echoed = await readEchoedMessageIds(
    db,
    userId,
    items.map((message) => message._id),
  )

  return {
    items: items.map((message) => toMessageView(message, userId, echoed)),
    nextCursor: hasOlder && oldest ? encodeDateIdCursor(oldest.createdAt, oldest._id) : null,
    prevCursor: hasNewer && newest ? encodeDateIdCursor(newest.createdAt, newest._id) : null,
    participants: conversation.participants,
    mediaLockedFor: mediaLockedFor(conversation, userId),
    pinned: conversation.pinned
      ? {
          messageId: conversation.pinned.messageId.toHexString(),
          byUserId: conversation.pinned.byUserId,
          at: conversation.pinned.at.toISOString(),
        }
      : null,
    anchorId: anchor._id.toHexString(),
  }
}

/**
 * The second tick: everything in this conversation that `recipientId` has not
 * received yet is now on their device. Returns the timestamp if anything
 * actually changed and `null` otherwise, so a caller does not emit a realtime
 * event announcing that nothing happened.
 *
 * `$exists: false` rather than a blanket `$set`, because delivery is a moment,
 * not a flag — re-stamping a message that arrived an hour ago would drag its
 * timestamp forward every time the recipient reconnects.
 */
export async function markDelivered(
  db: Db,
  conversationId: ObjectId,
  recipientId: string,
): Promise<Date | null> {
  const deliveredAt = new Date()
  const result = await db.collection<Message>(COLLECTIONS.messages).updateMany(
    {
      conversationId,
      senderId: { $ne: recipientId },
      deliveredAt: { $exists: false },
    },
    { $set: { deliveredAt } },
  )
  return result.modifiedCount > 0 ? deliveredAt : null
}

export interface DeliveredSweep {
  conversationId: string
  /** The counterpart — the one waiting to see a second tick appear. */
  senderId: string
  deliveredAt: Date
}

/**
 * What runs when someone connects: every message that was sent to them while
 * they were away is delivered now, in every thread at once.
 *
 * Without this, a message sent to an offline recipient would sit on one tick
 * forever — the send-time path can only mark what it can hand to an open
 * socket, and there may not be one.
 *
 * Scoped to conversations with a non-zero unread count rather than all of
 * them, which is sound because undelivered implies unread: a message cannot be
 * read before it arrives, so anything missing `deliveredAt` is still counted
 * in `unread[userId]`. That keeps a reconnect off a scan of the user's entire
 * history — reconnects are frequent and happen in bursts (a train tunnel, a
 * phone waking up), which is exactly when a full scan would hurt most.
 */
export async function markPendingDelivered(db: Db, userId: string): Promise<DeliveredSweep[]> {
  const pending = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: userId, [`unread.${userId}`]: { $gt: 0 } })
    .toArray()

  const swept: DeliveredSweep[] = []
  for (const conversation of pending) {
    const deliveredAt = await markDelivered(db, conversation._id, userId)
    const senderId = conversation.participants.find((id) => id !== userId)
    if (!deliveredAt || !senderId) continue
    swept.push({ conversationId: conversation._id.toHexString(), senderId, deliveredAt })
  }
  return swept
}

/**
 * How many unread messages this account has, everywhere.
 *
 * Summed on the server because the app cannot do it: the list is paged, so a
 * client only ever holds the threads it has scrolled to, and the archive is
 * excluded from every other tab — a total added up in the cache would be a
 * total of whatever happened to be loaded.
 *
 * Blocked counterparts are left out for the same reason their threads are left
 * out of the list: a badge that counts a conversation nobody can open is a
 * number with nowhere to go.
 *
 * Deleted threads are left out for a sharper version of that reason. They are
 * gone from every tab, the archive included, so their count is not merely
 * pointing nowhere — it can never be cleared either: reading is what zeroes
 * `unread`, and there is no thread left to open. One deletion of an unread
 * conversation left a badge that outlived it, on the tab, on the icon and in
 * every push's `badge`. `listConversations` and the unread digest have always
 * excluded them; this was the one reader that did not.
 */
export async function countUnread(db: Db, userId: string): Promise<number> {
  const hidden = await blockedUserIds(db, userId)
  const unreadPath = `unread.${userId}`
  const rows = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .aggregate<{ total: number }>([
      {
        $match: {
          participants: hidden.length > 0 ? { $eq: userId, $nin: hidden } : userId,
          [`archivedBy.${userId}`]: { $ne: true },
          [`deletedBy.${userId}`]: { $ne: true },
          [unreadPath]: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: `$${unreadPath}` } } },
    ])
    .toArray()
  return rows[0]?.total ?? 0
}

/**
 * The threads this reader still has something unread in, by id, for the
 * silent push that keeps their other phones' shades in step (`ws/traySync.ts`).
 *
 * Wider than `countUnread` on purpose: an archived or blocked thread with
 * unread messages keeps its pushes on the lock screen, which is the safe side
 * to be wrong on. A thread missing from this list has its pushes cleared.
 */
export async function unreadThreadIds(db: Db, userId: string, limit: number): Promise<string[]> {
  const rows = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: userId, [`unread.${userId}`]: { $gt: 0 } }, { projection: { _id: 1 } })
    .limit(limit)
    .toArray()
  return rows.map((row) => row._id.toHexString())
}

/**
 * `wasUnread` says whether this read changed anything. Opening a thread that
 * was already read is most opens, and none of them is news to another device.
 * `unreadBefore` is how many it cleared, which the thread draws its "New
 * messages" line from.
 */
export async function markConversationRead(
  db: Db,
  userId: string,
  conversationId: string,
): Promise<{ conversation: Conversation; wasUnread: boolean; unreadBefore: number }> {
  const conversation = await assertConversationAccess(db, conversationId, userId)
  const unreadBefore = conversation.unread?.[userId] ?? 0
  const wasUnread = unreadBefore > 0

  const updated = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOneAndUpdate(
      { _id: conversation._id },
      { $set: { [`unread.${userId}`]: 0 } },
      { returnDocument: 'after' },
    )
  // Reading a thread proves the messages in it arrived, and this is the only
  // path that catches a reader who never held a socket — opening the app
  // straight from a push notification marks read over REST. No
  // `conversation:delivered` event follows, because the `conversation:read`
  // the caller emits already implies it.
  await markDelivered(db, conversation._id, userId)
  await db
    .collection<Message>(COLLECTIONS.messages)
    .updateMany(
      { conversationId: conversation._id, senderId: { $ne: userId }, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    )

  return { conversation: updated ?? conversation, wasUnread, unreadBefore }
}

export interface ConversationPage {
  items: ConversationView[]
  /** Always the whole set, never paginated — see the note in `listConversations`. */
  pinned: ConversationView[]
  nextCursor: string | null
}

export async function listConversations(
  db: Db,
  userId: string,
  query: { filter?: ConversationFilter | undefined; cursor?: string | undefined; limit: number },
): Promise<ConversationPage> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  const filter = query.filter ?? 'all'

  // A blocked counterpart's thread disappears from the list entirely.
  // `assertConversationAccess` already refuses to open it; without this the
  // thread would still sit in the list, unopenable — the worst of both.
  const hidden = await blockedUserIds(db, userId)
  /*
   * An account nobody can write to is hidden the same way, but from this one
   * tab: `unreplied` is a to-do list, and a thread that takes no reply can
   * never be crossed off it — @langx would announce once and sit at the top of
   * the tab for good. Keyed on `OFFICIAL_WRITABLE` rather than on "is
   * official", so @copilot leaves the tab today and joins it again on the day
   * it opens.
   */
  if (filter === 'unreplied') hidden.push(...unwritableOfficialIds())
  // On an array field `$nin` means "contains none of these", so this reads as
  //: my threads, minus any whose participant list includes someone hidden.
  const base: Document = {
    participants: hidden.length > 0 ? { $eq: userId, $nin: hidden } : userId,
  }

  /*
   * Archiving is a per-tab bound, not a flag on a row: the archive tab is the
   * only place archived threads appear, and every other tab is defined by
   * their absence. Written as `$ne: true` rather than `$exists: false` so a
   * document that was archived and then un-archived — which leaves the key
   * unset — reads the same as one that never was.
   */
  const archivedPath = `archivedBy.${userId}`
  if (filter === 'archived') base[archivedPath] = true
  else base[archivedPath] = { $ne: true }

  // Deleted threads are gone from every tab, archive included — `$ne: true`
  // for the same reason as above, since coming back leaves the key unset.
  base[`deletedBy.${userId}`] = { $ne: true }

  // "They spoke last." See `toConversationView` for why this is not `unread`.
  if (filter === 'unreplied') base['lastMessage.senderId'] = { $ne: userId }

  const pinnedPath = `pinnedBy.${userId}`

  /*
   * Pinned threads are fetched whole and separately, and that is a deliberate
   * limit rather than an oversight.
   *
   * Pinning makes the sort compound — pinned first, then recency — and the
   * cursor is `<lastMessage.createdAt>|<_id>`, which cannot express "and also
   * this side of the pin boundary". Rather than widen the cursor for a set
   * that is small by construction, the pins come back in one un-paginated
   * query and the page below excludes them. `MAX_PINNED_CONVERSATIONS` is what
   * keeps "small by construction" true.
   */
  const pinned =
    filter === 'archived'
      ? []
      : await conversations
          .find({ ...base, [pinnedPath]: true })
          .sort({ 'lastMessage.createdAt': -1, _id: -1 })
          .limit(MAX_PINNED_CONVERSATIONS)
          .toArray()

  const pageFilter: Document = { ...base }
  if (filter !== 'archived') pageFilter[pinnedPath] = { $ne: true }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    pageFilter.$or = [
      { 'lastMessage.createdAt': { $lt: date } },
      { 'lastMessage.createdAt': date, _id: { $lt: id } },
    ]
  }

  const page = await conversations
    .find(pageFilter)
    .sort({ 'lastMessage.createdAt': -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const rows = hasMore ? page.slice(0, query.limit) : page
  const last = rows.at(-1)
  const nextCursor =
    hasMore && last ? encodeDateIdCursor(last.lastMessage.createdAt, last._id) : null

  const partners = await conversationPartners(
    db,
    [...pinned, ...rows].flatMap((c) => c.participants.filter((id) => id !== userId)),
  )
  const view = (c: Conversation): ConversationView => {
    const partner = partners.get(c.participants.find((id) => id !== userId) ?? '')
    return partner ? { ...toConversationView(c, userId), partner } : toConversationView(c, userId)
  }

  return {
    items: rows.map(view),
    pinned: pinned.map(view),
    nextCursor,
  }
}
