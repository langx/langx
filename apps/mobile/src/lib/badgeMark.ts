import type { BadgeKind } from '@langx/shared'
import type { ThemeColors } from './theme'

export interface BadgeMark {
  fill: string
  glyph: string
}

/**
 * The mark each badge kind wears, as a pair of theme colours.
 *
 * Four families for six kinds — the palette has four tints to spend, and the
 * groupings are meant rather than forced. **Warm** is the economy: streak
 * badges are built from the milestones that pay tokens, so a streak and a
 * token total are two views of one thing, and the glyph says which. **Green**
 * is helping somebody, and that one is not a choice — `tokens.ts` says a
 * correction is always the green pair, or it starts being mistaken for
 * Copilot. **Blue** carries talking, here as everywhere else in the app.
 * **Ink** is how long you have been here rather than what you did, which makes
 * a veteran badge and the v1 one relatives.
 *
 * The warm glyph is `warning` and not `streak`, even on the streak badge.
 * `warningBg`/`warning` is the pair `tokens.ts` documents for streak
 * milestones; the orange `streak` is for a flame on the app's own ground, and
 * on this pale yellow it reads at 2.14:1 — which is what the whole screen has
 * been drawing since badges shipped.
 *
 * The v1 badge is the only thing on this screen painted `primary`. That is
 * v3's "yellow exactly once per screen" spent on the one badge nobody can earn
 * any more, and it is also why it does not take an `ink` fill like its
 * relative: `ink` inverts with the ground, so a yellow glyph on it falls to
 * 1.44:1 in dark. `primary` and `primaryText` are deliberately the same value
 * in both schemes, so this one mark is identical in both.
 *
 * A `Record` rather than a switch with a default, for the same reason
 * `progress` in `getBadgeSummary` is one: a kind added to `BADGE_KINDS` does
 * not compile until somebody has said what it looks like. `badgeMark.test.ts`
 * then checks the pair is legible in both schemes.
 */
export const BADGE_MARKS: Record<BadgeKind, (colors: ThemeColors) => BadgeMark> = {
  streak: (colors) => ({ fill: colors.warningBg, glyph: colors.warning }),
  tokens: (colors) => ({ fill: colors.warningBg, glyph: colors.warning }),
  correction: (colors) => ({ fill: colors.successBg, glyph: colors.success }),
  messages: (colors) => ({ fill: colors.accentBg, glyph: colors.accent }),
  veteran: (colors) => ({ fill: colors.ink, glyph: colors.bg }),
  origin: (colors) => ({ fill: colors.primary, glyph: colors.primaryText }),
}
