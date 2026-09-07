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
  /** The glyph's own colour, when it is not the numeral's — the orange bolt beside a black 34. */
  iconColor?: string
  /** Omit for plain ink; a tone colours the *numeral* — v3 has no filled tiles. */
  tone?: CalloutTone
  /**
   * The numeral's size. v3 runs three: 24 on a public profile, 26 on your own
   * tab and the wallet, 34 on the streak page where the number is the point.
   */
  valueSize?: number
  onPress?: () => void
}

/**
 * A number and what it counts. Three of these sit in a row on the profile.
 * v3 strips the boxes: the big Nunito numeral carries the weight, the tone
 * survives as the numeral's colour (the corrections count is green), and the
 * row underneath them draws the divider.
 */
export function StatTile({
  value,
  label,
  icon,
  iconColor,
  tone,
  valueSize = 24,
  onPress,
}: StatTileProps) {
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
        {icon ? (
          // About two thirds of the numeral, which is where the prototype's
          // 18-on-26 and 22-on-34 both land.
          <Feather
            name={icon}
            size={Math.round(valueSize * 0.68)}
            color={iconColor ?? toneColour ?? colors.text}
          />
        ) : null}
        <Text
          style={[
            styles.value,
            { fontSize: valueSize, lineHeight: Math.round(valueSize * 1.2) },
            toneColour ? { color: toneColour } : null,
          ]}
        >
          {value}
        </Text>
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
  value: { ...font.heading, color: colors.text },
  label: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
