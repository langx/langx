import Feather from '@expo/vector-icons/Feather'
import { useEffect, type ReactNode } from 'react'
import { AccessibilityInfo, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, unlessReduced } from '../../lib/theme/motion'
import type { ThreadReward } from '../../lib/threadRewards'
import { FlameGlyph } from '../ui/StreakFlame'

/**
 * How long after the send a chip still counts as news. A row the list
 * virtualised away and brings back remounts its chip, and replaying the
 * entrance (or the announcement) then would be telling the reader twice.
 */
const FRESH_MS = 1500

/**
 * "+10 · you corrected Anna", centred under the message that earned it.
 *
 * Only ever drawn from the server's award for a send this screen made (see
 * `threadRewards`), and never stored: leave the thread and the chips are
 * gone, because the message does not carry them and a number redrawn from
 * anywhere else would be a guess.
 *
 * A status, not a control — there is nothing to do with it, so it takes no
 * press and needs no target size. It rises in with one bounce when it is
 * news and is simply there under reduced motion; it is announced once, then.
 *
 * The correction's chip is the correction's green, as the drawing has it;
 * the others sit on the partner's hue, with ink on it as every hue-lettered
 * chip has.
 */
export function RewardChipV3({
  reward,
  partnerName,
  hue,
  at,
}: {
  reward: ThreadReward
  partnerName: string
  /** The partner's hue, as a colour. */
  hue: string | undefined
  /** When the award arrived, `Date.now()`. */
  at: number
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  const fresh = Date.now() - at < FRESH_MS
  const shown = useSharedValue(fresh ? 0 : 1)

  const corrected = reward.kind === 'corrected'
  const amount =
    reward.kind === 'bothWrote'
      ? t('chat.rewardBothAmount', { count: reward.amount })
      : t('tokens.shareAmount', { count: reward.amount })
  const reason =
    reward.kind === 'corrected'
      ? t('chat.rewardCorrected', { name: partnerName })
      : reward.kind === 'bothWrote'
        ? t('chat.rewardBothWrote')
        : t('chat.rewardStreak', { count: reward.days })
  const label =
    reward.kind === 'bothWrote'
      ? t('chat.rewardBothLabel', { count: reward.amount, name: partnerName })
      : t('chat.rewardLabel', { count: reward.amount, reason })
  const ground = corrected ? v3.colors.correctionTint : (hue ?? v3.hues.lilac)
  const ink = corrected ? v3.colors.correction : v3.colors.ink

  useEffect(() => {
    shown.set(unlessReduced(reduce, 1, (to) => withSpring(to, SPRING.bounce)))
    // Keyed on `reduce` alone: its answer can arrive after the first render,
    // and a chip already in place has nothing to replay.
  }, [reduce])

  useEffect(() => {
    if (fresh) AccessibilityInfo.announceForAccessibility(label)
    // Once, on arrival; a remount of an old chip is not news.
  }, [])

  const motion = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get() * 1.5),
    transform: [{ translateY: (1 - shown.get()) * 8 }, { scale: 0.92 + 0.08 * shown.get() }],
  }))

  return (
    <Animated.View style={[styles.row, motion]}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        style={[styles.chip, { backgroundColor: ground }]}
      >
        {corrected ? (
          <Feather name="check" size={16} color={ink} />
        ) : (
          <FlameGlyph size={16} color={ink} />
        )}
        <Text style={[styles.text, { color: ink }]} numberOfLines={2}>
          {t('chat.rewardChip', { amount, reason })}
        </Text>
      </View>
    </Animated.View>
  )
}

/**
 * A message row with the chips its send earned under it. Always the same
 * shape, chips or none, so a chip arriving never remounts the bubble above
 * it; with no chips (and always with the flag off) it draws the row alone.
 */
export function WithRewardChips({
  rewards,
  partnerName,
  hue,
  children,
}: {
  rewards: { chips: ThreadReward[]; at: number } | undefined
  partnerName: string
  hue: string | undefined
  children: ReactNode
}) {
  return (
    <>
      {children}
      {rewards?.chips.map((reward) => (
        <RewardChipV3
          key={reward.kind}
          reward={reward}
          partnerName={partnerName}
          hue={hue}
          at={rewards.at}
        />
      ))}
    </>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', paddingHorizontal: v3.space[16], paddingVertical: v3.space[4] },
  chip: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    maxWidth: 420,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[6],
  },
  text: { ...v3.type.buttonSmall, flexShrink: 1, textAlign: 'center' },
}))
