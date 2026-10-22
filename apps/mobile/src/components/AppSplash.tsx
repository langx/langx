import * as SplashScreen from 'expo-splash-screen'
import { usePathname } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import stamp from '../../assets/splash/stamp.png'
import { useT } from '../i18n'
import { useAppReady } from '../hooks/useAppReady'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { markAppReady } from '../lib/appReady'
import { markLaunchOver } from '../lib/launchOver'
import {
  DISC_SIZE,
  PARTNER_OFFSET,
  PARTNER_SIZE,
  RING_WIDTH,
  SPLASH_TIMING,
  STAMP_PRESS_AT,
  STAMP_PRESS_SCALE,
  msUntilExitAllowed,
  quickRingMs,
} from '../lib/splashTiming'
import { exitDelayMs, stampPlan } from '../lib/launchFilm'
import { FLAG_KEYS, readBoolFlag, setBoolFlag } from '../lib/localFlags'
import { OVERLAY_LAYER } from '../lib/overlayLayers'
import { makeStyles } from '../lib/theme'
import { EASE_OUT, EASE_POP, EASE_RISE } from '../lib/theme/motionAnimated'
import { DURATION } from '../lib/theme/motionValues'
import { v3 } from '../lib/theme/tokens'

/**
 * The launch's look per scheme. `ground` is the native splash's
 * `backgroundColor` in `app.config.ts`'s `expo-splash-screen` block (and its
 * `dark` twin), and this layer's first frame; a test holds the config to these
 * tokens, because the two have to match for the handover to be invisible.
 *
 * Light keeps the brand yellow, so the yellow disc of `stamp.png` sinks into
 * it and only the mark shows until the ring draws the disc's edge. Dark is
 * v3's dark `bg`: a full yellow screen at night was a glare. `ink` is v3's
 * `fg`, not the constant ink, which would vanish on the dark ground.
 */
const LAUNCH = {
  light: {
    ground: v3.light.colors.yellow,
    ink: v3.light.colors.fg,
    partners: [v3.light.hues.lilac, v3.light.hues.mint],
  },
  dark: {
    ground: v3.dark.colors.bg,
    ink: v3.dark.colors.fg,
    partners: [v3.dark.hues.lilac, v3.dark.hues.mint],
  },
} as const

type LaunchCut = { ground: string; ink: string; partners: readonly string[] }

/**
 * Which look to open with. The device's scheme, not the app's theme
 * preference: the native splash can only follow the device, and this layer
 * has to start on the colour the OS just drew. Read once, so a scheme change
 * mid-launch cannot repaint the ground under itself.
 */
function useLaunchCut(): LaunchCut {
  const scheme = useColorScheme()
  const [cut] = useState<LaunchCut>(() =>
    Platform.OS === 'web' ? WEB_CUT : LAUNCH[scheme === 'dark' ? 'dark' : 'light'],
  )
  return cut
}

/**
 * The look on the web. The web build is a static export, so this layer is in
 * the HTML before any script can ask for the scheme, and the prerender has no
 * scheme to ask: a dark-mode visitor was shown the yellow until the app
 * hydrated — and hydration keeps the prerender's colours, so the ring and the
 * partners stayed in their light inks on the dark ground for good.
 * `light-dark()` lets the browser pick every one of them from the first
 * paint; `colorScheme` on the sheet is what it picks by, and its children
 * inherit it. Each rides in the fallback of a variable nothing sets because
 * react-native-web drops a colour it cannot parse, and passes anything
 * starting with `var(` through.
 */
function lightDark(light: string, dark: string): string {
  return `var(--launch-scheme, light-dark(${light}, ${dark}))`
}

const WEB_CUT: LaunchCut = {
  ground: lightDark(LAUNCH.light.ground, LAUNCH.dark.ground),
  ink: lightDark(LAUNCH.light.ink, LAUNCH.dark.ink),
  partners: [
    lightDark(LAUNCH.light.partners[0], LAUNCH.dark.partners[0]),
    lightDark(LAUNCH.light.partners[1], LAUNCH.dark.partners[1]),
  ],
}

const WEB_SCHEME = { colorScheme: 'light dark' } as unknown as ViewStyle

/**
 * How far the sheet reaches past the top and bottom of the screen. Its lifting
 * edge — the rounded corners and the ink line — sits in the bottom bleed, so
 * nothing of it shows until the sheet moves.
 */
