import { deliveryStateOf, type DeliveryState } from '@langx/shared'
import { StyleSheet, Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
import { colors, font, spacing } from '../lib/theme'

function clockTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * A tick means nothing to a screen reader, and the whole point of the glyph is
 * that it carries information the text does not.
 */
const LABELS: Record<DeliveryState, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
}

/**
 * The time under a message, and — on your own — how far it has got.
 *
 * One tick sent, two ticks delivered, two tinted ticks read: the convention
 * WhatsApp and Telegram taught everyone, so it needs no explanation in the UI.
 * Each state is backed by something real — `deliveredAt` is written when the
 * message goes out over a socket the recipient is holding, or when they next
 * connect; `readAt` when they open the thread. Neither is inferred from the
 * other.
 */
export function MessageMeta({ message, mine }: { message: MessageDto; mine: boolean }) {
  const tint = mine ? colors.primaryText : colors.textMuted
  const state = deliveryStateOf(message)

  return (
    <View style={styles.row}>
      <Text style={[styles.time, { color: tint }]}>{clockTime(message.createdAt)}</Text>
      {mine ? (
        <Text
          accessibilityLabel={LABELS[state]}
          style={[styles.status, { color: state === 'read' ? colors.read : tint }]}
        >
          {state === 'sent' ? '✓' : '✓✓'}
        </Text>
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
  status: {
    fontSize: 11,
    // Pulls the second tick under the first, the way the single glyph these
    // imitate is drawn. Without it the pair reads as two separate marks.
    letterSpacing: -3,
    opacity: 0.9,
    // The negative tracking above also eats the space after the last tick.
    paddingRight: 3,
  },
})
