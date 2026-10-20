import Feather from '@expo/vector-icons/Feather'
import type { MessageCall } from '@langx/shared'
import type { ReactNode, RefObject } from 'react'
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useT } from '../../i18n'
import {
  callRowIcon,
  callRowLabel,
  formatCallDuration,
  spokenCallLength,
} from '../../lib/calls/callLabels'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'

interface CallRowV3Props {
  call: MessageCall
  /** Whether the reader placed the call — the row's sender. */
  mine: boolean
  /** The bubble's own measured box, for the long-press menu to anchor on. */
  box: RefObject<View | null>
  /** The bubble's side of the thread, as every other row lines up. */
  column: StyleProp<ViewStyle>
  /** The jump-to ring, when a search or a reply lands here. */
  flash: StyleProp<ViewStyle>
  /** The clock under the row. */
  meta: ReactNode
  onLongPress: () => void
  /** "Call back" or "Call again": present on the newest call only, and where a call can happen. */
  onCallBack?: (() => void) | undefined
}

/**
 * The row a call leaves, in the v3 thread.
 *
 * The same record the current look draws — the words come from
 * `callRowLabel`, the glyph from `callRowIcon`, and whether it may offer to
 * call again is still the thread's decision — drawn on the surface grey like
 * every v3 record, with two changes that are not only paint:
 *
 * - "Call back" is a pill at the in-row size, 44pt on iOS and 48dp on
 *   Android, not a 13pt link with some slop around it. It is the one thing
 *   on the row that does anything.
 * - The record is read as one sentence — "Outgoing voice call, 3 minutes,
 *   12 seconds" — where the screen would have read the timer's digits.
 *   "Call back" stays its own stop, beside it rather than inside it: a
 *   pressable that holds a button hides the button from VoiceOver.
 */
export function CallRowV3({
  call,
  mine,
  box,
  column,
  flash,
  meta,
  onLongPress,
  onCallBack,
}: CallRowV3Props) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const label = callRowLabel(call, mine)
  const title = t(label.title)
  const completed = call.outcome === 'completed' && call.durationSeconds !== undefined
  const shown = completed
    ? formatCallDuration(call.durationSeconds ?? 0)
    : label.detail
      ? t(label.detail)
      : null
  const spoken = completed
    ? spokenCallLength(call.durationSeconds ?? 0, t)
    : label.detail
      ? t(label.detail)
      : null

  return (
    <View style={column}>
      <View ref={box} style={[styles.card, flash]}>
        <Pressable
          accessibilityLabel={spoken ? t('calls.row.spoken', { title, detail: spoken }) : title}
          onLongPress={onLongPress}
          style={styles.record}
        >
          <View style={[styles.icon, label.missed && styles.iconMissed]}>
            <Feather
              name={callRowIcon(call, mine)}
              size={v3.icon.md}
              color={label.missed ? v3.colors.danger : v3.colors.fg}
            />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, label.missed && styles.titleMissed]}>{title}</Text>
            {shown ? <Text style={styles.detail}>{shown}</Text> : null}
          </View>
        </Pressable>
        {onCallBack ? (
          <Button
            label={t(mine ? 'calls.callAgain' : 'calls.callBack')}
            onPress={onCallBack}
            variant="secondary"
            size="small"
            icon={call.media === 'video' ? 'video' : 'phone'}
            style={styles.action}
          />
        ) : null}
      </View>
      <View style={styles.meta}>{meta}</View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    gap: v3.space[12],
    padding: v3.space[14],
  },
  record: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  icon: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  // v3 has no red tint to fill with; the ring says it without a second red.
  iconMissed: { borderColor: v3.colors.danger, borderWidth: 2 },
  text: { flexShrink: 1, gap: v3.space[2] },
  title: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  titleMissed: { color: v3.colors.danger },
  detail: { ...v3.type.caption, color: v3.colors.muted, fontVariant: ['tabular-nums'] },
  action: { alignSelf: 'flex-start' },
  meta: { marginTop: v3.space[4] },
}))
