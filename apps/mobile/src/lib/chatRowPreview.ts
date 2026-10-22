import type { MessageKey } from '../i18n/runtime'

/**
 * Structural rather than `ConversationDto['lastMessage']`, for the reason
 * `messagePreview.ts` gives: that type lives beside `react-native`, which the
 * mobile vitest cannot load.
 */
export interface ChatRowLast {
  body: string
  deleted?: boolean
}

export type ChatRowPreview = { text: string } | { key: MessageKey }

/**
 * The line under a partner's name in the chat list.
 *
 * Deleting the newest message for everyone empties `lastMessage.body` on the
 * server and sets `deleted`, so printing the body left the row blank — and
 * "You: " with nothing after it on the sender's side. It says what the bubble
 * says instead.
 */
export function chatRowPreview(last: ChatRowLast): ChatRowPreview {
  if (last.deleted) return { key: 'chat.deleted' }
  return { text: last.body }
}
