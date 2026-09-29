import Feather from '@expo/vector-icons/Feather'
import { TIER_BADGES } from '@langx/shared'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'

/**
 * The PRO chip: a star and the plan's badge on its violet.
 *
 * One component for the paywall's hero, your own profile and everyone
 * else's, because three hand-drawn copies of it had already become three
 * different marks — a chip on one screen, bare text on another.
 *
 * Renders nothing when the shared table gives the plan no badge.
 */
export function ProMark({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  const styles = useStyles()
  if (!TIER_BADGES.pro) return null
  return (
    <View style={[styles.mark, style]}>
      <Feather name="star" size={12} color={colors.bg} />
      <Text style={styles.text}>{TIER_BADGES.pro}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  mark: {
    alignItems: 'center',
    backgroundColor: colors.pro,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  // The ground's colour on the plan's: white on violet in light, near-black on
  // the lifted violet of dark, where white would sit under 3:1.
  text: {
    color: colors.bg,
    fontFamily: DISPLAY_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
}))
