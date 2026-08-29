import { Pressable, Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[]
  /** Multi-select by design — a level filter is a set, not a choice. */
  selected: readonly T[]
  onToggle: (value: T) => void
  accessibilityLabel: string
}

/**
 * A row of equal-width pills. Selected uses the **info** pair rather than
 * `primary`: these choose rather than commit, and yellow is reserved for the
 * one control on a screen that commits.
 */
export function SegmentedControl<T extends string>({
  options,
  selected,
  onToggle,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const styles = useStyles()
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const on = selected.includes(option.value)
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(option.value)}
            style={[styles.segment, on ? styles.on : styles.off]}
          >
            <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  row: { flexDirection: 'row', gap: 6 },
  segment: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  on: { backgroundColor: colors.infoBg, borderColor: colors.infoBg },
  // `surface` rather than the design's page-grey: the design draws this control
  // inside a white card, and on the page ground a grey segment on a grey page
  // disappears. Same outline as an unselected `Chip`, which is what it is.
  off: { backgroundColor: colors.surface, borderColor: colors.border },
  label: { ...font.label },
  labelOn: { color: colors.info },
  labelOff: { color: colors.textFaint },
}))
