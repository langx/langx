import { Image } from 'expo-image'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../hooks/useReduceMotion'
import type { PendingPhoto } from '../hooks/useProfilePhotoUploads'
import { useT } from '../i18n'
import { makeStyles } from '../lib/theme'
import { percentOf } from '../lib/uploadProgress'

interface PendingPhotoTileProps {
  photo: PendingPhoto
  size: number
  onRetry: () => void
  onDiscard: () => void
}

/**
 * A photo the gallery already has on screen but the server does not yet.
 *
 * The picture itself is drawn from the local `uri` immediately — the tile is
 * not a grey box waiting for a round-trip. Over it goes the same scrim and
 * tabular percentage `AttachmentPreview` uses, so an upload looks the same
 * wherever it happens in the app. What replaced the whole of this was a "+"
 * that turned into an ellipsis, which said something was happening but not
 * what, and not to which picture.
 *
 * The bar underneath is the only part that animates on its own: `withTiming`
 * smooths the jumps between the progress events, which arrive in chunks and
 * would otherwise step. A failed tile stops animating and becomes a button.
 */
export function PendingPhotoTile({ photo, size, onRetry, onDiscard }: PendingPhotoTileProps) {
  const styles = useStyles()
  const t = useT()
  const reduceMotion = useReduceMotion()
  const failed = photo.progress.phase === 'failed'
  const percent = percentOf(photo.progress)

  const fill = useSharedValue(0)
  useEffect(() => {
    fill.value = reduceMotion ? percent / 100 : withTiming(percent / 100, { duration: 220 })
  }, [percent, reduceMotion, fill])

  const entrance = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (reduceMotion) {
      entrance.value = 1
      return
    }
    entrance.value = withSpring(1, { damping: 12, stiffness: 160 })
  }, [reduceMotion, entrance])

  // Two flex children rather than a percentage width: the pair always sums
  // to one, so the fill cannot drift out of the track as it animates.
  const barStyle = useAnimatedStyle(() => ({ flex: fill.value }))
  const restStyle = useAnimatedStyle(() => ({ flex: 1 - fill.value }))
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ scale: entrance.value }] }))

  return (
    <Animated.View style={tileStyle}>
      <Pressable
        accessibilityRole={failed ? 'button' : 'image'}
        /*
         * The label announces the phase the tile is drawing, not a number the
         * tile is not showing: reading the file into memory has no percentage,
         * and saying "0%" through it would be the same lie the scrim avoids.
         */
        accessibilityLabel={
          failed
            ? t('editProfile.photoRetry')
            : photo.progress.phase === 'reading'
              ? t('editProfile.photoPreparing')
              : t('editProfile.photoUploading', { percent })
        }
        disabled={!failed}
        onPress={onRetry}
        onLongPress={failed ? onDiscard : undefined}
        style={[styles.tile, { borderRadius: 14, height: size, width: size }]}
      >
        <Image source={{ uri: photo.uri }} style={styles.picture} contentFit="cover" />
        <View style={[styles.scrim, failed && styles.scrimFailed]} pointerEvents="none">
          <Text style={styles.label} numberOfLines={1}>
            {failed
              ? t('editProfile.photoRetryShort')
              : photo.progress.phase === 'reading'
                ? t('composer.percentPending')
                : t('composer.percentOnly', { percent })}
          </Text>
        </View>
        {failed ? null : (
          <View style={styles.track} pointerEvents="none">
            <Animated.View style={[styles.trackFill, barStyle]} />
            <Animated.View style={[styles.trackRest, restStyle]} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  tile: { backgroundColor: colors.fill, overflow: 'hidden' },
  picture: { height: '100%', width: '100%' },
  scrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrimFailed: { backgroundColor: 'rgba(229,72,77,0.78)' },
  /*
   * Tabular figures, for the reason `AttachmentPreview` gives: 9%, 49% and
   * 100% are three different widths, and a centred proportional number slides
   * as it counts.
   */
  label: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700' },
  track: { bottom: 0, flexDirection: 'row', height: 3, left: 0, position: 'absolute', right: 0 },
  trackFill: { backgroundColor: colors.primary },
  trackRest: { backgroundColor: 'rgba(255,255,255,0.25)' },
}))
