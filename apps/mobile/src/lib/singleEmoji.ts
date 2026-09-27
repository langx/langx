/**
 * Moved to `@langx/shared`, where the server needs it too: a reaction is valid
 * when it is exactly one emoji, and the rule has to be the same on both sides.
 * Re-exported so the components that draw the big-emoji hero keep their import.
 */
export { bigEmojiCount, isBigEmoji, MAX_BIG_EMOJI } from '@langx/shared'
