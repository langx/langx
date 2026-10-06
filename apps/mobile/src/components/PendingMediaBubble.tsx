import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useT } from '../i18n'
import type { PendingMedia } from '../lib/pendingMedia'
import { DiscardUnsentButton } from './DiscardUnsentButton'
import { percentOf } from '../lib/uploadProgress'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * An attachment that is on its way, drawn where its message will be.
 *
 * Shaped like one of your own bubbles, which is the point: the thing the
 * reader is waiting for is a message, so the waiting should look like one. The
 * picture is the local file the picker returned, so it appears the instant it
 * is chosen rather than after a round trip — a video as its first frame. The
 * spinner and the percentage sit on the picture itself, the way every
 * messenger draws an upload: a video used to fall through to the voice-note
 * row and showed a microphone while it went up.
 *
 * A voice note has nothing to show, so it gets a three-pixel track that fills
 * as it uploads — its waveform is read by the server, after the upload.
 *
 * When it fails it keeps its place and becomes a button, following the unsent
 * text queue above it. Before this, a failed attachment raised an alert and
 * the picked file was thrown away.
 */
export function PendingMediaBubble({
  item,
  onRetry,
  onDiscard,
  onLongPress,
}: {
  item: PendingMedia
  onRetry: () => void
  /** The bin beside a failed one; the same thing the long-press menu's Delete does. */
  onDiscard: () => void
  /** Only once it has failed: one still uploading has nothing to offer yet. */
  onLongPress: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const failed = item.progress.phase === 'failed'
  const ratio = item.width && item.height ? item.width / item.height : undefined
  const percent = percentOf(item.progress)
  /*
   * Three states, because there are three waits. "Preparing" covers the file
   * being read into memory, which has no number to give — `fetch(uri).blob()`
   * reads the whole thing before a byte is sent, and 0% through it would be a
   * lie that looks like a stall. Then the real percentage. Then the socket
   * round-trip that turns the bytes into a message, which is not an upload and
   * should not claim to be one.
   */
  const label =
    item.progress.phase === 'reading'
      ? t('composer.preparingUpload')
      : item.progress.phase === 'sending'
        ? t('chat.sendingAttachment')
        : t('composer.uploadingPercent', { percent })
  // A picture carries its own progress on top of it; a status line under it
  // would say the same thing twice.
  const pictured = !item.viewOnce && (item.kind === 'image' || item.kind === 'video')

  const body = (
    <>
      {item.viewOnce ? (
        // A card, not the picture: once it lands the sender's bubble shows
        // no picture either, and the upload is no reason to show one.
        <View style={styles.audioRow}>
          <Feather
            name={item.kind === 'video' ? 'video' : 'camera'}
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.viewOnceTitle}>
            {t(item.kind === 'video' ? 'viewOnce.video' : 'viewOnce.photo')}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: colors.accent, width: `${Math.max(2, percent)}%` },
              ]}
            />
          </View>
        </View>
      ) : item.kind === 'image' || item.kind === 'video' ? (
        <View>
          {item.kind === 'video' ? (
            <VideoFrame
              uri={item.uri}
              style={[styles.image, ratio ? { aspectRatio: ratio } : styles.imageUnmeasured]}
            />
          ) : (
            <Image
              source={{ uri: item.uri }}
              style={[styles.image, ratio ? { aspectRatio: ratio } : styles.imageUnmeasured]}
              contentFit="cover"
            />
          )}
          {failed ? null : (
            <View style={[styles.veil, styles.progressOverlay]} pointerEvents="none">
              <View style={styles.progressBadge}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.progressText}>
                  {/*
                    The number alone, as `PendingPhotoTile` draws it: the
                    sentence does not fit in the circle, and the picture
                    already says what is being uploaded. Reading has no number
                    yet, so it is an ellipsis rather than 0%.
                  */}
                  {item.progress.phase === 'reading'
                    ? t('composer.percentPending')
                    : t('composer.percentOnly', { percent })}
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.audioRow}>
          <Feather name="mic" size={16} color={colors.textMuted} />
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: colors.accent, width: `${Math.max(2, percent)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {item.body ? <Text style={styles.caption}>{item.body}</Text> : null}

      {pictured && !failed ? null : (
        <View style={styles.status}>
          {failed ? (
            <>
              <Feather name="alert-circle" size={12} color={colors.danger} />
              <Text style={styles.failedLabel}>{t('chat.notSentRetry')}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" />
              <Text style={styles.label}>{label}</Text>
            </>
          )}
        </View>
      )}
    </>
  )

  if (!failed) return <View style={[styles.bubble, styles.pending]}>{body}</View>
  return (
    <View style={styles.failedRow}>
      <DiscardUnsentButton onPress={onDiscard} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chat.notSentRetry')}
        onPress={onRetry}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.bubble, styles.failed, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    </View>
  )
}

/**
 * A picked video drawn as its first frame, paused and muted — the trick
 * `AttachmentPreview`'s thumbnail uses, for the same reason: the player
 * already holds the frame, and generating a thumbnail is an async call and a
 * bitmap for the few seconds the upload is on screen.
 */
function VideoFrame({ uri, style }: { uri: string; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true
  })
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  bubble: {
    alignSelf: 'flex-end',
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.xs,
    maxWidth: '78%',
    padding: spacing.sm,
  },
  // Your own side, drained: the message does not exist yet, so it does not get
  // the accent fill a sent one has.
  pending: { borderColor: colors.border },
  failed: { borderColor: colors.danger, flexShrink: 1 },
  failedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.7 },
  // `overflow` for the video: a native player view ignores `borderRadius` without it.
  image: { backgroundColor: colors.fill, borderRadius: radius.md, overflow: 'hidden', width: 220 },
  imageUnmeasured: { height: 220 },
  /** Says "not yet" without hiding what was picked. */
  veil: {
    ...({ position: 'absolute' } as const),
    backgroundColor: colors.scrim,
    borderRadius: radius.md,
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  progressOverlay: { alignItems: 'center', justifyContent: 'center' },
  progressBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 44,
    gap: 4,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  /*
   * Tabular figures, as in `AttachmentPreview`: 9%, 49% and 100% are three
   * widths, and a centred proportional number slides as it counts.
   */
  progressText: {
    color: '#fff',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  audioRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 180 },
  // A plain track rather than `AudioBubble`'s waveform: the server has not
  // read the note yet, and what fills here is the upload, not the playhead.
  track: { backgroundColor: colors.border, borderRadius: 2, flex: 1, height: 3 },
  trackFill: { borderRadius: 2, height: 3 },
  viewOnceTitle: { ...font.body, color: colors.text, fontSize: 15, fontWeight: '600' },
  caption: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 24 },
  status: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  label: { ...font.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  failedLabel: { ...font.caption, color: colors.danger },
}))
