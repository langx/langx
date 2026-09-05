import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { ApiRequestError } from '../../src/api/client'
import { useClaimGift, useWallet } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { showAlert } from '../../src/lib/alert'
import { giftState } from '../../src/lib/gift'
import { impact, notification } from '../../src/lib/haptics'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useShake } from '../../src/hooks/useShake'

type Phase = 'waiting' | 'opening' | 'revealed'

/**
 * Opening the hourly gift.
 *
 * The box is always a button. A shake opens it too, where there is an
 * accelerometer to hear one — but tapping is the path a screen reader takes,
 * the path the web build takes, and the path a binary without the sensor
 * takes, so the shake is decoration on top of a control, never the control.
 *
 * The server decides what is inside; this screen only asks and then shows.
 * "Empty" is drawn as an outcome rather than an error, because it is one —
 * a third of gifts are, by design, and the honest thing is to say so.
 */
export default function GiftScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const wallet = useWallet()
  const claim = useClaimGift()

  const [phase, setPhase] = useState<Phase>('waiting')
  const [amount, setAmount] = useState(0)

  const wobble = useSharedValue(0)
  const lift = useSharedValue(0)
  const pop = useSharedValue(0)

  // A gentle idle wobble while it waits — the box is asking to be opened.
  useEffect(() => {
    if (phase !== 'waiting' || reduceMotion) return
    wobble.value = withRepeat(
      withSequence(withTiming(-4, { duration: 700 }), withTiming(4, { duration: 700 })),
      -1,
      true,
    )
    return () => cancelAnimation(wobble)
  }, [phase, reduceMotion, wobble])

  // Reached with nothing to open — a stale card, a back-forward, a deep link.
  useEffect(() => {
    if (phase !== 'waiting' || !wallet.data) return
    if (!giftState(wallet.data.gift.nextAt).ready) goBackTo('/(app)/wallet')
  }, [phase, wallet.data])

  // The opening shake is an effect too, for the same reason in the other
  // direction: set from the tap handler it was cancelled a frame later by the
  // idle wobble's cleanup, and the box froze at whatever tilt it had reached.
  useEffect(() => {
    if (phase !== 'opening') return
    wobble.value = reduceMotion
      ? 0
      : withSequence(
          withTiming(-9, { duration: 70 }),
          withTiming(9, { duration: 70 }),
          withTiming(-9, { duration: 70 }),
          withTiming(9, { duration: 70 }),
          withTiming(0, { duration: 70 }),
        )
  }, [phase, reduceMotion, wobble])

  // The reveal starts from an effect, once the amount is mounted. Started from
  // the mutation callback, before the `Animated.View` existed, the spring
  // froze part-way on web — the number sat at forty percent opacity forever.
  useEffect(() => {
    if (phase !== 'revealed') return
    lift.value = reduceMotion ? 0 : withSpring(-28, { damping: 14, stiffness: 180 })
    pop.value = reduceMotion ? 1 : withSpring(1, { damping: 12, stiffness: 160 })
  }, [phase, reduceMotion, lift, pop])

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value}deg` }, { translateY: lift.value }],
  }))
  const amountStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.6 + 0.4 * pop.value }],
  }))

  function open(): void {
    if (phase !== 'waiting' || claim.isPending) return
    setPhase('opening')
    void impact('medium')
    claim.mutate(undefined, {
      onSuccess: (result) => {
        setAmount(result.amount)
        setPhase('revealed')
        void notification(result.amount > 0 ? 'success' : 'warning')
      },
      onError: (error) => {
        setPhase('waiting')
        // Somebody else — another device, or the clock — opened this hour's
        // gift first. The wallet cache already knows; the card will say when.
        if (error instanceof ApiRequestError && error.code === 'RATE_LIMITED') {
          goBackTo('/(app)/wallet')
          return
        }
        void showAlert(t('gift.failed'), t('common.retry'))
      },
    })
  }

  const shake = useShake(open, phase === 'waiting')

  const hint =
    phase === 'waiting'
      ? t(shake.available ? 'gift.shakeHint' : 'gift.tapHint')
      : phase === 'opening'
        ? t('gift.opening')
        : t('gift.nextIn', { minutes: 60 })

  return (
    // `flex: 1` on the column, or the stage below has no height to centre in:
    // a non-scrolling `Screen` sizes its column to its content.
    <Screen style={styles.screen}>
      <ScreenHeader title={t('gift.title')} onBack={() => goBackTo('/(app)/wallet')} />
      <View style={styles.stage}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('gift.openAccessibility')}
          accessibilityState={{ disabled: phase !== 'waiting' }}
          disabled={phase !== 'waiting'}
          onPress={open}
          hitSlop={24}
        >
          <Animated.View style={[styles.box, boxStyle]}>
            <Feather
              name="gift"
              size={96}
              color={phase === 'revealed' ? colors.textFaint : colors.accent}
            />
          </Animated.View>
        </Pressable>

        {phase === 'revealed' ? (
          <Animated.View style={[styles.reveal, amountStyle]}>
            <Text style={amount > 0 ? styles.amount : styles.empty}>
              {amount > 0 ? t('gift.revealed', { amount }) : t('gift.revealedZero')}
            </Text>
          </Animated.View>
        ) : null}

        <Text style={styles.hint}>{hint}</Text>
        {phase === 'waiting' ? <Text style={styles.body}>{t('gift.body')}</Text> : null}

        {phase === 'revealed' ? (
          <Button
            label={t('gift.done')}
            onPress={() => goBackTo('/(app)/wallet')}
            style={styles.done}
          />
        ) : null}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  screen: { flex: 1 },
  stage: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: spacing.xxxl },
  box: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.xl,
    height: 180,
    justifyContent: 'center',
    width: 180,
  },
  reveal: { marginTop: spacing.xl },
  amount: { ...font.heading, color: colors.text, fontSize: 40, textAlign: 'center' },
  empty: { ...font.body, color: colors.textMuted, fontSize: 18, textAlign: 'center' },
  hint: {
    ...font.body,
    color: colors.textMuted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  body: {
    ...font.caption,
    color: colors.textFaint,
    lineHeight: 19,
    marginTop: spacing.sm,
    maxWidth: 320,
    textAlign: 'center',
  },
  done: { alignSelf: 'stretch', marginTop: spacing.xl },
}))
