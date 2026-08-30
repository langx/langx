import { Pressable, Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[]
  /** Kept as a set for callers whose choice genuinely is one — see filters. */
  selected: readonly T[]
  onToggle: (value: T) => void
  accessibilityLabel: string
}

/**
 * v3's segmented control: a `fill` track with the chosen segment lifted onto a
 * `surface` pill under a small shadow — the iOS shape, drawn with the app's
 * own palette. It chooses rather than commits, so no yellow anywhere near it.
 */
export function SegmentedControl<T extends string>({
  options,
  selected,
  onToggle,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const styles = useStyles()
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const on = selected.includes(option.value)
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(option.value)}
            style={({ pressed }) => [
              styles.segment,
              on && styles.on,
              pressed && !on && styles.pressed,
            ]}
          >
            <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, cardShadow }) => ({
  track: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  on: {
    backgroundColor: colors.surface,
    ...cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  pressed: { opacity: 0.6 },
  label: { fontSize: 14 },
  labelOn: { color: colors.text, fontWeight: '700' },
  labelOff: { color: colors.textMuted, fontWeight: '600' },
}))
