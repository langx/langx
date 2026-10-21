import Feather from '@expo/vector-icons/Feather'
import { findBadge } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { badgeName } from '../../i18n/badgeWords'
import { useLocale, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { BadgePatch } from './BadgePatch'

/**
 * The badges somebody wears, as patches at 40 with their names: the three
 * they pinned, or — with nothing pinned — the newest of each family, as the
 * strip has always picked them. One button for the whole row, onto the
 * shelf, and a **Change** link on your own.
 */
export function BadgeRow({
  ids,
  onPress,
  change,
}: {
  ids: readonly string[]
  onPress: () => void
  /** Your own row: the link to the shelf, where pins are chosen. */
  change?: (() => void) | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const marks = ids.slice(0, MAX).flatMap((id) => {
    const badge = findBadge(id)
    return badge ? [{ id, name: badgeName({ t, locale }, badge) }] : []
  })
  if (marks.length === 0) return null

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('badgesV3.pinnedRow')}: ${marks.map((m) => m.name).join(', ')}`}
        onPress={onPress}
        style={({ pressed }) => [styles.marks, pressed && styles.pressed]}
      >
        {marks.map((mark) => (
          <View key={mark.id} style={styles.mark}>
            <BadgePatch id={mark.id} size={PATCH} />
            <Text style={styles.name} numberOfLines={1}>
              {mark.name}
            </Text>
          </View>
        ))}
      </Pressable>
      {change ? (
        <Pressable
          accessibilityRole="link"
          onPress={change}
          hitSlop={8}
          style={({ pressed }) => [styles.change, pressed && styles.pressed]}
        >
          <Text style={styles.changeText}>{t('badgesV3.change')}</Text>
          <Feather name="chevron-right" size={v3.icon.sm} color={v3.colors.blue} />
        </Pressable>
      ) : null}
    </View>
  )
}

const MAX = 3
const PATCH = 40

const useStyles = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  marks: { flex: 1, flexDirection: 'row', gap: v3.space[12] },
  mark: { alignItems: 'center', gap: v3.space[4], maxWidth: 76 },
  name: { ...v3.type.label, color: v3.colors.blue, textAlign: 'center' },
  change: { alignItems: 'center', flexDirection: 'row', gap: v3.space[2], minHeight: 44 },
  changeText: { ...v3.type.buttonSmall, color: v3.colors.blue },
  pressed: { opacity: 0.7 },
}))
