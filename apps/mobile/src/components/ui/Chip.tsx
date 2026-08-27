import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, font, radius, spacing } from '../../lib/theme'

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: 'default' | 'accent' | 'streak' | 'pro'
}

const TONE = {
  default: colors.textMuted,
  accent: colors.accent,
  streak: colors.streak,
  pro: colors.pro,
} as const

export function Chip({ label, selected = false, onPress, tone = 'default' }: ChipProps) {
  const colour = TONE[tone]
  const content = (
    <Text style={[styles.label, { color: selected ? colors.primaryText : colour }]}>{label}</Text>
  )
  const style = [
    styles.base,
    { borderColor: colour },
    selected && { backgroundColor: colour, borderColor: colour },
  ]

  if (!onPress) return <Text style={[...style, styles.static]}>{label}</Text>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...style, pressed && styles.pressed]}>
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  static: { color: colors.textMuted, ...font.caption },
  label: { ...font.caption, fontWeight: '600' },
  pressed: { opacity: 0.7 },
})
