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
import { useV3Home } from '../hooks/useV3Home'
import { useT } from '../i18n'
import type { PendingMedia } from '../lib/pendingMedia'
import { DiscardUnsentButton } from './DiscardUnsentButton'
import { NotSentColumnV3 } from './thread/NotSentLineV3'
import { PendingVoiceNoteV3 } from './thread/PendingVoiceNoteV3'
import { UploadRingV3 } from './thread/UploadRingV3'
import { UploadRing } from './UploadRing'
import { percentOf } from '../lib/uploadProgress'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * An attachment that is on its way, drawn where its message will be.
 *
 * Shaped like one of your own bubbles, which is the point: the thing the
 * reader is waiting for is a message, so the waiting should look like one. The
 * picture is the local file the picker returned, so it appears the instant it
 * is chosen rather than after a round trip — a video as its first frame. The
 * ring and the percentage sit on the picture itself, the way every
 * messenger draws an upload: a video used to fall through to the voice-note
 * row and showed a microphone while it went up.
 *
 * A voice note has nothing to show, so it gets a three-pixel track that fills
 * as it uploads — its waveform is read by the server, after the upload.
 *
 * When it fails it keeps its place and becomes a button, following the unsent
 * text queue above it. Before this, a failed attachment raised an alert and
 * the picked file was thrown away.
 *
 * Under `flags.v3Home` the same bubble in the v3 thread's terms: the ring is
 * `UploadRingV3`, a voice note is `PendingVoiceNoteV3` — the sent note's row
 * with its bars in a pending style — and a failed one carries v3's not-sent
 * line under the bubble (`NotSentColumnV3`) rather than a status inside it.
 * The handlers are this component's either way.
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
  const current = useStyles()
  const redesigned = useStylesV3()
  const v3Look = useV3Home()
  const styles = v3Look ? redesigned : current
  const { colors, v3 } = useTheme()
  const t = useT()
  const muted = v3Look ? v3.colors.muted : colors.textMuted
  const fillColor = v3Look ? v3.colors.blue : colors.accent

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
  // What the ring — or v3's voice note — draws; see the comment at the ring.
  const ringFraction = item.progress.phase === 'reading' ? null : item.progress.fraction
  const ringLabel =
    item.progress.phase === 'reading'
      ? t('composer.percentPending')
      : t('composer.percentOnly', { percent })
  // A picture carries its own progress on top of it; a status line under it
  // would say the same thing twice.
  const pictured = !item.viewOnce && (item.kind === 'image' || item.kind === 'video')

  const body = (
    <>
      {item.viewOnce ? (
        // A card, not the picture: once it lands the sender's bubble shows
        // no picture either, and the upload is no reason to show one.
        <View style={styles.audioRow}>
          <Feather name={item.kind === 'video' ? 'video' : 'camera'} size={16} color={muted} />
          <Text style={styles.viewOnceTitle}>
            {t(item.kind === 'video' ? 'viewOnce.video' : 'viewOnce.photo')}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: fillColor, width: `${Math.max(2, percent)}%` },
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
              {/*
                The number alone, as `PendingPhotoTile` draws it: the sentence
                does not fit in the ring, and the picture already says what is
                being uploaded. Reading has no number yet, so it is an ellipsis
                rather than 0%.
              */}
              {v3Look ? (
                <UploadRingV3 fraction={ringFraction} label={ringLabel} />
              ) : (
                <UploadRing fraction={ringFraction} label={ringLabel} />
              )}
            </View>
          )}
        </View>
      ) : v3Look ? (
        <PendingVoiceNoteV3
          seed={item.clientId}
          fraction={ringFraction}
          failed={failed}
          percentLabel={ringLabel}
        />
      ) : (
        <View style={styles.audioRow}>
          <Feather name="mic" size={16} color={muted} />
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: fillColor, width: `${Math.max(2, percent)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {item.body ? <Text style={styles.caption}>{item.body}</Text> : null}

      {/*
        v3 says the upload on the thing itself — the ring, the voice note's
        number — and a failure under the bubble, so only a view-once card,
        which has neither, keeps a status line there.
      */}
      {(pictured && !failed) || (v3Look && (failed || !item.viewOnce)) ? null : (
        <View style={styles.status}>
          {failed ? (
            <>
              <Feather
                name="alert-circle"
                size={12}
                color={v3Look ? v3.colors.danger : colors.danger}
              />
              <Text style={styles.failedLabel}>{t('chat.notSentRetry')}</Text>
            </>
          ) : (
            <>
              {/* v3 is calm about it: the bar above already moves. */}
              {v3Look ? null : <ActivityIndicator size="small" />}
              <Text style={styles.label}>{label}</Text>
            </>
          )}
        </View>
      )}
    </>
  )

  if (!failed) {
    return (
      <View
        style={[styles.bubble, styles.pending]}
        // The ring and the bars show a number; the sentence is for the screen reader.
        {...(v3Look ? { accessible: true, accessibilityLabel: label } : {})}
      >
        {body}
      </View>
    )
  }
  if (v3Look) {
    return (
      <View style={styles.failedRow}>
        <DiscardUnsentButton onPress={onDiscard} />
        <NotSentColumnV3
          label={t('chat.notSentTapRetry')}
          onPress={onRetry}
          onLongPress={onLongPress}
        >
          <View style={[styles.bubble, styles.failed]}>{body}</View>
        </NotSentColumnV3>
      </View>
    )
  }
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

/**
 * v3's look for the same bubble, behind `flags.v3Home` with the thread
 * (V-Thread draws your sent bubble, not this one): the sent bubble's shape —
 * v3's tile corner and your side's tail — still drained to an outline, since
 * the message does not exist yet, at v3's two-point weight; the picture close
 * to the edge at the card corner, as a sent one's; the track in v3's ring
 * grey filling in your blue, and v3's type.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  // `bubbleLookV3`'s bubble, tail and all; the frame is the picture's, as there.
  bubble: {
    alignSelf: 'flex-end',
    borderBottomEndRadius: v3.space[8],
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    gap: v3.space[4],
    maxWidth: '78%',
    padding: v3.space[4],
  },
  pending: { borderColor: v3.colors.line },
  // Inside `NotSentColumnV3`, which already caps the width: a second
  // percentage of a column sized by its child resolves against nothing.
  failed: { borderColor: v3.colors.danger, maxWidth: '100%' },
  failedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.7 },
  image: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    overflow: 'hidden',
    width: 220,
  },
  imageUnmeasured: { height: 220 },
  veil: {
    ...({ position: 'absolute' } as const),
    backgroundColor: v3.colors.scrim,
    borderRadius: v3.radius.card,
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  progressOverlay: { alignItems: 'center', justifyContent: 'center' },
  // The view-once card's row; a voice note is `PendingVoiceNoteV3`'s own.
  audioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    minWidth: 180,
    padding: v3.space[6],
  },
  track: {
    backgroundColor: v3.colors.track,
    borderRadius: v3.radius.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  trackFill: { borderRadius: v3.radius.pill, height: 4 },
  viewOnceTitle: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  caption: {
    ...v3.type.body,
    color: v3.colors.fg,
    lineHeight: 23,
    paddingBottom: v3.space[6],
    paddingHorizontal: v3.space[10],
  },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[4],
    paddingBottom: v3.space[4],
    paddingHorizontal: v3.space[6],
  },
  label: { ...v3.type.caption, color: v3.colors.muted, fontVariant: ['tabular-nums'] },
  failedLabel: { ...v3.type.caption, color: v3.colors.danger },
}))
