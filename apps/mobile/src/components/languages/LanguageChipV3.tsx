import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * One language in the v3 picker (`V-LanguagePick`): a 46pt pill on the grey
 * block, ink with a tick when it is the one you have, and — for a language
 * the other list holds — an empty dashed pill with the reason after the name.
 *
 * The taken pill is a plain view, not a disabled button, for the reason
 * `LanguagePicker` gives: nothing happens when it is pressed, so it should not
 * be announced as something to press. It says so in its shape rather than by
 * fading, because a faded pill read as a broken one.
 */
export function LanguageChipV3({
  label,
  selected = false,
  takenBy,
  onPress,
}: {
  label: string
  selected?: boolean
  /** The other list's name — "Native" — when that list already has it. */
  takenBy?: string | undefined
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()

  if (takenBy) {
    return (
      <View accessible accessibilityState={{ disabled: true }} style={[styles.chip, styles.taken]}>
        <Text style={[styles.label, styles.labelTaken]}>{`${label} · ${takenBy}`}</Text>
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.on, pressed && styles.pressed]}
    >
      {selected ? <Feather name="check" size={v3.icon.xs} color={v3.colors.pillText} /> : null}
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  chip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[6],
    // A floor, not a height: "Haitian Creole · Learning" in German is wider
    // than a small phone, and a fixed 46 clipped its second line.
    maxWidth: '100%',
    minHeight: 46,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[2],
  },
  on: {
    backgroundColor: v3.colors.pill,
    borderColor: v3.colors.pill,
    paddingStart: v3.space[12],
  },
  // `line`, as the dashed Add rows on Your languages draw it.
  taken: { backgroundColor: 'transparent', borderColor: v3.colors.line, borderStyle: 'dashed' },
  pressed: { opacity: 0.7 },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, flexShrink: 1 },
  labelOn: { color: v3.colors.pillText },
  labelTaken: { color: v3.colors.muted },
}))
