import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { calloutColours, type CalloutTone } from './Callout'

interface StatTileProps {
  value: string
  label: string
  /** Omit for the plain `surface` tile; a tone fills it with that callout pair. */
  tone?: CalloutTone
  onPress?: () => void
}

/** A number and what it counts. Three of these sit in a row on the profile. */
export function StatTile({ value, label, tone, onPress }: StatTileProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const pair = tone ? calloutColours(colors, tone) : null

  const body = (
    <>
      <Text style={[styles.value, pair ? { color: pair.fg } : null]}>{value}</Text>
      <Text style={[styles.label, pair ? { color: pair.fg } : null]}>{label}</Text>
    </>
  )
  const style = [styles.tile, pair ? { backgroundColor: pair.bg } : styles.plain]

  if (!onPress) return <View style={style}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  tile: { borderRadius: radius.lg, flex: 1, gap: 2, padding: 14 },
  plain: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  pressed: { opacity: 0.7 },
  value: { ...font.heading, color: colors.text, fontSize: 22 },
  label: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
