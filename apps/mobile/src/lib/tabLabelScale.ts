/**
 * How far the redesign's tab bar words grow with the reader's text size, and
 * the bar with them, by what the word's line grows.
 *
 * Uncapped, the words grew into a bar of fixed height: at 200% they ran 8
 * points under its bottom edge, and at the largest size each was wider than
 * its tab, so on the web build, where nothing clips them, the five ran into
 * one another. At 1.25× the widest of them in English, German, Russian and
 * Arabic ("Главная") still fits a fifth of a 375-point phone. In Spanish,
 * French, Portuguese and Turkish one word nearly fills its tab at the default
 * size, so a phone still cuts that word short once it grows, as it did
 * before — but by less, since it grows no further. French's tab was
 * "Discussions", which no scale here could fit: it is 72 points at the
 * default size and a tab leaves its word 65 on a 375-point phone, so the tab
 * says "Messages" instead.
 *
 * The trade: past 1.25× an Android reader's tab words stop growing, and
 * Android has no large-content viewer to stand in for them. The tab's glyph
 * and its accessible name are unchanged, and the words stay legible at
 * 1.25×; a bar that ran its words into each other read worse.
 */
export const V3_LABEL_MAX_SCALE = 1.25

/**
 * The scale the tab words are drawn at. iOS never grows them, as the bar's
 * own label does not: a long press on a tab shows the large-content viewer
 * instead. Elsewhere they follow the reader's size up to
 * `V3_LABEL_MAX_SCALE`, and shrink with a smaller one.
 *
 * `os` is `Platform.OS`, passed in so this stays testable without React
 * Native.
 */
export function v3TabLabelScale(os: string, fontScale: number): number {
  return os === 'ios' ? 1 : Math.min(fontScale, V3_LABEL_MAX_SCALE)
}

/**
 * The bar's height: its own (`base`, the pill, the word and the padding round
 * them), plus whatever the word's line has grown by, plus the bottom inset —
 * a custom height replaces the bar's whole sum. A smaller text size leaves
 * the bar as it is rather than shrinking it under the pill.
 */
export function v3TabBarHeight({
  base,
  lineHeight,
  labelScale,
  bottomInset,
}: {
  base: number
  lineHeight: number
  labelScale: number
  bottomInset: number
}): number {
  return base + lineHeight * Math.max(labelScale - 1, 0) + bottomInset
}
