import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import type { CallState } from '../../lib/calls/machine'
import { setCallMinimized } from '../../lib/calls/session'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * The call, put away, in v3's look — behind `flags.v3Home`, drawn by
 * `CallBar` in its place. The same strip, in the same place in the layout,
 * doing the same thing when pressed; taller (52, against the current 36) so
 * it is a target a thumb finds without looking, and still green in both
 * schemes, for `CallBar`'s reason.
 */
export function CallBarV3({ call, status }: { call: CallState; status: string }) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('calls.returnToCall')}
      onPress={() => setCallMinimized(false)}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={styles.who}>
        <Feather
          name={call.media === 'video' ? 'video' : 'phone'}
          size={v3.icon.sm}
          color={v3.colors.onSignal}
        />
        <Text style={styles.name} numberOfLines={1}>
          {call.peer.displayName}
        </Text>
        <Text style={styles.status} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <View style={styles.action}>
        <Text style={styles.actionLabel} numberOfLines={1}>
          {t('calls.returnToCall')}
        </Text>
        <Feather
          name={isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.onSignal}
        />
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  bar: {
    alignItems: 'center',
    backgroundColor: v3.colors.openLine,
    flexDirection: 'row',
    gap: v3.space[10],
    justifyContent: 'space-between',
    minHeight: 52,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[6],
  },
  pressed: { opacity: 0.85 },
  who: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: v3.space[10] },
  name: { ...v3.type.button, color: v3.colors.onSignal, flexShrink: 1 },
  status: {
    ...v3.type.buttonSmall,
    color: v3.colors.onSignal,
    fontVariant: ['tabular-nums'],
  },
  action: { alignItems: 'center', flexDirection: 'row', gap: v3.space[2] },
  actionLabel: { ...v3.type.buttonSmall, color: v3.colors.onSignal },
}))
