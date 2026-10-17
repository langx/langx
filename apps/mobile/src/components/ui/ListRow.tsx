import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { NO_NUMBER } from '../../lib/loadState'
import { makeStyles, useTheme } from '../../lib/theme'
import { CrossFade } from './CrossFade'
import { Skeleton } from './Skeleton'

interface ListRowProps {
  title: string
  subtitle?: string | undefined
  /** Tints the subtitle — `pro` for a gated row, `danger` for a destructive one. */
  subtitleColor?: string | undefined
  /** The right-hand value, e.g. "Language matches". Drawn before the chevron. */
  value?: string | undefined
  /**
   * Pass it, true or false, when the value comes from a request: a block holds
   * its place until this turns false and then dissolves into it. Left out, the
   * row is drawn as it always was.
   */
  valueLoading?: boolean | undefined
  /** The same for the line under the title. */
  subtitleLoading?: boolean | undefined
  onPress?: (() => void) | undefined
  /** A control instead of a value: a `Toggle`, a `Chip`. */
  accessory?: ReactNode
  /** Rows in a group draw their own divider; the last one must not. */
  last?: boolean
  destructive?: boolean
}

/**
 * The settings/filters workhorse: a title, an optional explanation under it,
 * and one thing on the right. v3 rows run edge to edge of the screen's own
 * padding — no horizontal inset of their own — with a hairline divider below.
 * Rows draw their own bottom border rather than the group drawing separators,
 * because the last row's border has to disappear and only the row knows
 * whether it is last.
 */
export function ListRow({
  title,
  subtitle,
  subtitleColor,
  value,
  valueLoading,
  subtitleLoading,
  onPress,
  accessory,
  last = false,
  destructive = false,
}: ListRowProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const subtitleLine = subtitle ? (
    <Text style={[styles.subtitle, subtitleColor ? { color: subtitleColor } : null]}>
      {subtitle}
    </Text>
  ) : null
  const valueText = value ? (
    <Text
      // The dash for a value that did not load is read as what it means.
      accessibilityLabel={value === NO_NUMBER ? t('common.notLoaded') : undefined}
      style={styles.value}
    >
      {value}
    </Text>
  ) : null

  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.title, destructive && styles.destructive]}>{title}</Text>
        {subtitleLoading === undefined ? (
          subtitleLine
        ) : (
          <CrossFade
            ready={!subtitleLoading}
            // The subtitle's own line height, so the row is as tall as it will be.
            skeleton={
              <View style={styles.subtitleSlot}>
                <Skeleton width={150} height={13} />
              </View>
            }
          >
            {subtitleLine}
          </CrossFade>
        )}
      </View>
      {accessory}
      {valueLoading === undefined ? (
        valueText
      ) : (
        <CrossFade ready={!valueLoading} skeleton={<Skeleton width={36} height={14} />}>
          {valueText}
        </CrossFade>
      )}
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

const useStyles = makeStyles(({ colors, spacing }) => ({
  // 17 over 17: v3 sets the row a point taller and a point larger than v2's
  // 16, which is what lets a 14px explanation sit under it without crowding.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 17,
  },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
  destructive: { color: colors.danger },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  subtitleSlot: { height: 20, justifyContent: 'center' },
  value: { color: colors.textFaint, fontSize: 15 },
}))
