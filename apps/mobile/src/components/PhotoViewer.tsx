import { isVideoContentType } from '@langx/shared'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '../i18n'
import { makeStyles, spacing } from '../lib/theme'
import {
  DISMISS_DRAG_PX,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SCALE,
  MIN_SCALE,
  type Point,
  type Size,
  clampOffset,
  clampScale,
  distanceBetween,
  fittedSize,
  isDoubleTap,
  midpointOf,
  offsetForFocus,
  swipeStep,
} from '../lib/pinch'

/**
 * The browser's own pinch-zoom and scroll would fight ours, and unlike
 * `MessageBubble`'s `pan-y` this view wants every axis: it is a modal, there is
 * nothing behind it to scroll.
 *
 * `as unknown as ViewStyle` for the reason `MessageBubble` records at its own
 * copy of this: react-native's `ViewStyle` has no `touchAction` and
 * react-native-web's does, so which of the two a checkout resolves decides
 * whether a plain cast is an error or a redundant one. Going through `unknown`
 * is the one spelling both agree on — and the difference is real enough that
 * this compiled locally and failed in CI.
 */
const WEB_NO_TOUCH_ACTION =
  Platform.OS === 'web' ? ({ touchAction: 'none' } as unknown as ViewStyle) : null

export interface PhotoViewerProps {
  /**
   * `contentType` is optional because a profile gallery has only ever held
   * pictures and has none to give. Anything without one is drawn as one.
   */
  photos: { url: string; contentType?: string }[]
  /** `null` is closed. The index is owned by the host so a list can open at one. */
  index: number | null
  onClose: () => void
  onIndexChange?: (index: number) => void
}

/**
 * The opened video, playing straight away and again after that.
 *
 * Autoplay here and not in the bubble: opening one is the request to watch it,
 * where scrolling past one is not.
 *
 * Looping, like the feed's inline preview and unlike a thread's. What gets
 * posted here is a few seconds of a word being said, and this is the only
 * place it has sound — so the thing somebody opened it for is the thing they
 * will want twice. Ending on a frozen last frame with a scrub bar under it
 * makes them find the start again by hand. The controls are still there for
 * anyone who wants to stop.
 */
function FullscreenVideo({ url }: { url: string }) {
  const styles = useStyles()
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true
    instance.play()
  })

  return (
    <VideoView
      player={player}
      style={styles.full}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  )
}

/**
 * One full-screen picture, zoomable.
 *
 * Split out of `PhotoGallery`, which owned both a thumbnail strip and a viewer
 * and could therefore only be used by something that wanted both. A chat bubble
 * and a feed card want the second half and already have their own first half,
 * and three viewers is three sets of gesture bugs.
 *
 * The gesture is `PanResponder` and `Animated`, for the reason `pinch.ts`
 * records. `evt.nativeEvent.touches` is where the second finger lives —
 * `gestureState` only ever describes the centroid, so a pinch is invisible to
 * it.
 */
