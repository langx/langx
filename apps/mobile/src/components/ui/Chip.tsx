import { Pressable, Text, View, type ViewStyle } from 'react-native'
import { makeStyles, useTheme, type ThemeColors } from '../../lib/theme'

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: 'default' | 'accent' | 'secondary' | 'streak' | 'pro' | 'proPlus'
}

type Tone = NonNullable<ChipProps['tone']>

/**
 * A function of the palette rather than a module-scope map: the tones differ
 * per scheme, and a map built at import time would hand a dark screen light
 * mode's accents.
 */
function toneColour(colors: ThemeColors, tone: Tone): string {
  const byTone: Record<Tone, string> = {
    // The committing/primary choice in a row of chips — the selected sort.
    default: colors.primary,
    accent: colors.accent,
    secondary: colors.secondary,
    streak: colors.streak,
    pro: colors.pro,
    proPlus: colors.proPlus,
  }
  return byTone[tone]
}

/**
 * A read-only chip and a tappable one look identical, so they have to be
 * *styled* identically. An earlier version styled the static branch separately
 * and forgot `selected`, which rendered a filled chip with muted text on its
 * own background colour — unreadable, and only visible on a screen that
 * happened to use a selected chip without an `onPress`.
 */
export function Chip({ label, selected = false, onPress, tone = 'default' }: ChipProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  const colour = toneColour(colors, tone)
  const container: ViewStyle[] = selected
    ? [styles.base, { backgroundColor: colour, borderColor: colour }]
    : // Unselected chips share one outline — `surface` on `border` — so a row of
      // them reads as one control rather than as five differently-ringed
      // buttons. The tone survives in the *label*, which is where "Nearby" says
      // Pro and "Filters" says it is the second action.
      [styles.base, { backgroundColor: colors.surface, borderColor: colors.border }]
  const text = [
    styles.label,
    {
      // `default` fills with `primary`, whose contrast partner is black in both
      // schemes; every other tone is a saturated accent and takes `textInverse`.
      color: selected
        ? tone === 'default'
          ? colors.primaryText
          : colors.textInverse
        : tone === 'default'
          ? colors.text
          : colour,
    },
  ]

  // Both branches render the same View + Text structure. Styling a bare Text
  // as the container is what let the two drift apart in the first place.
  if (!onPress) {
    return (
      <View style={container}>
        <Text style={text}>{label}</Text>
      </View>
    )
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...container, pressed && styles.pressed]}>
      <Text style={text}>{label}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ font, spacing, radius }) => ({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  label: { ...font.caption, fontWeight: '600' },
  pressed: { opacity: 0.7 },
}))
