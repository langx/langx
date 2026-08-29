import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

interface ListRowProps {
  title: string
  subtitle?: string | undefined
  /** Tints the subtitle — `pro` for a gated row, `danger` for a destructive one. */
  subtitleColor?: string | undefined
  /** The right-hand value, e.g. "Language matches". Drawn before the chevron. */
  value?: string | undefined
  onPress?: (() => void) | undefined
  /** A control instead of a value: a `Toggle`, a `Chip`. */
  accessory?: ReactNode
  /** Rows inside a `Card` draw their own divider; the last one must not. */
  last?: boolean
  destructive?: boolean
}

/**
 * The settings/filters workhorse: a title, an optional explanation under it,
 * and one thing on the right. Rows draw their own bottom border rather than the
 * card drawing separators, because the last row's border has to disappear and
 * only the row knows whether it is last.
 */
export function ListRow({
  title,
  subtitle,
  subtitleColor,
  value,
  onPress,
  accessory,
  last = false,
  destructive = false,
}: ListRowProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.title, destructive && styles.destructive]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, subtitleColor ? { color: subtitleColor } : null]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory}
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.textFaint} /> : null}
    </>
  )

  if (!onPress) return <View style={[styles.row, !last && styles.divided]}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divided, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  title: { ...font.body, color: colors.text, fontWeight: '600' },
  destructive: { color: colors.danger },
  subtitle: { ...font.caption, color: colors.textMuted },
  value: { ...font.label, color: colors.textMuted, fontWeight: '400' },
}))
