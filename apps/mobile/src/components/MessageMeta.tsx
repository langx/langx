import { deliveryStateOf, type DeliveryState } from '@langx/shared'
import { Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
import { makeStyles, useTheme } from '../lib/theme'

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
  const { colors } = useTheme()
  const styles = useStyles()
  /**
   * Your own bubble is `primary` yellow in both schemes, so its meta is black
   * at half strength rather than the palette's muted grey — the grey was tuned
   * against `surface` and disappears on yellow.
   */
  const tint = mine ? colors.primaryTextMuted : colors.textMuted
  const state = deliveryStateOf(message)

  return (
    <View style={styles.row}>
      <Text style={[styles.time, { color: tint }]}>{clockTime(message.createdAt)}</Text>
      {mine ? (
        <Text
          accessibilityLabel={LABELS[state]}
          // Read is the one state that has to stand out, and on yellow it can
          // no longer do that with a hue — full-strength black against the
          // half-strength tint carries it instead.
          style={[styles.status, { color: state === 'read' && mine ? colors.primaryText : tint }]}
        >
          {state === 'sent' ? '✓' : '✓✓'}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ font, spacing }) => ({
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
}))
