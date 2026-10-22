import { useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import { claimCelebration } from '../../lib/celebration'
import { notification } from '../../lib/haptics'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING } from '../../lib/theme/motion'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { FlameGlyph } from '../ui/StreakFlame'

/**
 * The streak milestone a send just crossed, celebrated in the thread, under
 * the message that crossed it: the flame and the days, what the milestone
 * paid, Share and a ✕.
 *
 * V-Celebrate draws this moment as a sheet over the thread. Here it is a
 * block in the list instead, because the person has just sent and is most
 * likely still typing: a sheet would take the composer away mid-thought, and
 * this sits where the reward chips sit and scrolls with the thread. It is
 * also smaller than the drawing's for the same reason — with the keyboard up
 * a phone has little thread left, and `compact` then drops the sentence.
 *
 * Only the server's milestone is celebrated: `days` and `amount` come from
 * the send's award, so there is nothing here the client counted. The
 * drawing's "days together" is a pair streak, which the server does not keep
 * yet; this is the person's own streak, which it does.
 *
 *   - **Once per milestone.** `eventId` is the streak day; the rise and the
 *     haptic play only the first time it is claimed in this run of the app.
 *     A row the list recycles and brings back is the block, standing still.
 *   - **Skippable.** The ✕ folds it into the plain "+50 · 7-day streak"
 *     chip, so the reward stays acknowledged.
 *   - **Reduced motion** is the block in place, with the haptic, as
 *     `CelebrationSheet` does it.
 *   - Not announced on its own: the row announces everything the send earned
 *     in one sentence (`WithRewardChips`), so iOS does not cut one off.
 */
export function ThreadCelebrationV3({
  eventId,
  days,
  amount,
  hue,
  onShare,
  compact,
  onClose,
}: {
  eventId: string
  days: number
  amount: number
  /** The partner's hue, as a colour — the thread's colour, as the chips use. */
  hue: string | undefined
  /**
   * Opens the streak's share card — the days and the invite, never the
   * tokens. Absent before the handle has arrived.
   */
  onShare: (() => void) | undefined
  /** The soft keyboard is up: the sentence goes, the rest stays. */
  compact: boolean
  onClose: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  const shown = useSharedValue(1)
  const decided = useRef<string | null>(null)

  /*
   * Decided once per milestone, in an effect: claiming is a side effect, and
   * the ref keeps a development double-run from finding it already claimed.
   */
  useEffect(() => {
    if (decided.current === eventId) return
    decided.current = eventId
    if (!claimCelebration(eventId)) return
    void notification('success')
    if (reduce) return
    shown.set(0)
    shown.set(withSpring(1, SPRING.bounce))
  }, [eventId, reduce, shown])

  // `useReduceMotion` can answer after the first frame; then it stops at rest.
  useEffect(() => {
    if (reduce) shown.set(1)
  }, [reduce, shown])

  const motion = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.4 + shown.get()),
    transform: [{ translateY: (1 - shown.get()) * 16 }, { scale: 0.94 + 0.06 * shown.get() }],
  }))

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.block, { backgroundColor: hue ?? v3.hues.lilac }, motion]}>
        <View style={styles.top}>
          <View style={styles.flame}>
            <FlameGlyph size={24} color={hue ?? v3.hues.lilac} />
            <Text style={[styles.flameCount, { color: hue ?? v3.hues.lilac }]}>
              {days.toLocaleString(locale)}
            </Text>
          </View>
          <IconButton
            icon="x"
            look="hue"
            iconSize={20}
            accessibilityLabel={t('common.close')}
            onPress={onClose}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('chat.rewardStreak', { count: days })}
        </Text>
        {compact ? null : (
          <Text style={styles.body}>{t('chat.celebrateStreakBody', { count: days })}</Text>
        )}
        <View style={styles.foot}>
          <View style={styles.rewardChip}>
            <Text style={[styles.rewardText, { color: hue ?? v3.hues.lilac }]}>
              {t('tokens.shareAmount', { count: amount })}
            </Text>
          </View>
          <Text style={styles.rewardNote}>{t('chat.celebrateStreakNote', { count: amount })}</Text>
          {onShare ? (
            <Button
              variant="hue"
              size="small"
              icon="share"
              style={styles.share}
              label={t('share.action')}
              onPress={onShare}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', paddingHorizontal: v3.space[12], paddingVertical: v3.space[6] },
  block: {
    alignSelf: 'stretch',
    borderRadius: v3.radius.hero,
    gap: v3.space[8],
    maxWidth: 560,
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[12],
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  flame: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    minHeight: 40,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[10],
  },
  flameCount: v3.type.headline,
  title: { ...v3.type.title, color: v3.colors.ink },
  body: { ...v3.type.body, color: v3.colors.ink, fontWeight: '500' },
  foot: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  // The kit's Button is full width by default, which would take the whole line.
  share: { width: 'auto' },
  rewardChip: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: v3.space[14],
  },
  rewardText: v3.type.headline,
  rewardNote: { ...v3.type.callout, color: v3.colors.ink, flexShrink: 1, fontWeight: '600' },
}))
