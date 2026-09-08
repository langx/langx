import Feather from '@expo/vector-icons/Feather'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useT } from '../i18n'
import { audioProgress } from '../lib/audioProgress'
import { ensurePlaybackAudioMode } from '../lib/audioSession'
import { makeStyles, useTheme } from '../lib/theme'
import {
  percentOf,
  thumbProgress,
  type ActiveUpload,
  type UploadProgress,
} from '../lib/uploadProgress'

/** A file the composer is holding, before anything has been uploaded. */
export interface PendingAttachment {
  kind: 'image' | 'audio' | 'video'
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
}

/**
 * What is attached, drawn above the composer rather than inside it.
 *
 * It used to be the words "Photo attached" on one line, which answered neither
 * question somebody asks after picking: *which* photo, and how do I take it
 * back. A thumbnail answers the first by being the picture, and the cross on
 * its corner is the second — the same gesture every gallery uses.
 *
 * Shared by both composers now. Chat used to upload the moment you picked, on
 * the grounds that in a thread picking is sending; it does not any more, so
 * the two hold a file the same way and the row that shows it is one component.
 */
function VideoThumb({ uri, uploading }: { uri: string; uploading: boolean }) {
  const styles = useStyles()
  const { colors } = useTheme()
  /*
   * Paused on its first frame, which is the thumbnail. Generating a real one
   * costs an async call and a bitmap for a picture the player is already
   * holding, and this row is on screen for as long as it takes to write a
   * caption — long enough that a second of grey would be noticed.
   */
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true
  })

  return (
    <View style={styles.thumb}>
      <VideoView
        player={player}
        style={styles.thumbFill}
        contentFit="cover"
        nativeControls={false}
      />
      {/*
        Not while it is uploading. The badge sits in the corner of the same
        64pt square the progress label is centred in, so the two shared it —
        a play triangle showing through a scrim under a number that moved
        around it. The upload is the only thing worth saying at that moment.
      */}
      {uploading ? null : (
        <View style={styles.playBadge} pointerEvents="none">
          <Feather name="play" size={12} color={colors.bg} />
        </View>
      )}
    </View>
  )
}

/**
 * A recording that has not been sent yet, playable.
 *
 * It used to be the same 64pt square as a photo with a microphone drawn in it,
 * which answered "there is a recording" and nothing else. A voice note cannot
 * be un-sent, and the question somebody has after speaking is whether what
 * they said is any good — so the draft plays here, and the cross beside it is
 * the second answer.
 *
 * Deliberately not `AudioBubble`: that one is a bubble, with a scrubber, a
 * half-speed control and a whole loading vocabulary for a file that came over
 * the network. This file is on the device and a few seconds long.
 */
function VoiceDraft({ attachment }: { attachment: PendingAttachment }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const player = useAudioPlayer(attachment.uri)
  const status = useAudioPlayerStatus(player)
  // `Platform.OS` passed in rather than read there, so `audioProgress` stays
  // free of `react-native`. Same call the sent bubble makes.
  const { total, elapsed, canReplay } = audioProgress(attachment, status, Platform.OS)

  async function toggle(): Promise<void> {
    if (status.playing) {
      player.pause()
      return
    }
    // `useVoiceRecorder.stop` already puts the session back into playback
    // mode, but this pill also plays a file picked from the library — and
    // `audioSession` memoises, so in the common case this is a no-op.
    await ensurePlaybackAudioMode()
    if (canReplay) void player.seekTo(0)
    player.play()
  }

  return (
    <View style={styles.voice}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(status.playing ? 'chat.pauseVoiceMessage' : 'chat.playVoiceMessage')}
        hitSlop={8}
        onPress={() => void toggle()}
        style={styles.voicePlay}
      >
        <Feather name={status.playing ? 'pause' : 'play'} size={14} color={colors.textInverse} />
      </Pressable>
      {/*
        Tabular figures: the clock ticks every second and a proportional font
        makes it shuffle sideways as the digits change.
      */}
      <Text style={styles.voiceTime}>
        {clock(elapsed)}
        {total > 0 ? ` / ${clock(total)}` : ''}
      </Text>
    </View>
  )
}

