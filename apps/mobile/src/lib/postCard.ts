/**
 * What a Posts card is and which one big button it carries — v3's feed card.
 *
 * Pure and free of `react-native`, so the card and the tests agree on one
 * reading of a post.
 */

import type { PostAsk } from '@langx/shared'

/**
 * An ask (somebody wants a correction, a recording, or both) or a moment (a
 * line or a picture from somebody's day). Two cards that look different,
 * because they want different things from the reader.
 */
export type PostCardKind = 'ask' | 'moment'

export function postCardKind(asks: readonly PostAsk[]): PostCardKind {
  return asks.length > 0 ? 'ask' : 'moment'
}

/**
 * The card's one big button.
 *
 * - `correct` opens the feed's own correction box under the card.
 * - `record` opens the post, where the recorder lives (never in a recycled row).
 * - `comment` opens the post at its comments: a moment's way to answer.
 * - `view` opens the post: your own, or one you have already helped with.
 *
 * A moment never offers a correction. Only asked-for help can be given — the
 * server refuses the rest with `not_asked` — so a Correct button on a moment
 * would be a button that always fails (`docs/decisions.md` → _Asks are
 * optional, and only asked-for help can be given_).
 */
export type PostCardAction = 'correct' | 'record' | 'comment' | 'view'

export function postCardAction(post: {
  asks: readonly PostAsk[]
  mine: boolean
  correctedByViewer: boolean
  answeredByViewer: boolean
}): PostCardAction {
  if (post.asks.length === 0) return 'comment'
  // Help is never offered on your own post.
  if (post.mine) return 'view'
  // A post asking for both offers the correction first — it is the one the
  // card can answer in place — and the recording once that is done.
  if (post.asks.includes('correction') && !post.correctedByViewer) return 'correct'
  if (post.asks.includes('pronunciation') && !post.answeredByViewer) return 'record'
  return 'view'
}
