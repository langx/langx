import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { useCallClock, useCallState } from '../../hooks/useCalls'
import { useT } from '../../i18n'
import { callStatusKey } from '../../lib/calls/callLabels'
import { setCallMinimized } from '../../lib/calls/session'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * The call, put away.
 *
 * Somebody on a call wants to look something up — the message they were
 * talking about, a word, the other person's profile — and the call has to
 * carry on while they do. This is what it carries on behind: a green strip
 * across the top of the app, saying who and for how long, that brings the
 * call back when it is pressed.
 *
 * **In the layout, not over it.** It sits above the navigator in the root and
 * pushes every screen down by its own height, the way a phone's in-call bar
 * does. Floated over the screens instead, it covered whatever every header
 * puts in its middle — in a thread, the name of the person on the call.
 *
 * Drawn only where a call can happen, which in this build is the browser.
 * The native cut has to hand the screens below a safe-area inset with this
 * strip's height taken out of it, or each of them pads for the status bar a
 * second time.
 */
export function CallBar() {
  const call = useCallState()
  const clock = useCallClock(call)
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()

  if (!call || !call.minimized) return null

  const statusKey = callStatusKey(call)
  const status = statusKey ? t(statusKey, { name: call.peer.displayName }) : (clock ?? '')

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
          size={14}
          color={colors.onScrim}
        />
        <Text style={styles.name} numberOfLines={1}>
          {call.peer.displayName}
        </Text>
        <Text style={styles.status} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <Text style={styles.action} numberOfLines={1}>
        {t('calls.returnToCall')}
      </Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // Green in both schemes: it is the colour of a line that is open, and the
  // one strip at the top of the screen that must not be mistaken for the app
  // talking about itself.
  bar: {
    alignItems: 'center',
    backgroundColor: colors.success,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  pressed: { opacity: 0.85 },
  who: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: spacing.sm },
  name: { ...font.label, color: colors.onScrim, flexShrink: 1 },
  status: { ...font.label, color: colors.onScrim, fontVariant: ['tabular-nums'], opacity: 0.85 },
  action: { ...font.label, color: colors.onScrim },
}))
