import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { ApiRequestError } from '../../src/api/client'
import { useClaimGift, useWallet } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { showAlert } from '../../src/lib/alert'
import { giftState, giftTickDelay } from '../../src/lib/gift'
import { impact, notification } from '../../src/lib/haptics'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'
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
 *
 * Three pictures: the yellow tile while a gift is ready, a grey circle and a
 * countdown while it is not, and the amount once one has been opened. The
 * countdown ticks on the minute, as the wallet's card does — a second hand on
 * a box that will not open for forty minutes is a nag.
 */
export default function GiftScreen() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { colors } = useTheme()
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

  const pop = useSharedValue(0)

  // The reveal starts from an effect, once the amount is mounted. Started from
  // the mutation callback, before the `Animated.View` existed, the spring
  // froze part-way on web — the number sat at forty percent opacity forever.
  useEffect(() => {
    if (phase !== 'revealed') return
    pop.value = reduceMotion ? 1 : withSpring(1, { damping: 12, stiffness: 160 })
  }, [phase, reduceMotion, pop])

  const amountStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.6 + 0.4 * pop.value }],
  }))

  function open(): void {
    if (phase !== 'waiting' || !ready || claim.isPending) return
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

  const shake = useShake(open, phase === 'waiting' && ready)

  return (
    // `flex: 1` on the column, or the stage below has no height to centre in:
    // a non-scrolling `Screen` sizes its column to its content.
    <Screen style={styles.screen}>
      <ScreenHeader title={t('gift.title')} onBack={() => goBackTo('/(app)/wallet')} />
      <Text style={styles.body}>{t('gift.body')}</Text>

      <View style={styles.stage}>
        {phase === 'revealed' ? (
          <Animated.View style={[styles.reveal, amountStyle]}>
            {amount > 0 ? (
              <>
                <Text style={styles.amount}>+{amount.toLocaleString(locale)}</Text>
                <Text style={styles.amountUnit}>{t('gift.tokensUnit', { count: amount })}</Text>
              </>
            ) : (
              <Text style={styles.empty}>{t('gift.revealedZero')}</Text>
            )}
          </Animated.View>
        ) : state === null ? (
          <ActivityIndicator />
        ) : state.ready ? (
          <>
            {/* Two views for the hard shadow, as `Button` draws it: the face drops onto the shade on press. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('gift.openAccessibility')}
              accessibilityState={{ disabled: phase !== 'waiting' }}
              disabled={phase !== 'waiting'}
              onPress={open}
              style={styles.tileShade}
            >
              {({ pressed }) => (
                <View
                  style={[styles.tileFace, pressed && phase === 'waiting' && styles.tilePressed]}
                >
                  <Feather name="gift" size={64} color={colors.primaryText} />
                </View>
              )}
            </Pressable>
            <View style={styles.caption}>
              <Text style={styles.captionTitle}>{t('gift.ready')}</Text>
              <Text style={styles.captionSub}>
                {phase === 'opening'
                  ? t('gift.opening')
                  : t(shake.available ? 'gift.shakeHint' : 'gift.tapHint')}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.waitingCircle}>
              <Feather name="gift" size={64} color={colors.textFaint} />
            </View>
            <View style={styles.caption}>
              <Text style={styles.captionTitle}>
                {t('gift.nextIn', { minutes: state.minutes })}
              </Text>
              <Text style={styles.captionSub}>{t('gift.anotherInAnHour')}</Text>
            </View>
          </>
        )}
      </View>

      <Button
        label={t('gift.done')}
        variant="secondary"
        onPress={() => goBackTo('/(app)/wallet')}
        style={styles.done}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  screen: { flex: 1 },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
  stage: { alignItems: 'center', flex: 1, gap: spacing.xl, justifyContent: 'center' },
  // 40 is the prototype's tile radius: rounder than any card, squarer than a circle.
  tileShade: { backgroundColor: colors.primaryShade, borderRadius: 40, paddingBottom: 8 },
  tileFace: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 40,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  tilePressed: { transform: [{ translateY: 8 }] },
  waitingCircle: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  caption: { alignItems: 'center', gap: spacing.xs },
  captionTitle: { ...font.heading, color: colors.text, textAlign: 'center' },
  captionSub: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  reveal: { alignItems: 'center', gap: spacing.xs },
  amount: {
    ...font.heading,
    color: colors.text,
    fontSize: 64,
    lineHeight: 72,
    textAlign: 'center',
  },
  amountUnit: { color: colors.textMuted, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  empty: { color: colors.textMuted, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  done: { marginTop: 20 },
}))
