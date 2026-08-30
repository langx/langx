import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { useT } from '../../i18n'

interface ScreenHeaderProps {
  title: string
  /** Omit on a tab root, which has nowhere to go back to. */
  onBack?: () => void
  /** A count, a chip, an action — drawn hard right. */
  trailing?: ReactNode
}

/**
 * The title row on every full-screen route: a bare back arrow, the title in
 * the display face, and whatever the screen needs on the right. v3 drops the
 * circled button — the arrow sits directly on the ground.
 *
 * `onBack` is a callback rather than a `router.back()` default on purpose —
 * `back()` resets to the first tab from a nested stack, so these screens pass
 * `goBackTo` with an explicit destination.
 */
export function ScreenHeader({ title, onBack, trailing }: ScreenHeaderProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  back: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  pressed: { opacity: 0.5 },
  title: { ...font.heading, color: colors.text, flex: 1, fontSize: 24 },
  trailing: { alignItems: 'flex-end' },
}))
