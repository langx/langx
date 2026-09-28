import { useEvent, useEventListener } from 'expo'
import * as SplashScreen from 'expo-splash-screen'
import { usePathname } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import darkBadge from '../../assets/splash/badge-dark.png'
import defaultBadge from '../../assets/splash/badge.png'
import introFilm from '../../assets/splash/intro.mp4'
import { useT } from '../i18n'
import { useAppReady } from '../hooks/useAppReady'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { markAppReady } from '../lib/appReady'
import { forgetAudioMode } from '../lib/audioSession'
import { SPLASH_TIMING, canExit, discDiameter, msUntilExitAllowed } from '../lib/splashTiming'
import { OVERLAY_LAYER } from '../lib/overlayLayers'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * Must equal `imageWidth` in `app.config.ts`'s `expo-splash-screen` block. One
 * number in two files, because that file is evaluated by Node and cannot
 * import from here — and if the two drift, the badge jumps size at the exact
 * moment the handover is supposed to be invisible.
 */
const TILE_SIZE = 160

/**
 * The ground baked into each badge, so the tile is the right colour for the
 * frame or two before the bitmap decodes — worst case on the web, where it is
 * an HTTP fetch. Properties of these two files rather than palette values, but
 * still read at render time, so `tokens.ts`'s rule about never reading the
 * palette at module scope is not being worked around.
 */
const TILE_GROUND = { light: '#ffc409', dark: '#121318' } as const
const BADGES = { light: defaultBadge, dark: darkBadge } as const

/**
 * The film's ground: every pixel of its first frame, and what the disc has to
 * be for the cut from one to the other to be invisible. A property of
 * `intro.mp4`, like the tile grounds above, so it is the same in both schemes
 * — the film is. It is rendered by `tools/showreel` (`--page splash`); change
 * this and the film together or not at all.
 */
const FILM_GROUND = '#ffc409'

/**
 * The opening.
 *
 * Mounted on `RootShell`'s first render and *outside* the readiness branch, so
 * there is a JS layer on screen before the native splash is torn down. That
 * ordering is the whole no-flash story; see `onLayout` below.
 *
 * It outlives the redirect chain — `index` deciding between onboarding, the
 * welcome-back screen and the app, or `(auth)/index` reading the intro flag —
 * because it sits above the navigator rather than inside a screen. Before
 * this, a cold start was a blank window, then a spinner, then a second
 * spinner, then something to look at.
 *
 * The sequence: the badge, exactly as the OS drew it; a yellow disc growing
 * out of its centre until it is the whole screen; on that yellow, a film of
 * the hellos streaming in and bending into the mark (`intro.mp4`, whose first
 * frame is the same yellow); then, once the film is over and the app is ready,
 * the whole layer fades off the app. With reduced motion there is no disc and
 * no film — the badge holds, and dissolves.
 *
 * Everything animated here is a transform or an opacity, so all of it is on
 * the native driver. That is not a micro-optimisation on this screen: the JS
 * thread during a cold start is the busiest it will ever be, and an animation
 * driven from it would stutter precisely while it is the only thing visible.
 */
