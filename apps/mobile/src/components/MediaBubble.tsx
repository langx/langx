import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { isImageContentType, isVideoContentType, type Media } from '@langx/shared'
import { audioProgress } from '../lib/audioProgress'
import { ensurePlaybackAudioMode } from '../lib/audioSession'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'
import { SLOW_PLAYBACK_RATE, NORMAL_PLAYBACK_RATE } from '../lib/playbackRate'

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = Math.floor(total % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * A voice note.
 *
 * One player per bubble rather than one shared player: a shared instance means
 * scrolling has to work out which message it currently belongs to, and the
 * common bug is a second tap resuming the wrong message from the wrong offset.
 */
/**
 * Takes the attachment, not the message it came on.
 *
 * A post and a correction carry the same `media` shape as a message, and a
 * second player for the feed would have re-derived the "one `useAudioPlayer`
 * per bubble, deliberately" decision this file exists to record.
 */
export function AudioBubble({ media, mine = false }: { media: Media; mine?: boolean }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const player = useAudioPlayer(media.url)
  const status = useAudioPlayerStatus(player)

  /*
   * Half speed, for the sentence you cannot quite catch.
   *
   * A second, slower recording was the other way to do this, and it costs a
   * schema field, a second upload, a second `assertMediaAllowed` and a ruling
   * on whether it spends a second unit of the media quota — to make somebody
   * say the same thing twice before their voice note is any use. Pitch
   * correction is what makes the cheap version the right one: at 0.5x without
   * it, a slowed voice is a growl and nobody learns pronunciation from a
   * growl.
   *
   * Local state rather than a preference: this is per sentence, not per
   * person. The one you need slowed is the one you did not follow, and the
   * next one is usually fine.
   */
  const [slow, setSlow] = useState(false)
  /** A `play()` that threw; the status alone cannot report one. */
  const [failed, setFailed] = useState(false)

  const { total, elapsed, fraction, canReplay, state } = audioProgress(media, status)
  // Both v3 bubbles are light tints, so the glyphs read in plain `text`; the
  // accent on your own progress is the only mark of whose note it is.
  const tint = mine ? colors.accent : colors.text
  // `unsupported` is a type this platform will not decode; `error` is a load
  // that failed. Both leave nothing to press, and both used to be a button
  // that did nothing at all.
  const broken = failed || state === 'error' || state === 'unsupported'
  const loading = state === 'loading'

  /**
   * Configures the audio session *before* every play, not once at mount.
   *
   * `_layout.tsx` already sets it at start, which covers the reported bug — a
   * note played on a silent-switched iPhone by someone who had not recorded.
   * This second call covers the other direction: `useVoiceRecorder` puts the
   * session into recording mode, and a note played after that would otherwise
   * come out of the earpiece rather than the speaker. `audioSession` memoises,
   * so in the common case this is a no-op.
   */
  const toggle = async (): Promise<void> => {
    if (status.playing) {
      player.pause()
      return
    }
    await ensurePlaybackAudioMode()
    // Replay from the start once it has finished, rather than sitting at
    // the end doing nothing when tapped.
    // `seekTo` is async but `play` does not need to wait for it — the
    // player queues the seek ahead of playback itself.
    if (canReplay) void player.seekTo(0)
    try {
      player.play()
    } catch {
      // A throw here used to be the whole failure: nothing moved, nothing was
      // said, and the button looked identical to one that had worked. The
      // status the bubble already draws carries it now.
      setFailed(true)
    }
  }

  return (
    <View style={styles.audioRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(status.playing ? 'chat.pauseVoiceMessage' : 'chat.playVoiceMessage')}
        accessibilityState={{ disabled: broken }}
        disabled={broken}
        hitSlop={8}
        onPress={() => {
          void toggle()
        }}
      >
        <Text style={[styles.playIcon, { color: broken ? colors.textFaint : colors.text }]}>
          {loading ? '⋯' : status.playing ? '❚❚' : '▶'}
        </Text>
      </Pressable>

      {broken ? (
        <Text style={[styles.unavailable, { color: colors.textFaint }]} numberOfLines={2}>
          {t('chat.voiceMessageUnavailable')}
        </Text>
      ) : (
        <>
          <View style={styles.track}>
            {/*
              An unknown total draws a full-width faint bar rather than a 0%
              one: v1's notes report no duration at all, and a bar frozen at
              zero while the audio plays reads as a broken player.
            */}
            <View
              style={[
                styles.trackFill,
                {
                  backgroundColor: tint,
                  opacity: fraction === null ? 0.35 : 1,
                  width: `${(fraction ?? 1) * 100}%`,
                },
              ]}
            />
          </View>

          <Text style={[styles.duration, { color: colors.textFaint }]}>
            {formatSeconds(status.playing || elapsed > 0 ? elapsed : total)}
          </Text>
        </>
      )}

      {/*
        Marked only when it is on. An always-visible "1x" beside every voice
        note in a thread is a control nobody asked for; the off state is the
        absence of one.
      */}
      {broken ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: slow }}
          accessibilityLabel={t(slow ? 'chat.playAtNormalSpeed' : 'chat.playSlowly')}
          hitSlop={8}
          onPress={() => {
            const next = !slow
            setSlow(next)
            /*
             * `'high'` is not decoration, and it does something different on
             * each platform. iOS reads it as the pitch algorithm and already
             * corrects pitch by default; Android ignores the argument entirely
             * and preserves pitch anyway; **web only turns pitch correction on
             * when this exact value is passed** — `AudioPlayer.web.ts` sets
             * `preservesPitch = (quality === 'high')`, starting from `false`.
             * Drop it and the web build, which is the one at app2, plays a growl.
             *
             * Applied to the live player rather than saved for the next play, so
             * a tap part-way through a word slows that word.
             */
            player.setPlaybackRate(next ? SLOW_PLAYBACK_RATE : NORMAL_PLAYBACK_RATE, 'high')
          }}
        >
          <Text style={[styles.rate, { color: slow ? tint : colors.textFaint }]}>
            {slow ? t('chat.speedSlow') : t('chat.speedNormal')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

/**
 * A shared photo. `expo-image` rather than RN's `Image` for the disk cache —
 * scrolling back through a conversation should not re-download every picture.
 * The aspect ratio comes from the message so the row reserves the right space
 * before the bytes arrive and the list does not jump.
 *
 * When the message carries no dimensions the picture measures itself on load
 * instead of falling back to a square. A fixed 1:1 with `contentFit: cover`
 * does not merely guess wrong, it *crops* — a portrait photo would lose its
 * top and bottom permanently, with no way for the viewer to see the rest.
 * v1's messages have no stored dimensions beyond what the migration could
 * read out of the file header, so this is the path a good number of imported
 * photos take.
 */
export function ImageBubble({ media, onPress }: { media: Media; onPress?: () => void }) {
  const styles = useStyles()
  const t = useT()

  const { width, height, url } = media
  const [measured, setMeasured] = useState<number | null>(null)
  const ratio = width && height ? width / height : measured
  if (!url) return null

  const picture = (
    <Image
      source={{ uri: url }}
      style={[styles.image, ratio ? { aspectRatio: ratio } : styles.imageUnmeasured]}
      contentFit="cover"
      transition={150}
      onLoad={({ source }) => {
        if (ratio || !source.width || !source.height) return
        setMeasured(source.width / source.height)
      }}
    />
  )

  /*
   * Optional, because a chat bubble already is a `Pressable` — it carries the
   * long press for the message menu — and nesting a second one inside it would
   * make the two negotiate for every touch. There the whole bubble opens the
   * viewer; here, on a feed card, the picture is the only part that should.
   */
  if (!onPress) return picture
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('photo.open')} onPress={onPress}>
      {picture}
    </Pressable>
  )
}

/** The width a multi-attachment bubble occupies, and the seam between tiles. */
const GALLERY_WIDTH = 240
const GALLERY_GAP = 2

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  audioRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 180 },
  playIcon: { fontSize: 16 },
  track: { backgroundColor: colors.border, borderRadius: 2, flex: 1, height: 3 },
  trackFill: { borderRadius: 2, height: 3 },
  duration: { ...font.caption, fontSize: 11, fontVariant: ['tabular-nums'] },
  // Takes the track's place rather than sitting under it: the row is one line
  // tall in a bubble, and a note that cannot play has no progress to show.
  unavailable: { ...font.caption, flex: 1, fontSize: 11 },
  // Same size and tabular figures as the duration beside it, so "0:07" and
  // "0.5x" sit on one line without the row shifting when either changes.
  rate: { ...font.caption, fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '600' },
  image: { backgroundColor: colors.fill, borderRadius: radius.md, width: 220 },
  /** Holds a plausible slot until `onLoad` reports the real shape. */
  imageUnmeasured: { height: 220 },
  video: {
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    // Android's VideoView does not clip to the rounded corner on its own.
    overflow: 'hidden',
    width: 220,
  },
  videoFill: { height: '100%', width: '100%' },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GALLERY_GAP,
    overflow: 'hidden',
    width: GALLERY_WIDTH,
  },
  tile: { backgroundColor: colors.fill, borderRadius: radius.sm, overflow: 'hidden' },
  tileFill: { height: '100%', width: '100%' },
  tilePlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // White with a shadow rather than a muted grey: it sits on whatever the
  // first frame happens to be, which is as often bright as dark.
  tilePlayGlyph: {
    color: '#fff',
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
}))