const SHEET_BLEED = 40
const SHEET_CORNER = 28
const SHEET_EDGE = 3
const PARTNER_OUTLINE = 3

/**
 * Gives the badge image this long to report itself drawn before the native
 * splash is let go anyway. A layer that never hands over is worse than one
 * frame of plain ground.
 */
const MARK_WAIT_MS = 600

/**
 * The opening: the ink stamp.
 *
 * Mounted on `RootShell`'s first render and *outside* the readiness branch, so
 * there is a JS layer on screen before the native splash is torn down. That
 * ordering is the whole no-flash story; see `handOver` below.
 *
 * It outlives the redirect chain — `index` deciding between onboarding, the
 * welcome-back screen and the app, or `(auth)/index` reading the intro flag —
 * because it sits above the navigator rather than inside a screen.
 *
 * The first frame is the native splash exactly: the same ground and the same
 * `stamp.png` at the same size, centred. On the first launch an ink ring then
 * draws once around the badge, the badge presses down and lifts with an
 * overshoot while a lilac and a mint disc pop out from behind it and tuck back,
 * and once the app is ready too the whole ground lifts off it as one sheet,
 * with the badge riding it. Every later launch holds the first frame until the
 * app is ready, closes the ring and lifts at once; a tap does the same on any
 * launch (`lib/launchFilm.ts`). With reduced motion the badge holds and the
 * layer dissolves.
 *
 * On React Native's `Animated` with the native driver, not Reanimated: this
 * is the launch path, which must not evaluate Reanimated on import (see
 * `lib/theme/motionValues.ts`). The native driver still runs every frame on
 * the UI thread, where a JS thread busy booting the app cannot stall it, so
 * the ring is drawn with transforms (`InkRing`) rather than an SVG stroke,
 * whose dash offset the native driver cannot animate.
 */
