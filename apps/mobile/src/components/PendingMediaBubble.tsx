import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useT } from '../i18n'
import type { PendingMedia } from '../lib/pendingMedia'
import { percentOf } from '../lib/uploadProgress'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * An attachment that is on its way, drawn where its message will be.
 *
 * Shaped like one of your own bubbles, which is the point: the thing the
 * reader is waiting for is a message, so the waiting should look like one. The
 * picture is the local file the picker returned, so it appears the instant it
 * is chosen rather than after a round trip.
 *
 * A voice note has nothing to show, so it gets the same three-pixel track
 * `AudioBubble` uses for playback, filling instead of playing.
 *
 * When it fails it keeps its place and becomes a button, following the unsent
 * text queue above it. Before this, a failed attachment raised an alert and
 * the picked file was thrown away.
 */
export function PendingMediaBubble({ item, onRetry }: { item: PendingMedia; onRetry: () => void }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const failed = item.progress.phase === 'failed'
  const ratio = item.width && item.height ? item.width / item.height : undefined
  const percent = percentOf(item.progress)

  const body = (
    <>
      {item.kind === 'image' ? (
        <View>
          <Image
            source={{ uri: item.uri }}
            style={[styles.image, ratio ? { aspectRatio: ratio } : styles.imageUnmeasured]}
            contentFit="cover"
          />
          {failed ? null : <View style={styles.veil} />}
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

      <View style={styles.status}>
        {failed ? (
          <>
            <Feather name="alert-circle" size={12} color={colors.danger} />
            <Text style={styles.failedLabel}>{t('chat.notSentRetry')}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" />
            <Text style={styles.label}>
              {/*
                Three states, because there are three waits. "Preparing"
                covers the file being read into memory, which has no number to
                give — `fetch(uri).blob()` reads the whole thing before a byte
                is sent, and 0% through it would be a lie that looks like a
                stall. Then the real percentage. Then the socket round-trip
                that turns the bytes into a message, which is not an upload
                and should not claim to be one.
              */}
              {item.progress.phase === 'reading'
                ? t('chat.preparingUpload')
                : item.progress.phase === 'sending'
                  ? t('chat.sendingAttachment')
                  : t('chat.uploadingPercent', { percent })}
            </Text>
          </>
        )}
      </View>
    </>
  )

  if (!failed) return <View style={[styles.bubble, styles.pending]}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chat.notSentRetry')}
      onPress={onRetry}
      style={({ pressed }) => [styles.bubble, styles.failed, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  bubble: {
    alignSelf: 'flex-end',
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.xs,
    maxWidth: '82%',
    padding: spacing.sm,
  },
  // Your own side, drained: the message does not exist yet, so it does not get
  // the accent fill a sent one has.
  pending: { borderColor: colors.border },
  failed: { borderColor: colors.danger },
  pressed: { opacity: 0.7 },
  image: { backgroundColor: colors.fill, borderRadius: radius.md, width: 220 },
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
  audioRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 180 },
  // The same three pixels `AudioBubble` plays along; here it fills instead.
  track: { backgroundColor: colors.border, borderRadius: 2, flex: 1, height: 3 },
  trackFill: { borderRadius: 2, height: 3 },
  status: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  label: { ...font.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  failedLabel: { ...font.caption, color: colors.danger },
}))
