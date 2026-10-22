import Feather from '@expo/vector-icons/Feather'
import { MAX_ATTACHMENTS, MAX_VIDEO_SECONDS } from '@langx/shared'
import { useEffect, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useT } from '../i18n'
import { useV3Home } from '../hooks/useV3Home'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { pickMediaAssets } from '../lib/pickMediaAsset'
import { showToast } from '../lib/toast'
import { makeStyles, useTheme } from '../lib/theme'
import { AttachmentPreviewRow, AttachmentThumbs, type PendingAttachment } from './AttachmentPreview'
import { useAttachmentStylesV3, useAttachmentTileStylesV3 } from './AttachmentBarV3.styles'

export type { PendingAttachment }
export { AttachmentPreviewRow, AttachmentThumbs }

interface AttachmentBarProps {
  pending: readonly PendingAttachment[]
  onPick: (attachments: PendingAttachment[]) => void
  disabled?: boolean
  /**
   * The microphone. On where a spoken message is a message — both composers —
   * and off where the files are evidence of something: nobody proves a bug by
   * describing it out loud, and the button would only be a way to attach
   * something the report cannot use.
   */
  voiceNote?: boolean
  /**
   * The picker chip's words, when a screen leads with it. The composer does:
   * a photo or a video can be the whole post now, so "Add a photo or video"
   * says what the chip is for there, where "Photo" undersold it.
   */
  mediaLabel?: string
  /**
   * Draws the two buttons as squares of this side, after `leading` in one
   * scrolling line — `V-Compose`'s tiles. Only the v3 post composer asks:
   * the correction composer's bar sits beside its Send, where a tile does
   * not fit. The picker, the recorder and their limits are the same either
   * way; only the drawing changes.
   */
  tile?: number
  /** What goes before the tiles in that line: the thumbnails already picked. */
  leading?: ReactNode
}

/**
 * Attach photos and videos, or record a voice note, for the feed's two
 * composers.
 *
 * **Attach, do not send.** Nothing is uploaded until the post is submitted:
 * uploading on pick would spend a day's media quota and put bytes in the
 * bucket for a post the writer then abandons. Chat used to be the exception,
 * on the grounds that in a thread picking *is* sending; it is not one any
 * more, and both composers now hold the local file the same way.
 *
 * Its own layout rather than the chat composer's: that one swaps its send
 * button for a microphone when the draft is empty and its camera for a timer
 * while recording, which is chat's arrangement. A component with enough props
 * to serve both would not be a component.
 */
