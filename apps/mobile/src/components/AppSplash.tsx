import * as SplashScreen from 'expo-splash-screen'
import { usePathname } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import darkBadge from '../../assets/splash/badge-dark.png'
import defaultBadge from '../../assets/splash/badge.png'
import { useT } from '../i18n'
import { useAppReady } from '../hooks/useAppReady'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { markAppReady } from '../lib/appReady'
import { SPLASH_TIMING, floodDiameter, msUntilExitAllowed } from '../lib/splashTiming'
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
 * The bloom: the mark's own geometry, taken apart.
 *
 * The badge is two arcs curling into one another, so the opening is four more
 * of them at four radii, turning at four speeds in alternating directions.
 * Nothing here is a shape the logo does not already contain.
 *
 * An arc is a circular `View` with two of its four borders coloured and the
 * other two transparent; `sweep` says which two. Two adjacent sides is a
 * half-turn of ring, and picking a different pair per ring is what keeps the
 * gaps from lining up into a symmetry.
 *
 * `offset` is what stops this being a target. Each arc is pushed off centre by
 * that many points and then swung around it, so the four are eccentric to one
 * another and their paths cross — arcs cutting through arcs, which is the
 * effect, rather than four rings nested tidily inside one another. It is
 * applied after the rotation, so it is an orbit and not a lean.
 *
 * `scale` is a multiple of `TILE_SIZE`: the innermost sits just outside the
 * badge and the outermost is twice the width of a phone, so its arc leaves the
 * screen entirely and comes back — that one is the yellow reaching the corners.
 * Opacity falls with radius because at those widths an arc is a stripe across
 * the whole display, and a stripe at full strength is a barrier, not a bloom.
 */
const BLOOM_RINGS = [
  {
    scale: 1.45,
    thickness: 10,
    opacity: 0.95,
    offset: 16,
    spinMs: 9000,
    reverse: false,
    sweep: 'ne',
  },
  {
    scale: 2.3,
    thickness: 14,
    opacity: 0.7,
    offset: 30,
    spinMs: 13000,
    reverse: true,
    sweep: 'sw',
  },
  {
    scale: 3.4,
    thickness: 20,
    opacity: 0.42,
    offset: 48,
    spinMs: 19000,
    reverse: false,
    sweep: 'nw',
  },
  {
    scale: 4.8,
    thickness: 30,
    opacity: 0.24,
    offset: 66,
    spinMs: 27000,
    reverse: true,
    sweep: 'se',
  },
] as const

type Sweep = (typeof BLOOM_RINGS)[number]['sweep']

/** The two lit borders of an arc, and the two that are not. */
function arcSides(sweep: Sweep, color: string) {
  const transparent = 'transparent'
  return {
    borderTopColor: sweep === 'ne' || sweep === 'nw' ? color : transparent,
    borderRightColor: sweep === 'ne' || sweep === 'se' ? color : transparent,
    borderBottomColor: sweep === 'sw' || sweep === 'se' ? color : transparent,
    borderLeftColor: sweep === 'sw' || sweep === 'nw' ? color : transparent,
  }
}

/**
 * What the screen fills with on the way out.
 *
 * Yellow in light, where yellow is the brand's ground and a warm wash is the
 * point. Not in dark: `#ffc409` across a whole display is where the app is
 * most likely to be opened in an unlit room, and the badge's dark variant says
 * what the answer is — after dark the yellow is a line, not a field. So the
 * flood there is the same hue burnt almost to black, which reads as the dark
 * ground warming rather than as a lamp being switched on.
 */
