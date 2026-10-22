import Feather from '@expo/vector-icons/Feather'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { ApiRequestError } from '../../api/client'
import { useClaimGift, useWallet } from '../../api/queries'
import { Button } from '../../components/ui/Button'
import { Confetti } from '../../components/ui/Confetti'
import { CountUp } from '../../components/ui/CountUp'
import { PressableScale } from '../../components/ui/PressableScale'
import { Screen } from '../../components/ui/Screen'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useShake } from '../../hooks/useShake'
import { useLocale, useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { CELEBRATION_MS, RAIN } from '../../lib/celebration'
import { giftState, giftTickDelay } from '../../lib/gift'
import { notification } from '../../lib/haptics'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, PARTNER_HUES, useTheme } from '../../lib/theme'
import { DURATION, EASE_OUT, SPRING, TIMING } from '../../lib/theme/motion'
import { useV3Fonts } from './useV3Fonts'

type Phase = 'waiting' | 'opening' | 'revealed'

/** How far the box shrinks under the finger: it is the one thing to press, and big. */
const BOX_PRESS_SCALE = 0.95
/** One turn of the wiggle while the claim is out, either way, in degrees. */
const WIGGLE_DEG = 4
/** Each of the wiggle's three legs, in ms. */
const WIGGLE_LEG_MS = 80
/** The box bursting: up to this scale, and gone, in `BOX_BURST_MS`. */
const BOX_BURST_SCALE = 1.12
const BOX_BURST_MS = 150
/** The rings spreading out and fading, over `DURATION.roll`. */
const RING_SPREAD_SCALE = 1.25

const WALLET = '/(app)/wallet'

/**
 * The hourly gift in the redesign's look (`V-Gift`), behind `flags.v3Home`.
 *
 * Everything that happens is `gift.tsx`'s: the box is always a button and a
 * shake is a second way in, never the only one; the server decides what is
 * inside; an empty gift is an outcome, said plainly. The copy stays a free
 * gift that is sometimes empty — no odds, no amounts teased, nothing that
 * reads as a game of chance.
 *
 * The stage is one lilac block with the yellow box on it — the screen's one
 * yellow, on the one thing to press.
 */