export function AttachmentBar({
  pending,
  onPick,
  disabled,
  voiceNote = true,
  mediaLabel,
  tile,
  leading,
}: AttachmentBarProps) {
  const styles = useStyles()
  const tiles = useAttachmentTileStylesV3()
  const { colors, v3 } = useTheme()
  const v3Look = useV3Home()
  // The glyphs' colour: the ink on the pills, and on the stop's ink disc its own text colour.
  const glyph = v3Look ? v3.colors.fg : colors.text
  const t = useT()
  const recorder = useVoiceRecorder()

  const remaining = MAX_ATTACHMENTS - pending.length

  async function pick(): Promise<void> {
    if (remaining <= 0) {
      showToast(t('errors.tooManyAttachments', { count: MAX_ATTACHMENTS }))
      return
    }
    const picked = await pickMediaAssets({ remaining })
    if (picked.status === 'denied') {
      showToast(
        picked.source === 'camera' ? t('media.cameraPermission') : t('feed.photosPermission'),
      )
      return
    }
    if (picked.status === 'cancelled') return
    // Said once, for the first file that was dropped: naming each of six would
    // be a stack of toasts nobody reads.
    if (picked.refused) {
      showToast(
        picked.refused.reason === 'tooLong'
          ? t('errors.videoTooLong', { count: MAX_VIDEO_SECONDS })
          : picked.refused.reason === 'tooLarge'
            ? t('errors.attachmentTooLarge')
            : picked.refused.reason === 'tooMany'
              ? t('errors.tooManyAttachments', { count: MAX_ATTACHMENTS })
              : t('errors.attachmentUnsupported'),
      )
    }
    if (picked.media.length > 0) onPick(picked.media.slice(0, remaining))
  }

  /*
   * The ceiling stops the recording rather than letting it run past what the
   * server will accept — same rule as the chat composer, and for the same
   * reason: the refusal used to arrive after the bytes had been spoken.
   */
  useEffect(() => {
    if (!recorder.atLimit) return
    void finishRecording()
    // The flag alone, deliberately: `finishRecording` is re-made every render
    // and listing it here would end a recording on every one of them.
  }, [recorder.atLimit])

  async function toggleRecording(): Promise<void> {
    if (!recorder.isRecording) {
      const started = await recorder.start()
      if (!started && recorder.error) showToast(recorder.error)
      return
    }
    await finishRecording()
  }

  /** Stops and keeps what was said, whether a person or the clock ended it. */
  async function finishRecording(): Promise<void> {
    const recording = await recorder.stop()
    if (!recording) return
    onPick([{ kind: 'audio', ...recording }])
  }

  if (recorder.isRecording) {
    return (
      <View style={styles.row}>
        <View style={styles.recordingDot} />
        <Text style={styles.recording}>
          {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={() => void toggleRecording()}
          hitSlop={8}
          style={styles.button}
          {...(v3Look
            ? { accessibilityRole: 'button' as const, accessibilityLabel: t('feed.stopRecording') }
            : {})}
        >
          <Feather name="square" size={18} color={v3Look ? v3.colors.pillText : colors.text} />
        </Pressable>
        <Pressable onPress={() => void recorder.cancel()} hitSlop={8}>
          <Text style={styles.cancel}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    )
  }

  /*
   * A voice note is the message, so once one is attached there is nothing more
   * to add; the server refuses a recording sent beside a picture anyway.
   */
  const hasVoice = pending.some((item) => item.kind === 'audio')
  const photoDisabled = disabled || hasVoice || remaining <= 0
  const voiceDisabled = disabled || pending.length > 0

  if (tile) {
    const square = { height: tile, width: tile }
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tiles.line}
        // The thumbnails' crosses sit outside their squares.
        style={tiles.scroll}
      >
        {leading}
        <Pressable
          onPress={() => void pick()}
          disabled={photoDisabled}
          accessibilityRole="button"
          accessibilityLabel={t('composer.attachMedia')}
          accessibilityState={{ disabled: photoDisabled }}
          style={({ pressed }) => [
            tiles.tile,
            tiles.add,
            square,
            photoDisabled && styles.chipDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="image" size={v3.icon.xl} color={v3.colors.fg} />
          <Text style={tiles.label} maxFontSizeMultiplier={TILE_TEXT_MAX_SCALE}>
            {mediaLabel ?? t('composer.attachLibrary')}
          </Text>
        </Pressable>
        {voiceNote ? (
          <Pressable
            onPress={() => void toggleRecording()}
            disabled={voiceDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('feed.recordVoice')}
            accessibilityState={{ disabled: voiceDisabled }}
            style={({ pressed }) => [
              tiles.tile,
              tiles.voice,
              square,
              voiceDisabled && styles.chipDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="mic" size={v3.icon.xl} color={v3.colors.fg} />
            <Text style={tiles.label} maxFontSizeMultiplier={TILE_TEXT_MAX_SCALE}>
              {t('feed.voiceNote')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    )
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void pick()}
        disabled={photoDisabled}
        accessibilityRole="button"
        accessibilityLabel={t('composer.attachMedia')}
        accessibilityState={{ disabled: photoDisabled }}
        style={({ pressed }) => [
          styles.chip,
          photoDisabled && styles.chipDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Feather name="image" size={18} color={glyph} />
        <Text style={styles.chipLabel}>{mediaLabel ?? t('composer.attachLibrary')}</Text>
      </Pressable>
      {voiceNote ? (
        <Pressable
          onPress={() => void toggleRecording()}
          disabled={voiceDisabled}
          accessibilityRole="button"
          accessibilityLabel={t('feed.recordVoice')}
          accessibilityState={{ disabled: voiceDisabled }}
          style={({ pressed }) => [
            styles.chip,
            voiceDisabled && styles.chipDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="mic" size={18} color={glyph} />
          <Text style={styles.chipLabel}>{t('feed.voiceNote')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/**
 * How far the tiles' words follow the system text size. The square does not
 * grow with them, so past this the label would spill out of it.
 */
const TILE_TEXT_MAX_SCALE = 1.2

/** This file's sheet, or with `flags.v3Home` on the redesign's (`AttachmentBarV3.styles.ts`). */
function useStyles() {
  const current = useCurrentStyles()
  const v3 = useAttachmentStylesV3()
  return useV3Home() ? v3 : current
}

const useCurrentStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // `flexShrink` so this can never starve the submit button beside it: a row
  // whose child asks for `flex: 1` measures at the full width offered to it,
  // and React Native does not shrink a flex item unless it is told to.
  row: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: spacing.sm },
  previewRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  thumb: { borderRadius: radius.md, height: 64, width: 64 },
  removeBadge: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    end: -6,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    top: -6,
    width: 20,
  },
  // The stop control while recording: a bare glyph in a 36 box, the touch
  // target the outlined circle used to give it.
  button: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  // v3's attach controls are `fill` pills with the word beside the glyph —
  // "Photo", "Voice note" — rather than two unlabelled icons.
  chip: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
  },
  chipLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  attached: { ...font.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
  recording: { ...font.label, color: colors.text, flex: 1, fontVariant: ['tabular-nums'] },
  recordingDot: { backgroundColor: colors.danger, borderRadius: 5, height: 10, width: 10 },
  cancel: { ...font.caption, color: colors.textMuted },
}))
