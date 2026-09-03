import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../i18n'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { pickImageAsset } from '../lib/pickImageAsset'
import { showToast } from '../lib/toast'
import { makeStyles, useTheme } from '../lib/theme'

export interface PendingAttachment {
  kind: 'image' | 'audio'
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
}

interface AttachmentBarProps {
  pending: PendingAttachment | null
  onPick: (attachment: PendingAttachment) => void
  disabled?: boolean
}

interface AttachmentPreviewProps {
  pending: PendingAttachment | null
  onClear: () => void
}

/**
 * What is attached, drawn above the composer's buttons rather than inside them.
 *
 * It used to be the words "Photo attached" on the same line as Post, which
 * answered neither question somebody asks after picking: *which* photo, and
 * how do I take it back. A thumbnail answers the first by being the picture,
 * and the cross on its corner is the second — the same gesture every gallery
 * uses.
 *
 * Its own component, and its own row, because the row it used to share is the
 * one holding the submit button. Anything that grows in there is competing for
 * width with the only control that sends the post.
 */
export function AttachmentPreview({ pending, onClear }: AttachmentPreviewProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  if (!pending) return null

  if (pending.kind === 'image') {
    return (
      <View style={styles.previewRow}>
        <View>
          <Image source={{ uri: pending.uri }} style={styles.thumb} contentFit="cover" />
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('feed.removeAttachment')}
            style={styles.removeBadge}
          >
            <Feather name="x" size={12} color={colors.bg} />
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.previewRow}>
      <Feather name="mic" size={16} color={colors.textMuted} />
      <Text style={styles.attached} numberOfLines={1}>
        {t('feed.voiceAttached')}
      </Text>
      <Pressable
        onPress={onClear}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('feed.removeAttachment')}
      >
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

/**
 * Attach a photo or record a voice note, for the feed's two composers.
 *
 * **Attach, do not send.** The chat composer uploads the moment you pick,
 * because in a thread picking *is* sending. Here there is a sentence still
 * being written, and uploading on pick would spend a day's media quota and put
 * bytes in the bucket for a post the writer then abandons. So this only holds
 * the local file; the screen uploads it when the post is actually submitted.
 *
 * Its own layout rather than the chat composer's: that one swaps its send
 * button for a microphone when the draft is empty and its camera for a timer
 * while recording, which is chat's arrangement. A component with enough props
 * to serve both would not be a component.
 */
export function AttachmentBar({ pending, onPick, disabled }: AttachmentBarProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const recorder = useVoiceRecorder()

  async function pick(): Promise<void> {
    const picked = await pickImageAsset()
    if (picked.status === 'denied') {
      showToast(
        picked.source === 'camera' ? t('media.cameraPermission') : t('feed.photosPermission'),
      )
      return
    }
    if (picked.status === 'cancelled') return
    if (picked.status === 'unsupported') {
      showToast(t('errors.attachmentUnsupported'))
      return
    }
    onPick({ kind: 'image', ...picked.image })
  }

  async function toggleRecording(): Promise<void> {
    if (!recorder.isRecording) {
      const started = await recorder.start()
      if (!started && recorder.error) showToast(recorder.error)
      return
    }
    const recording = await recorder.stop()
    if (!recording) return
    onPick({ kind: 'audio', ...recording })
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
   * Nothing while something is attached. A post carries one attachment, so a
   * second camera is an offer the composer cannot keep, and the row it would
   * sit in belongs to the submit button.
   */
  if (pending) return null

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void pick()}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('feed.attachPhoto')}
        style={styles.button}
      >
        <Feather name="camera" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => void toggleRecording()}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('feed.recordVoice')}
        style={styles.button}
      >
        <Feather name="mic" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // `flexShrink` so this can never starve the submit button beside it: a row
  // whose child asks for `flex: 1` measures at the full width offered to it,
  // and React Native does not shrink a flex item unless it is told to.
  row: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 10 },
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
  // v3 draws attachment controls as bare muted glyphs; the 36 box keeps the
  // touch target the outlined circle used to give them.
  button: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  attached: { ...font.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
  recording: { ...font.label, color: colors.text, flex: 1, fontVariant: ['tabular-nums'] },
  recordingDot: { backgroundColor: colors.danger, borderRadius: 5, height: 10, width: 10 },
  cancel: { ...font.caption, color: colors.textMuted },
}))
