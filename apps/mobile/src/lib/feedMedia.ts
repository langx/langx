/**
 * How tall a photo or a video is drawn on a feed card.
 *
 * Full width, at its own shape — until it gets tall. A portrait phone video at
 * full width is taller than the window, and the feed's autoplay only starts a
 * clip once 60% of its post is on screen: a clip taller than the window could
 * never get there, so it would never play. Capped at 5:4 portrait and at a
 * fixed ceiling, whichever is lower; the letterbox shows the rest, because a
 * crop would hide part of what somebody chose to share.
 *
 * Pure, so the numbers are testable without a renderer.
 */
export const FEED_MEDIA_MAX_HEIGHT = 420
/** Width over height, at its tallest: 4:5. */
export const FEED_MEDIA_MIN_RATIO = 0.8

export function feedMediaHeight(width: number, ratio: number | null | undefined): number {
  // 4:3 while a picture's shape is unknown — the same guess a card reserves
  // before its bytes arrive, and wrong in the direction that letterboxes.
  const shape = ratio && ratio > 0 ? ratio : 4 / 3
  return Math.round(Math.min(width / Math.max(shape, FEED_MEDIA_MIN_RATIO), FEED_MEDIA_MAX_HEIGHT))
}
