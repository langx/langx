import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import type { CalloutTone } from './Callout'

interface StatTileProps {
  value: string
  label: string
  /**
   * A Feather glyph drawn before the numeral, in the numeral's colour. The
   * streak tiles used to glue "🔥" into `value`, which put an emoji — drawn
   * differently on every platform — inside a string that is also read aloud.
   */
  icon?: keyof typeof Feather.glyphMap
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
export function StatTile({ value, label, icon, tone, onPress }: StatTileProps) {
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
      <View style={styles.valueRow}>
        {icon ? <Feather name={icon} size={18} color={toneColour ?? colors.text} /> : null}
        <Text style={[styles.value, toneColour ? { color: toneColour } : null]}>{value}</Text>
      </View>
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
  valueRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  value: { ...font.heading, color: colors.text, fontSize: 24 },
  label: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
