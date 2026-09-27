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

// TEMP(feed-api): replace with @langx/shared once the API stack merges.
// `POST_ASKS`, `PostAsk` and `asksOf` are specified in the feed plan §2.1 and
// land in `packages/shared/src/feed.ts` with the "asks stored" API part; until
// then this is their only copy, so reconciling is deleting these three and
// re-exporting the shared ones from here.
export const POST_ASKS = ['correction', 'pronunciation'] as const
export type PostAsk = (typeof POST_ASKS)[number]

/**
 * The asks a post carries.
 *
 * - `asks` present → it, as sent (the server writes it sorted and deduplicated);
 * - otherwise `kind === 'pronunciation'` → a pronunciation ask;
 * - `kind === 'moment'` → none (the API never sends it, but a stored row can);
 * - otherwise — a missing `kind` included — a correction ask, because every
 *   post written before `kind` existed was one.
 *
 * Takes a loose shape rather than `FeedPost` so a cached page from before the
 * field, a DTO from `@langx/shared` and a test fixture all fit.
 */
// TEMP(feed-api): replace with @langx/shared once the API stack merges.
export function asksOf(post: {
  asks?: readonly PostAsk[] | undefined
  kind?: string | undefined
}): PostAsk[] {
  if (post.asks) return [...post.asks]
  if (post.kind === 'pronunciation') return ['pronunciation']
  if (post.kind === 'moment') return []
  return ['correction']
}

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
  return POST_ASKS.filter((ask) => asks.includes(ask))
}
