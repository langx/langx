import { ERROR_CODES, type AnswerPollInput, type PollResults } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { assertConversationAccess } from './access'
import type { Conversation, Message } from './conversations'

/** One person's answer to one poll. The unique `{pollId, userId}` is the rule. */
export interface PollAnswer {
  _id: ObjectId
  pollId: string
  userId: string
  optionId: string
  messageId: ObjectId
  createdAt: Date
}

/**
 * Answering a poll under a message — the one function REST and the socket
 * both call, so neither transport can answer twice or answer somebody else's.
 *
 * **The insert is the guard.** `pollAnswers.poll_user_unique` refuses a second
 * row for the same person, whichever way it arrived and however fast; a prior
 * read would let two racing taps both through. The answer is then echoed onto
 * the reader's own copy of the message, so their chip stays ticked on every
 * device without a join.
 *
 * A second answer is not an error to the caller. It gets back the message as
 * it stands, with the first pick on it — which is what the screen should show
 * after a double tap, rather than a toast about a rule nobody broke on purpose.
 */
export async function answerPoll(
  db: Db,
  userId: string,
  input: AnswerPollInput,
): Promise<{ message: Message; conversation: Conversation }> {
  const conversation = await assertConversationAccess(db, input.conversationId, userId)

  let messageId: ObjectId
  try {
    messageId = new ObjectId(input.messageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
  }

  const messages = db.collection<Message>(COLLECTIONS.messages)
  const message = await messages.findOne({
    _id: messageId,
    conversationId: conversation._id,
    'interactive.kind': 'poll',
    deletedAt: { $exists: false },
  })
  const poll = message?.interactive?.kind === 'poll' ? message.interactive : null
  if (!message || !poll) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No such poll')
  // The poll is asked of the reader; its sender answering it would count a
  // program's own vote.
  if (message.senderId === userId) throw new ApiError(ERROR_CODES.FORBIDDEN, 'You sent this one')
  if (!poll.options.some((option) => option.id === input.optionId)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No such option')
  }

  try {
    await db.collection<PollAnswer>(COLLECTIONS.pollAnswers).insertOne({
      _id: new ObjectId(),
      pollId: poll.pollId,
      userId,
      optionId: input.optionId,
      messageId,
      createdAt: new Date(),
    })
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error
    /*
     * Already answered. The message may still lack the echo if the first
     * request died between the two writes, so it is repaired from the row
     * that won rather than from this request's pick.
     */
    const first = await db
      .collection<PollAnswer>(COLLECTIONS.pollAnswers)
      .findOne({ pollId: poll.pollId, userId })
    if (first && poll.answer !== first.optionId) {
      const repaired = await messages.findOneAndUpdate(
        { _id: messageId },
        { $set: { 'interactive.answer': first.optionId } },
        { returnDocument: 'after' },
      )
      if (repaired) return { message: repaired, conversation }
    }
    return { message, conversation }
  }

  const updated = await messages.findOneAndUpdate(
    { _id: messageId },
    { $set: { 'interactive.answer': input.optionId } },
    { returnDocument: 'after' },
  )
  return { message: updated ?? message, conversation }
}

/**
 * Per-option counts for one poll, for the operator panel. Every option the
 * poll offered is present, at 0 if nobody picked it — a missing bar reads as
 * a broken chart, not as nobody.
 */
export async function pollResults(
  db: Db,
  pollId: string,
  optionIds: readonly string[],
): Promise<PollResults> {
  const rows = await db
    .collection<PollAnswer>(COLLECTIONS.pollAnswers)
    .aggregate<{ _id: string; count: number }>([
      { $match: { pollId } },
      { $group: { _id: '$optionId', count: { $sum: 1 } } },
    ])
    .toArray()
  const counts: Record<string, number> = Object.fromEntries(optionIds.map((id) => [id, 0]))
  let total = 0
  for (const row of rows) {
    counts[row._id] = row.count
    total += row.count
  }
  return { pollId, total, counts }
}
