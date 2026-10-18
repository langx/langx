import { useCallback, useEffect, useReducer, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { notification } from '../../lib/haptics'
import {
  enqueueReward,
  finishReward,
  REWARD_TOAST_MS,
  type QueuedReward,
  type Reward,
} from '../../lib/rewardQueue'
import { makeStyles } from '../../lib/theme'
import { DURATION, SPRING, TIMING, unlessReduced } from '../../lib/theme/motion'

/**
 * "+15 · you both wrote today", drawn still: the pill a `RewardToast` moves.
 * Exported on its own so a screen can show the same words in place, and so
 * the gallery can show it without waiting for one to arrive.
 *
 * The amount is `tokens.shareAmount` ("+{count}") rather than a bare
 * number, so the plus sign and the digits are the locale's.
 */
export function RewardPill({ amount, reason }: { amount: number; reason: string }) {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.pill}>
      <Text style={styles.amount}>{t('tokens.shareAmount', { count: amount })}</Text>
      <View style={styles.dot} />
      <Text style={styles.reason}>{reason}</Text>
    </View>
  )
}

/**
 * A reward, acknowledged in the moment: it rises in with one bounce, stays
 * for `REWARD_TOAST_MS`, and fades up and out. A tap sends it early.
 *
 * Exits by animating its own values and then telling the caller, never by
 * Reanimated's `exiting`: that layout animation is what 4.5.1 crashes on in
 * recycled rows (rule 13), and a toast is often drawn by a screen that is
 * mostly a list. The timers are on the JS thread for the same reason the
 * toast's are — the queue lives there, and a worklet calling back into it
 * would be one more thing that must carry `'worklet'`.
 *
 * Buzzes once, on arrival, and only when the reward asked to: whether a
 * reward is worth a haptic is the caller's decision (one per meaningful
 * action), not the toast's. Under reduced motion it is simply there, and
 * simply gone.
 *
 * Where it sits is the caller's too — absolutely over a screen, above the
 * tab bar, or in a column. `useRewardQueue` feeds it.
 */
export function RewardToast({
  reward,
  onDone,
}: {
  reward: QueuedReward | null
  onDone: (id: number) => void
}) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const shown = useSharedValue(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = (): void => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
  }

  const leave = useCallback(
    (id: number) => {
      clear()
      shown.set(unlessReduced(reduce, 0, (to) => withTiming(to, TIMING.release)))
      timers.current.push(setTimeout(() => onDone(id), reduce ? 0 : DURATION.release))
    },
    [reduce, shown, onDone],
  )

  const id = reward?.id
  const haptic = reward?.haptic ?? false
  useEffect(() => {
    if (id === undefined) return
    if (haptic) void notification('success')
    shown.set(0)
    shown.set(unlessReduced(reduce, 1, (to) => withSpring(to, SPRING.bounce)))
    timers.current.push(setTimeout(() => leave(id), REWARD_TOAST_MS))
    return clear
    // Keyed on the id alone: a merged amount or a late answer from
    // `useReduceMotion` must not restart a toast that is already up.
  }, [id])

  const motion = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get() * 1.5),
    transform: [{ translateY: (1 - shown.get()) * 12 }, { scale: 0.92 + 0.08 * shown.get() }],
  }))

  if (!reward) return null

  return (
    <Animated.View style={[styles.layer, motion]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={() => leave(reward.id)}
      >
        <RewardPill amount={reward.amount} reason={reward.reason} />
      </Pressable>
    </Animated.View>
  )
}

/**
 * The queue a `RewardToast` reads: `show` a reward from anywhere in the
 * screen, hand `current` and `done` to the toast. The rules — one at a time,
 * same reason merged, nothing for nothing — are `lib/rewardQueue.ts`'s.
 */
export function useRewardQueue(): {
  current: QueuedReward | null
  show: (reward: Reward) => void
  done: (id: number) => void
} {
  const nextId = useRef(1)
  const [queue, dispatch] = useReducer(
    (state: QueuedReward[], action: { show: Reward; id: number } | { done: number }) =>
      'show' in action
        ? enqueueReward(state, action.show, action.id)
        : finishReward(state, action.done),
    [],
  )
  const show = useCallback((reward: Reward) => dispatch({ show: reward, id: nextId.current++ }), [])
  const done = useCallback((id: number) => dispatch({ done: id }), [])
  return { current: queue[0] ?? null, show, done }
}

const useStyles = makeStyles(({ v3 }) => ({
  layer: { alignItems: 'center' },
  /*
   * The ink pill, which inverts with the ground — a reward reports what
   * happened, and the one yellow on a screen is kept for what makes
   * something happen. No shadow: v3 is flat, and the pill is the only dark
   * (or, after dark, the only light) shape near it.
   */
  pill: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    maxWidth: 420,
    minHeight: 48,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[8],
  },
  amount: { ...v3.type.headline, color: v3.colors.pillText },
  dot: {
    backgroundColor: v3.colors.pillText,
    borderRadius: v3.radius.pill,
    height: 4,
    opacity: 0.6,
    width: 4,
  },
  reason: { ...v3.type.callout, color: v3.colors.pillText, flexShrink: 1, fontWeight: '600' },
}))
