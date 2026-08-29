import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

interface ScreenHeaderProps {
  title: string
  /** Omit on a tab root, which has nowhere to go back to. */
  onBack?: () => void
  /** A count, a chip, an action — drawn hard right. */
  trailing?: ReactNode
}

/**
 * The title row on every full-screen route: a round back button, the title in
 * the display face, and whatever the screen needs on the right.
 *
 * `onBack` is a callback rather than a `router.back()` default on purpose —
 * `back()` resets to the first tab from a nested stack, so these screens pass
 * `goBackTo` with an explicit destination.
 */
export function ScreenHeader({ title, onBack, trailing }: ScreenHeaderProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Feather name="arrow-left" size={19} color={colors.text} />
        </Pressable>
      ) : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  back: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressed: { opacity: 0.7 },
  title: { ...font.heading, color: colors.text, flex: 1, fontSize: 22 },
  trailing: { alignItems: 'flex-end' },
}))