export function GiftScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const black = useV3Fonts()
  const reduceMotion = useReduceMotion()
  const wallet = useWallet()
  const claim = useClaimGift()

  const [phase, setPhase] = useState<Phase>('waiting')
  const [amount, setAmount] = useState(0)
  const [now, setNow] = useState(() => new Date())

  const nextAt = wallet.data?.gift.nextAt
  const state = wallet.data ? giftState(nextAt, now) : null
  const ready = state?.ready === true

  useEffect(() => {
    if (!state || state.ready) return
    const timer = setTimeout(() => setNow(new Date()), giftTickDelay(state.remainingMs))
    return () => clearTimeout(timer)
  }, [state, nextAt])

  /*
   * The reveal, under 1.5 s from the tap's answer to the last piece landing:
   * while the claim is out the box wiggles once; when it answers the box
   * bursts (150 ms) as the rings spread out (600 ms), then the amount pops on
   * `SPRING.bounce` and counts up over `DURATION.roll`. Done is live
   * throughout — nothing here takes a touch. With reduce motion the amount
   * is simply there.
   */
  const pop = useSharedValue(0)
  const tilt = useSharedValue(0)
  const burst = useSharedValue(0)
  const rings = useSharedValue(0)
  const [raining, setRaining] = useState(false)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (burstTimer.current) clearTimeout(burstTimer.current)
    },
    [],
  )

  // Started once the amount is mounted, for today's reason (a spring started
  // before its view existed froze part-way on web). `SPRING.bounce`, not the
  // 12/160 spring that used to be here: that one wobbled rather than landed.
  useEffect(() => {
    if (phase !== 'revealed') return
    pop.set(reduceMotion ? 1 : withSpring(1, SPRING.bounce))
  }, [phase, reduceMotion, pop])

  // The one wiggle while the claim is out: one turn each way and home.
  useEffect(() => {
    if (phase !== 'opening' || reduceMotion) return
    const leg = { duration: WIGGLE_LEG_MS, easing: EASE_OUT }
    tilt.set(
      withSequence(withTiming(WIGGLE_DEG, leg), withTiming(-WIGGLE_DEG, leg), withTiming(0, leg)),
    )
    // Home as well as stopped: a claim that fails mid-wiggle leaves no tilt.
    return () => {
      cancelAnimation(tilt)
      tilt.set(0)
    }
  }, [phase, reduceMotion, tilt])

  // Confetti only for a gift with something in it, and never under reduce motion.
  useEffect(() => {
    if (!raining) return
    const timer = setTimeout(() => setRaining(false), CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [raining])
  useEffect(() => {
    if (reduceMotion) setRaining(false)
  }, [reduceMotion])

  const colours = useMemo(() => PARTNER_HUES.map((hue) => v3.hues[hue]), [v3])
  const pieces = useMemo(() => ({ kind: 'flat', colours }) as const, [colours])

  const amountStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: Math.min(1, pop.get()),
      transform: [{ scale: 0.6 + 0.4 * pop.get() }],
    }
  })
  const boxStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - burst.get(),
      transform: [
        { scale: 1 + (BOX_BURST_SCALE - 1) * burst.get() },
        { rotate: `${tilt.get()}deg` },
      ],
    }
  })
  const ringStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - rings.get(),
      transform: [{ scale: 1 + (RING_SPREAD_SCALE - 1) * rings.get() }],
    }
  })

  function reveal(value: number): void {
    setAmount(value)
    // One haptic per gift: the reveal's, never the press's as well.
    void notification(value > 0 ? 'success' : 'warning')
    if (reduceMotion) {
      setPhase('revealed')
      return
    }
    cancelAnimation(tilt)
    tilt.set(0)
    burst.set(withTiming(1, { duration: BOX_BURST_MS, easing: EASE_OUT }))
    rings.set(withTiming(1, TIMING.roll))
    // From the answer, so the last piece lands inside `CELEBRATION_MS` of it.
    if (value > 0) setRaining(true)
    // The amount takes the box's place once the box has gone.
    burstTimer.current = setTimeout(() => setPhase('revealed'), BOX_BURST_MS)
  }

  function open(): void {
    if (phase !== 'waiting' || !ready || claim.isPending) return
    setPhase('opening')
    claim.mutate(undefined, {
      onSuccess: (result) => reveal(result.amount),
      onError: (error) => {
        setPhase('waiting')
        // Another device, or the clock, opened this hour's gift first.
        if (error instanceof ApiRequestError && error.code === 'RATE_LIMITED') {
          goBackTo(WALLET)
          return
        }
        void showAlert(t('gift.failed'), t('common.retry'))
      },
    })
  }

  const shake = useShake(open, phase === 'waiting' && ready)

  return (
    <Screen ground={v3.colors.bg} style={styles.screen}>
      <WalletHeader
        title={t('gift.title')}
        subtitle={t('gift.body')}
        black={black}
        onBack={() => goBackTo(WALLET)}
      />

      <View style={[styles.stage, { backgroundColor: v3.hues.lilac }]}>
        <Animated.View style={[styles.ring, styles.ringOuter, ringStyle]} pointerEvents="none" />
        <Animated.View style={[styles.ring, styles.ringInner, ringStyle]} pointerEvents="none" />
        {phase === 'revealed' ? (
          <Animated.View style={[styles.reveal, amountStyle]}>
            {amount > 0 ? (
              <>
                <CountUp
                  value={amount}
                  prefix="+"
                  locale={locale}
                  reduce={reduceMotion}
                  duration={DURATION.roll}
                  style={styles.amount}
                  numberOfLines={1}
                />
                <Text style={styles.amountUnit}>{t('gift.tokensUnit', { count: amount })}</Text>
              </>
            ) : (
              <Text style={styles.caption}>{t('gift.revealedZero')}</Text>
            )}
          </Animated.View>
        ) : state === null ? (
          <ActivityIndicator color={v3.colors.ink} />
        ) : state.ready ? (
          <>
            <Animated.View style={boxStyle}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('gift.openAccessibility')}
                accessibilityState={{ disabled: phase !== 'waiting' }}
                disabled={phase !== 'waiting'}
                onPress={open}
                scaleTo={BOX_PRESS_SCALE}
                style={styles.box}
              >
                <Feather name="gift" size={64} color={v3.colors.onYellow} />
                <Text style={styles.boxLabel}>{t('gift.openLabel')}</Text>
              </PressableScale>
            </Animated.View>
            <View style={styles.captions}>
              <Text style={styles.captionTitle}>{t('gift.ready')}</Text>
              <Text style={styles.caption}>
                {phase === 'opening' ? t('gift.opening') : t('gift.tapHint')}
              </Text>
              {phase !== 'opening' && shake.available ? (
                <View style={styles.chip}>
                  <Feather name="smartphone" size={v3.icon.sm} color={v3.colors.ink} />
                  <Text style={styles.chipText}>{t('gift.shakeHint')}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.waiting}>
              <Feather name="gift" size={64} color={v3.colors.ink} />
            </View>
            <View style={styles.captions}>
              <Text style={styles.captionTitle}>
                {t('gift.nextIn', { minutes: state.minutes })}
              </Text>
              <Text style={styles.caption}>{t('gift.anotherInAnHour')}</Text>
            </View>
          </>
        )}
      </View>

      <Text style={styles.note}>{t('gift.someEmpty')}</Text>

      <Button
        label={t('gift.done')}
        variant="secondary"
        onPress={() => goBackTo(WALLET)}
        style={styles.done}
      />
      {raining ? <Confetti pieces={pieces} count={36} rain={RAIN.celebration} /> : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // `flex: 1`, or the stage has no height to centre in.
  screen: { flex: 1 },
  stage: {
    alignItems: 'center',
    borderRadius: v3.radius.hero,
    flex: 1,
    gap: 22,
    justifyContent: 'center',
    marginTop: v3.space[12],
    overflow: 'hidden',
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[24],
  },
  ring: {
    borderColor: 'rgba(20, 22, 27, 0.14)',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    position: 'absolute',
  },
  ringOuter: { height: 340, top: '50%', marginTop: -236, width: 340 },
  ringInner: { height: 270, top: '50%', marginTop: -201, width: 270 },
  box: {
    alignItems: 'center',
    backgroundColor: v3.colors.yellow,
    borderRadius: 48,
    gap: v3.space[8],
    height: 196,
    justifyContent: 'center',
    width: 196,
  },
  boxLabel: { ...v3.type.headline, color: v3.colors.onYellow },
  waiting: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: v3.radius.pill,
    height: 196,
    justifyContent: 'center',
    width: 196,
  },
  captions: { alignItems: 'center', gap: v3.space[6] },
  captionTitle: { ...v3.type.title, color: v3.colors.ink, textAlign: 'center' },
  caption: { ...v3.type.body, color: v3.colors.ink, fontWeight: '600', textAlign: 'center' },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    marginTop: v3.space[2],
    minHeight: 36,
    paddingHorizontal: v3.space[14],
  },
  chipText: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700' },
  // No adjustsFontSizeToFit on the amount. On iOS it measured the line while
  // the reveal was still scaled and the count was still rolling, and drew
  // "+13" a few points tall on TestFlight 194 and again on 195 even with the
  // view stretched. An hourly gift is a few digits, which the numeral fits
  // at full size, so the amount simply takes the stage's width.
  reveal: { alignItems: 'center', alignSelf: 'stretch', gap: v3.space[4] },
  amount: {
    ...v3.type.numeral,
    alignSelf: 'stretch',
    color: v3.colors.ink,
    lineHeight: 84,
    textAlign: 'center',
  },
  amountUnit: { ...v3.type.headline, color: v3.colors.ink, textAlign: 'center' },
  note: {
    ...v3.type.caption,
    color: v3.colors.muted,
    marginHorizontal: v3.space[8],
    marginTop: v3.space[12],
    textAlign: 'center',
  },
  done: { marginBottom: v3.space[8], marginTop: v3.space[12] },
}))
