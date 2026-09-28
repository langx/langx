import { useEvent, useEventListener } from 'expo'
import * as SplashScreen from 'expo-splash-screen'
import { usePathname } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, View } from 'react-native'
import badge from '../../assets/splash/badge.png'
import introFilm from '../../assets/splash/intro.mp4'
import { useT } from '../i18n'
import { useAppReady } from '../hooks/useAppReady'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { markAppReady } from '../lib/appReady'
import { forgetAudioMode } from '../lib/audioSession'
import { SPLASH_TIMING, canExit, msUntilExitAllowed } from '../lib/splashTiming'
import { OVERLAY_LAYER } from '../lib/overlayLayers'
import { makeStyles } from '../lib/theme'

/**
 * The launch's one colour: the native splash's ground (`backgroundColor` in
 * `app.config.ts`'s `expo-splash-screen` block, both schemes), this layer's
 * first frame, and every pixel of the film's first frame. The three have to be
 * the same yellow for the opening to read as one piece. The film is rendered
 * by `tools/showreel` (`--page splash`); change them together or not at all.
 */
const FILM_GROUND = '#ffc409'

/**
 * Only for reduced motion, where there is no film: the mark on its disc, whose
 * disc is exactly `FILM_GROUND`, so on the yellow ground only the mark shows.
 */
const MARK_SIZE = 160

/**
 * The opening.
 *
 * Mounted on `RootShell`'s first render and *outside* the readiness branch, so
 * there is a JS layer on screen before the native splash is torn down. That
 * ordering is the whole no-flash story; see `onLayout` below.
 *
 * It outlives the redirect chain — `index` deciding between onboarding, the
 * welcome-back screen and the app, or `(auth)/index` reading the intro flag —
 * because it sits above the navigator rather than inside a screen.
 *
 * The sequence: the plain yellow the OS drew, and on it, as soon as the native
 * splash is gone, a film of the hellos streaming in and bending into the mark
 * (`intro.mp4`, whose first frame is the same yellow). When the film is over
 * and the app is ready, the whole layer fades off the app. There used to be a
 * badge on white first and a yellow disc growing out of it; the owner saw that
 * as two openings, one after the other, and asked for only this one.
 *
 * With reduced motion there is no film: the mark sits still on the yellow and
 * dissolves.
 */
