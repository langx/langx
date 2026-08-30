import { deliveryStateOf, type DeliveryState } from '@langx/shared'
import { Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
import type { Locale } from '@langx/shared'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale, useT, type MessageKey } from '../i18n'

function clockTime(iso: string, locale: Locale): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  // The app's locale rather than the device's, so a 24-hour clock does not
  // appear under messages in a language whose readers were shown a 12-hour one
  // everywhere else.
  return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/**
 * A tick means nothing to a screen reader, and the whole point of the glyph is
 * that it carries information the text does not.
 */
const LABEL_KEYS: Record<DeliveryState, MessageKey> = {
  sent: 'messageMeta.sent',
  delivered: 'messageMeta.delivered',
  read: 'messageMeta.read',
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
  const t = useT()
  const { locale } = useLocale()
  /**
   * Both bubbles are light tints in v3, so one faint grey serves both sides —
   * the meta is a whisper under the message, not a second line of it.
   */
  const tint = colors.textFaint
  const state = deliveryStateOf(message)

  return (
    <View style={[styles.row, mine ? styles.rowMine : null]}>
      <Text style={[styles.time, { color: tint }]}>{clockTime(message.createdAt, locale)}</Text>
      {mine ? (
        <Text
          accessibilityLabel={t(LABEL_KEYS[state])}
          // Read is the one state that has to stand out; on the light bubble
          // the accent carries it — the tinted double tick everyone knows.
          style={[styles.status, { color: state === 'read' ? colors.accent : tint }]}
        >
          {state === 'sent' ? '✓' : '✓✓'}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ font, spacing }) => ({
  // The clock sits where the bubble came from: start on theirs, end on yours.
  row: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 6,
  },
  rowMine: { alignSelf: 'flex-end' },
  // Already faint by colour; a second dampening via opacity would bury it.
  time: { ...font.caption, fontSize: 11 },
  status: {
    fontSize: 11,
    // Pulls the second tick under the first, the way the single glyph these
    // imitate is drawn. Without it the pair reads as two separate marks.
    letterSpacing: -3,
    // The negative tracking above also eats the space after the last tick.
    paddingEnd: 3,
  },
}))
