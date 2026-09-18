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
 * separate targets would buy nothing and cost the ambiguity of a horizontal
 * scroll that is also a press. The strip does not scroll: the server sends at
 * most `PROFILE_BADGE_STRIP_MAX` marks and the rest becomes "+12", which says
 * the same thing in less room and cannot be missed by a thumb.
 *
 * **The marks size themselves to the row** rather than taking a number of
 * pixels. Because the strip cannot scroll, a fixed width is a bet on the
 * phone: 80px marks fit a 375px screen and overflow a 320px one, silently and
 * only on the smallest devices anybody tests last. `flex: 1` against a square
 * aspect ratio divides whatever the row has, and `maxWidth` stops a tablet
 * from drawing three coasters. The glyph stays a fixed 40px: it reads well
 * against every width that division can produce, and scaling it too would
 * need a layout pass to find out how big the circle turned out.
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
            <BadgeGlyph icon={badge.icon ?? 'award'} color={mark.glyph} size={40} />
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
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.6 },
  mark: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    // Three marks share a 375px row at about 88px each, so this is a ceiling
    // for wide screens rather than the size anybody's phone will draw.
    maxWidth: 88,
  },
  // Out of the division: the count is as wide as its digits, and the marks
  // take what is left.
  rest: { color: colors.textMuted, flex: 0, fontSize: 15, fontWeight: '700' },
}))
