import Feather from '@expo/vector-icons/Feather'
import { isVideoContentType } from '@langx/shared'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale, useT } from '../i18n'
import { chooseAlert, showAlert } from '../lib/alert'
import {
  AXIS_LOCK_PX,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SCALE,
  MIN_SCALE,
  type Size,
  albumSlots,
  clampOffset,
  dismissDirection,
  dismissProgress,
  fittedSize,
  maxOffset,
  offsetForFocus,
  resist,
  resistScaleChange,
  settleZoom,
  swipeStep,
  zoomAbout,
} from '../lib/pinch'
import { messagePreviewKey } from '../lib/messagePreview'
import { saveMediaToDevice } from '../lib/saveMedia'
import { makeStyles, spacing, useTheme } from '../lib/theme'
import { DURATION, EASE_OUT, SPRING, unlessReduced } from '../lib/theme/motion'
import { IconButton } from './ui/IconButton'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useV3Home } from '../hooks/useV3Home'

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
 * **gesture-handler and Reanimated, and it used to be `PanResponder` and
 * `Animated`** — the same move `SwipeableRow` made, for the same reason and a
 * worse version of it. Every pinch frame was a `setValue` across the bridge,
 * and the arithmetic behind it was absolute: each frame recomputed the offset
 * from the fingers' midpoint alone, so a second pinch on a zoomed picture
 * jumped, a pinch on the black letterbox spent every frame against the clamp
 * with the picture sliding out from under the fingers, and lifting one finger
 * mid-pinch threw the picture to wherever it had been before the pinch began.
 * Now the pinch and the pan are recognised natively on the whole stage —
 * picture and letterbox alike — every frame is applied to where the picture
 * already is (`zoomAbout`, `resist`), and the release is a spring on the UI
 * thread. Anything a gesture callback below calls is a worklet; see
 * `lib/pinch.ts` for why that is not optional.
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
  const { colors } = useTheme()
  const t = useT()
  const v3Look = useV3Home()
  const reduceMotion = useReduceMotion()
  const { isRtl } = useLocale()
  /*
   * A `Modal` is outside every `SafeAreaView` and every `Screen`, so the
   * chrome has to ask for the insets itself. The close button used to sit at
   * a fixed distance from the physical top — inside the status bar, beside
   * the Dynamic Island, on every notched iPhone.
   */
  const insets = useSafeAreaInsets()

  /** The open picture's zoom, and its offset from the frame's centre. */
  const scale = useSharedValue(MIN_SCALE)
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)
  /**
   * Where the strip of three has been dragged to, in pixels. It rests at
   * `-turned * width`, never at zero: the strip is laid out `turned` pages
   * along so that the picture that just slid into the middle *is* the middle
   * once the host has moved the index. Resetting to zero on the new index
   * instead would race the re-render, and whichever of the two landed first
   * would show the wrong picture for a frame.
   */
  const pageX = useSharedValue(0)
  /**
   * `turned` twice: the ref is what the render lays the strip out by, the
   * shared value is the same number for the worklets, which cannot read a ref.
   */
  const turned = useRef(0)
  const turnedAt = useSharedValue(0)

  /**
   * The frame, and what `contentFit="contain"` draws of the open picture in
   * it — the pan bounds. Shared values because the gestures read them on the
   * UI thread; `frame` is kept on this side too for the JS-side page turn.
   */
  const frame = useRef<Size>({ width: 0, height: 0 })
  const frameW = useSharedValue(0)
  const frameH = useSharedValue(0)
  const contentW = useSharedValue(0)
  const contentH = useSharedValue(0)
  /**
   * By URL rather than one size for "the picture": three are mounted, each
   * reports its own size when it loads, and the one in the middle changes
   * without any of them loading again.
   */
  const naturals = useRef(new Map<string, Size>())

  /**
   * What the current one-finger drag is doing, decided on its first frame and
   * kept until it lifts, so a drag that wanders diagonally does not flip
   * between turning the page and dismissing. A pinch always makes it `ZOOM`.
   */
  const panMode = useSharedValue<PanMode>(PAN_IDLE)
  const pinching = useSharedValue(false)
  const panning = useSharedValue(false)
  /**
   * 0 until a dismissal is committed, then 1 over the throw: the backdrop and
   * the chrome finish fading on it, so the picture leaves an empty screen
   * rather than a scrim that vanishes in one frame after it.
   */
  const leaving = useSharedValue(0)

  /**
   * A spring that does not follow a finger — a settle, a double tap — or,
   * with reduce motion on, the value it would have ended on (`unlessReduced`).
   */
  function settleTo(to: number): number {
    'worklet'
    return unlessReduced(reduceMotion, to, (value) => withSpring(value, SPRING.snap))
  }

  /**
   * The page turn runs on the JS side and outlives the render that started
   * it, so anything it needs from props has to be read through a ref that
   * every render rewrites.
   */
  const latest = useRef({ index, photos, onIndexChange })
  latest.current = { index, photos, onIndexChange }

  /** Which picture a save is running or has just finished for. */
  const [saving, setSaving] = useState<{ url: string; phase: 'saving' | 'saved' } | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function syncContent(): void {
    const { index: open, photos: album } = latest.current
    const natural = naturals.current.get(album[open ?? -1]?.url ?? '') ?? { width: 0, height: 0 }
    const fitted = fittedSize(natural, frame.current)
    contentW.set(fitted.width)
    contentH.set(fitted.height)
  }

  function rememberSize(url: string, width: number | undefined, height: number | undefined): void {
    naturals.current.set(url, { width: width ?? 0, height: height ?? 0 })
    syncContent()
  }

  function settleStrip(): void {
    pageX.set(settleTo(-turned.current * frame.current.width))
  }

  /** The end of a page turn, back on the JS side once the slide has landed. */
  function landTurn(to: number, next: number): void {
    turned.current = to
    turnedAt.set(to)
    latest.current.onIndexChange?.(next)
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
    const next = (at + album.length + step) % album.length
    if (reduceMotion) {
      pageX.set(-to * frame.current.width)
      landTurn(to, next)
      return
    }
    pageX.set(
      withTiming(
        -to * frame.current.width,
        // v3 lands the turn on the app's ease-out; the current look keeps its curve.
        v3Look ? { duration: 160, easing: EASE_OUT } : { duration: 160 },
        (finished) => {
          // Cut short by a finger landing mid-slide: the strip is wherever that
          // finger now has it, and its release decides.
          if (finished) runOnJS(landTurn)(to, next)
        },
      ),
    )
  }

  // A new picture starts life-size. Without this, paging while zoomed lands the
  // next one already halfway off the screen.
  useEffect(() => {
    scale.set(MIN_SCALE)
    offsetX.set(0)
    offsetY.set(0)
    leaving.set(0)
    syncContent()
    // Closed: nothing is on screen, so this is the one moment the strip can go
    // back to the start without anyone seeing it move.
    if (index === null) {
      turned.current = 0
      turnedAt.set(0)
      pageX.set(0)
    }
    // Shared values and refs only besides `index`; listing the functions
    // would rebuild this on every render.
  }, [index])

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    [],
  )

  function settleZoomNow(): void {
    'worklet'
    const next = settleZoom(
      { x: offsetX.get(), y: offsetY.get() },
      scale.get(),
      { width: frameW.get(), height: frameH.get() },
      { width: contentW.get(), height: contentH.get() },
    )
    scale.set(settleTo(next.scale))
    offsetX.set(settleTo(next.offset.x))
    offsetY.set(settleTo(next.offset.y))
  }

  function settleStripNow(): void {
    'worklet'
    pageX.set(settleTo(-turnedAt.get() * frameW.get()))
  }

  /**
   * A committed dismissal. In v3 the picture is thrown on the way it was
   * going, off the frame over `DURATION.exit`, and the viewer closes once it
   * is gone; in the current look, and with reduce motion on, it simply closes.
   */
  function dismissNow(direction: -1 | 1): void {
    'worklet'
    if (!v3Look || reduceMotion) {
      runOnJS(onClose)()
      return
    }
    const throwing = { duration: DURATION.exit, easing: EASE_OUT }
    leaving.set(withTiming(1, throwing))
    // Closed whether or not the throw finished: a finger landing mid-throw
    // must not strand an empty viewer on screen.
    offsetY.set(withTiming(direction * frameH.get(), throwing, () => runOnJS(onClose)()))
  }

  const multiple = photos.length > 1

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinching.set(true)
      // A second finger landing mid page-turn or mid-dismiss takes the gesture
      // over; the strip goes back to rest rather than staying half-turned.
      if (panMode.get() === PAN_PAGE) settleStripNow()
      panMode.set(PAN_ZOOM)
    })
    .onChange((event) => {
      const next = zoomAbout(
        { x: offsetX.get(), y: offsetY.get() },
        scale.get(),
        { x: event.focalX - frameW.get() / 2, y: event.focalY - frameH.get() / 2 },
        resistScaleChange(scale.get(), event.scaleChange),
      )
      scale.set(next.scale)
      offsetX.set(next.offset.x)
      offsetY.set(next.offset.y)
    })
    .onEnd(() => {
      pinching.set(false)
      // A finger still down carries on as a pan, and that pan's release settles.
      if (!panning.get()) settleZoomNow()
    })

  const pan = Gesture.Pan()
    // The centroid of every finger down, so going from two fingers to one or
    // back moves the picture by what the fingers did and nothing else.
    .averageTouches(true)
    .onStart(() => {
      panning.set(true)
      panMode.set(pinching.get() || scale.get() > MIN_SCALE ? PAN_ZOOM : PAN_IDLE)
    })
    .onChange((event) => {
      if (panMode.get() === PAN_IDLE) {
        // Not yet: too little travel to tell sideways from down. The web's
        // gesture-handler measures from where the pan was recognised, so its
        // first frame is 0,0 — which read as "not sideways" and made every
        // page turn a dismissal.
        if (Math.hypot(event.translationX, event.translationY) < AXIS_LOCK_PX) return
        // Life-size: a sideways drag through an album is a page turn and the
        // whole strip follows the finger, so the next picture is in view
        // before the gesture is committed to; anything else is a dismissal,
        // and the open picture follows that on its own.
        panMode.set(
          multiple && Math.abs(event.translationX) > Math.abs(event.translationY)
            ? PAN_PAGE
            : PAN_DISMISS,
        )
      }
      if (panMode.get() === PAN_ZOOM) {
        const limit = maxOffset(
          scale.get(),
          { width: frameW.get(), height: frameH.get() },
          { width: contentW.get(), height: contentH.get() },
        )
        offsetX.set(offsetX.get() + resist(offsetX.get(), event.changeX, limit.x))
        offsetY.set(offsetY.get() + resist(offsetY.get(), event.changeY, limit.y))
        return
      }
      if (panMode.get() === PAN_PAGE) {
        pageX.set(-turnedAt.get() * frameW.get() + event.translationX)
        return
      }
      offsetY.set(event.translationY)
      offsetX.set(event.translationX / 3)
    })
    .onEnd((event) => {
      panning.set(false)
      const mode = panMode.get()
      panMode.set(PAN_IDLE)
      // Still pinching: the pinch's release settles.
      if (pinching.get()) return
      if (mode === PAN_PAGE) {
        // gesture-handler reports px/s; `swipeStep` is in px/ms like the rest.
        const step = swipeStep(event.translationX, event.translationY, event.velocityX / 1000)
        if (step !== 0) runOnJS(turn)(step)
        else settleStripNow()
        return
      }
      if (mode === PAN_DISMISS) {
        // Far enough, or flicked away: see `dismissDirection`.
        const direction = dismissDirection(event.translationY, event.velocityY)
        if (direction !== 0) {
          dismissNow(direction)
          return
        }
      }
      settleZoomNow()
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(DOUBLE_TAP_MS)
    .onEnd((event, success) => {
      if (!success) return
      if (scale.get() > MIN_SCALE) {
        scale.set(settleTo(MIN_SCALE))
        offsetX.set(settleTo(0))
        offsetY.set(settleTo(0))
        return
      }
      // Zoomed about the point tapped, so the face somebody tapped stays
      // under their finger rather than walking off the edge.
      const focus = { x: event.x - frameW.get() / 2, y: event.y - frameH.get() / 2 }
      const offset = clampOffset(
        offsetForFocus(focus, DOUBLE_TAP_SCALE),
        DOUBLE_TAP_SCALE,
        { width: frameW.get(), height: frameH.get() },
        { width: contentW.get(), height: contentH.get() },
      )
      scale.set(settleTo(DOUBLE_TAP_SCALE))
      offsetX.set(settleTo(offset.x))
      offsetY.set(settleTo(offset.y))
    })

  /*
   * A single tap closes, but only once a second one can no longer arrive —
   * `Exclusive` holds it until the double tap has failed. Acting immediately
   * would make double-tap-to-zoom unreachable: the viewer would already be
   * gone. Zoomed, a tap does nothing, so a stray one does not throw away the
   * spot somebody zoomed in on.
   */
  const singleTap = Gesture.Tap().onEnd((_event, success) => {
    if (success && scale.get() <= MIN_SCALE) runOnJS(onClose)()
  })

  /*
   * Holding a finger on the picture offers to save it, the gesture every
   * gallery app has taught people. In the race with everything else: a finger
   * that moves is a pan or a pinch and cancels it, and one that is held is no
   * longer a tap, so it never closes the viewer on the way.
   *
   * On the web the sheet waits for the finger to lift. Opened while it is
   * still down, the browser's click for that same touch lands on whatever
   * the sheet has just put under it — the Save row — and saves without being
   * asked. Native platforms keep a touch with the view it began on, so there
   * the sheet can appear while the finger is held, as it does elsewhere.
   */
  const longPress = Gesture.LongPress()
    .onStart(() => {
      if (!SHEET_ON_RELEASE && !pinching.get()) runOnJS(offerSave)()
    })
    .onEnd((_event, success) => {
      if (SHEET_ON_RELEASE && success && !pinching.get()) runOnJS(offerSave)()
    })

  const gesture = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    longPress,
    Gesture.Exclusive(doubleTap, singleTap),
  )

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pageX.get() }] }))
  /*
   * How far a life-size picture has been dragged towards closing. Only at
   * life size: there the picture fits and has no pan, so an offset means a
   * dismissal; zoomed, an offset is somebody looking around. The current
   * look keeps its fixed scrim.
   */
  const dismissAt = (): number => {
    'worklet'
    if (!v3Look || Math.abs(scale.get() - MIN_SCALE) > 0.001) return 0
    return dismissProgress(offsetY.get(), frameH.get())
  }
  const openStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.get() },
      { translateY: offsetY.get() },
      // The picture eases back from the screen as it is pulled.
      { scale: scale.get() * interpolate(dismissAt(), [0, 1], [1, DISMISS_SCALE]) },
    ],
  }))
  // The screen behind shows through as the picture is pulled, as far as
  // `DISMISS_SCRIM` while the finger is down, then the rest with the throw.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissAt(), [0, 1], [1, DISMISS_SCRIM]) * (1 - leaving.get()),
  }))
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: (1 - dismissAt()) * (1 - leaving.get()),
  }))

  if (index === null) return null
  const photo = photos[index]
  if (!photo) return null
  const slots = albumSlots(index, photos.length)
  const savePhase = saving?.url === photo.url ? saving.phase : null

  /** The long-press sheet: one row, which does what the disc does. */
  async function offerSave(): Promise<void> {
    const { index: open, photos: album } = latest.current
    const media = album[open ?? -1]
    if (!media) return
    const kind = isVideoContentType(media.contentType ?? '') ? 'video' : 'image'
    const choice = await chooseAlert(t(messagePreviewKey(kind)), undefined, [
      { label: t('photo.save'), value: 'save', icon: 'download' },
    ])
    if (choice === 'save') await save(media)
  }

  async function save(media: { url: string; contentType?: string }): Promise<void> {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaving({ url: media.url, phase: 'saving' })
    const clear = () => setSaving((current) => (current?.url === media.url ? null : current))
    try {
      if ((await saveMediaToDevice(media)) === 'denied') {
        clear()
        await showAlert(t('photo.saveFailed'), t('photo.saveDenied'))
        return
      }
    } catch {
      clear()
      await showAlert(t('photo.saveFailed'), t('common.retry'))
      return
    }
    /*
     * Confirmed here, on the button, rather than with a toast: `ToastHost` is
     * mounted at the root, and a `Modal` is drawn above everything at the root,
     * so a toast would land behind the very viewer it is about. A failure is
     * an alert, which is a `Modal` of its own and does show on top.
     */
    setSaving({ url: media.url, phase: 'saved' })
    AccessibilityInfo.announceForAccessibility(t('photo.saved'))
    savedTimer.current = setTimeout(clear, 1500)
  }

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      // Android's hardware back has to close the viewer, or it closes the
      // screen behind it and the reader loses their place.
      onRequestClose={onClose}
    >
      {/*
        A root of its own: a `Modal` is a separate native window, outside the
        `GestureHandlerRootView` in `app/_layout.tsx`, and without one here
        Android delivers the viewer's gestures to nothing at all.
      */}
      <GestureHandlerRootView style={[styles.backdrop, v3Look && styles.backdropClear]}>
        {/* v3's scrim is a layer of its own, so a dismissing drag can fade it. */}
        {v3Look ? <Animated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} /> : null}
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
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[styles.stage, WEB_NO_TOUCH_ACTION]}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout
                frame.current = { width, height }
                frameW.set(width)
                frameH.set(height)
                // A rotation changes the width a page is, and so where the
                // strip rests.
                pageX.set(-turned.current * width)
                syncContent()
              }}
            >
              {/*
                Three frames wide and laid out `turned` pages along, in percent
                so it needs no measurement before the first draw. Together with
                `pageX` resting at `-turned * width` the middle slot always sits
                in the middle; see `pageX` for why the two are kept in step
                rather than both reset.
              */}
              <Animated.View
                style={[styles.strip, { left: `${(turned.current - 1) * 100}%` }, stripStyle]}
              >
                {slots.map((slot) => {
                  const neighbour = slot.at === null ? null : photos[slot.at]
                  if (slot.at === index) {
                    return (
                      <Animated.View key={slot.key} style={[styles.slot, openStyle]}>
                        <Image
                          source={{ uri: photo.url }}
                          style={styles.full}
                          contentFit="contain"
                          onLoad={(event) =>
                            rememberSize(photo.url, event.source?.width, event.source?.height)
                          }
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
                          onLoad={(event) =>
                            rememberSize(neighbour.url, event.source?.width, event.source?.height)
                          }
                        />
                      ) : null}
                    </Animated.View>
                  )
                })}
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}

        {/*
          The chrome sits on a layer of its own above the stage. `zIndex` on
          the discs alone was not enough everywhere: react-native-web paints a
          transformed sibling over them, and Android wants `elevation` before it
          reorders touch targets. `box-none` keeps the layer itself out of the
          way, so a tap between the controls still reaches the picture — and
          because the stage is a sibling rather than an ancestor, a touch that
          starts on a disc never reaches the stage's gestures at all.
        */}
        <Animated.View style={[styles.chrome, chromeStyle]} pointerEvents="box-none">
          {v3Look ? (
            // The kit's dark disc, dark in both schemes as the scrim is: the
            // platform's minimum target in place of a 36pt disc and its slop.
            <IconButton
              icon="x"
              iconSize={22}
              look="hue"
              accessibilityLabel={t('photo.close')}
              onPress={onClose}
              hitSlop={DISC_HIT_SLOP}
              style={[styles.discV3, styles.close, { top: insets.top + spacing.sm }]}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('photo.close')}
              style={({ pressed }) => [
                styles.disc,
                styles.close,
                { top: insets.top + spacing.sm },
                pressed && styles.discPressed,
              ]}
              onPress={onClose}
              hitSlop={DISC_HIT_SLOP}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          )}

          {/*
            Whatever is open, photo or video, goes to the phone's gallery — or
            the browser's downloads. Across from ✕ so neither is hit for the
            other.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={savePhase === 'saved' ? t('photo.saved') : t('photo.save')}
            accessibilityState={{ busy: savePhase === 'saving' }}
            disabled={savePhase !== null}
            style={({ pressed }) => [
              styles.disc,
              styles.save,
              { top: insets.top + spacing.sm },
              pressed && styles.discPressed,
            ]}
            onPress={() => void save(photo)}
            hitSlop={DISC_HIT_SLOP}
          >
            {savePhase === 'saving' ? (
              <ActivityIndicator size="small" color={colors.onScrim} />
            ) : (
              <Feather
                name={savePhase === 'saved' ? 'check' : 'download'}
                size={18}
                color={colors.onScrim}
              />
            )}
          </Pressable>

          {photos.length > 1 ? (
            // `box-none` too: the row spans the whole width, and the picture
            // either side of the arrows is still picture.
            <View
              style={[styles.pager, { paddingBottom: insets.bottom + spacing.lg }]}
              pointerEvents="box-none"
            >
              {v3Look ? (
                <IconButton
                  // The row reverses under RTL, so "previous" sits on the right.
                  icon={isRtl ? 'chevron-right' : 'chevron-left'}
                  color={colors.onScrim}
                  accessibilityLabel={t('photo.previous')}
                  onPress={() => turn(-1)}
                  hitSlop={12}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('photo.previous')}
                  onPress={() => turn(-1)}
                  hitSlop={12}
                >
                  <Text style={styles.pagerArrow}>‹</Text>
                </Pressable>
              )}
              <Text style={styles.pagerCount}>
                {t('photo.counter', { index: index + 1, total: photos.length })}
              </Text>
              {v3Look ? (
                <IconButton
                  icon={isRtl ? 'chevron-left' : 'chevron-right'}
                  color={colors.onScrim}
                  accessibilityLabel={t('photo.next')}
                  onPress={() => turn(1)}
                  hitSlop={12}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('photo.next')}
                  onPress={() => turn(1)}
                  hitSlop={12}
                >
                  <Text style={styles.pagerArrow}>›</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

/** What a one-finger drag is doing; see `panMode`. Numbers, because worklets compare them. */
type PanMode = 0 | 1 | 2 | 3
const PAN_IDLE: PanMode = 0
const PAN_ZOOM: PanMode = 1
const PAN_PAGE: PanMode = 2
const PAN_DISMISS: PanMode = 3

/** See `longPress`. */
const SHEET_ON_RELEASE = Platform.OS === 'web'

/** How small the picture gets as it is pulled towards closing (v3). */
const DISMISS_SCALE = 0.9
/** How far the scrim fades while the finger is still down (v3). */
const DISMISS_SCRIM = 0.3

/** A disc's diameter and the slop around it; 36 + 12 + 12 is the platform's 44pt target and then some. */
const DISC_SIZE = 36
const DISC_HIT_SLOP = 12

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // `relative`, so the chrome's z-order is decided against this and not
  // against whatever stacking context the transformed stage creates on web.
  backdrop: {
    backgroundColor: colors.scrimStrong,
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  backdropClear: { backgroundColor: 'transparent' },
  scrim: {
    backgroundColor: colors.scrimStrong,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chrome: { bottom: 0, elevation: 2, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 2 },
  // `hidden`, for the two neighbours: off-screen on native, but on web an
  // overflowing sibling widens the page and hands the browser a scrollbar.
  stage: { flex: 1, overflow: 'hidden', width: '100%' },
  strip: { bottom: 0, flexDirection: 'row', position: 'absolute', top: 0, width: '300%' },
  slot: { flex: 1 },
  // `minHeight: 0`: the web player is a bare `<video>`, and without it a
  // portrait clip grows past the screen; see the view-once screen's note.
  full: { flex: 1, minHeight: 0, width: '100%' },
  /*
   * A disc on a scrim rather than a bare glyph: over a light photo the glyph
   * alone disappeared. 36pt plus the hit slop is the platform's 44pt target.
   */
  disc: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: DISC_SIZE / 2,
    height: DISC_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    width: DISC_SIZE,
  },
  discPressed: { opacity: 0.7 },
  // Only the placing: the kit's target draws its own disc.
  discV3: { position: 'absolute' },
  close: { end: spacing.lg },
  save: { start: spacing.lg },
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