export function PhotoViewer({ photos, index, onClose, onIndexChange }: PhotoViewerProps) {
  const styles = useStyles()
  const t = useT()
  /*
   * A `Modal` is outside every `SafeAreaView` and every `Screen`, so the
   * chrome has to ask for the insets itself. The close button used to sit at
   * a fixed distance from the physical top — inside the status bar, beside
   * the Dynamic Island, on every notched iPhone.
   */
  const insets = useSafeAreaInsets()

  const scale = useRef(new Animated.Value(MIN_SCALE)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current

  /**
   * `Animated.Value` cannot be read back synchronously, and a gesture needs the
   * value it is continuing from on every frame. These mirror the three above;
   * everything writes both or neither.
   */
  const rest = useRef({ scale: MIN_SCALE, x: 0, y: 0 })
  const frame = useRef<Size>({ width: 0, height: 0 })
  const natural = useRef<Size>({ width: 0, height: 0 })
  const start = useRef({ distance: 0, scale: MIN_SCALE, x: 0, y: 0, focus: { x: 0, y: 0 } })
  const lastTap = useRef<{ at: number } | null>(null)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * The responder below is created once and keeps the first render's
   * closures, so anything it needs from props has to be read through a ref
   * that every render rewrites. `rest` and friends already work this way for
   * the gesture's own numbers; this is the same for the album.
   */
  const latest = useRef({ index, photos, onIndexChange })
  latest.current = { index, photos, onIndexChange }

  function page(step: number): void {
    const { index: at, photos: album, onIndexChange: change } = latest.current
    if (at === null) return
    change?.((at + album.length + step) % album.length)
  }

  const settle = useCallback(
    (next: { scale: number; x: number; y: number }, animate: boolean) => {
      rest.current = next
      if (animate) {
        Animated.parallel([
          Animated.spring(scale, { toValue: next.scale, useNativeDriver: true, bounciness: 0 }),
          Animated.spring(translateX, { toValue: next.x, useNativeDriver: true, bounciness: 0 }),
          Animated.spring(translateY, { toValue: next.y, useNativeDriver: true, bounciness: 0 }),
        ]).start()
        return
      }
      scale.setValue(next.scale)
      translateX.setValue(next.x)
      translateY.setValue(next.y)
    },
    [scale, translateX, translateY],
  )

  const reset = useCallback(() => settle({ scale: MIN_SCALE, x: 0, y: 0 }, false), [settle])

  // A new picture starts life-size. Without this, paging while zoomed lands the
  // next one already halfway off the screen.
  useEffect(() => {
    natural.current = { width: 0, height: 0 }
    reset()
  }, [index, reset])

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current)
    },
    [],
  )

  function clampTo(offset: Point, at: number): Point {
    return clampOffset(offset, at, frame.current, fittedSize(natural.current, frame.current))
  }

  function toggleZoom(focus: Point): void {
    if (rest.current.scale > MIN_SCALE) {
      settle({ scale: MIN_SCALE, x: 0, y: 0 }, true)
      return
    }
    const next = DOUBLE_TAP_SCALE
    const offset = clampTo(offsetForFocus(focus, next), next)
    settle({ scale: next, ...offset }, true)
  }

  const pan = useRef(
    PanResponder.create({
      // Claimed on touch-down, unlike the list rows: this view is the whole
      // modal, so there is no tap of anyone else's to swallow.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches
        start.current = {
          distance:
            touches.length >= 2 ? distanceBetween(pointOf(touches[0]), pointOf(touches[1])) : 0,
          scale: rest.current.scale,
          x: rest.current.x,
          y: rest.current.y,
          focus: { x: 0, y: 0 },
        }
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches
        if (touches.length >= 2) {
          const a = pointOf(touches[0])
          const b = pointOf(touches[1])
          const spread = distanceBetween(a, b)
          // The second finger can land after the first, so the reference
          // distance is taken here rather than only in `onPanResponderGrant`.
          if (start.current.distance === 0) {
            start.current = { ...start.current, distance: spread, scale: rest.current.scale }
          }
          const centre = midpointOf(a, b)
          const focus = {
            x: centre.x - frame.current.width / 2,
            y: centre.y - frame.current.height / 2,
          }
          const next = clampScale((start.current.scale * spread) / start.current.distance)
          const offset = clampTo(offsetForFocus(focus, next), next)
          rest.current = { scale: next, ...offset }
          scale.setValue(next)
          translateX.setValue(offset.x)
          translateY.setValue(offset.y)
          return
        }

        if (rest.current.scale > MIN_SCALE) {
          const offset = clampTo(
            { x: start.current.x + gesture.dx, y: start.current.y + gesture.dy },
            rest.current.scale,
          )
          rest.current = { ...rest.current, ...offset }
          translateX.setValue(offset.x)
          translateY.setValue(offset.y)
          return
        }

        // Life-size: a sideways drag through an album is a page turn and the
        // picture follows the finger; anything else is a dismissal, and the
        // picture follows that too, so the gesture is visible before it is
        // committed to.
        if (latest.current.photos.length > 1 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          translateX.setValue(gesture.dx)
          translateY.setValue(0)
          return
        }
        translateY.setValue(gesture.dy)
        translateX.setValue(gesture.dx / 3)
      },
      onPanResponderRelease: (event, gesture) => {
        const travelled = Math.hypot(gesture.dx, gesture.dy)
        const now = Date.now()

        if (event.nativeEvent.touches.length === 0 && travelled <= 12) {
          const focus = {
            x: gesture.x0 - frame.current.width / 2,
            y: gesture.y0 - frame.current.height / 2,
          }
          if (isDoubleTap(lastTap.current, now, travelled)) {
            if (tapTimer.current) clearTimeout(tapTimer.current)
            lastTap.current = null
            toggleZoom(focus)
            return
          }
          lastTap.current = { at: now }
          /*
           * A single tap closes, but only once a second one can no longer
           * arrive. Acting immediately would make double-tap-to-zoom
           * unreachable — the viewer would already be gone.
           */
          if (rest.current.scale === MIN_SCALE) {
            if (tapTimer.current) clearTimeout(tapTimer.current)
            tapTimer.current = setTimeout(onClose, DOUBLE_TAP_MS)
          }
          return
        }

        lastTap.current = null

        if (rest.current.scale === MIN_SCALE) {
          const step =
            latest.current.photos.length > 1 ? swipeStep(gesture.dx, gesture.dy, gesture.vx) : 0
          if (step !== 0) {
            // Off the edge it was dragged towards, then the next picture: the
            // `[index]` effect resets the transform, so it lands centred
            // rather than sliding in from wherever this one was let go.
            Animated.timing(translateX, {
              toValue: -step * frame.current.width,
              duration: 160,
              useNativeDriver: true,
            }).start(() => page(step))
            return
          }
          if (Math.abs(gesture.dy) > DISMISS_DRAG_PX) {
            onClose()
            return
          }
          settle({ scale: MIN_SCALE, x: 0, y: 0 }, true)
          return
        }
        settle({ ...rest.current, ...clampTo(rest.current, rest.current.scale) }, true)
      },
      onPanResponderTerminate: () => {
        settle(rest.current, true)
      },
    }),
  ).current

  if (index === null) return null
  const photo = photos[index]
  if (!photo) return null

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android's hardware back has to close the viewer, or it closes the
      // screen behind it and the reader loses their place.
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {isVideoContentType(photo.contentType ?? '') ? (
          /*
           * No pinch and no pan for a video: the gesture layer below exists to
           * zoom a still, and wrapping a player in it would take the drag the
           * scrub bar needs. Full screen with native controls is what a video
           * being "opened" means.
           */
          <View style={styles.stage}>
            <FullscreenVideo url={photo.url} />
          </View>
        ) : (
          <Animated.View
            style={[styles.stage, WEB_NO_TOUCH_ACTION]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout
              frame.current = { width, height }
            }}
            {...pan.panHandlers}
          >
            <Animated.View
              style={[styles.stage, { transform: [{ translateX }, { translateY }, { scale }] }]}
            >
              <Image
                source={{ uri: photo.url }}
                style={styles.full}
                contentFit="contain"
                onLoad={(event) => {
                  natural.current = {
                    width: event.source?.width ?? 0,
                    height: event.source?.height ?? 0,
                  }
                }}
              />
            </Animated.View>
          </Animated.View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('photo.close')}
          style={({ pressed }) => [
            styles.close,
            { top: insets.top + spacing.sm },
            pressed && styles.closePressed,
          ]}
          onPress={onClose}
          hitSlop={12}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {photos.length > 1 ? (
          <View style={[styles.pager, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('photo.previous')}
              onPress={() => page(-1)}
              hitSlop={12}
            >
              <Text style={styles.pagerArrow}>‹</Text>
            </Pressable>
            <Text style={styles.pagerCount}>
              {t('photo.counter', { index: index + 1, total: photos.length })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('photo.next')}
              onPress={() => page(1)}
              hitSlop={12}
            >
              <Text style={styles.pagerArrow}>›</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

function pointOf(touch: { pageX: number; pageY: number } | undefined): Point {
  return { x: touch?.pageX ?? 0, y: touch?.pageY ?? 0 }
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  backdrop: { backgroundColor: colors.scrimStrong, flex: 1, justifyContent: 'center' },
  stage: { flex: 1, width: '100%' },
  full: { flex: 1, width: '100%' },
  /*
   * A disc on a scrim rather than a bare glyph: over a light photo the glyph
   * alone disappeared. 36pt plus the hit slop is the platform's 44pt target.
   */
  close: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: 18,
    end: spacing.lg,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    width: 36,
    zIndex: 1,
  },
  closePressed: { opacity: 0.7 },
  closeText: { color: colors.onScrim, fontSize: 18, fontWeight: '600' },
  pager: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  pagerArrow: { color: colors.onScrim, fontSize: 32 },
  pagerCount: { ...font.caption, color: colors.onScrim, fontVariant: ['tabular-nums'] },
}))
