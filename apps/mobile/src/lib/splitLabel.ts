/**
 * A marker no message can contain, so splitting on it cannot cut real text.
 * Interpolated in place of the value, then split back out.
 */
export const LABEL_MARKER = '\u0000'

/**
 * A translated label broken around one of its own placeholders, so the value
 * can be drawn as something other than text.
 *
 * The placeholder does not sit in the same place in every language — English
 * ends with it ("Your sentence in Russian") and Turkish opens with it
 * ("Rusca dilindeki cumlen") — so the two halves cannot be hard-coded, and a
 * second message key holding "the bit before" would be a translator's trap.
 * Asking the existing key to interpolate a marker and cutting there keeps one
 * string per language, still translated as one sentence.
 *
 * Returns `null` when the marker is absent, which means a translation dropped
 * the placeholder. The caller falls back to the plain label: a sentence with
 * the language named but not tappable is worse than this one, and much better
 * than a blank line.
 */
export function splitLabel(label: string): { before: string; after: string } | null {
  const at = label.indexOf(LABEL_MARKER)
  if (at === -1) return null
  return { before: label.slice(0, at), after: label.slice(at + LABEL_MARKER.length) }
}
