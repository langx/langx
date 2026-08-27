import { StyleSheet, Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
import { colors, font, spacing } from '../lib/theme'

function clockTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * The time under a message, and — on your own — whether it has been read.
 *
 * Everything behind this was already built and none of it was drawn:
 * `Message.readAt` is written by `markConversationRead`, the `conversation:read`
 * socket event travels in both directions, and `MessageDto.readAt` reached the
 * client and was never once read. A chat with no timestamps and no read state
 * is the kind of gap people notice immediately and cannot name.
 *
 * Two states, not three. v1 showed sending / sent / read and v2 has no
 * `deliveredAt` field and no acknowledgement event to build one from — in a
 * one-to-one chat the socket connection is already the delivery receipt. A
 * third tick would be decoration standing in for information we do not have.
 */
export function MessageMeta({ message, mine }: { message: MessageDto; mine: boolean }) {
  const tint = mine ? colors.primaryText : colors.textMuted

  return (
    <View style={styles.row}>
      <Text style={[styles.time, { color: tint }]}>{clockTime(message.createdAt)}</Text>
      {mine ? (
        <Text style={[styles.status, { color: tint }]}>{message.readAt ? '◉' : '○'}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  time: { ...font.caption, fontSize: 11, opacity: 0.7 },
  status: { fontSize: 11, opacity: 0.85 },
})
