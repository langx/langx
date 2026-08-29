import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Image } from 'expo-image'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
import { makeStyles, useTheme } from '../lib/theme'

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
export function AudioBubble({ message, mine }: { message: MessageDto; mine: boolean }) {
  const { colors } = useTheme()
  const styles = useStyles()

  const player = useAudioPlayer(message.media?.url ?? null)
  const status = useAudioPlayerStatus(player)

  const total = message.media?.durationSeconds ?? status.duration ?? 0
  const elapsed = status.currentTime ?? 0
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0
  const tint = mine ? colors.primaryText : colors.text

  return (
    <View style={styles.audioRow}>
      <Pressable
        hitSlop={8}
        onPress={() => {
          if (status.playing) {
            player.pause()
            return
          }
          // Replay from the start once it has finished, rather than sitting at
          // the end doing nothing when tapped.
          // `seekTo` is async but `play` does not need to wait for it — the
          // player queues the seek ahead of playback itself.
          if (total > 0 && elapsed >= total - 0.25) void player.seekTo(0)
          player.play()
        }}
      >
        <Text style={[styles.playIcon, { color: tint }]}>{status.playing ? '❚❚' : '▶'}</Text>
      </Pressable>

      <View style={styles.track}>
        <View style={[styles.trackFill, { backgroundColor: tint, width: `${progress * 100}%` }]} />
      </View>

      <Text style={[styles.duration, { color: tint }]}>
        {formatSeconds(status.playing || elapsed > 0 ? elapsed : total)}
      </Text>
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
export function ImageBubble({ message }: { message: MessageDto }) {
  const styles = useStyles()

  const { width, height, url } = message.media ?? {}
  const [measured, setMeasured] = useState<number | null>(null)
  const ratio = width && height ? width / height : measured
  if (!url) return null

  return (
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
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  audioRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 180 },
  playIcon: { fontSize: 16 },
  track: { backgroundColor: 'rgba(128,128,128,0.35)', borderRadius: 2, flex: 1, height: 3 },
  trackFill: { borderRadius: 2, height: 3 },
  duration: { ...font.caption, fontVariant: ['tabular-nums'] },
  image: { backgroundColor: colors.surface, borderRadius: radius.md, width: 220 },
  /** Holds a plausible slot until `onLoad` reports the real shape. */
  imageUnmeasured: { height: 220 },
}))
