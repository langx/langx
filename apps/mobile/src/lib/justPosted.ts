/**
 * The post somebody has just written, handed from the composer to the feed it
 * returns to — read once, then gone.
 *
 * Posting closes the composer onto the feed, and the new card was patched in
 * at the top of the timeline (`useCreatePost`), wherever the list had been
 * scrolled to: often off screen, so the post seemed to have gone nowhere. The
 * feed takes this when it regains focus, scrolls to the top and rings the
 * card once.
 *
 * A module value rather than a route param or query state: it is a one-shot
 * event between two screens, and a param would ring the card again on every
 * later visit to a URL that still carried it.
 */
let pending: string | null = null

/** The composer, on a post's success. A second post before the feed looked replaces the first. */
export function markJustPosted(postId: string): void {
  pending = postId
}

/** The feed, on focus: the new post's id once, then `null`. */
export function takeJustPosted(): string | null {
  const postId = pending
  pending = null
  return postId
}