/**
 * A video, in one of two modes.
 *
 * `'controls'` is the thread: `nativeControls` rather than our own — a scrub
 * bar, a mute and a fullscreen button are three things every platform already
 * draws correctly — and **it never autoplays**. A thread of clips that all
 * start as they scroll past is somebody's data allowance and somebody else's
 * quiet carriage, and that reasoning still holds for a conversation.
 *
 * `'preview'` is the feed, and it deliberately does the opposite: muted,
 * looping, no controls, playing only while its post is on screen, with a tap
 * opening it full screen with sound. The two surfaces differ because reading a
 * feed and reading a conversation are different acts — a feed is scanned, and
 * a still frame with no controls in a scanned list reads as a video that is
 * broken. See `docs/decisions.md` → *A video is one file*.
 *
 * `useVideoPlayer` releases the native player when the bubble unmounts, so a
 * long list does not accumulate them.
 *
 * `contain`, not `cover`: `ImageBubble` records why cropping a picture to a
 * guessed shape is worse than letterboxing it, and here the controls would sit
 * over the cropped part as well.
 */
export function VideoBubble({
  media,
  mode = 'controls',
  playing = false,
  onPress,
}: {
  media: Media
  mode?: 'controls' | 'preview'
  /** `'preview'` only: whether this one is on screen right now. */
  playing?: boolean
  onPress?: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const preview = mode === 'preview'
  const player = useVideoPlayer(media.url, (instance) => {
    instance.loop = preview
    instance.muted = preview
  })

  /*
   * Driven from the outside rather than from a viewability check in here: one
   * post can hold several videos, and they have to start and stop together
   * with the post rather than each deciding for itself.
   */
  useEffect(() => {
    if (!preview) return
    if (playing) player.play()
    else player.pause()
  }, [playing, player, preview])

  const { width, height } = media
  // 16:9 when the message carries no dimensions — every phone camera is
  // landscape or portrait video at a standard ratio, and `contain` means a
  // wrong guess letterboxes rather than crops.
  const ratio = width && height ? width / height : 16 / 9

  const view = (
    <VideoView
      player={player}
      style={styles.videoFill}
      contentFit="contain"
      nativeControls={!preview}
      fullscreenOptions={{ enable: !preview }}
      /*
       * In preview mode the tap belongs to the `Pressable` wrapped around
       * this, and a native video surface will happily swallow it — which is
       * why a one-video post could not be opened while a video in a grid,
       * whose tile has an overlay above the surface, always could. With no
       * controls of its own there is nothing here that wants a touch.
       */
      pointerEvents={preview ? 'none' : 'auto'}
    />
  )

  return (
    <View style={[styles.video, { aspectRatio: ratio }]}>
      {preview && onPress ? (
        // Only in preview mode. With native controls on, a `Pressable` around
        // them competes with the scrub bar for the same touch.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('media.playVideo')}
          onPress={onPress}
          style={styles.videoFill}
        >
          {view}
          {/*
            The glyph the grid tile has always had, and the single video never
            did. A preview only plays while its post is on screen, so the rest
            of the time it is a still frame with no controls and nothing to say
            it is a video at all — and before the player is ready it is not
            even a frame, just the box's fill. That is the whole of "the video
            looks broken".
          */}
          {playing ? null : (
            <View style={styles.tilePlay} pointerEvents="none">
              <Text style={styles.tilePlayGlyph}>▶</Text>
            </View>
          )}
        </Pressable>
      ) : (
        view
      )}
    </View>
  )
}

/** A gallery tile's picture: the video, paused on its first frame. */
function VideoTile({ url }: { url: string }) {
  const styles = useStyles()
  const player = useVideoPlayer(url, (instance) => {
    instance.muted = true
  })

  return (
    <VideoView player={player} style={styles.tileFill} contentFit="cover" nativeControls={false} />
  )
}

/**
 * One attachment, or several as a grid.
 *
 * By content type rather than by the message's `type`: a feed post has no type
 * at all, and on a message the server has already checked that the two agree.
 *
 * The grid is square tiles because a row of mixed aspect ratios is a ragged
 * edge, and a gallery is scanned rather than looked at — the full shape is one
 * tap away in the viewer. A single attachment keeps its own proportions, which
 * is the case that is looked at.
 */
export function MediaGallery({
  items,
  mine,
  onOpen,
  videoMode = 'controls',
  videoPlaying = false,
}: {
  items: readonly Media[]
  mine?: boolean
  onOpen?: (index: number) => void
  /** The feed asks for `'preview'`; chat keeps the thread's controls. */
  videoMode?: 'controls' | 'preview'
  videoPlaying?: boolean
}) {
  const styles = useStyles()
  const t = useT()

  const first = items[0]
  if (!first) return null

  if (items.length === 1) {
    if (isVideoContentType(first.contentType)) {
      /*
       * The `onPress` the single-image branch below has always had, and the
       * single-video branch never did: `VideoBubble` had no such prop at all,
       * so a one-video post — the ordinary case — could not be opened full
       * screen anywhere, while a video in a *grid* could.
       */
      return (
        <VideoBubble
          media={first}
          mode={videoMode}
          playing={videoPlaying}
          {...(onOpen ? { onPress: () => onOpen(0) } : {})}
        />
      )
    }
    if (isImageContentType(first.contentType)) {
      return <ImageBubble media={first} {...(onOpen ? { onPress: () => onOpen(0) } : {})} />
    }
    return <AudioBubble media={first} {...(mine !== undefined ? { mine } : {})} />
  }

  // Two columns up to four, three beyond it, so a tile never falls below a
  // third of the bubble's width.
  const columns = items.length <= 4 ? 2 : 3
  const size = (GALLERY_WIDTH - GALLERY_GAP * (columns - 1)) / columns

  return (
    <View style={styles.gallery}>
      {items.map((item, index) => {
        const video = isVideoContentType(item.contentType)
        return (
          <Pressable
            key={`${item.url}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={video ? t('media.playVideo') : t('photo.open')}
            onPress={onOpen ? () => onOpen(index) : undefined}
            style={[styles.tile, { height: size, width: size }]}
          >
            {video ? (
              <>
                {/*
                 * Paused on its first frame, which is the tile's picture. A
                 * grey square with a play glyph was the alternative and it
                 * reads as a video that failed to load. Nothing plays until
                 * the tile is tapped, so the decoders stay idle.
                 */}
                <VideoTile url={item.url} />
                <View style={styles.tilePlay} pointerEvents="none">
                  <Text style={styles.tilePlayGlyph}>▶</Text>
                </View>
              </>
            ) : (
              <Image source={{ uri: item.url }} style={styles.tileFill} contentFit="cover" />
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
