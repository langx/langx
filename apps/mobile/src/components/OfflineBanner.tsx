import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../api/queries'
import { useIsOnline } from '../hooks/useIsOnline'
import { makeStyles, spacing, useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * Says the one thing the app had no way of saying.
 *
 * Every offline failure used to arrive as something else: a list with no rows
 * said "Nobody here yet", a tab that never loaded stayed on its skeletons, a
 * heart un-filled itself with no explanation. All three are the same fact, and
 * a person who cannot be told it assumes the app is broken — which, from where
 * they are sitting, it is.
 *
 * One bar, above the navigator like the other two, and it takes itself away
 * the moment the network is back. Nothing to dismiss: unlike an update notice
 * this is not a decision anybody is being asked to make.
 */
export function OfflineBanner() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const insets = useSafeAreaInsets()
  const online = useIsOnline()
  const me = useMe()

  if (online) return null
  // One bar at the top at a time, and a pending deletion is the more urgent of
  // the two — it has a deadline attached and this one does not.
  if (me.data?.deletedAt) return null

  return (
    // Its own top inset, for the reason the other two carry one: this sits
    // above the navigator, outside every `Screen`, and the layout does not
    // inset for it.
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <Feather name="wifi-off" size={16} color={colors.warning} />
      <Text style={styles.text}>{t('common.offline')}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  /*
   * The warning tint rather than the update notice's blue or a deletion's red.
   * Nothing is wrong with the app and nothing has been lost — the phone is
   * simply somewhere without a signal — so it reads as a state, not an alarm.
   */
  root: {
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { ...font.caption, color: colors.text, flex: 1, fontWeight: '700' },
}))