export function AppSplash() {
  const styles = useStyles()
  const cut = useLaunchCut()
  const t = useT()
  const ready = useAppReady()
  const reduceMotion = useReduceMotion()
  const pathname = usePathname()
  const { height } = useWindowDimensions()

  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)
  const [laidOut, setLaidOut] = useState(false)
  /** On the web the badge is inline SVG, in the prerendered HTML: drawn from the first paint. */
  const [markDrawn, setMarkDrawn] = useState(Platform.OS === 'web')
  /**
   * The native splash has been asked to go. Nothing moves before then: on
   * Android the native view leaves last, and anything that moves under it is
   * played to nobody.
   */
  const [nativeGone, setNativeGone] = useState(false)
  /** The stored "opening already shown" flag; `undefined` while it is read. */
  const [filmSeen, setFilmSeen] = useState<boolean | undefined>(undefined)
  const [skipped, setSkipped] = useState(false)
  const [stampDone, setStampDone] = useState(false)
  const mountedAt = useRef(Date.now())
  const stampStarted = useRef(false)
  const exitStarted = useRef(false)
  const stampRun = useRef<Animated.CompositeAnimation | null>(null)

  /** The ring, drawn from 0 to 1. */
  const ring = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  /** The partner discs, from tucked (0) to out (1). */
  const partner = useRef(new Animated.Value(0)).current
  /** The sheet, from resting (0) to off the top of the screen (1). */
  const lift = useRef(new Animated.Value(0)).current
  /** Reduced motion only: the whole layer's opacity. */
  const layer = useRef(new Animated.Value(1)).current

  const plan = stampPlan({ seen: filmSeen, skipped, reduceMotion })

  /** Nothing signalled. One-way, so it can only ever be early, never wrong. */
  useEffect(() => {
    const timer = setTimeout(markAppReady, SPLASH_TIMING.TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  /*
   * The stored flag. Written (below) as soon as this launch is known to be the
   * first, not when the stamp ends: "the very first launch" is the launch, and
   * one closed halfway through has had its hello. A store that cannot be read
   * counts as seen: the full opening is not worth holding a launch on.
   */
  useEffect(() => {
    let cancelled = false
    void readBoolFlag(FLAG_KEYS.launchFilmSeen)
      .catch(() => true)
      .then((seen) => {
        if (!cancelled) setFilmSeen(seen)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /*
   * Only once somebody can be watching. A VoIP push cold-starts the app in
   * the background, where nobody sees the opening, and writing then would
   * spend the one full showing on nothing; so a launch that is not active yet
   * writes on its first `active`. With reduce motion on there is no stamp to
   * have seen, and nothing is written.
   */
  const filmWritten = useRef(false)
  useEffect(() => {
    if (filmSeen !== false || reduceMotion || filmWritten.current) return
    const write = () => {
      filmWritten.current = true
      void setBoolFlag(FLAG_KEYS.launchFilmSeen, true)
    }
    if (AppState.currentState === 'active') {
      write()
      return
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || filmWritten.current) return
      write()
      subscription.remove()
    })
    return () => subscription.remove()
  }, [filmSeen, reduceMotion])

  /*
   * Both gates resolve to "/" — expo-router strips group segments, so
   * `app/(auth)/index.tsx` is "/" as well. Any other path means both of them
   * are already behind us: a deep link, a notification, a restored route.
   */
  useEffect(() => {
    if (pathname !== '/') markAppReady()
  }, [pathname])

  /*
   * The one place the native splash is allowed to go: once this layer has
   * been laid out and the badge image has reported itself loaded, plus a
   * frame, so there is never a moment with neither on screen — nor one with
   * the ground and no badge, which is what an image still decoding draws.
   * Rejects harmlessly if it has already auto-hidden.
   */
  useEffect(() => {
    if (markDrawn) return
    const timer = setTimeout(() => setMarkDrawn(true), MARK_WAIT_MS)
    return () => clearTimeout(timer)
  }, [markDrawn])

  useEffect(() => {
    if (!laidOut || !markDrawn) return
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync()
        .catch(() => undefined)
        .finally(() => setNativeGone(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [laidOut, markDrawn])

  /*
   * The first launch's stamp. It waits for the flag to be read rather than
   * starting on the guess: a launch that turns out to be a later one would
   * have to break off a ring halfway, and the frame it holds meanwhile is the
   * native splash's, so the wait is invisible.
   */
  useEffect(() => {
    if (plan !== 'full' || filmSeen === undefined || !nativeGone || stampStarted.current) return
    stampStarted.current = true
    const T = SPLASH_TIMING
    const run = Animated.parallel([
      Animated.timing(ring, {
        toValue: 1,
        delay: T.STAMP_HOLD_MS,
        duration: T.STAMP_RING_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(STAMP_PRESS_AT),
        Animated.timing(scale, {
          toValue: STAMP_PRESS_SCALE,
          duration: T.STAMP_PRESS_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: T.STAMP_RELEASE_MS,
          easing: EASE_POP,
          useNativeDriver: true,
        }),
        Animated.delay(T.STAMP_SETTLE_MS),
      ]),
      // Squeezed out by the press, back in before the sheet may lift.
      Animated.sequence([
        Animated.delay(STAMP_PRESS_AT),
        Animated.timing(partner, {
          toValue: 1,
          duration: T.PARTNER_OUT_MS,
          easing: EASE_POP,
          useNativeDriver: true,
        }),
        Animated.delay(T.PARTNER_HOLD_MS),
        Animated.timing(partner, {
          toValue: 0,
          duration: T.PARTNER_IN_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]),
    ])
    stampRun.current = run
    run.start(({ finished }) => {
      if (finished) setStampDone(true)
    })
  }, [plan, filmSeen, nativeGone, ring, scale, partner])

  useEffect(() => {
    if (exitStarted.current || !ready || !nativeGone) return
    const done = ({ finished }: { finished: boolean }) => {
      if (!finished) return
      setVisible(false)
      markLaunchOver()
    }

    if (plan === 'still') {
      /*
       * Marked as started only when it really starts. The effect can re-run
       * while the floor is still being waited out — a tap changes `skipped` —
       * and the cleanup clears the timer; a flag set before it fired would
       * then refuse to schedule another, and the layer would stay up over a
       * ready app for good.
       */
      const timer = setTimeout(
        () => {
          exitStarted.current = true
          setExiting(true)
          Animated.timing(layer, {
            toValue: 0,
            duration: SPLASH_TIMING.FADE_MS,
            easing: EASE_OUT,
            useNativeDriver: true,
          }).start(done)
        },
        exitDelayMs({ floorMs: msUntilExitAllowed(mountedAt.current, Date.now()), skipped }),
      )
      return () => clearTimeout(timer)
    }

    if (plan === 'full') {
      if (!stampDone) return
      exitStarted.current = true
      setExiting(true)
      Animated.timing(lift, {
        toValue: 1,
        duration: SPLASH_TIMING.LIFT_MS,
        easing: EASE_RISE,
        useNativeDriver: true,
      }).start(done)
      return
    }

    // Quick: from wherever the stamp has got to, if it started at all.
    exitStarted.current = true
    setExiting(true)
    stampRun.current?.stop()
    ring.stopAnimation((drawn) => {
      Animated.parallel([
        Animated.timing(ring, {
          toValue: 1,
          duration: quickRingMs(drawn),
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: DURATION.press,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(partner, {
          toValue: 0,
          duration: DURATION.press,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 1,
          delay: SPLASH_TIMING.QUICK_LIFT_DELAY_MS,
          duration: SPLASH_TIMING.QUICK_LIFT_MS,
          easing: EASE_RISE,
          useNativeDriver: true,
        }),
      ]).start(done)
    })
  }, [ready, nativeGone, plan, stampDone, skipped, ring, scale, partner, lift, layer])

  /*
   * A tap anywhere on the layer: the opening is somebody's to cut short. Only
   * before the sheet starts to lift; `exiting` takes the layer out of the
   * touch system from then on, so a tap mid-lift can never restart it.
   */
  const skip = useCallback(() => setSkipped(true), [])
  const onLayout = useCallback(() => setLaidOut(true), [])
  const onMarkLoad = useCallback(() => setMarkDrawn(true), [])

  if (!visible) return null

  const travel = height + SHEET_BLEED * 2
  const sheetMotion = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) },
    ],
  }

  return (
    <Animated.View
      testID="app-splash"
      onLayout={onLayout}
      pointerEvents={exiting ? 'none' : 'auto'}
      onStartShouldSetResponder={() => true}
      onResponderRelease={skip}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.oneMoment')}
      style={[StyleSheet.absoluteFill, styles.layer, { opacity: layer }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sheet,
          { backgroundColor: cut.ground },
          Platform.OS === 'web' && WEB_SCHEME,
          sheetMotion,
        ]}
      >
        <View style={[styles.edge, { borderColor: cut.ink }]} />
        <View style={styles.center}>
          {cut.partners.map((hue, index) => {
            const way = index === 0 ? -1 : 1
            const offset = partner.interpolate({
              inputRange: [0, 1],
              outputRange: [0, way * PARTNER_OFFSET],
            })
            return (
              <Animated.View
                key={hue}
                style={[
                  styles.partner,
                  {
                    backgroundColor: hue,
                    borderColor: cut.ink,
                    transform: [{ translateX: offset }, { translateY: offset }],
                  },
                ]}
              />
            )
          })}
          <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
            {Platform.OS === 'web' ? (
              <WebStamp />
            ) : (
              <Image source={stamp} style={styles.badgeImage} onLoad={onMarkLoad} />
            )}
            <InkRing progress={ring} color={cut.ink} />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

/**
 * The badge on the web: `stamp.png` as inline SVG, the same geometry (the
 * PNG is rendered from exactly this). The web has no native splash to match,
 * but it has a prerender, and an `Image` there is an empty box until the
 * script that loads it has run — the mark appeared a beat after the yellow.
 * SVG is in the HTML itself, so the first paint already has it.
 *
 * The arcs are the brand mark's, never recoloured: black and white on the
 * yellow disc in both schemes.
 */
function WebStamp() {
  return (
    <Svg width={DISC_SIZE} height={DISC_SIZE} viewBox="0 0 1024 1024">
      <Circle cx={512} cy={512} r={510} fill={v3.light.colors.yellow} />
      <G transform="translate(512 512) scale(1.2264) translate(-512 -512)">
        <Path fill="#000000" d={MARK_BLACK} />
        <Path fill="#ffffff" d={MARK_WHITE} />
      </G>
    </Svg>
  )
}

const MARK_BLACK =
  'M393.661 591.654A235.3 235.3 0 0 1 462.846 266.161A235.3 235.3 0 0 1 788.339 335.346L718.059 380.987A151.5 151.5 0 0 0 508.487 336.441A151.5 151.5 0 0 0 463.941 546.013Z'
const MARK_WHITE =
  'M630.339 432.346A235.3 235.3 0 0 1 561.154 757.839A235.3 235.3 0 0 1 235.661 688.654L305.941 643.013A151.5 151.5 0 0 0 515.513 687.559A151.5 151.5 0 0 0 560.059 477.987Z'

/**
 * The ink ring, drawn clockwise from twelve o'clock as `progress` goes from 0
 * to 1, with nothing but transforms, so the native driver can run it.
 *
 * Each half of the screen-space box shows one half of the ring, and each of
 * those is a half-ring that starts hidden on the other side of its clip and
 * is turned into view: the right side's for the first half of the stroke, the
 * left side's for the second. It is invisible at 0 rather than merely clipped,
 * so an anti-aliased hairline where the two clips meet cannot show on the
 * handover frame.
 */
function InkRing({ progress, color }: { progress: Animated.Value; color: string }) {
  const styles = useStyles()
  const right = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '180deg', '180deg'],
  })
  const left = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '0deg', '180deg'],
  })
  const opacity = progress.interpolate({
    inputRange: [0, 0.001, 1],
    outputRange: [0, 1, 1],
  })
  const band = [styles.ringBand, { borderColor: color }]
  return (
    <Animated.View pointerEvents="none" style={[styles.ring, { opacity }]}>
      <View style={[styles.ringHalf, styles.ringRight]}>
        <Animated.View
          style={[styles.ringRotor, styles.ringRotorRight, { transform: [{ rotate: right }] }]}
        >
          <View style={[styles.ringHalf, styles.ringLeft]}>
            <View style={band} />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.ringHalf, styles.ringLeft]}>
        <Animated.View style={[styles.ringRotor, { transform: [{ rotate: left }] }]}>
          <View style={[styles.ringHalf, styles.ringRight]}>
            <View style={[band, styles.ringBandRight]} />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

/** The ring's box: centred on the disc's edge, so half the stroke sits outside it. */
const RING_SIZE = DISC_SIZE + RING_WIDTH
const RING_HALF = RING_SIZE / 2

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
  /**
   * Taller than the screen by the bleed at both ends, so its centre is the
   * screen's — where the OS drew the badge — and its lifting edge starts out
   * of sight below.
   */
  sheet: {
    borderBottomLeftRadius: SHEET_CORNER,
    borderBottomRightRadius: SHEET_CORNER,
    bottom: -SHEET_BLEED,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -SHEET_BLEED,
  },
  edge: {
    borderBottomLeftRadius: SHEET_CORNER,
    borderBottomRightRadius: SHEET_CORNER,
    borderBottomWidth: SHEET_EDGE,
    borderLeftWidth: SHEET_EDGE,
    borderRightWidth: SHEET_EDGE,
    borderTopWidth: 0,
    bottom: 0,
    height: SHEET_CORNER,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  partner: {
    borderRadius: PARTNER_SIZE / 2,
    borderWidth: PARTNER_OUTLINE,
    height: PARTNER_SIZE,
    position: 'absolute',
    width: PARTNER_SIZE,
  },
  badge: { height: DISC_SIZE, width: DISC_SIZE },
  badgeImage: { height: DISC_SIZE, width: DISC_SIZE },
  ring: {
    height: RING_SIZE,
    left: -RING_WIDTH / 2,
    position: 'absolute',
    top: -RING_WIDTH / 2,
    width: RING_SIZE,
  },
  ringHalf: {
    height: RING_SIZE,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: RING_HALF,
  },
  ringLeft: { left: 0 },
  ringRight: { left: RING_HALF },
  ringRotor: { height: RING_SIZE, left: 0, position: 'absolute', top: 0, width: RING_SIZE },
  /** Inside the right-hand clip, the rotor's box starts half a ring to the left. */
  ringRotorRight: { left: -RING_HALF },
  ringBand: {
    borderRadius: RING_HALF,
    borderWidth: RING_WIDTH,
    height: RING_SIZE,
    width: RING_SIZE,
  },
  /** Inside a clip that starts at the ring's middle, the full ring starts half a ring left. */
  ringBandRight: { marginLeft: -RING_HALF },
  fill: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
}))
