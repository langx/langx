import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useT } from '../i18n'
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
        // A recording has no picture, so the square says what it is instead of
        // showing a grey box that looks like a photo that failed to load.
        <View style={[styles.thumb, styles.audioThumb]}>
          <Feather name="mic" size={18} color={colors.textMuted} />
        </View>
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
  audioThumb: { alignItems: 'center', justifyContent: 'center' },
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
