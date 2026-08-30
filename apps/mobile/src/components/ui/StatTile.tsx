import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import type { CalloutTone } from './Callout'

interface StatTileProps {
  value: string
  label: string
  /** Omit for plain ink; a tone colours the *numeral* — v3 has no filled tiles. */
  tone?: CalloutTone
  onPress?: () => void
}

/**
 * A number and what it counts. Three of these sit in a row on the profile.
 * v3 strips the boxes: the big Nunito numeral carries the weight, the tone
 * survives as the numeral's colour (the corrections count is green), and the
 * row underneath them draws the divider.
 */
export function StatTile({ value, label, tone, onPress }: StatTileProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const toneColour =
    tone === 'success'
      ? colors.success
      : tone === 'info'
        ? colors.info
        : tone === 'warning'
          ? colors.warning
          : tone === 'error'
            ? colors.danger
            : null

  const body = (
    <>
      <Text style={[styles.value, toneColour ? { color: toneColour } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </>
  )

  if (!onPress) return <View style={styles.tile}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  tile: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  value: { ...font.heading, color: colors.text, fontSize: 24 },
  label: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
