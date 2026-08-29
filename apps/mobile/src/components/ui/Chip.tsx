import { Pressable, Text, View, type ViewStyle } from 'react-native'
import { makeStyles, useTheme, type ThemeColors } from '../../lib/theme'

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: 'default' | 'accent' | 'streak' | 'pro' | 'proPlus'
}

type Tone = NonNullable<ChipProps['tone']>

/**
 * A function of the palette rather than a module-scope map: the tones differ
 * per scheme, and a map built at import time would hand a dark screen light
 * mode's accents.
 */
function toneColour(colors: ThemeColors, tone: Tone): string {
  const byTone: Record<Tone, string> = {
    default: colors.textMuted,
    accent: colors.accent,
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
  const container: ViewStyle[] = [
    styles.base,
    { borderColor: colour },
    ...(selected ? [{ backgroundColor: colour }] : []),
  ]
  // `textInverse`, not `primaryText`: a selected chip is filled with its own
  // tone, which is only `primary` by coincidence for the default one.
  const text = [styles.label, { color: selected ? colors.textInverse : colour }]

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
