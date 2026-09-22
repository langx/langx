import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * The mark on the owner's own screen beside something a privacy switch keeps
 * off their public profile — the city, the week's chart.
 *
 * The owner always sees their own data; what changes is that they are told
 * which of it nobody else does. The alternative, and what the city used to
 * do, was to withhold it here too so the two screens could not disagree —
 * which made "Hide my city" read as "your city is gone" on the one screen
 * where it should have read as a setting. A tap opens that setting.
 */
export function HiddenFromOthers({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('me.hiddenFromOthers')}
      hitSlop={8}
      onPress={() => router.push('/(app)/settings/privacy')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      <Feather name="eye-off" size={13} color={colors.textFaint} />
      <Text style={styles.label}>{t('me.hiddenFromOthers')}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  row: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 5 },
  pressed: { opacity: 0.6 },
  label: { color: colors.textFaint, fontSize: 12 },
}))
