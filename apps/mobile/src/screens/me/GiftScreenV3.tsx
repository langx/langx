import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { ApiRequestError } from '../../api/client'
import { useClaimGift, useWallet } from '../../api/queries'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useShake } from '../../hooks/useShake'
import { useLocale, useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { giftState, giftTickDelay } from '../../lib/gift'
import { impact, notification } from '../../lib/haptics'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { useV3Fonts } from './useV3Fonts'

type Phase = 'waiting' | 'opening' | 'revealed'

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

  const pop = useSharedValue(0)

  // Started once the amount is mounted, for today's reason (a spring started
  // before its view existed froze part-way on web).
  useEffect(() => {
    if (phase !== 'revealed') return
    pop.set(reduceMotion ? 1 : withSpring(1, { damping: 12, stiffness: 160 }))
  }, [phase, reduceMotion, pop])

  const amountStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: pop.get(),
      transform: [{ scale: 0.6 + 0.4 * pop.get() }],
    }
  })

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
        <View style={[styles.ring, styles.ringOuter]} pointerEvents="none" />
        <View style={[styles.ring, styles.ringInner]} pointerEvents="none" />
        {phase === 'revealed' ? (
          <Animated.View style={[styles.reveal, amountStyle]}>
            {amount > 0 ? (
              <>
                <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                  +{amount.toLocaleString(locale)}
                </Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('gift.openAccessibility')}
              accessibilityState={{ disabled: phase !== 'waiting' }}
              disabled={phase !== 'waiting'}
              onPress={open}
              style={({ pressed }) => [
                styles.box,
                pressed && phase === 'waiting' && !reduceMotion && styles.boxPressed,
              ]}
            >
              <Feather name="gift" size={64} color={v3.colors.onYellow} />
              <Text style={styles.boxLabel}>{t('gift.openLabel')}</Text>
            </Pressable>
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
  boxPressed: { transform: [{ scale: 0.97 }] },
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
  reveal: { alignItems: 'center', gap: v3.space[4] },
  amount: { ...v3.type.numeral, color: v3.colors.ink, lineHeight: 84, textAlign: 'center' },
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
