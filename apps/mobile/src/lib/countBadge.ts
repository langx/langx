/**
 * The digits inside a count badge, so they sit in the middle of the circle.
 *
 * A badge is a fixed-height box, and React Native draws a Text from the top of
 * its line box. The redesign's `label` step has a 16pt line, so in the tab
 * bar's 18pt badge the digits sat 2pt high on iOS — top-aligned, not centred.
 * The fix is a line as tall as the box (the line box then *is* the box), plus
 * the two Android knobs that stop the font's own padding pushing it again.
 * `lineHeight === height` is the invariant; the test holds it.
 */
export const TAB_BADGE_SIZE = 18
/** A chat row's unread count. */
export const ROW_BADGE_SIZE = 20

export function countBadgeText(size: number) {
  return {
    height: size,
    lineHeight: size,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  } as const
}

/**
 * The redesign's tab badge style. `label` is spread first, so its 16pt line
 * height is overridden rather than inherited.
 */
export function v3TabBadgeStyle<T extends object>(
  label: T,
  backgroundColor: string,
  color: string,
) {
  return { ...label, ...countBadgeText(TAB_BADGE_SIZE), backgroundColor, color }
}

/**
 * Whether a tab's count went up — the one change its badge pops for.
 *
 * `undefined` on either side is "not known", never zero: the first answer a
 * launch gets is the count as it already was, and popping every badge on the
 * bar as the app opens would announce that nothing had happened. Zero is
 * known, so a badge appearing over a count that was zero does pop.
 */
export function badgeGrew(previous: number | undefined, next: number | undefined): boolean {
  if (previous === undefined || next === undefined) return false
  return next > previous
}