export function AppSplash() {
  const styles = useStyles()
  const t = useT()
  const ready = useAppReady()
  const reduceMotion = useReduceMotion()
  const pathname = usePathname()

  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)
  /**
   * The film is only mounted after the first commit. The web build is a
   * static export, and this renders during its prerender, where a `<video>`
   * in the HTML would start downloading before the app that owns it exists.
   */
  const [filmMounted, setFilmMounted] = useState(false)
  /**
   * The native splash has been asked to go. The film does not start before
   * then: on Android the native view leaves last, and anything that moves
   * under it is played to nobody.
   */
  const [nativeGone, setNativeGone] = useState(false)
  const [filmFrame, setFilmFrame] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const mountedAt = useRef(Date.now())
  const exitStarted = useRef(false)

  /** The whole layer, film included: what the exit fades. */
  const layer = useRef(new Animated.Value(1)).current
  /** Reduced motion only: the still mark, which leaves before the ground does. */
  const mark = useRef(new Animated.Value(1)).current

  const finishIntro = useCallback(() => setIntroDone(true), [])
  const showFilm = useCallback(() => setFilmFrame(true), [])

  /** Nothing signalled. One-way, so it can only ever be early, never wrong. */
  useEffect(() => {
    const timer = setTimeout(markAppReady, SPLASH_TIMING.TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setFilmMounted(true)
  }, [])

  /*
   * Both gates resolve to "/" — expo-router strips group segments, so
   * `app/(auth)/index.tsx` is "/" as well. Any other path means both of them
   * are already behind us: a deep link, a notification, a restored route.
   */
  useEffect(() => {
    if (pathname !== '/') markAppReady()
  }, [pathname])

  /*
   * A film that fails before the native splash has gone is still only over
   * once it has: otherwise the layer could fade off before the OS's own splash
   * is down, and the app would appear from behind a yellow that then vanishes.
   */
  const filmOver = introDone && nativeGone

  useEffect(() => {
    if (exitStarted.current || !canExit({ ready, introDone: filmOver, reduceMotion })) return
    const done = ({ finished }: { finished: boolean }) => {
      if (!finished) return
      // The film's player has had the audio session; see forgetAudioMode.
      forgetAudioMode()
      setVisible(false)
    }

    if (!reduceMotion) {
      exitStarted.current = true
      setExiting(true)
      // One fade for everything, film and all: the app is revealed from
      // behind the finished mark, not from behind a layer taken apart piece
      // by piece.
      Animated.timing(layer, {
        toValue: 0,
        duration: SPLASH_TIMING.EXIT_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(done)
      return
    }

    /*
     * Marked as started only when it really starts. The effect can re-run
     * while the floor is still being waited out — reduced motion switched on
     * mid-opening changes `filmOver` a render later — and the cleanup clears
     * the timer; a flag set before it fired would then refuse to schedule
     * another, and the layer would stay up over a ready app for good.
     */
    const timer = setTimeout(
      () => {
        exitStarted.current = true
        setExiting(true)
        Animated.parallel([
          Animated.timing(mark, {
            toValue: 0,
            duration: SPLASH_TIMING.EXIT_TILE_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Last, and still going after the mark has gone, so the app is never
          // revealed from underneath a logo that is still on screen.
          Animated.timing(layer, {
            toValue: 0,
            duration: SPLASH_TIMING.EXIT_GROUND_MS,
            delay: SPLASH_TIMING.EXIT_GROUND_DELAY_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(done)
      },
      msUntilExitAllowed(mountedAt.current, Date.now()),
    )
    return () => clearTimeout(timer)
  }, [ready, filmOver, reduceMotion, layer, mark])

  /**
   * The one place the native splash is allowed to go: after this layer has been
   * laid out, plus a frame, so there is never a moment with neither on screen.
   * Rejects harmlessly if it has already auto-hidden.
   */
  const onLayout = useCallback(() => {
    requestAnimationFrame(() => {
      void SplashScreen.hideAsync()
        .catch(() => undefined)
        .finally(() => setNativeGone(true))
    })
  }, [])

  if (!visible) return null

  const withFilm = filmMounted && !reduceMotion
  /**
   * The film sits at the bottom of the layer and is uncovered, not faded in:
   * once it has drawn its first frame — the same yellow — the ground above it
   * is taken away in one commit. Until then it is under that opaque ground,
   * which is what keeps a surface that has not drawn yet from ever being seen.
   */
  const filmShown = withFilm && filmFrame

  return (
    <Animated.View
      testID="app-splash"
      onLayout={onLayout}
      pointerEvents={exiting ? 'none' : 'auto'}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.oneMoment')}
      style={[StyleSheet.absoluteFill, styles.layer, { opacity: layer }]}
    >
      {withFilm && <IntroFilm covered={nativeGone} onFirstFrame={showFilm} onDone={finishIntro} />}

      {!filmShown && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ground]}>
          {reduceMotion && (
            <Animated.View style={[styles.mark, { opacity: mark }]}>
              <Image source={badge} style={styles.markImage} resizeMode="contain" />
            </Animated.View>
          )}
        </View>
      )}
    </Animated.View>
  )
}

/**
 * The film, and every way it can end: played to the last frame, failed to
 * load, not playing `INTRO_WAIT_MS` after the yellow was ready for it, or
 * started and then never finished. Each of those calls `onDone`, which may be
 * called more than once; it only ever sets a flag.
 *
 * Muted, and mixing with other audio rather than taking the session: the
 * film has no sound, and somebody's music or podcast must not stop because
 * an app opened. With `mixWithOthers` expo-video neither requests audio focus
 * on Android nor activates the session on iOS.
 *
 * `textureView` on Android because a `SurfaceView` draws into a surface of its
 * own behind the window, which a parent's opacity does not reliably reach: the
 * film could cut out at the end of the exit instead of dissolving with
 * everything else. No ExoPlayer shutter, or the frame before the first one is
 * black. `playsInline` is for Safari on an iPhone, which otherwise takes a
 * playing video fullscreen.
 */
function IntroFilm({
  covered,
  onFirstFrame,
  onDone,
}: {
  covered: boolean
  onFirstFrame: () => void
  onDone: () => void
}) {
  const styles = useStyles()
  const player = useVideoPlayer(introFilm, (instance) => {
    instance.muted = true
    instance.loop = false
    instance.audioMixingMode = 'mixWithOthers'
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const [playing, setPlaying] = useState(false)
  const started = useRef(false)

  useEventListener(player, 'playToEnd', onDone)
  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'error') onDone()
  })
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) setPlaying(true)
  })

  // Not before the native splash has gone: its first second would play under it.
  useEffect(() => {
    if (!covered || status !== 'readyToPlay' || started.current) return
    started.current = true
    player.play()
  }, [covered, status, player])

  useEffect(() => {
    if (!covered || playing) return
    const timer = setTimeout(onDone, SPLASH_TIMING.INTRO_WAIT_MS)
    return () => clearTimeout(timer)
  }, [covered, playing, onDone])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(onDone, SPLASH_TIMING.INTRO_MS + SPLASH_TIMING.INTRO_STALL_MS)
    return () => clearTimeout(timer)
  }, [playing, onDone])

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: FILM_GROUND }]}
    >
      <VideoView
        player={player}
        style={styles.film}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        useExoShutter={false}
        playsInline
        onFirstFrameRender={onFirstFrame}
      />
    </View>
  )
}

/**
 * What sits *underneath* the splash while it is up: an opaque themed ground and
 * nothing else. It replaces the three copies of the same inline spinner.
 *
 * The spinner only comes back once the splash has actually gone — which, if it
 * has while this is still mounted, means the timeout fired and something is
 * genuinely slow. That is the one case where a spinner says something true.
 */
export function SplashFill({ children }: { children?: ReactNode }) {
  const styles = useStyles()
  const ready = useAppReady()
  if (!ready) return <View style={styles.fill} />
  return (
    <View style={styles.fill}>
      <ActivityIndicator />
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  // Over `react-native-screens`, which a plain later-sibling is not enough
  // for. The number moved to `overlayLayers.ts` when the toast and the banner
  // turned out to need the same thing.
  layer: {
    elevation: OVERLAY_LAYER.splash,
    overflow: 'hidden',
    zIndex: OVERLAY_LAYER.splash,
  },
  ground: { alignItems: 'center', backgroundColor: FILM_GROUND, justifyContent: 'center' },
  fill: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mark: { height: MARK_SIZE, width: MARK_SIZE },
  markImage: { height: '100%', width: '100%' },
  /**
   * Sized, not pinned by its edges: on the web this is a `<video>`, and a
   * replaced element pinned to all four edges keeps its intrinsic size — the
   * film came out 1080 by 1920 CSS pixels with a phone's worth of its top-left
   * corner on screen.
   */
  film: { height: '100%', width: '100%' },
}))
