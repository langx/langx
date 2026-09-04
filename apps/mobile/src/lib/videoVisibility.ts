/**
 * Which feed videos may play right now.
 *
 * Two inputs, and both have to be true: the post is far enough onto the screen
 * that somebody is looking at it, and the tab it is on still has focus.
 * Leaving the tab has to stop everything — a muted loop that keeps running
 * behind another screen is a decoder and a battery spent on nobody.
 *
 * Pure and here rather than inside the screen because `vitest.config.ts` can
 * only see `src/lib`, and this is the decision; the `FlatList` wiring around
 * it is not.
 */
export function playableIds(input: {
  /** Post ids `onViewableItemsChanged` last reported. */
  viewable: readonly string[]
  /** False while the tab is not the one on screen. */
  focused: boolean
}): Set<string> {
  if (!input.focused) return new Set()
  return new Set(input.viewable)
}

/**
 * Whether one post's video should be running.
 *
 * A separate function from the set above so a bubble can ask without holding
 * the whole answer, and so "no set at all yet" — the first frame after a
 * mount, before viewability has reported anything — reads as "not yet" rather
 * than as "everything".
 */
export function shouldPlay(postId: string | undefined, playing: ReadonlySet<string>): boolean {
  return postId !== undefined && playing.has(postId)
}
