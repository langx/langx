import Feather from '@expo/vector-icons/Feather'
import { effectivePlanTier, TIER_BADGES } from '@langx/shared'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useAckProWelcome, useMe, type MeProfile } from '../api/queries'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTourOpen } from '../hooks/useTour'
import { useT } from '../i18n'
import { track } from '../lib/analytics'
import { notification } from '../lib/haptics'
import { isLaunchOver, subscribeToLaunchOver } from '../lib/launchOver'
import { PRO_WELCOME_HIGHLIGHTS, proWelcomeCopy, setProWelcomeOpen } from '../lib/proWelcome'
import { makeStyles, useTheme } from '../lib/theme'
import { Button } from './ui/Button'

type Welcome = NonNullable<MeProfile['proWelcome']>

/** When this JS context started — see `fresh` below. */
const SESSION_STARTED_AT = Date.now()

/**
 * "You're Pro now", shown once for each welcome the server leaves on the
 * profile (`proWelcome`, written on the edge into Pro).
 *
 * Opened only off a `me` fetched in this run of the app, never off the
 * persisted copy restored at launch: that copy can hold a welcome another
 * device has already dismissed, and a celebration shown twice is worse than
 * one shown a launch late. Not while the launch film is up or the Discover
 * tour is open either — all three are windows of their own, and the one that
 * opens second would paint over, or under, the first. When the tour and this
 * are due in the same frame, this goes first and the tour waits for it
 * (`setProWelcomeOpen`).
 *
 * A welcome for Pro that has already ended — a free week cancelled and run
 * out before the app was opened — is cleared without being shown.
 *
 * A `Modal`, so it needs no `OVERLAY_LAYER`: it is its own native window.
 */
export function ProWelcomeHost({ enabled }: { enabled: boolean }) {
  const me = useMe(enabled)
  const { mutate: acknowledge } = useAckProWelcome()
  const launchOver = useSyncExternalStore(subscribeToLaunchOver, isLaunchOver, isLaunchOver)
  const tourOpen = useTourOpen()
  const [shown, setShown] = useState<Welcome | null>(null)
  // The `at` already dealt with in this session, so a failed dismissal does
  // not reopen the screen until the next launch.
  const handled = useRef<string | null>(null)

  const welcome = me.data?.proWelcome
  const entitlement = me.data?.entitlement
  const isPro =
    entitlement !== undefined &&
    effectivePlanTier(entitlement.tier, entitlement.expiresAt) !== 'free'

  /*
   * Fetched in this run of the app, not restored from disk. A restored query
   * keeps the `dataUpdatedAt` it was saved with, which is older than this
   * module. `isFetchedAfterMount` alone is not enough: on a sign-in or a
   * launch with nothing persisted, `index.tsx` has already fetched `me` before
   * this host mounts, the answer is fresh for thirty seconds, and this
   * observer would not see a fetch of its own until the app next came to the
   * foreground.
   */
  const fresh = me.isFetchedAfterMount || me.dataUpdatedAt >= SESSION_STARTED_AT

  useEffect(() => {
    if (!enabled || !fresh || !welcome || shown) return
    if (handled.current === welcome.at) return
    if (!isPro) {
      handled.current = welcome.at
      acknowledge(welcome.at)
      return
    }
    if (!launchOver || tourOpen) return
    handled.current = welcome.at
    // Synchronously, before the render that opens it: the Discover tour may
    // be half-way through its own start and reads this to stand aside.
    setProWelcomeOpen(true)
    setShown(welcome)
    track({
      name: 'pro_welcome_shown',
      properties: { source: welcome.source, months: welcome.months ?? null },
    })
  }, [enabled, fresh, welcome, shown, isPro, launchOver, tourOpen, acknowledge])

  useEffect(() => () => setProWelcomeOpen(false), [])

  if (!shown) return null

  function close(explore: boolean): void {
    if (!shown) return
    track({
      name: 'pro_welcome_closed',
      properties: { source: shown.source, action: explore ? 'start' : 'close' },
    })
    acknowledge(shown.at)
    setShown(null)
    setProWelcomeOpen(false)
    if (explore) router.navigate('/(app)/(tabs)/discover')
  }

  return <WelcomeSheet welcome={shown} onStart={() => close(true)} onClose={() => close(false)} />
}

