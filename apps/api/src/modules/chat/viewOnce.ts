import { attachmentsOf, ERROR_CODES, viewOnceMaxOpens, type MessageMedia } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Conversation, Message } from './conversations'
import { loadMutableMessage } from './mutations'

export interface ViewOnceResult {
  message: Message
  conversation: Conversation
}

/**
 * The view-once message this person may act on as its recipient.
 *
 * Through `loadMutableMessage`, so the conversation guard is the one every
 * other mutation passes. A message that is not view-once, is withdrawn, or is
 * hidden from this reader is "not found" — there is nothing of it to open.
 * The sender is refused outright: they took the picture, and an open of their
 * own would spend the other person's.
 */
async function loadViewOnce(
  db: Db,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<ViewOnceResult & { viewOnce: NonNullable<Message['viewOnce']> }> {
  const { conversation, message } = await loadMutableMessage(db, userId, conversationId, messageId)
  const { viewOnce } = message
  if (!viewOnce || message.deletedAt || message.hiddenFor?.includes(userId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found in this conversation')
  }
  if (message.senderId === userId) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      'A view-once message is for the person it was sent to',
    )
  }
  return { conversation, message, viewOnce }
}

/**
 * One open of a view-once photo or video, and the file to show for it.
 *
 * The count is the database's: a conditional `$inc` below the ceiling, so two
 * devices tapping at once get one open each and never a third between them.
 * The open is spent when the address is handed out, not when the picture
 * finishes loading — the server cannot know the second, and the client keeps
 * the address in memory for as long as the viewer is open, so a slow load is
 * not a lost one.
 *
 * Returns the file as stored. The bucket is public, so the address is the
 * file: what makes it "once" is that nothing else ever returns it. A
 * recipient who keeps it has kept the picture, which a screenshot does too —
 * this is a promise between two people, not DRM.
 */
export async function openViewOnce(
  db: Db,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<ViewOnceResult & { media: MessageMedia }> {
  const { conversation, message, viewOnce } = await loadViewOnce(
    db,
    userId,
    conversationId,
    messageId,
  )

  const updated = await db.collection<Message>(COLLECTIONS.messages).findOneAndUpdate(
    {
      _id: message._id,
      deletedAt: { $exists: false },
      'viewOnce.opens': { $lt: viewOnceMaxOpens(viewOnce.replay) },
    },
    { $inc: { 'viewOnce.opens': 1 }, $set: { 'viewOnce.openedAt': new Date() } },
    { returnDocument: 'after' },
  )
  const media = updated ? attachmentsOf(updated)[0] : undefined
  if (!updated || !media) {
    throw new ApiError(ERROR_CODES.VIEW_ONCE_GONE, 'This has already been opened')
  }

  return { message: updated, conversation, media }
}

/**
 * The recipient took a screenshot while the file was on their screen.
 *
 * Only after an open — there is nothing to capture before one — and only the
 * first time is recorded: the sender's bubble says "Screenshot taken", which
 * a second one would not change. A repeat returns the message as it is, so a
 * retry after a dropped response is not an error.
 */
export async function recordViewOnceScreenshot(
  db: Db,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<ViewOnceResult> {
  const { conversation, message, viewOnce } = await loadViewOnce(
    db,
    userId,
    conversationId,
    messageId,
  )
  if (viewOnce.opens === 0) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'It has not been opened')
  }
  if (viewOnce.screenshotAt) return { conversation, message }

  const updated = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOneAndUpdate(
      { _id: message._id, 'viewOnce.screenshotAt': { $exists: false } },
      { $set: { 'viewOnce.screenshotAt': new Date() } },
      { returnDocument: 'after' },
    )
  // Lost the race to another device's report of the same screenshot: the
  // first one stands, and the current row is what both people should see.
  const current =
    updated ??
    (await db.collection<Message>(COLLECTIONS.messages).findOne({ _id: message._id })) ??
    message
  return { conversation, message: current }
}
