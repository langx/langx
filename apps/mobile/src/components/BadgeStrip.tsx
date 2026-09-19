import { Pressable, ScrollView, Text, View } from 'react-native'
import type { ProfileBadge } from '@langx/shared'
import { BadgeGlyph } from './BadgeGlyph'
import { BADGE_MARKS } from '../lib/badgeMark'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale, useT } from '../i18n'

/**
 * What somebody has earned, above their bio: a scrolling row of marks, and a
 * count for everything the row does not draw.
 *
 * **One mark per kind**, which is a rule the server keeps — see
 * `badgeStripMarks`. A ladder's rungs all wear the same mark, so a climbed
 * one used to arrive here as three identical circles; what is sent now is the
 * newest rung of each kind, and the rest are part of the "+N".
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
  total,
  onPress,
}: {
  badges: readonly ProfileBadge[]
  /** Every badge earned, not just the ones sent — this is what "+N" counts. */
  total: number
  onPress: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  if (badges.length === 0) return null

  const rest = total - badges.length

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroller}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.badgeStrip', { count: total })}
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
        {rest > 0 ? <Text style={styles.rest}>+{rest.toLocaleString(locale)}</Text> : null}
      </Pressable>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
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
  rest: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
}))
