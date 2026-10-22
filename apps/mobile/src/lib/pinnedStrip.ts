import { stripFormatting, type MessageType } from '@langx/shared'
import type { MessageKey } from '../i18n/runtime'
import { messagePreviewKey } from './messagePreview'

/**
 * What the v3 thread's pinned strip says: who wrote the pinned message, and
 * one line of it.
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
 * The one line under "Pinned · Maria".
 *
 * The text as a preview prints it everywhere else — markers gone, a spoiler
 * masked (`stripFormatting`) — and folded onto one line, since a line break
 * in the middle of a one-line strip would end it after the first sentence.
 * A message with no words of its own is named by its kind ("Photo", "Voice
 * message"), as the reply band and the long-press menu name it.
 *
 *   - **Not loaded** (`undefined`): the pin is known, the message is not yet.
 *     "Pinned message", which was the whole of the old strip.
 *   - **Deleted** after it was pinned: said so, as the bubble says so,
 *     rather than a blank line or the words that were withdrawn.
 *   - **View once**: its kind only, never a caption. Opening it is the one
 *     time it is meant to be seen, and a strip that printed it would be a
 *     second.
 */
export function pinnedLine(message: PinnedSource | undefined): PinnedLine {
  if (!message) return { key: 'chat.pinnedMessage' }
  if (message.deleted) return { key: 'chat.deleted' }
  if (message.viewOnce === undefined) {
    const text = stripFormatting(message.body).replace(/\s+/g, ' ').trim()
    if (text) return { text }
  }
  return { key: messagePreviewKey(message.type) }
}

/** Whose message it is, or null while the message itself has not loaded. */
export function pinnedAuthor(
  message: PinnedSource | undefined,
  viewerId: string | undefined,
): 'you' | 'them' | null {
  if (!message || !viewerId) return null
  return message.senderId === viewerId ? 'you' : 'them'
}