function WelcomeSheet({
  welcome,
  onStart,
  onClose,
}: {
  welcome: Welcome
  onStart: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const copy = proWelcomeCopy(welcome)

  const pop = useSharedValue(0)

  // Once, on opening: the buzz is the moment, not the animation.
  useEffect(() => {
    void notification('success')
  }, [])

  // The badge lands with an overshoot, after the sheet has faded in. With
  // reduced motion it is simply there.
  useEffect(() => {
    pop.value = reduceMotion ? 1 : withDelay(180, withSpring(1, { damping: 9, stiffness: 170 }))
  }, [reduceMotion, pop])

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: 0.4 + 0.6 * pop.value }],
  }))

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{TIER_BADGES.pro}</Text>
          </Animated.View>
          <Text accessibilityRole="header" style={styles.title}>
            {t(copy.title.key, copy.title.params)}
          </Text>
          <Text style={styles.body}>{t(copy.body.key, copy.body.params)}</Text>
          <View style={styles.highlights}>
            {PRO_WELCOME_HIGHLIGHTS.map((highlight) => (
              <View key={highlight.key} style={styles.highlight}>
                <View style={styles.highlightIcon}>
                  <Feather name={highlight.icon} size={18} color={colors.pro} />
                </View>
                <Text style={styles.highlightLabel}>{t(highlight.key)}</Text>
              </View>
            ))}
            <Text style={styles.more}>{t('proWelcome.andMore')}</Text>
          </View>
          <Button label={t('proWelcome.start')} onPress={onStart} style={styles.start} />
        </View>
        {reduceMotion ? null : <EmojiRain />}
      </View>
    </Modal>
  )
}

/** Decoration, not content: never read out, never in the way of a tap. */
const RAIN = ['🎉', '✨', '🎊', '⭐', '💜'] as const
const DROPS = 24

/**
 * One shower, then gone. Every drop waits a beat before it starts, which is
 * also what keeps it off screen while `useReduceMotion` is still answering:
 * the hook starts at "motion is fine" and a drop already falling when it says
 * otherwise would be exactly the movement somebody asked not to see.
 */
function EmojiRain() {
  const { width, height } = useWindowDimensions()
  const drops = useMemo(
    () =>
      Array.from({ length: DROPS }, (_, index) => ({
        emoji: RAIN[index % RAIN.length] ?? RAIN[0],
        left: Math.random() * Math.max(0, width - 36),
        delay: 250 + Math.random() * 900,
        duration: 1900 + Math.random() * 1300,
        size: 22 + Math.random() * 14,
        spin: (Math.random() - 0.5) * 300,
      })),
    [width],
  )

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {drops.map((drop, index) => (
        <Drop key={index} {...drop} fall={height + 120} />
      ))}
    </View>
  )
}

function Drop({
  emoji,
  left,
  delay,
  duration,
  size,
  spin,
  fall,
}: {
  emoji: string
  left: number
  delay: number
  duration: number
  size: number
  spin: number
  fall: number
}) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.in(Easing.quad) }))
  }, [progress, delay, duration])

  const style = useAnimatedStyle(() => ({
    // Invisible until it starts, and fading over the last fifth of the fall.
    opacity: progress.value === 0 ? 0 : Math.min(1, (1 - progress.value) * 5),
    transform: [
      { translateY: -60 + progress.value * fall },
      { rotate: `${progress.value * spin}deg` },
    ],
  }))

  return (
    <Animated.Text style={[{ fontSize: size, left, position: 'absolute', top: 0 }, style]}>
      {emoji}
    </Animated.Text>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    gap: spacing.md,
    maxWidth: 420,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl + spacing.sm,
    width: '100%',
  },
  badge: {
    backgroundColor: colors.pro,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  badgeText: {
    ...font.heading,
    color: colors.textInverse,
    fontSize: 22,
    letterSpacing: 2,
  },
  title: { ...font.heading, color: colors.text, fontSize: 24, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  highlights: { alignSelf: 'stretch', gap: spacing.sm, marginVertical: spacing.sm },
  highlight: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  highlightIcon: {
    alignItems: 'center',
    backgroundColor: `${colors.pro}1f`,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  highlightLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  more: { color: colors.textMuted, fontSize: 14, paddingStart: 34 + spacing.md },
  start: { alignSelf: 'stretch' },
}))
