import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { colors, font, radius, spacing } from '../../lib/theme'

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: 'default' | 'accent' | 'streak' | 'pro' | 'proPlus'
}

const TONE = {
  default: colors.textMuted,
  accent: colors.accent,
  streak: colors.streak,
  pro: colors.pro,
  proPlus: colors.proPlus,
} as const

/**
 * A read-only chip and a tappable one look identical, so they have to be
 * *styled* identically. An earlier version styled the static branch separately
 * and forgot `selected`, which rendered a filled chip with muted text on its
 * own background colour — unreadable, and only visible on a screen that
 * happened to use a selected chip without an `onPress`.
 */
export function Chip({ label, selected = false, onPress, tone = 'default' }: ChipProps) {
  const colour = TONE[tone]
  const container: ViewStyle[] = [
    styles.base,
    { borderColor: colour },
    ...(selected ? [{ backgroundColor: colour }] : []),
  ]
  const text = [styles.label, { color: selected ? colors.primaryText : colour }]

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

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  label: { ...font.caption, fontWeight: '600' },
  pressed: { opacity: 0.7 },
})
