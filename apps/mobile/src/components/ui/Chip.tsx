import Feather from '@expo/vector-icons/Feather'
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
    // v3's selected chip is the ink fill — `text` used as a background.
    default: colors.ink,
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
    : // Unselected chips share one outline — the ground on `border` — so a row
      // of them reads as one control rather than as five differently-ringed
      // buttons. The tone survives in the *label*.
      [styles.base, { backgroundColor: colors.bg, borderColor: colors.border }]
  // The ink fill's contrast partner is the ground itself; every other tone
  // is a saturated accent and takes `textInverse`. Unselected, the default
  // tone is plain `text` — v3 does not grey out a choice for being unmade.
  const labelColour = selected
    ? tone === 'default'
      ? colors.bg
      : colors.textInverse
    : tone === 'default'
      ? colors.text
      : colour
  const text = [styles.label, { color: labelColour }]

  /*
   * A tick before the label when chosen, so a selected chip says so twice —
   * the fill for anyone who sees colour, the mark for anyone who does not.
   * Same structure in both branches; styling a bare Text as the container is
   * what let the two drift apart in the first place.
   */
  const body = (
    <>
      {selected ? <Feather name="check" size={14} color={labelColour} /> : null}
      <Text style={text}>{label}</Text>
    </>
  )

  if (!onPress) return <View style={container}>{body}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...container, pressed && styles.pressed]}>
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ spacing, radius }) => ({
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  label: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
}))
