import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useV3Home } from '../../hooks/useV3Home'
import { makeStyles, useTheme } from '../../lib/theme'
import { useLocale, useT } from '../../i18n'
import { IconButton } from './IconButton'

interface ScreenHeaderProps {
  /** Omit for the bare arrow row the auth screens open with — a title in the display face follows below. */
  title?: string
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
  const { isRtl } = useLocale()
  const v3Look = useV3Home()

  return (
    <View style={styles.row}>
      {onBack && v3Look ? (
        // The kit's back, as Settings draws it: the platform's minimum target
        // where the arrow below is a 34pt square widened by `hitSlop`. The
        // same `hitSlop` stays, so nothing that could be pressed before stops
        // being pressable.
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          hitSlop={12}
          onPress={onBack}
          style={styles.backV3}
        />
      ) : onBack ? (
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
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, v3 }) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md + 2,
    paddingBottom: spacing.sm + 2,
    paddingTop: spacing.xs,
  },
  // 34 square: the arrow's own hit box, before `hitSlop` widens it.
  back: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  // Pulled into the gutter so the chevron's ink, not its target, lines up
  // with the content under it — `WizardHeaderV3`'s offset.
  backV3: { marginStart: -v3.space[12] },
  pressed: { opacity: 0.5 },
  title: { ...font.heading, color: colors.text, flex: 1, fontSize: 24 },
  // Keeps `trailing` hard right when there is no title to push it there.
  spacer: { flex: 1 },
  trailing: { alignItems: 'flex-end' },
}))
