import { ActivityIndicator, Pressable, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

interface ToggleProps {
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  /**
   * The change is on its way to the server. The knob becomes a spinner and
   * presses are ignored until it lands: a privacy switch is the one control
   * where a request that silently takes three seconds reads as a switch that
   * did nothing, and a second tap then undoes the first.
   */
  busy?: boolean
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
  busy = false,
  accessibilityLabel,
}: ToggleProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: disabled || busy, busy }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || busy}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.on : styles.off, disabled && styles.disabled]}
    >
      {/* Same box as the knob, so the track does not change shape while it spins. */}
      <View style={styles.knob}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} />
        ) : null}
      </View>
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
    alignItems: 'center',
    backgroundColor: colors.knob,
    borderRadius: radius.pill,
    height: 21,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    width: 21,
  },
  // RN's "small" indicator is 20px; scaled so it sits inside the knob with a
  // hairline of white around it rather than touching the edge.
  spinner: { transform: [{ scale: 0.7 }] },
}))
