import Feather from '@expo/vector-icons/Feather'
import { MAX_ATTACHMENTS, MAX_VIDEO_SECONDS } from '@langx/shared'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../i18n'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { pickMediaAssets } from '../lib/pickMediaAsset'
import { showToast } from '../lib/toast'
import { makeStyles, useTheme } from '../lib/theme'
import { AttachmentPreviewRow, type PendingAttachment } from './AttachmentPreview'

export type { PendingAttachment }
export { AttachmentPreviewRow }

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
export function AttachmentBar({ pending, onPick, disabled, voiceNote = true }: AttachmentBarProps) {
  const styles = useStyles()
  const { colors } = useTheme()
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
        <Pressable onPress={() => void toggleRecording()} hitSlop={8} style={styles.button}>
          <Feather name="square" size={18} color={colors.text} />
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
        <Feather name="image" size={18} color={colors.text} />
        <Text style={styles.chipLabel}>{t('messageMeta.photo')}</Text>
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
          <Feather name="mic" size={18} color={colors.text} />
          <Text style={styles.chipLabel}>{t('feed.voiceNote')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
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
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
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
