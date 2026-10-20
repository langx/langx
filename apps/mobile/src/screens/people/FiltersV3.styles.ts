import { StyleSheet } from 'react-native'
import { makeStyles } from '../../lib/theme'

/**
 * `filters.tsx`'s drawing in the v3 look (`V-Filters`), behind
 * `flags.v3Home`.
 *
 * A second sheet with the same names rather than a second screen, for the
 * reason `PostScreenV3.styles.ts` gives: the page is its rules — the last
 * ticked language stays ticked, the level band's taps, the open-ended age,
 * which sections are Pro's and route to the paywall, gender and "only my
 * gender" clearing each other — and two copies of those are two places for a
 * paid filter to slip free. `filters.tsx` picks this sheet or its own by the
 * flag; `postsScreensV3.test.ts` holds the two to the same names.
 */
export const useFiltersStylesV3 = makeStyles(({ v3 }) => ({
  screen: { paddingHorizontal: 0 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[4],
    paddingBottom: v3.space[8],
    paddingEnd: v3.space[16],
    paddingStart: v3.space[6],
    paddingTop: v3.space[6],
  },
  close: {},
  title: { ...v3.type.title, color: v3.colors.fg, flex: 1 },
  // Reset as an outlined pill: a second action beside the title, never the yellow.
  resetButton: {
    alignItems: 'center',
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 44,
    justifyContent: 'center',
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
  },
  reset: { ...v3.type.buttonSmall, color: v3.colors.fg },
  body: { flex: 1 },
  content: { paddingHorizontal: v3.space[16] },
  section: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[8],
    paddingVertical: v3.space[20],
  },
  first: { borderTopWidth: 0, paddingTop: v3.space[10] },
  last: { paddingBottom: v3.space[32] },
  gapMd: { gap: v3.space[10] },
  gapLg: { gap: v3.space[4] },
  sectionHead: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  sectionTitle: { ...v3.type.headline, color: v3.colors.fg },
  proTag: {
    ...v3.type.label,
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    color: v3.colors.pillText,
    overflow: 'hidden',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[2],
  },
  hint: { ...v3.type.caption, color: v3.colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8], paddingTop: v3.space[2] },
  spread: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  ageValue: { ...v3.type.headline, color: v3.colors.echoText },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 72,
    paddingVertical: v3.space[8],
  },
  switchText: { flex: 1, gap: 1 },
  switchLabel: { ...v3.type.button, color: v3.colors.fg },
  switchHint: { ...v3.type.caption, color: v3.colors.muted },
  cityInput: {
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    color: v3.colors.fg,
    // The ramp's size alone: a line height on a one-line field shifts its text on iOS.
    fontSize: v3.type.body.fontSize,
    height: 56,
    paddingHorizontal: v3.space[20],
  },
  cityInputFocused: { borderColor: v3.colors.fg },
  cityList: { borderRadius: v3.radius.tile, overflow: 'hidden' },
  cityOption: {
    backgroundColor: v3.colors.surface,
    borderBottomColor: v3.colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: v3.space[2],
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[8],
  },
  cityOptionName: { ...v3.type.body, color: v3.colors.fg },
  cityOptionWhere: { ...v3.type.caption, color: v3.colors.muted },
  pressed: { opacity: 0.7 },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[10],
  },
}))