/** `m:ss`, the same shape the recording readout in the composer uses. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function AttachmentThumb({
  attachment,
  onRemove,
  progress,
}: {
  attachment: PendingAttachment
  onRemove: () => void
  /** Where this file is, or `null` when it is not being sent. */
  progress: UploadProgress | null
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const label =
    attachment.kind === 'video'
      ? t('feed.videoAttached')
      : attachment.kind === 'image'
        ? t('feed.photoAttached')
        : t('feed.voiceAttached')

  return (
    <View accessible accessibilityLabel={label}>
      {attachment.kind === 'image' ? (
        <Image source={{ uri: attachment.uri }} style={styles.thumb} contentFit="cover" />
      ) : attachment.kind === 'video' ? (
        <VideoThumb uri={attachment.uri} uploading={progress !== null} />
      ) : (
        <VoiceDraft attachment={attachment} />
      )}
      {progress === null ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('composer.removeAttachment')}
          style={styles.removeBadge}
        >
          <Feather name="x" size={12} color={colors.bg} />
        </Pressable>
      ) : (
        /*
         * The scrim replaces the cross rather than sitting beside it: once the
         * post is submitted the file is on its way and taking it back is not
         * something the composer can still offer.
         */
        <View style={[styles.thumb, styles.uploading]} pointerEvents="none">
          {/*
            A number and nothing else, unlike `PendingMediaBubble`, which has a
            bubble's width to spell it out in. Reading the file into memory has
            no number to give and says so with an ellipsis rather than sitting
            at a 0% it does not mean; once the bytes are up, `sending` is the
            round-trip, and 100% is true for the whole of it.
          */}
          <Text style={styles.uploadingText} numberOfLines={1}>
            {progress.phase === 'reading'
              ? t('composer.percentPending')
              : t('composer.percentOnly', { percent: percentOf(progress) })}
          </Text>
        </View>
      )}
    </View>
  )
}

/**
 * Every pending file, in the order it was picked, each with its own cross.
 *
 * Horizontal and scrolling because six squares are wider than a phone and the
 * composer must not grow a second line of thumbnails while somebody is typing
 * into it.
 */
export function AttachmentPreviewRow({
  pending,
  onRemove,
  progress = null,
}: {
  pending: readonly PendingAttachment[]
  onRemove: (index: number) => void
  /**
   * Which file is being sent and how far along, or `null` when nothing is.
   * Chat passes nothing: there, picking is sending, and the progress belongs
   * on the bubble that is already in the thread (`PendingMediaBubble`).
   */
  progress?: ActiveUpload | null
}) {
  const styles = useStyles()

  if (pending.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.previewRow}
      // The crosses sit outside their squares, so the row needs room for them.
      style={styles.previewScroll}
    >
      {pending.map((attachment, index) => (
        <AttachmentThumb
          key={`${attachment.uri}-${index}`}
          attachment={attachment}
          onRemove={() => onRemove(index)}
          progress={thumbProgress(index, progress)}
        />
      ))}
    </ScrollView>
  )
}

/** The one-attachment spelling, for a caller that holds a single file. */
export function AttachmentPreview({
  pending,
  onClear,
}: {
  pending: PendingAttachment | null
  onClear: () => void
}) {
  if (!pending) return null
  return <AttachmentPreviewRow pending={[pending]} onRemove={onClear} />
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  previewScroll: { flexGrow: 0, marginBottom: spacing.sm },
  // Over the thumbnail, not beside it: the row is already as wide as the
  // screen with six files in it.
  uploading: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    bottom: 0,
    justifyContent: 'center',
    // Spelled out rather than left to the static-position fallback, which is
    // what `PendingMediaBubble`'s veil does and what keeps the scrim exactly
    // over the square when the label inside it changes width.
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  /*
   * Tabular figures, because the whole point is that it does not move. With
   * proportional ones the centred string re-measures on every tick — 9%, 49%,
   * 100% are three different widths — and the number visibly slides.
   */
  uploadingText: {
    color: '#fff',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    // Aligned with the composer's own inset, and enough on top for the crosses,
    // which sit outside their squares.
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  thumb: {
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    height: 64,
    overflow: 'hidden',
    width: 64,
  },
  thumbFill: { height: '100%', width: '100%' },
  // A pill rather than a square: a transport control and a clock do not fit
  // in 64pt, and the row is a horizontal scroller so a wider child costs
  // nothing. `height` matches the thumbnails beside it.
  voice: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 10,
    height: 64,
    paddingHorizontal: 14,
  },
  voicePlay: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  voiceTime: {
    color: colors.text,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    bottom: 4,
    height: 20,
    justifyContent: 'center',
    left: 4,
    position: 'absolute',
    width: 20,
  },
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
}))
