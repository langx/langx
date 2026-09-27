/**
 * What a post is asking for, read the one way every screen reads it.
 *
 * A post used to be one of two kinds, and the feed had a section for each.
 * Now the ask is a pair of optional flags: none (a moment — a photo, a video,
 * a line from somebody's day), a correction, a pronunciation, or both. Posts
 * written before that carry only `kind`, and nothing was backfilled, so every
 * reader goes through `asksOf` rather than `post.asks` — the same "read the new
 * field or derive it from the old one" rule `attachmentsOf` set.
 *
 * Pure and free of `react-native`, so the card, the post screen, the composer
 * and the tests all agree on one derivation.
 */

import { POST_ASKS as SHARED_POST_ASKS, type PostAsk } from '@langx/shared'

/*
 * The model itself lives in `@langx/shared` — `asksOf` is the same function
 * the API reads its own rows through, so the client and the server cannot
 * disagree about what a legacy post asks for. Re-exported here so every
 * screen has one import for asks, the shared half and the client's own below.
 */
export { POST_ASKS, asksOf, type PostAsk } from '@langx/shared'

/** One word for a set of asks: what analytics and the "posted" toast branch on. */
export type AskSummary = 'none' | 'correction' | 'pronunciation' | 'both'

export function askSummary(asks: readonly PostAsk[]): AskSummary {
  const correction = asks.includes('correction')
  const pronunciation = asks.includes('pronunciation')
  if (correction && pronunciation) return 'both'
  if (correction) return 'correction'
  if (pronunciation) return 'pronunciation'
  return 'none'
}

/**
 * Canonical order, no duplicates, nothing unknown — the shape the server
 * stores. Applied before sending so two taps in a different order are the same
 * request, and so a hand-edited `?asks=` cannot smuggle in a third value.
 */
export function normaliseAsks(asks: readonly string[]): PostAsk[] {
  return SHARED_POST_ASKS.filter((ask) => asks.includes(ask))
}
