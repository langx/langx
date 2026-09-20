import { Pressable, ScrollView, View } from 'react-native'
import type { ProfileBadge } from '@langx/shared'
import { BadgeGlyph } from './BadgeGlyph'
import { BADGE_MARKS } from '../lib/badgeMark'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * What somebody has earned, above their bio: a scrolling row of marks.
 *
 * **One mark per kind**, which is a rule the server keeps — see
 * `badgeStripMarks`. A ladder's rungs all wear the same mark, so a climbed
 * one used to arrive here as three identical circles; what is sent now is the
 * newest rung of each kind.
 *
 * **There is no "+N" any more, because there is nothing left for it to
 * count.** It used to say how many badges were past the end of the row, back
 * when the row was every rung and the payload was capped. The shelf this
 * opens now draws the tips of the same ladders — `badgeLadderTips` on an
 * earned-only list is this rule by another route — so the row and the page
 * hold the same badges, and any count of the difference is zero. A "+8" over
 * a page with nothing extra on it is a promise the tap breaks.
 *
 * The count a screen reader hears is therefore the marks drawn, not the rungs
 * behind them. The summary stopped sending that second number when the "+N"
 * went: it had no other reader, and a profile paying for a number nothing
 * draws is how a payload grows.
 *
 * **It scrolls, and it is still one button.** Those read as a contradiction
 * and are not: React Native's responder system hands the touch to whichever
 * of the two the finger turns out to mean, so a drag scrolls and a tap opens
 * the shelf. What it does rule out is a target per mark — two nested presses
 * inside a scroll is where that stops being predictable, and every mark opens
 * the same page anyway, so there is nothing to tell apart.
 *
 * **The marks take a fixed 56px** now that the row scrolls. While it did not,
 * width was a budget and the marks divided it with `flex: 1`; inside a
 * horizontal `ScrollView` there is no bounded width to divide, so a flexed
 * child collapses. Fixed is not the compromise here — it is what a scrolling
 * row needs, and it also means a mark is the same size on every phone rather
 * than a function of the screen.
 *
 * Colour and glyph come from the same `BADGE_MARKS` the badge page uses, so a
 * reader who has learned that green is teaching and blue is talking reads this
 * strip without being taught it twice.
 *
 * Nothing is drawn for somebody with no badges. An empty rail under a profile
 * is not a smaller version of this — it is a sentence about a stranger that
 * nobody asked it to say.
 */
export function BadgeStrip({
  badges,
  onPress,
}: {
  badges: readonly ProfileBadge[]
  onPress: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  if (badges.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroller}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.badgeStrip', { count: badges.length })}
        onPress={onPress}
        style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
      >
        {badges.map((badge) => {
          const mark = BADGE_MARKS[badge.kind](colors)
          return (
            <View key={badge.id} style={[styles.mark, { backgroundColor: mark.fill }]}>
              <BadgeGlyph icon={badge.icon ?? 'award'} color={mark.glyph} size={28} />
            </View>
          )
        })}
      </Pressable>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ radius, spacing }) => ({
  // The vertical padding is the scroller's, so the marks do not sit against
  // the stats row above or the bio below while the row slides under them.
  scroller: { paddingVertical: spacing.lg },
  // Lets the last mark reach the right edge rather than stopping at the
  // gutter, which is what makes it read as "there is more" rather than "that
  // is all, oddly indented".
  content: { paddingRight: spacing.lg },
  strip: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  pressed: { opacity: 0.6 },
  mark: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
}))
