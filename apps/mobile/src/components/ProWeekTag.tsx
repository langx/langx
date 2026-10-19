import Feather from '@expo/vector-icons/Feather'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useMe } from '../api/queries'
import { useLocale, useT } from '../i18n'
import { proWeekUntil } from '../lib/proWeek'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * "Pro · yours until 25 October" — what a Pro feature wears while the Pro
 * Week runs, where it would otherwise wear nothing for somebody with Pro.
 *
 * Information, not a pitch: the end is the end RevenueCat holds, and nothing
 * here is a button. It renders nothing outside a running Pro Week, which is
 * every account while `flags.proWeek` is off, and nothing for a subscriber,
 * whose Pro has no such date (`proWeekUntil`).
 */
export function ProWeekTag({ style }: { style?: StyleProp<ViewStyle> }) {
  const me = useMe()
  const t = useT()
  const { locale } = useLocale()
  const { colors } = useTheme()
  const styles = useStyles()
  const until = proWeekUntil(me.data)
  if (!until) return null
  return (
    <View style={[styles.tag, style]}>
      <Feather name="star" size={12} color={colors.pro} />
      <Text style={styles.text}>
        {t('proWeek.yoursUntil', {
          date: until.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
        })}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  tag: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.pro,
    borderRadius: v3.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: v3.space[4],
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  text: { ...v3.type.label, color: colors.pro, flexShrink: 1 },
}))
