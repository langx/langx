import * as SplashScreen from 'expo-splash-screen'
import { usePathname } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, View } from 'react-native'
import darkBadge from '../../assets/splash/badge-dark.png'
import defaultBadge from '../../assets/splash/badge.png'
import { useT } from '../i18n'
import { useAppReady } from '../hooks/useAppReady'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { markAppReady } from '../lib/appReady'
import { SPLASH_TIMING, haloDelayMs, msUntilExitAllowed } from '../lib/splashTiming'
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

  const [visible, setVisible] = useState(true)
  const mountedAt = useRef(Date.now())

  const ground = useRef(new Animated.Value(1)).current
  /**
   * The badge is opaque, unscaled and perfectly still on the first frame, and
   * these two only ever move on the way out.
   *
   * It is already on screen when this mounts — the OS drew it, at this size,
   * from the same file — so the handover is a frame where the two pictures are
   * meant to be identical. Every entrance the badge could be given makes that
   * frame the one moment the logo visibly moves. The spring from 0.96 that
   * used to be here was exactly that: a 4% dip and a bounce, landing on the
   * frame most likely to be dropped, which is a pop with no cause the reader
   * can see. What arrives instead is the halo, which starts from nothing and
   * so has nothing to jump from.
   */
  const opacity = useRef(new Animated.Value(1)).current
  const zoom = useRef(new Animated.Value(1)).current
  const breath = useRef(new Animated.Value(0)).current
  /**
   * The halo: one ring, three times over, a third of a cycle apart.
   *
   * Each is a full circle exactly the badge's size, stroked in the brand yellow,
   * that grows out of the mark's edge and fades as it goes. Nothing rotates,
   * nothing reverses, nothing is off centre, and every ring is the same as every
   * other — the only difference between them is when it set off.
   *
   * That sameness is the point, and it is what the four eccentric rotating arcs
   * here before it got wrong. Those were partial rings — two of four borders
   * coloured — up to five times the badge's width, orbiting the centre at four
   * speeds in alternating directions. At that size a part-coloured border is a
   * yellow stripe sweeping across the display, its two ends visibly mitred where
   * the lit sides meet the transparent ones, and four of them crossing each
   * other at different rates has no discernible period. It read as a rendering
   * fault rather than as an opening, which is what this screen must never look
   * like: it is the first thing anyone sees, and the reader has no way to tell a
   * deliberate effect from a broken launch.
   *
   * A concentric ripple has a period anybody can see, never leaves the screen,
   * and — because a loop has no end state — can be cut off at any frame without
   * looking interrupted.
   */
  const halos = useRef(
    Array.from({ length: SPLASH_TIMING.HALO_COUNT }, () => new Animated.Value(0)),
  ).current
  /** Fades all three out together at the exit, over whatever they are doing. */
  const haloFade = useRef(new Animated.Value(1)).current
  const loops = useRef<Animated.CompositeAnimation[]>([])
  const exiting = useRef(false)

  /** Nothing signalled. One-way, so it can only ever be early, never wrong. */
  useEffect(() => {
    const timer = setTimeout(markAppReady, SPLASH_TIMING.TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  /*
   * Both gates resolve to "/" — expo-router strips group segments, so
   * `app/(auth)/index.tsx` is "/" as well. Any other path means both of them
   * are already behind us: a deep link, a notification, a restored route.
   */
  useEffect(() => {
    if (pathname !== '/') markAppReady()
  }, [pathname])

  useEffect(() => {
    if (reduceMotion) return

    // The same shape as `Skeleton`, slower, and on scale rather than opacity:
    // the mark dimming and brightening on its own reads as a flicker.
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: SPLASH_TIMING.BREATH_HALF_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: SPLASH_TIMING.BREATH_HALF_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )

    /*
     * The delay is outside the loop and so happens once. Inside it, every
     * iteration would wait again and the three would ripple in bursts with a
     * hole between them.
     *
     * Eased out, not linear: a ripple slows as it widens. A ring travelling at
     * a constant speed while its circumference grows looks driven rather than
     * released.
     */
    const rippling = halos.map((halo, index) =>
      Animated.sequence([
        Animated.delay(haloDelayMs(index)),
        Animated.loop(
          Animated.timing(halo, {
            toValue: 1,
            duration: SPLASH_TIMING.HALO_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ),
      ]),
    )

    loops.current = [breathing, ...rippling]
    Animated.parallel(loops.current).start()
    return () => {
      for (const animation of loops.current) animation.stop()
      loops.current = []
    }
  }, [reduceMotion, breath, halos])

  useEffect(() => {
    if (!ready || exiting.current) return
    exiting.current = true
    const wait = msUntilExitAllowed(mountedAt.current, Date.now())
    const timer = setTimeout(() => {
      /*
       * The loops keep running underneath all of this and are stopped in the
       * callback, once nothing is drawing them any more. Stopping them here
       * instead would freeze three rings and a half-taken breath in place for
       * the length of the exit — a stutter on the last thing the reader sees
       * of this screen, and the exact fault the exit is meant not to have.
       */
      Animated.parallel([
        Animated.timing(haloFade, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_HALO_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Scale and opacity share an easing, so the badge dissolves and drifts
        // as one gesture rather than as two overlapping ones.
        Animated.timing(zoom, {
          toValue: reduceMotion ? 1 : SPLASH_TIMING.EXIT_TILE_SCALE,
          duration: SPLASH_TIMING.EXIT_TILE_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_TILE_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // Last, and still going after the badge has gone, so the app is never
        // revealed from underneath a logo that is still on screen.
        Animated.timing(ground, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_GROUND_MS,
          delay: SPLASH_TIMING.EXIT_GROUND_DELAY_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        for (const animation of loops.current) animation.stop()
        loops.current = []
        if (finished) setVisible(false)
      })
    }, wait)
    return () => clearTimeout(timer)
  }, [ready, reduceMotion, ground, opacity, zoom, haloFade])

  /**
   * The one place the native splash is allowed to go: after this layer has been
   * laid out, plus a frame, so there is never a moment with neither on screen.
   * Rejects harmlessly if it has already auto-hidden.
   */
  const onLayout = useCallback(() => {
    requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined)
    })
  }, [])

  if (!visible) return null

  const tileScale = Animated.multiply(
    zoom,
    breath.interpolate({ inputRange: [0, 1], outputRange: [1, SPLASH_TIMING.BREATH_SCALE] }),
  )

  return (
    <Animated.View
      testID="app-splash"
      onLayout={onLayout}
      pointerEvents={ready ? 'none' : 'auto'}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.oneMoment')}
      style={[
        StyleSheet.absoluteFill,
        styles.layer,
        { backgroundColor: colors.bg, opacity: ground },
      ]}
    >
      {!reduceMotion && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centred]}>
          {halos.map((halo, index) => (
            <Animated.View
              key={index}
              style={[
                styles.halo,
                {
                  // `primaryShade` in light and not `primary`: the halo is a
                  // hairline, and the brand yellow at this opacity on a white
                  // ground is close to not being drawn at all. On the dark
                  // ground the brighter one is the legible half. The palette
                  // holds both in both schemes, so this is a choice about
                  // contrast rather than a scheme-specific colour.
                  borderColor: scheme === 'light' ? colors.primaryShade : colors.primary,
                  opacity: Animated.multiply(
                    haloFade,
                    halo.interpolate({
                      inputRange: [0, SPLASH_TIMING.HALO_FADE_IN, 1],
                      outputRange: [0, SPLASH_TIMING.HALO_OPACITY, 0],
                    }),
                  ),
                  transform: [
                    {
                      scale: halo.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, SPLASH_TIMING.HALO_TO_SCALE],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}

      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: TILE_GROUND[scheme],
            opacity,
            transform: [{ scale: tileScale }],
          },
        ]}
      >
        <Image source={BADGES[scheme]} style={styles.badge} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
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
    alignItems: 'center',
    elevation: OVERLAY_LAYER.splash,
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: OVERLAY_LAYER.splash,
  },
  centred: { alignItems: 'center', justifyContent: 'center' },
  /**
   * The badge's size, grown by a transform rather than by its width — a
   * layout-animated ring is a reflow every frame, off the native driver, on
   * the busiest thread of the launch.
   */
  halo: {
    borderRadius: TILE_SIZE / 2,
    borderWidth: 2,
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
}))
