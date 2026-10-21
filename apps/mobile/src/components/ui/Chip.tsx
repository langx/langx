import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View, type ViewStyle } from 'react-native'
import { useV3Home } from '../../hooks/useV3Home'
import { makeStyles, useTheme, type ThemeColors } from '../../lib/theme'

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: 'default' | 'accent' | 'secondary' | 'streak' | 'pro' | 'proPlus'
  /**
   * Opt-in: a chip that is one of several independent on/off choices — the
   * composer's two asks — says so to a screen reader. Without it a tappable
   * chip is announced as nothing in particular, and `SegmentedControl` is the
   * wrong control for independent choices: it is a radio group.
   */
  accessibilityRole?: 'checkbox'
  /** Drawn faded and not pressable; read out as unavailable with the role above. */
  disabled?: boolean
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
export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'default',
  accessibilityRole,
  disabled = false,
}: ChipProps) {
  const { colors, v3 } = useTheme()
  const styles = useStyles()
  /*
   * Under `flags.v3Home` the default chip takes `FilterChipV3`'s look — the
   * grey surface at rest, the ink pill with a tick when chosen, 48 tall — so
   * the v3 screens that still build their choices from this chip (Echo's
   * languages, Edit profile's interests and gender, a language's level, the
   * language pick) stop drawing the old outline without each forking it.
   * A toned chip keeps today's look: only the operator panel passes a tone,
   * and v3 draws no coloured chip to move it to.
   */
  const v3Look = useV3Home() && tone === 'default'

  const colour = toneColour(colors, tone)
  const container: ViewStyle[] = v3Look
    ? [styles.v3, ...(selected ? [styles.v3On] : [])]
    : selected
      ? [styles.base, { backgroundColor: colour, borderColor: colour }]
      : // Unselected chips share one outline — the ground on `border` — so a row
        // of them reads as one control rather than as five differently-ringed
        // buttons. The tone survives in the *label*.
        [styles.base, { backgroundColor: colors.bg, borderColor: colors.border }]
  // The ink fill's contrast partner is the ground itself; every other tone
  // is a saturated accent and takes `textInverse`. Unselected, the default
  // tone is plain `text` — v3 does not grey out a choice for being unmade.
  const labelColour = v3Look
    ? selected
      ? v3.colors.pillText
      : v3.colors.fg
    : selected
      ? tone === 'default'
        ? colors.bg
        : colors.textInverse
      : tone === 'default'
        ? colors.text
        : colour
  const text = [v3Look ? styles.v3Label : styles.label, { color: labelColour }]

  /*
   * A tick before the label when chosen, so a selected chip says so twice —
   * the fill for anyone who sees colour, the mark for anyone who does not.
   * Same structure in both branches; styling a bare Text as the container is
   * what let the two drift apart in the first place.
   */
  const body = (
    <>
      {selected ? (
        <Feather name="check" size={v3Look ? v3.icon.sm : 14} color={labelColour} />
      ) : null}
      <Text style={text}>{label}</Text>
    </>
  )

  if (!onPress) return <View style={container}>{body}</View>
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      {...(accessibilityRole
        ? {
            accessibilityRole,
            accessibilityState: { checked: selected, disabled },
            // react-native-web maps `disabled` out of `accessibilityState` but
            // not `checked`, so the web build said nothing about the tick.
            'aria-checked': selected,
          }
        : {})}
      style={({ pressed }) => [
        ...container,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ spacing, radius, v3 }) => ({
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
  /*
   * `FilterChipV3`'s measures, so a chip here and one on Filters are one chip
   * — plus a `track` ring, because these chips also sit on grey cards (a
   * language's levels on Languages), where a bare `surface` chip is the card's
   * own colour and vanishes. `V-Languages` rings its level chips the same way.
   */
  v3: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.track,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 48,
    overflow: 'hidden',
    paddingEnd: v3.space[20],
    paddingStart: v3.space[16],
  },
  v3On: {
    backgroundColor: v3.colors.pill,
    borderColor: v3.colors.pill,
    paddingStart: v3.space[14],
  },
  v3Label: { ...v3.type.button },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
}))
