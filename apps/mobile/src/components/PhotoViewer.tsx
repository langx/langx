import { isVideoContentType } from '@langx/shared'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  I18nManager,
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
  albumSlots,
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
 * One full-screen picture, zoomable, with its neighbours mounted either side.
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
 *
 * The album is a strip of three, not one picture swapped for the next. It
 * used to be the latter: a page turn slid the open picture off the screen,
 * showed the scrim for a few frames while the host re-rendered and the next
 * file fetched, then dropped the new one in with no motion at all. Every swipe
 * was a slide, a blink and a pop. With the pictures either side already
 * mounted the next one is on screen before the finger lets go, and it is
 * already decoded by the time it is wanted.
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
   * Where the strip of three has been dragged to, in pixels. It rests at
   * `-turned * width`, never at zero: the strip is laid out `turned` pages
   * along so that the picture that just slid into the middle *is* the middle
   * once the host has moved the index. Resetting to zero on the new index
   * instead would race the re-render, and whichever of the two landed first
   * would show the wrong picture for a frame.
   */
  const pageX = useRef(new Animated.Value(0)).current
  const turned = useRef(0)

  /**
   * `Animated.Value` cannot be read back synchronously, and a gesture needs the
   * value it is continuing from on every frame. These mirror the three above;
   * everything writes both or neither.
   */
  const rest = useRef({ scale: MIN_SCALE, x: 0, y: 0 })
  const frame = useRef<Size>({ width: 0, height: 0 })
  /**
   * By URL rather than one size for "the picture": three are mounted, each
   * reports its own size when it loads, and the one in the middle changes
   * without any of them loading again.
   */
  const naturals = useRef(new Map<string, Size>())
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

  /**
   * Where the close disc sits, in the same window coordinates the gesture
   * reads. Kept in a ref for the reason `latest` is: the responder is built
   * once and would otherwise hold the first render's inset. The gesture
   * layer refuses a touch that starts here, so the disc gets it even on a
   * platform that paints the transformed picture over an absolutely
   * positioned sibling — which is what made the ✕ unreachable once a photo
   * filled the screen.
   */
  const closeZone = useRef({ top: 0, bottom: 0, start: 0, end: 0 })
  closeZone.current = {
    top: insets.top + spacing.sm - CLOSE_HIT_SLOP,
    bottom: insets.top + spacing.sm + CLOSE_SIZE + CLOSE_HIT_SLOP,
    start: spacing.lg - CLOSE_HIT_SLOP,
    end: spacing.lg + CLOSE_SIZE + CLOSE_HIT_SLOP,
  }
  function overClose(x: number, y: number): boolean {
    const zone = closeZone.current
    if (y < zone.top || y > zone.bottom) return false
    const width = frame.current.width
    // `end` is the right edge in a left-to-right layout and the left in Arabic.
    const fromEdge = I18nManager.isRTL ? x : width - x
    return fromEdge >= zone.start && fromEdge <= zone.end
  }

  /** Where `pageX` rests for the strip as it is currently laid out. */
  function stripRest(): number {
    return -turned.current * frame.current.width
  }

  function settleStrip(): void {
    Animated.spring(pageX, { toValue: stripRest(), useNativeDriver: true, bounciness: 0 }).start()
  }

  /**
   * Slide the strip one picture along, then tell the host. The layout below
   * follows `turned`, so the new index draws the same picture in the same
   * place the strip already put it and nothing snaps.
   */
  function turn(step: -1 | 1): void {
    const { index: at, photos: album, onIndexChange: change } = latest.current
    if (at === null || album.length < 2 || !change) {
      settleStrip()
      return
    }
    const to = turned.current + step
    Animated.timing(pageX, {
      toValue: -to * frame.current.width,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Cut short by a finger landing mid-slide: the strip is wherever that
      // finger now has it, and its release decides.
      if (!finished) return
      turned.current = to
      change((at + album.length + step) % album.length)
    })
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
    reset()
    // Closed: nothing is on screen, so this is the one moment the strip can go
    // back to the start without anyone seeing it move.
    if (index === null) {
      turned.current = 0
      pageX.setValue(0)
    }
  }, [index, reset, pageX])

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current)
    },
    [],
  )

  function clampTo(offset: Point, at: number): Point {
    const { index: open, photos: album } = latest.current
    const natural = naturals.current.get(album[open ?? -1]?.url ?? '') ?? { width: 0, height: 0 }
    return clampOffset(offset, at, frame.current, fittedSize(natural, frame.current))
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
      onStartShouldSetPanResponder: (event) =>
        !overClose(event.nativeEvent.pageX, event.nativeEvent.pageY),
      onMoveShouldSetPanResponder: (event) =>
        !overClose(event.nativeEvent.pageX, event.nativeEvent.pageY),
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
        // whole strip follows the finger, so the next picture is in view
        // before the gesture is committed to; anything else is a dismissal,
        // and the open picture follows that on its own.
        if (latest.current.photos.length > 1 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          pageX.setValue(stripRest() + gesture.dx)
          translateX.setValue(0)
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
            turn(step)
            return
          }
          if (Math.abs(gesture.dy) > DISMISS_DRAG_PX) {
            onClose()
            return
          }
          settle({ scale: MIN_SCALE, x: 0, y: 0 }, true)
          settleStrip()
          return
        }
        settle({ ...rest.current, ...clampTo(rest.current, rest.current.scale) }, true)
      },
      onPanResponderTerminate: () => {
        settle(rest.current, true)
        settleStrip()
      },
    }),
  ).current

  if (index === null) return null
  const photo = photos[index]
  if (!photo) return null
  const slots = albumSlots(index, photos.length)

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
            {/*
              Three frames wide and laid out `turned` pages along, in percent
              so it needs no measurement before the first draw. Together with
              `pageX` resting at `-turned * width` the middle slot always sits
              in the middle; see `pageX` for why the two are kept in step
              rather than both reset.
            */}
            <Animated.View
              style={[
                styles.strip,
                { left: `${(turned.current - 1) * 100}%`, transform: [{ translateX: pageX }] },
              ]}
            >
              {slots.map((slot) => {
                const neighbour = slot.at === null ? null : photos[slot.at]
                if (slot.at === index) {
                  return (
                    <Animated.View
                      key={slot.key}
                      style={[
                        styles.slot,
                        { transform: [{ translateX }, { translateY }, { scale }] },
                      ]}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={styles.full}
                        contentFit="contain"
                        onLoad={(event) => {
                          naturals.current.set(photo.url, {
                            width: event.source?.width ?? 0,
                            height: event.source?.height ?? 0,
                          })
                        }}
                      />
                    </Animated.View>
                  )
                }
                // `Animated.View` like the middle one, not `View`: a key that moves
                // between slots of two different types is remounted, picture and all.
                return (
                  <Animated.View key={slot.key} style={styles.slot}>
                    {/* A video next door is left as scrim: it plays only once it is opened. */}
                    {neighbour && !isVideoContentType(neighbour.contentType ?? '') ? (
                      <Image
                        source={{ uri: neighbour.url }}
                        style={styles.full}
                        contentFit="contain"
                        onLoad={(event) => {
                          naturals.current.set(neighbour.url, {
                            width: event.source?.width ?? 0,
                            height: event.source?.height ?? 0,
                          })
                        }}
                      />
                    ) : null}
                  </Animated.View>
                )
              })}
            </Animated.View>
          </Animated.View>
        )}

        {/*
          The chrome sits on a layer of its own above the stage. `zIndex` on
          the disc alone was not enough everywhere: react-native-web paints a
          transformed sibling over it, and Android wants `elevation` before it
          reorders touch targets. `box-none` keeps the layer itself out of the
          way, so a tap between the controls still reaches the picture.
        */}
        <View style={styles.chrome} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.close')}
            style={({ pressed }) => [
              styles.close,
              { top: insets.top + spacing.sm },
              pressed && styles.closePressed,
            ]}
            onPress={onClose}
            hitSlop={CLOSE_HIT_SLOP}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>

          {photos.length > 1 ? (
            <View style={[styles.pager, { paddingBottom: insets.bottom + spacing.lg }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('photo.previous')}
                onPress={() => turn(-1)}
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
                onPress={() => turn(1)}
                hitSlop={12}
              >
                <Text style={styles.pagerArrow}>›</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

/** The disc's diameter and the slop around it; 36 + 12 + 12 is the platform's 44pt target and then some. */
const CLOSE_SIZE = 36
const CLOSE_HIT_SLOP = 12

function pointOf(touch: { pageX: number; pageY: number } | undefined): Point {
  return { x: touch?.pageX ?? 0, y: touch?.pageY ?? 0 }
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // `relative`, so the chrome's z-order is decided against this and not
  // against whatever stacking context the transformed stage creates on web.
  backdrop: {
    backgroundColor: colors.scrimStrong,
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  chrome: { bottom: 0, elevation: 2, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 2 },
  // `hidden`, for the two neighbours: off-screen on native, but on web an
  // overflowing sibling widens the page and hands the browser a scrollbar.
  stage: { flex: 1, overflow: 'hidden', width: '100%' },
  strip: { bottom: 0, flexDirection: 'row', position: 'absolute', top: 0, width: '300%' },
  slot: { flex: 1 },
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
    height: CLOSE_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    width: CLOSE_SIZE,
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
