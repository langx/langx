import { stripFormatting, type MessageType } from '@langx/shared'
import type { MessageKey } from '../i18n/runtime'
import { messagePreviewKey } from './messagePreview'

/**
 * What the v3 thread's pinned strip says. Its title is always "Pinned
 * message"; under it, one line of the message with its author in front —
 * "Maria: See you Friday", "You: See you Friday" — as Telegram words it. A
 * name in the title ("Pinned · Maria") read as "Maria pinned it", which it
 * need not be.
 *
 * Structural rather than `MessageDto`, for the reason `messagePreview.ts`
 * gives: that type lives beside `react-native`, which the mobile vitest
 * cannot load.
 */
export interface PinnedSource {
  type: MessageType
  body: string
  senderId: string
  deleted?: boolean
  viewOnce?: unknown
}

export type PinnedLine = { text: string } | { key: MessageKey }

/**
 * The words of the line under "Pinned message", before the author goes in
 * front of them.
 *
 * The text as a preview prints it everywhere else — markers gone, a spoiler
 * masked (`stripFormatting`) — and folded onto one line, since a line break
 * in the middle of a one-line strip would end it after the first sentence.
 * A message with no words of its own is named by its kind ("Photo", "Voice
 * message"), as the reply band and the long-press menu name it.
 *
 *   - **Not loaded** (`undefined`): the pin is known, the message is not yet.
 *     An ellipsis, so the card keeps its height and does not repeat its
 *     title.
 *   - **Deleted** after it was pinned, or gone (`null`: deleted from this
 *     viewer's own copy, so it never comes back): said so, as the bubble
 *     says so, rather than a blank line or the words that were withdrawn.
 *   - **View once**: its kind only, never a caption. Opening it is the one
 *     time it is meant to be seen, and a strip that printed it would be a
 *     second.
 */
export function pinnedLine(message: PinnedSource | null | undefined): PinnedLine {
  if (message === undefined) return { text: '…' }
  if (message === null || message.deleted) return { key: 'chat.deleted' }
  if (message.viewOnce === undefined) {
    const text = stripFormatting(message.body).replace(/\s+/g, ' ').trim()
    if (text) return { text }
  }
  return { key: messagePreviewKey(message.type) }
}

/**
 * Who goes in front of the line: "You", or the partner by name. Null while
 * the message, the viewer or the partner's profile has not loaded — never the
 * sentence-shaped "them", so until the name is in the line goes bare.
 */
export function pinnedAuthor(
  message: PinnedSource | null | undefined,
  viewerId: string | undefined,
  partnerName: string | undefined,
): { key: 'messageMeta.you' } | { text: string } | null {
  if (!message || !viewerId) return null
  if (message.senderId === viewerId) return { key: 'messageMeta.you' }
  return partnerName ? { text: partnerName } : null
}