const FLOOD = { light: '#ffc409', dark: '#33290c' } as const

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
  const { width, height } = useWindowDimensions()

  const [visible, setVisible] = useState(true)
  const mountedAt = useRef(Date.now())

  const ground = useRef(new Animated.Value(1)).current
  // Opaque from the first frame. Fading in would blink the badge out and back:
  // the native splash is already showing it.
  const opacity = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(SPLASH_TIMING.ENTRY_FROM_SCALE)).current
  const pulse = useRef(new Animated.Value(0)).current
  const flood = useRef(new Animated.Value(0)).current
  /**
   * The table above, with each ring's two drivers hung off it: how far it has
   * opened, and how far round it has turned. Carried together rather than as
   * parallel arrays so nothing here has to index one list by a position in
   * another.
   */
  const rings = useRef(
    BLOOM_RINGS.map((ring) => ({
      ...ring,
      size: TILE_SIZE * ring.scale,
      bloom: new Animated.Value(0),
      spin: new Animated.Value(0),
    })),
  ).current
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
    if (reduceMotion) {
      scale.setValue(1)
      return
    }
    Animated.spring(scale, {
      toValue: 1,
      speed: SPLASH_TIMING.ENTRY_SPEED,
      bounciness: SPLASH_TIMING.ENTRY_BOUNCINESS,
      useNativeDriver: true,
    }).start()

    // The same shape as `Skeleton`, slower, and on scale as well as opacity.
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: SPLASH_TIMING.LOOP_HALF_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: SPLASH_TIMING.LOOP_HALF_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )

    const opening = rings.map((ring, index) =>
      Animated.sequence([
        Animated.delay(index * SPLASH_TIMING.BLOOM_STAGGER_MS),
        Animated.spring(ring.bloom, {
          toValue: 1,
          speed: SPLASH_TIMING.BLOOM_SPEED,
          bounciness: SPLASH_TIMING.BLOOM_BOUNCINESS,
          useNativeDriver: true,
        }),
      ]),
    )
    // Linear and never reversed: an eased rotation reads as a thing being
    // pushed, and these should look like they were already turning.
    const turning = rings.map((ring) =>
      Animated.loop(
        Animated.timing(ring.spin, {
          toValue: 1,
          duration: ring.spinMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    )

    loops.current = [breathing, ...turning]
    Animated.parallel([breathing, ...opening, ...turning]).start()
    return () => {
      for (const animation of loops.current) animation.stop()
      loops.current = []
    }
  }, [reduceMotion, pulse, scale, rings])

  useEffect(() => {
    if (!ready || exiting.current) return
    exiting.current = true
    const wait = msUntilExitAllowed(mountedAt.current, Date.now())
    const timer = setTimeout(() => {
      for (const animation of loops.current) animation.stop()
      loops.current = []
      Animated.parallel([
        // Settled rather than snapped: `pulse.setValue(0)` mid-breath is a
        // visible jump on the first frame of the exit.
        Animated.timing(pulse, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_SETTLE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // The yellow leaving the badge and taking the screen. Skipped under
        // reduce motion, where a colour crossing the whole display is the
        // single most objectionable thing on this screen.
        Animated.timing(flood, {
          toValue: reduceMotion ? 0 : 1,
          duration: SPLASH_TIMING.EXIT_FLOOD_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: reduceMotion ? 1 : SPLASH_TIMING.EXIT_TILE_SCALE,
          duration: SPLASH_TIMING.EXIT_TILE_MS,
          delay: reduceMotion ? 0 : SPLASH_TIMING.EXIT_TILE_DELAY_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_TILE_MS,
          delay: reduceMotion ? 0 : SPLASH_TIMING.EXIT_TILE_DELAY_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // The ground leaves last, so the screen underneath is not revealed
        // before the flood has finished crossing it.
        Animated.timing(ground, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_GROUND_MS,
          delay: reduceMotion ? 0 : SPLASH_TIMING.EXIT_GROUND_DELAY_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false)
      })
    }, wait)
    return () => clearTimeout(timer)
  }, [ready, reduceMotion, ground, opacity, pulse, scale, flood])

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

  /**
   * The flood starts out exactly the size of the badge and ends covering the
   * corners, so the gesture is the tile's own yellow spreading rather than a
   * second yellow arriving from somewhere. Both ends are derived from the
   * screen, which is why this is a ratio rather than a constant.
   */
  const spread = floodDiameter(width, height)
  const floodFrom = spread > 0 ? TILE_SIZE / spread : 1

  if (!visible) return null

  const tileScale = Animated.multiply(
    scale,
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, SPLASH_TIMING.LOOP_SCALE] }),
  )
  const tileOpacity = Animated.multiply(
    opacity,
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, SPLASH_TIMING.LOOP_OPACITY] }),
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
          {rings.map((ring) => (
            <Animated.View
              key={ring.sweep}
              style={[
                styles.ring,
                {
                  width: ring.size,
                  height: ring.size,
                  borderRadius: ring.size / 2,
                  borderWidth: ring.thickness,
                  ...arcSides(ring.sweep, colors.primary),
                  opacity: ring.bloom.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, ring.opacity],
                  }),
                  transform: [
                    {
                      scale: ring.bloom.interpolate({
                        inputRange: [0, 1],
                        outputRange: [SPLASH_TIMING.BLOOM_FROM_SCALE, 1],
                      }),
                    },
                    {
                      rotate: ring.spin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', ring.reverse ? '-360deg' : '360deg'],
                      }),
                    },
                    // After the rotation, so the arc orbits the centre rather
                    // than sitting off it at a fixed angle. See `offset`.
                    { translateX: ring.offset },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}

      {!reduceMotion && spread > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flood,
            {
              width: spread,
              height: spread,
              borderRadius: spread / 2,
              backgroundColor: FLOOD[scheme],
              // Nothing on screen until the exit starts, and fully there well
              // before it stops growing — a disc that fades in as it travels
              // shows its edge as a soft ring instead of a front.
              opacity: flood.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
              transform: [
                { scale: flood.interpolate({ inputRange: [0, 1], outputRange: [floodFrom, 1] }) },
              ],
            },
          ]}
        />
      )}

      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: TILE_GROUND[scheme],
            opacity: tileOpacity,
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
  // Over `react-native-screens`, which a plain later-sibling is not enough for.
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
  ring: { position: 'absolute' },
  flood: { position: 'absolute' },
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
