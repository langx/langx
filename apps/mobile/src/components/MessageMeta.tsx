import Feather from '@expo/vector-icons/Feather'
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

/** The word for each state, drawn beside the clock. */
const LABEL_KEYS: Record<DeliveryState | 'sending', MessageKey> = {
  // Not a server state: the row is the sender's own stand-in, drawn before
  // the ack, and it says so until the echo replaces it.
  sending: 'messageMeta.sending',
  sent: 'messageMeta.sent',
  delivered: 'messageMeta.delivered',
  read: 'messageMeta.read',
}

/**
 * The line under a message: the clock, a star when it is kept, and — on your
 * own — how far it has got.
 *
 * v3 says the state in a word rather than in ticks: "10:20 · Read". Each state
 * is backed by something real — `deliveredAt` is written when the message goes
 * out over a socket the recipient is holding, or when they next connect;
 * `readAt` when they open the thread. Neither is inferred from the other.
 */
export function MessageMeta({
  message,
  mine,
  pending = false,
  v3 = false,
}: {
  message: MessageDto
  mine: boolean
  /** The row is an optimistic stand-in; see `lib/outgoingMessages`. */
  pending?: boolean
  /** The v3 thread's look, as `MessageBubble`'s own `v3`. */
  v3?: boolean
}) {
  const { colors } = useTheme()
  const current = useStyles()
  const redesigned = useStylesV3()
  const styles = v3 ? redesigned : current
  const t = useT()
  const { locale } = useLocale()
  const state = pending ? 'sending' : deliveryStateOf(message)

  return (
    <View style={styles.row}>
      {/* The one mark on this line that is not faint: a star is the reader's own doing. */}
      {message.starred === true ? <Feather name="star" size={11} color={colors.streak} /> : null}
      <Text style={styles.time}>{clockTime(message.createdAt, locale)}</Text>
      {mine ? (
        <>
          <Text style={styles.time}>·</Text>
          <Text style={styles.time}>{t(LABEL_KEYS[state])}</Text>
        </>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // The column the bubble sits in puts this on the bubble's side and spaces it.
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  // Already faint by colour; a second dampening via opacity would bury it.
  time: { ...font.caption, color: colors.textFaint, fontSize: 11 },
}))

/**
 * The same line in the v3 thread: v3's caption in its grey. The current
 * look's 11pt is under v3's floor of 12 for anything a person reads, and the
 * clock and "Sending" or "Read" are read; Nunito's label step was tried and
 * shouted, on every row. Tabular, so a clock does not shift the line when its
 * digits change.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  time: { ...v3.type.caption, color: v3.colors.muted, fontVariant: ['tabular-nums'] },
}))
