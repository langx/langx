import { Pressable, Text, View } from 'react-native'
import type { ProfileBadge } from '@langx/shared'
import { BadgeGlyph } from './BadgeGlyph'
import { BADGE_MARKS } from '../lib/badgeMark'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale, useT } from '../i18n'

/**
 * What somebody has earned, above their bio: the marks themselves, and a count
 * for whatever did not fit.
 *
 * **One button, not one per badge.** Every mark would open the same page, so
 * separate targets would buy nothing and cost the two things a row of small
 * circles cannot afford — a 40px tap target each, and the ambiguity of a
 * horizontal scroll that is also a press. The strip does not scroll: the
 * server sends at most `PROFILE_BADGE_STRIP_MAX` marks and the rest becomes
 * "+12", which says the same thing in less room and cannot be missed by a
 * thumb.
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
            <BadgeGlyph icon={badge.icon ?? 'award'} color={mark.glyph} size={20} />
          </View>
        )
      })}
      {rest > 0 ? <Text style={styles.rest}>+{rest.toLocaleString(locale)}</Text> : null}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  strip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.6 },
  mark: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rest: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
}))
