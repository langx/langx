import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

interface CheckboxProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** The tappable label beside the box. A whole row, so the box is not the only target. */
  children: ReactNode
  disabled?: boolean
  accessibilityLabel: string
}

/**
 * A square that ticks, and a label that also toggles it.
 *
 * Custom rather than a platform control, for the reason `Toggle` gives: the
 * platform widget ignores the palette and reads as another app's control
 * dropped into the row. Same colours as `Toggle` — `accent` when on, `border`
 * when off — so a checked box and an on switch look like the same "yes".
 *
 * The label is inside the pressable because a 20px square is a poor target and
 * consent is the one place where a missed tap turns into a person believing
 * they agreed to something they did not.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  disabled = false,
  accessibilityLabel,
}: CheckboxProps) {
  const styles = useStyles()
  const { colors } = useTheme()

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxOn, disabled && styles.disabled]}>
        {checked ? <Feather name="check" size={14} color={colors.knob} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  pressed: { opacity: 0.7 },
  box: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
    // Nudged down so the box sits on the first line of a wrapping label rather
    // than floating above it.
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  disabled: { opacity: 0.5 },
  label: { flex: 1 },
}))
