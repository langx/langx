import { CARD_SHAPES, type CardKind, type CardShape } from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, Text } from 'react-native'
import { useCreateShareCard } from '../api/queries'
import { useT, type MessageKey } from '../i18n'
import { shareLink } from '../lib/share'
import type { ShareContent } from '../lib/shareText'
import { makeStyles } from '../lib/theme'
import { showToast } from '../lib/toast'

/** One label per shape, named for where the picture is going rather than for
 *  its ratio: nobody thinks in 9:16, everybody thinks in "story". */
const SHAPE_LABELS: Record<CardShape, MessageKey> = {
  story: 'share.shapeStory',
  square: 'share.shapeSquare',
  wide: 'share.shapeWide',
}

export interface ShareCardRequest {
  kind: CardKind
  headline: string
  caption: string
  /** The sentence to share when there is no picture, and beside the link when there is. */
  fallback: ShareContent
}

/**
 * Choose where a card is going, then share it.
 *
 * The shape is asked for rather than guessed because there is no shape that
 * survives all three destinations: a 9:16 card posted to a timeline is a
 * stamp, and a 16:9 card in a story is a band across an empty screen. One
 * question, three answers, and the picture is drawn to fit the answer.
 *
 * **Sharing text remains possible and remains the fallback.** If the render
 * fails — storage not configured, the API unreachable — the sheet shares the
 * sentence and the link it always did rather than reporting an error for
 * something the user asked to *share*.
 */
export function ShareCardSheet({
  request,
  onClose,
}: {
  request: ShareCardRequest | null
  onClose: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const createCard = useCreateShareCard()
  const [busy, setBusy] = useState<CardShape | null>(null)

  async function pick(shape: CardShape): Promise<void> {
    if (!request || busy) return
    setBusy(shape)
    try {
      const card = await createCard.mutateAsync({
        kind: request.kind,
        shape,
        headline: request.headline,
        caption: request.caption,
      })
      onClose()
      // The page, not the picture: `app.langx.io/s/<id>` unfurls with a title
      // and gives whoever taps it somewhere to go.
      await shareLink({ message: request.fallback.message, url: card.shareUrl })
    } catch (caught) {
      void caught
      onClose()
      showToast(t('share.cardFailed'))
      await shareLink(request.fallback)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{t('share.cardTitle')}</Text>
          <Text style={styles.body}>{t('share.cardBody')}</Text>

          {CARD_SHAPES.map((shape) => (
            <Pressable
              key={shape}
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => void pick(shape)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowLabel}>{t(SHAPE_LABELS[shape])}</Text>
              {busy === shape ? <ActivityIndicator /> : null}
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => {
              const fallback = request?.fallback
              onClose()
              if (fallback) void shareLink(fallback)
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabelMuted}>{t('share.justTheLink')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: spacing.xs,
    maxHeight: '80%',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...font.heading, color: colors.text, fontSize: 18 },
  body: { ...font.body, color: colors.textMuted, marginBottom: spacing.sm },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.6 },
  rowLabel: { ...font.heading, color: colors.text, fontSize: 16 },
  rowLabelMuted: { ...font.body, color: colors.textMuted, fontSize: 16 },
}))
