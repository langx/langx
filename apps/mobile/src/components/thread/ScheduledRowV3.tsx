import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { NotSentLineV3 } from './NotSentLineV3'

/**
 * One of your scheduled messages at the foot of the v3 thread.
 *
 * Your bubble's shape and side, outlined rather than filled: a dashed two-point
 * blue while it waits — yours, planned, not sent — and the not-sent red, with
 * v3's not-sent line under it, once the scheduler gave up. The time it goes
 * sits under the bubble where a sent message's clock does, in grey with a
 * clock. The cross beside it cancels or dismisses, as in the current look.
 */
export function ScheduledRowV3({
  body,
  failed,
  note,
  actionLabel,
  cancelDisabled,
  onCancel,
}: {
  body: string
  failed: boolean
  /** "Sends Tue 9:00", "Sending…" or "Could not be sent". */
  note: string
  actionLabel: string
  cancelDisabled: boolean
  onCancel: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={10}
        disabled={cancelDisabled}
        onPress={onCancel}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Feather name="x" size={v3.icon.md} color={v3.colors.muted} />
      </Pressable>
      <View style={styles.column}>
        <View style={[styles.bubble, failed ? styles.failed : styles.waiting]}>
          <Text style={styles.body} numberOfLines={3}>
            {body}
          </Text>
        </View>
        {failed ? (
          <NotSentLineV3 label={note} />
        ) : (
          <View style={styles.note}>
            <Feather name="clock" size={13} color={v3.colors.muted} />
            <Text style={styles.noteText}>{note}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'flex-end',
  },
  cancel: { padding: v3.space[4] },
  pressed: { opacity: 0.5 },
  column: { alignItems: 'flex-end', flexShrink: 1, gap: v3.space[4], maxWidth: '82%' },
  bubble: {
    borderBottomEndRadius: v3.space[8],
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  waiting: { borderColor: v3.colors.blue, borderStyle: 'dashed' },
  failed: { borderColor: v3.colors.danger },
  body: { ...v3.type.body, color: v3.colors.fg, lineHeight: 23 },
  note: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  // `MessageMeta`'s v3 line: this is where a sent message's clock goes.
  noteText: { ...v3.type.caption, color: v3.colors.muted },
}))
