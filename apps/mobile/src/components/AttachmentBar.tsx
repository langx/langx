import Feather from '@expo/vector-icons/Feather'
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
  onClear: () => void
  disabled?: boolean
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
export function AttachmentBar({ pending, onPick, onClear, disabled }: AttachmentBarProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const recorder = useVoiceRecorder()

  async function pick(): Promise<void> {
    const picked = await pickImageAsset()
    if (picked.status === 'denied') {
      showToast(t('feed.photosPermission'))
      return
    }
    if (picked.status === 'cancelled') return
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

  if (pending) {
    return (
      <View style={styles.row}>
        <Feather
          name={pending.kind === 'image' ? 'image' : 'mic'}
          size={16}
          color={colors.textMuted}
        />
        <Text style={styles.attached} numberOfLines={1}>
          {pending.kind === 'image' ? t('feed.photoAttached') : t('feed.voiceAttached')}
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

const useStyles = makeStyles(({ colors, font, radius }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  button: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  attached: { ...font.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
  recording: { ...font.label, color: colors.text, flex: 1, fontVariant: ['tabular-nums'] },
  recordingDot: { backgroundColor: colors.danger, borderRadius: 5, height: 10, width: 10 },
  cancel: { ...font.caption, color: colors.textMuted },
}))
