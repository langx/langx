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
import { SPLASH_TIMING, msUntilExitAllowed } from '../lib/splashTiming'
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
  // Opaque from the first frame. Fading in would blink the badge out and back:
  // the native splash is already showing it.
  const opacity = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(SPLASH_TIMING.ENTRY_FROM_SCALE)).current
  const pulse = useRef(new Animated.Value(0)).current
  const loop = useRef<Animated.CompositeAnimation | null>(null)
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
    loop.current = breathing
    breathing.start()
    return () => breathing.stop()
  }, [reduceMotion, pulse, scale])

  useEffect(() => {
    if (!ready || exiting.current) return
    exiting.current = true
    const wait = msUntilExitAllowed(mountedAt.current, Date.now())
    const timer = setTimeout(() => {
      loop.current?.stop()
      Animated.parallel([
        // Settled rather than snapped: `pulse.setValue(0)` mid-breath is a
        // visible jump on the first frame of the exit.
        Animated.timing(pulse, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_SETTLE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
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
        // The ground leaves last, so the screen underneath is not revealed
        // before the badge has finished going.
        Animated.timing(ground, {
          toValue: 0,
          duration: SPLASH_TIMING.EXIT_GROUND_MS,
          delay: SPLASH_TIMING.EXIT_GROUND_DELAY_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false)
      })
    }, wait)
    return () => clearTimeout(timer)
  }, [ready, reduceMotion, ground, opacity, pulse, scale])

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
  layer: { alignItems: 'center', elevation: 100, justifyContent: 'center', zIndex: 100 },
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
