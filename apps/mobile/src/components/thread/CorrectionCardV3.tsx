import Feather from '@expo/vector-icons/Feather'
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { diffCorrection } from '../../lib/correctionDiff'
import { makeStyles, useTheme } from '../../lib/theme'

interface CorrectionCardV3Props {
  mine: boolean
  partnerName: string
  /** The corrected sentence: the message's own body. */
  body: string
  /** What it corrected, when the message carries it. */
  original?: string | undefined
  note?: string | undefined
  /** The sentence is already in this reader's Echo. */
  echoed: boolean
}

/**
 * The inside of a v3 correction: who corrected whom, the two lines
 * `diffCorrection` gives — the original with what changed struck through, the
 * rewrite with what changed in green — the note, and whether the sentence is
 * kept in Echo. The outline and the gestures around it are `MessageBubble`'s.
 *
 * The drawing's "+10" is not here, on purpose. A send's award comes back in
 * its ack and is never stored on the message, so the real figure is drawn by
 * `RewardChipV3` under the card, for the sender and only after their own
 * send; a number drawn from `TOKEN_RULES` here instead would be wrong whenever
 * a cap applied, and for every correction the other person wrote.
 *
 * The struck words are muted rather than red, as the drawing has them: the
 * green is the news, and the strike and the weight carry the same news for
 * anyone who cannot tell the colours apart.
 */
export function CorrectionCardV3({
  mine,
  partnerName,
  body,
  original,
  note,
  echoed,
}: CorrectionCardV3Props) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const diff = useMemo(
    () => (original === undefined ? null : diffCorrection(original, body)),
    [original, body],
  )

  return (
    <>
      <View style={styles.label}>
        <Feather name={mine ? 'check' : 'edit-2'} size={14} color={v3.colors.correction} />
        <Text style={styles.labelText}>
          {mine ? t('chat.yourCorrection') : t('chat.correctionFrom', { name: partnerName })}
        </Text>
      </View>
      {diff ? (
        <>
          <Text style={styles.original}>
            {diff.original.map((segment, index) => (
              <Text key={index} style={segment.changed ? styles.removed : null}>
                {segment.text}
              </Text>
            ))}
          </Text>
          <Text style={styles.corrected}>
            {diff.corrected.map((segment, index) => (
              <Text key={index} style={segment.changed ? styles.added : null}>
                {segment.text}
              </Text>
            ))}
          </Text>
        </>
      ) : (
        <Text style={styles.corrected}>{body}</Text>
      )}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {echoed ? (
        <View style={styles.echo}>
          <Feather name="copy" size={14} color={v3.colors.echoText} />
          <Text style={styles.echoText}>{t('echo.bubbleAdded')}</Text>
        </View>
      ) : null}
    </>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  label: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  labelText: { ...v3.type.label, color: v3.colors.correction, flexShrink: 1 },
  original: { ...v3.type.callout, color: v3.colors.muted },
  removed: { textDecorationLine: 'line-through' },
  corrected: { ...v3.type.body, color: v3.colors.fg, lineHeight: 23 },
  added: { color: v3.colors.correction, fontWeight: '800' },
  note: {
    ...v3.type.caption,
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    color: v3.colors.muted,
    marginTop: v3.space[2],
    paddingTop: v3.space[6],
  },
  echo: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    marginTop: v3.space[2],
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  echoText: { ...v3.type.label, color: v3.colors.echoText },
}))
