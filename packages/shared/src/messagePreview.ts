import type { MessageCall } from './calls'
import type { MessageType } from './chat'

/**
 * The line the chat list and a reply quote show for a message with no words
 * of its own.
 *
 * English, from the server, and so the one string in a message that does not
 * come from the app's catalogues — it is denormalized into
 * `conversations.lastMessage` at send time, where the reader's language is not
 * known and cannot be. Localising it would mean either storing it per reader
 * or re-deriving the list's preview on every read.
 *
 * Shared rather than the API's own because the app writes the same line: a
 * message that arrives over the socket is patched into the chat list without
 * a refetch, and that patch has only the message, whose `body` is empty for
 * everything this words. Two copies would drift, and the row would read one
 * thing until the next refetch and another after it.
 */
export function previewFor(
  type: MessageType,
  count = 1,
  /** A call's row, when there is one in hand, so the line can say which kind. */
  call?: Pick<MessageCall, 'media'>,
): string {
  /*
   * Neutral on purpose: "Voice call", never "Missed voice call". This line is
   * stored once on the conversation and read by both people, and whether a
   * call was missed depends on which of them is reading. A build that knows
   * about calls words it per reader from `lastMessage.call`; this is for the
   * ones that do not, and for anything that only has the type.
   */
  if (type === 'call') return call?.media === 'video' ? '📹 Video call' : '📞 Voice call'
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
  // Never the place name: this line is the chat list row and the push body,
  // and a lock screen is not where somebody's whereabouts should be read out.
  if (type === 'location') return '📍 Location'
  return ''
}

/**
 * `previewFor` with the message in hand, which is what every caller has.
 *
 * The one thing it adds is the view-once wording. "📷 Photo" would be true,
 * but it would also be the only hint on a lock screen or a chat list row that
 * this is not a photo the reader can come back to.
 *
 * The attachments are only counted, so this takes them as anything: the
 * stored message and the app's DTO describe a file differently.
 */
export function previewOf(message: {
  type: MessageType
  attachments?: readonly unknown[] | null
  media?: unknown
  viewOnce?: unknown
}): string {
  if (message.viewOnce) {
    return message.type === 'video' ? '🎬 View-once video' : '📷 View-once photo'
  }
  // `attachmentsOf`'s rule, counted: the list, else the legacy single `media`.
  const count = message.attachments?.length || (message.media ? 1 : 0)
  return previewFor(message.type, count)
}
