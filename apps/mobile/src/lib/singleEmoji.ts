/**
 * Whether a message is nothing but a couple of emoji, and how many.
 *
 * Harder than `/\p{Emoji}/` suggests, in three ways that all produce visible
 * bugs:
 *
 * - **`\p{Emoji}` matches the digits.** `0`–`9`, `#` and `*` carry the property,
 *   so "7" would render as a 64px hero. Only a keycap sequence (`7️⃣`) counts.
 * - **One emoji is often many code points.** `👨‍👩‍👧‍👦` is four pictographs joined
 *   by zero-width joiners, `👍🏽` is a thumb plus a skin-tone modifier, and `❤️`
 *   is a heart plus a variation selector. Counting code points would call a
 *   single family emoji four, and drop it out of the "at most three" rule that
 *   makes this readable.
 * - **Flags are pairs of regional indicators**, which are not pictographic at
 *   all.
 *
 * `Intl.Segmenter` would do the clustering, but Hermes does not reliably ship
 * it, so the grouping is done here. Property escapes are compiled once inside a
 * `try` for the same reason: an engine without them must make every message
 * ordinary, never crash the bundle at import.
 */

/** More than this and it is a sentence in emoji, which reads better at body size. */
export const MAX_BIG_EMOJI = 3

const PICTOGRAPHIC = compile('\\p{Extended_Pictographic}')
const REGIONAL = compile('[\\u{1F1E6}-\\u{1F1FF}]')
const SKIN_TONE = compile('[\\u{1F3FB}-\\u{1F3FF}]')

function compile(source: string): RegExp | null {
  try {
    return new RegExp(`^${source}$`, 'u')
  } catch {
    // An engine without Unicode property escapes. Every message stays ordinary,
    // which is the correct degradation for a decoration.
    return null
  }
}

const ZWJ = '‍'
const VARIATION_SELECTOR_16 = '️'
const KEYCAP = '⃣'

function is(pattern: RegExp | null, codePoint: string): boolean {
  return pattern !== null && pattern.test(codePoint)
}

/**
 * The number of emoji, when the message is *only* emoji and whitespace.
 * Zero for anything else — including an empty string, and including a message
 * that mixes emoji with words.
 */
export function bigEmojiCount(body: string): number {
  const points = [...body.trim()]
  if (points.length === 0) return 0

  let count = 0
  let i = 0
  while (i < points.length) {
    const point = points[i]!

    if (/\s/u.test(point)) {
      i++
      continue
    }

    // A flag: exactly two regional indicators. A lone one is not an emoji.
    if (is(REGIONAL, point)) {
      if (!is(REGIONAL, points[i + 1] ?? '')) return 0
      count++
      i += 2
      continue
    }

    // A keycap: the digit is only an emoji with the enclosing mark after it.
    if (/^[0-9#*]$/u.test(point)) {
      const next = points[i + 1]
      const after = next === VARIATION_SELECTOR_16 ? points[i + 2] : next
      if (after !== KEYCAP) return 0
      count++
      i += next === VARIATION_SELECTOR_16 ? 3 : 2
      continue
    }

    if (!is(PICTOGRAPHIC, point)) return 0

    // One pictograph, then everything that modifies or joins to it.
    i++
    for (;;) {
      const next = points[i]
      if (next === VARIATION_SELECTOR_16 || is(SKIN_TONE, next ?? '')) {
        i++
        continue
      }
      if (next === ZWJ && is(PICTOGRAPHIC, points[i + 1] ?? '')) {
        i += 2
        continue
      }
      break
    }
    count++
  }

  return count
}

/** Whether the message should be drawn as a hero rather than in a bubble. */
export function isBigEmoji(body: string): boolean {
  const count = bigEmojiCount(body)
  return count > 0 && count <= MAX_BIG_EMOJI
}
