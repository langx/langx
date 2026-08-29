import type { MessageRow } from './messageGroups'

export type JumpPlan = { kind: 'scroll'; index: number } | { kind: 'fetch'; anchorId: string }

/**
 * Tapping a quote: scroll to it, or go and get it.
 *
 * Most replies answer something a few rows up, which is already mounted — and
 * fetching a window for a message that is on screen would swap the live thread
 * for a detached one, lose the reader's place and cost a request, all to end up
 * where a `scrollToIndex` would have gone. Only a quote whose target has paged
 * out is worth a round trip.
 *
 * Rows rather than messages, because the index has to count the date headings
 * between them — `scrollToIndex` addresses what the list renders.
 */
export function planJump(rows: MessageRow[], messageId: string): JumpPlan {
  const index = rows.findIndex((row) => row.kind === 'message' && row.key === messageId)
  return index >= 0 ? { kind: 'scroll', index } : { kind: 'fetch', anchorId: messageId }
}