export function AppSplash() {
  const styles = useStyles()
  const { colors, scheme } = useTheme()
  const t = useT()
  const ready = useAppReady()
  const reduceMotion = useReduceMotion()
  const pathname = usePathname()
  /**
   * The layer's own size, from its layout, for the disc. Not
   * `useWindowDimensions`: on the web build this renders first in the static
   * export's prerender, where the window is 0x0, and hydration keeps that
   * answer — the disc came out two pixels wide and the film appeared from
   * behind a badge that had not been covered.
   */
  const [size, setSize] = useState({ width: 0, height: 0 })

  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)
  /**
   * The film is only mounted after the first commit. The web build is a
   * static export, and this renders during its prerender, where a `<video>`
   * in the HTML would start downloading before the app that owns it exists.
   */
  const [filmMounted, setFilmMounted] = useState(false)
  const [covered, setCovered] = useState(false)
  const [filmFrame, setFilmFrame] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const mountedAt = useRef(Date.now())
  const exitStarted = useRef(false)

  /** The whole layer, film included: what the exit fades. */
  const layer = useRef(new Animated.Value(1)).current
  /**
   * The badge is opaque, unscaled and perfectly still on the first frame, and
   * only moves on the way out, and only with reduced motion on.
   *
   * It is already on screen when this mounts — the OS drew it, at this size,
   * from the same file — so the handover is a frame where the two pictures are
   * meant to be identical. Every entrance the badge could be given makes that
   * frame the one moment the logo visibly moves. The spring from 0.96 that
   * used to be here was exactly that: a 4% dip and a bounce, landing on the
   * frame most likely to be dropped, which is a pop with no cause the reader
   * can see. What moves first now is the disc, after `HOLD_MS`.
   */
  const opacity = useRef(new Animated.Value(1)).current
  /**
   * The yellow disc, 0 to 1 of a diameter that reaches the window's corners.
   *
   * It grows from the badge's centre, so it eats the mark from the middle
   * outward, then the badge's own disc, then the ground — which on a dark
   * phone is ink, so the brand colour arrives as the thing that fills the
   * screen rather than as a flash.
   */
  const disc = useRef(new Animated.Value(0)).current
  /**
   * The native splash has been asked to go. Nothing moves before it has: on
   * Android it covered the first half-second of the disc, which then played
   * out unseen behind it.
   */
  const [nativeGone, setNativeGone] = useState(false)

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
   * `useReduceMotion` answers asynchronously and starts at false, so on a
   * phone with reduced motion on this can begin before the answer arrives.
   * The hold makes that a still badge rather than a disc starting to grow, and
   * if the answer lands later still, the cleanup puts the badge back.
   *
   * Eased in: the disc starts gently over the mark and is travelling fastest
   * as it leaves the screen, so the part the eye is on is the part that is slow.
   */
  useEffect(() => {
    if (reduceMotion || !nativeGone) return
    let growing: Animated.CompositeAnimation | null = null
    const timer = setTimeout(() => {
      growing = Animated.timing(disc, {
        toValue: 1,
        duration: SPLASH_TIMING.DISC_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      })
      growing.start(({ finished }) => {
        if (finished) setCovered(true)
      })
    }, SPLASH_TIMING.HOLD_MS)
    return () => {
      clearTimeout(timer)
      growing?.stop()
      disc.setValue(0)
      setCovered(false)
    }
  }, [reduceMotion, nativeGone, disc])

  /*
   * A film that fails before the yellow is up — a missing file errors within
   * a few hundred milliseconds — is still only over once the disc has covered
   * the screen. Otherwise the layer fades straight off the badge the moment
   * the app is ready, a flash of logo with no floor under it; this way every
   * opening without a film still leaves from the yellow.
   */
  const filmOver = introDone && covered

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
          Animated.timing(opacity, {
            toValue: 0,
            duration: SPLASH_TIMING.EXIT_TILE_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Last, and still going after the badge has gone, so the app is never
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
  }, [ready, filmOver, reduceMotion, layer, opacity])

  /**
   * The one place the native splash is allowed to go: after this layer has been
   * laid out, plus a frame, so there is never a moment with neither on screen.
   * Rejects harmlessly if it has already auto-hidden.
   */
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize({ width, height })
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
   * once the disc has covered the screen and the film has drawn its first
   * frame — the same yellow — everything above it is taken away in one
   * commit. Until then it is under an opaque ground, which is what keeps a
   * surface that has not drawn yet from ever being seen.
   */
  const filmShown = withFilm && covered && filmFrame
  const diameter = discDiameter(size.width, size.height)

  return (
    <Animated.View
      testID="app-splash"
      onLayout={onLayout}
      pointerEvents={exiting ? 'none' : 'auto'}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.oneMoment')}
      style={[StyleSheet.absoluteFill, styles.layer, { opacity: layer }]}
    >
      {withFilm && <IntroFilm covered={covered} onFirstFrame={showFilm} onDone={finishIntro} />}

      {!filmShown && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.centred, { backgroundColor: colors.bg }]}
        >
          <Animated.View style={[styles.tile, { backgroundColor: TILE_GROUND[scheme], opacity }]}>
            <Image source={BADGES[scheme]} style={styles.badge} resizeMode="contain" />
          </Animated.View>

          {!reduceMotion && (
            // Drawn at the badge's size and scaled up to the diameter, so the
            // view is small whatever the window, and scale 1 is the badge's
            // own disc.
            <Animated.View
              style={[
                styles.disc,
                {
                  transform: [
                    {
                      scale: disc.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, diameter / TILE_SIZE],
                      }),
                    },
                  ],
                },
              ]}
            />
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

  // Not before the yellow is up: its first second would play under the disc.
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
  centred: { alignItems: 'center', justifyContent: 'center' },
  /**
   * Badge-sized and grown by a transform, rather than by its width — a
   * layout-animated circle is a reflow every frame, off the native driver, on
   * the busiest thread of the launch.
   */
  disc: {
    backgroundColor: FILM_GROUND,
    borderRadius: TILE_SIZE / 2,
    height: TILE_SIZE,
    position: 'absolute',
    width: TILE_SIZE,
  },
  fill: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  tile: {
    borderRadius: TILE_SIZE / 2,
    height: TILE_SIZE,
    overflow: 'hidden',
    width: TILE_SIZE,
  },
  badge: { height: '100%', width: '100%' },
  /**
   * Sized, not pinned by its edges: on the web this is a `<video>`, and a
   * replaced element pinned to all four edges keeps its intrinsic size — the
   * film came out 1080 by 1920 CSS pixels with a phone's worth of its top-left
   * corner on screen.
   */
  film: { height: '100%', width: '100%' },
}))
