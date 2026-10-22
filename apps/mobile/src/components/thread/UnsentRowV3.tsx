import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'
import { DiscardUnsentButton } from '../DiscardUnsentButton'
import { NotSentColumnV3 } from './NotSentLineV3'

/**
 * A sentence of yours that did not go, in the v3 thread — offline when it was
 * sent, or refused on the way.
 *
 * Your bubble's shape, side and tail, drained of its blue to a two-point red
 * outline with the words in the ground's ink: still your message, not sent.
 * Under it, where a sent message carries "10:20 · Read", the not-sent line.
 * The bin beside it, as in the current look. Tap retries and long-press opens
 * the menu with Copy and Delete; both are the screen's handlers, unchanged.
 *
 * `retrying` is the moment between a tap and its answer: the outline drains
 * to grey and the line says "Sending" instead of the red, and a second
 * failure brings the red back with its pop.
 */
export function UnsentRowV3({
  body,
  retrying,
  onRetry,
  onDiscard,
  onLongPress,
}: {
  body: string
  retrying: boolean
  onRetry: () => void
  onDiscard: () => void
  onLongPress: () => void
}) {
  const styles = useStyles()
  const t = useT()
  return (
    <View style={styles.row}>
      <DiscardUnsentButton onPress={onDiscard} />
      <NotSentColumnV3
        label={retrying ? t('messageMeta.sending') : t('chat.notSentTapRetry')}
        spoken={retrying ? t('messageMeta.sending') : t('chat.notSentRetry')}
        retrying={retrying}
        onPress={onRetry}
        onLongPress={onLongPress}
      >
        <View style={[styles.bubble, retrying && styles.bubbleRetrying]}>
          <Text style={styles.body}>{body}</Text>
        </View>
      </NotSentColumnV3>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  /** The bin on the inside, the bubble on your own side. */
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'flex-end',
  },
  /*
   * `bubbleLookV3`'s own bubble — the tile corner, the tighter corner on your
   * side's tail, its padding less the outline so the text sits where a sent
   * one's does.
   */
  bubble: {
    borderBottomEndRadius: v3.space[8],
    borderColor: v3.colors.danger,
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  // Not failed while the retry is out: the outline drains to the pending grey.
  bubbleRetrying: { borderColor: v3.colors.line },
  body: { ...v3.type.body, color: v3.colors.fg, lineHeight: 23 },
}))
