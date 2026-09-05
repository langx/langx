import { CARD_SHAPES, type CardKind, type CardShape } from '@langx/shared'
import { File, Paths } from 'expo-file-system'
import { useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, Text } from 'react-native'
import { useCreateShareCard } from '../api/queries'
import { useT, type MessageKey } from '../i18n'
import { shareImage, shareLink } from '../lib/share'
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

/** A share that has been decided on but not yet handed to the OS. */
type PendingShare = () => Promise<void>

/**
 * Fetches the rendered card into the cache so the share sheet can be handed
 * a file rather than a URL. Named by card id, so sharing the same card twice
 * overwrites rather than accumulates; `idempotent` is what makes the second
 * download land on the first one's name without complaint.
 */
async function downloadCard(id: string, imageUrl: string): Promise<File> {
  const target = new File(Paths.cache, `langx-card-${id}.png`)
  return File.downloadFileAsync(imageUrl, target, { idempotent: true })
}

/**
 * Choose where a card is going, then share it.
 *
 * The shape is asked for rather than guessed because there is no shape that
 * survives all three destinations: a 9:16 card posted to a timeline is a
 * stamp, and a 16:9 card in a story is a band across an empty screen. One
 * question, three answers, and the picture is drawn to fit the answer.
 *
 * **What goes into the sheet is the picture, as a file.** It used to be the
 * card's page, `app.langx.io/s/<id>`, and that link is still what the page
 * and "Just the link" hand out — but Instagram's share extension, given a
 * URL, offers only "send in a message"; given an image it asks Story or Post,
 * which is the whole point of drawing a 9:16 card. The PNG is downloaded into
 * the cache and shared from there, on iOS and Android. The web keeps sharing
 * the page: a browser cannot hand a file to Instagram anyway, and a URL is
 * what `navigator.share` is good at.
 *
 * **Sharing text remains possible and remains the fallback.** If the render
 * fails — storage not configured, the API unreachable — the sheet shares the
 * sentence and the link it always did rather than reporting an error for
 * something the user asked to *share*. If the render worked and only the
 * download or the file share did not, the page link goes out instead, with no
 * toast: the card exists and the link shows it.
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
  const [pending, setPending] = useState<PendingShare | null>(null)

  /**
   * Close this sheet, then hand the sentence to the platform share sheet —
   * and in that order, with the dismissal actually finished in between.
   *
   * iOS refuses to present `UIActivityViewController` while another
   * presentation is still animating away, and it refuses **silently**: no
   * throw, the promise resolves, and no sheet ever appears. Closing and
   * sharing in the same tick therefore looked exactly like a share that had
   * worked — the card was rendered, stored and returned, and then nothing
   * happened. `onDismiss` fires after the dismissal completes and is the only
   * moment that is reliably safe.
   *
   * Android has no such rule and never fires `onDismiss`, so there it goes out
   * straight away rather than waiting for a callback that will not come.
   */
  function shareAfterClose(share: PendingShare): void {
    onClose()
    if (Platform.OS === 'ios') setPending(() => share)
    else void share()
  }

  /** The picture as a file where the platform can take one, the page otherwise. */
  function shareCard(card: { id: string; imageUrl: string; shareUrl: string }): PendingShare {
    const page: ShareContent = { message: request?.fallback.message ?? '', url: card.shareUrl }
    if (Platform.OS === 'web') return () => shareLink(page)
    return async () => {
      const file = await downloadCard(card.id, card.imageUrl).catch(() => null)
      const shared = file ? await shareImage(file.uri) : false
      if (!shared) await shareLink(page)
      // The cache is not a gallery: the file has done its job either way.
      try {
        file?.delete()
      } catch {
        // A file that will not delete is a file the OS sweeps later.
      }
    }
  }

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
      shareAfterClose(shareCard(card))
    } catch (caught) {
      void caught
      showToast(t('share.cardFailed'))
      const fallback = request.fallback
      shareAfterClose(() => shareLink(fallback))
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
      onDismiss={() => {
        if (!pending) return
        const share = pending
        setPending(null)
        void share()
      }}
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
              if (!request) return onClose()
              const fallback = request.fallback
              shareAfterClose(() => shareLink(fallback))
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
