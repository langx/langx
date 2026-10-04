import type { MessageCall } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Conversation, Message } from '../chat/conversations'
import { previewFor } from '../chat/messages'
import { durationSecondsOf, outcomeOf, type Call } from './calls'

export interface CallLogResult {
  message: Message
  conversation: Conversation
  /**
   * False when the row was already there — a second writer arriving after the
   * first. The caller fans out only what it created, or both people would be
   * told about the same call twice.
   */
  created: boolean
}

/**
 * The outcomes that leave something waiting for the person who was called —
 * an unread row, and a push saying they missed it.
 *
 * `missed` and `busy` are the two that happened without them. A call they
 * declined is one they saw ringing and answered, with a no.
 */
export function leavesUnread(outcome: MessageCall['outcome']): boolean {
  return outcome === 'missed' || outcome === 'busy'
}

/**
 * The row a finished call leaves in its thread.
 *
 * **Deliberately not `recordMessage`**, and the list of what that function
 * does that this one must not is the reason this is its own file:
 *
 * - It does not increment `messageCount` or `messageCountBy`. Those counters
 *   are what the consent gate reads — photos, voice notes and calls themselves
 *   all unlock on *messages the other person sent you* — and what the
 *   testimonial unlock reads. A call's row carries the caller as its
 *   `senderId`; counting it would let somebody ring their way past the gate
 *   that decides whether they may ring at all.
 * - It does not claim `bothSpoke`. Ringing somebody is not them answering.
 * - It does not call `awardForSend`. No tokens, no streak day, no activity
 *   score, no share of the daily pool: a call is paid nothing, because two
 *   accounts holding a line open is the cheapest thing in the app to do and
 *   would be the easiest to farm.
 * - It does not refuse a suspended or official recipient. Those are questions
 *   for whether a call may *start* (`assertCallAllowed`); a call that a
 *   suspension ended still happened, and the thread says so.
 *
 * What it keeps is everything that makes the thread tell the truth: the row,
 * the list's last line, the unread count for a call that was missed, and a
 * deleted thread coming back because something happened in it.
 */
export async function recordCallLog(db: Db, call: Call): Promise<CallLogResult | null> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  const messages = db.collection<Message>(COLLECTIONS.messages)

  const outcome = outcomeOf(call)
  const durationSeconds = outcome === 'completed' ? (durationSecondsOf(call) ?? 0) : undefined
  const summary: MessageCall = {
    callId: call._id,
    media: call.media,
    outcome,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: call.conversationId,
    // Whoever placed it. Both readers word the row from where they stand —
    // see `MessageCall` — and this is what tells each of them which side that is.
    senderId: call.callerId,
    type: 'call',
    body: '',
    call: summary,
    /*
     * When the call ended, not when this ran. The sweeper can write a row
     * half a minute late for a process that died, and a row stamped then
     * would sit below messages sent after the call was already over.
     */
    createdAt: call.endedAt ?? new Date(),
  }

  try {
    await messages.insertOne(message)
  } catch (error) {
    // `call_id_unique`: somebody got here first. Not an error — it is the
    // index doing the one thing it is there for.
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error
    const [existing, conversation] = await Promise.all([
      messages.findOne({ 'call.callId': call._id }),
      conversations.findOne({ _id: call.conversationId }),
    ])
    return existing && conversation ? { message: existing, conversation, created: false } : null
  }

  /*
   * The list's last line, but only if nothing newer is already there. A
   * message sent after the call ended and before this row was written is the
   * newer one, and `listConversations` sorts on this date: moving it
   * backwards would drop the thread down the list under a line that is no
   * longer its last.
   */
  await conversations.updateOne(
    { _id: call.conversationId, 'lastMessage.createdAt': { $lte: message.createdAt } },
    {
      $set: {
        lastMessage: {
          body: previewFor('call', 1, summary),
          senderId: call.callerId,
          createdAt: message.createdAt,
          call: {
            media: summary.media,
            outcome: summary.outcome,
            ...(durationSeconds !== undefined ? { durationSeconds } : {}),
          },
        },
        updatedAt: message.createdAt,
      },
    },
  )

  const conversation = await conversations.findOneAndUpdate(
    { _id: call.conversationId },
    {
      // Only what the person being called did not see happen. A call both of
      // them were on is nobody's unread, and neither is one they turned down.
      ...(leavesUnread(outcome) ? { $inc: { [`unread.${call.calleeId}`]: 1 } } : {}),
      // A call brings a deleted thread back, as a message does: see
      // `recordMessage`.
      $unset: Object.fromEntries(call.parties.map((id) => [`deletedBy.${id}`, ''])),
    },
    { returnDocument: 'after' },
  )
  // The thread is gone — both accounts purged between the call and this
  // write. The row is orphaned and harmless; there is nobody to tell.
  if (!conversation) return null

  return { message, conversation, created: true }
}
