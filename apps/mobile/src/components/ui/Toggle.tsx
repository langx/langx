import { Pressable, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface ToggleProps {
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  accessibilityLabel: string
}

/**
 * Not RN's `Switch`: that renders the platform control, which ignores the
 * palette and looks like a different app's widget dropped into the row.
 *
 * The knob is `knob` — white in **both** schemes — rather than `surface`. A
 * surface-coloured knob sits on a `border`-coloured track in dark mode and has
 * no contrast left to read as a knob at all.
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: ToggleProps) {
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.on : styles.off, disabled && styles.disabled]}
    >
      <View style={styles.knob} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, radius }) => ({
  track: {
    borderRadius: radius.pill,
    flexDirection: 'row',
    height: 27,
    padding: 3,
    width: 46,
  },
  /**
   * `accent`, not `primary`: v3 reserves yellow for the one committing action
   * on a screen, and a settings toggle chooses rather than commits. Blue is
   * what carries interactive state everywhere else.
   */
  on: { backgroundColor: colors.accent, justifyContent: 'flex-end' },
  off: { backgroundColor: colors.border, justifyContent: 'flex-start' },
  disabled: { opacity: 0.5 },
  knob: {
    backgroundColor: colors.knob,
    borderRadius: radius.pill,
    height: 21,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    width: 21,
  },
}))
