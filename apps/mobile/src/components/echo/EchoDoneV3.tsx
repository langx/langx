import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import {
  TOKEN_RULES,
  type EchoGrade,
  type EchoQueue,
  type SubmitEchoReviewsResult,
} from '@langx/shared'
import { useIsFetching } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { keys, useEchoSummary } from '../../api/queries'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { CELEBRATION_MS, claimCelebration, RAIN } from '../../lib/celebration'
import { planEchoDone } from '../../lib/echoV3'
import { notification } from '../../lib/haptics'
import { nextStreakMilestone } from '../../lib/homePlan'
import { goBackTo } from '../../lib/navigation'
import { DISPLAY_FONT, makeStyles, PARTNER_HUES, useTheme } from '../../lib/theme'
import { SPRING, STAGGER, TIMING, unlessReduced } from '../../lib/theme/motion'
import { Button } from '../ui/Button'
import { Confetti } from '../ui/Confetti'
import { PressableScale } from '../ui/PressableScale'
import { Screen } from '../ui/Screen'
import { Skeleton } from '../ui/Skeleton'
import { FlameGlyph } from '../ui/StreakFlame'

interface EchoDoneV3Props {
  graded: readonly { reviewId: string; grade: EchoGrade }[]
  /** The session's own queue, still observed: refetched once the batch lands. */
  queue: { data: EchoQueue | undefined; dataUpdatedAt: number }
  submit: {
    data: SubmitEchoReviewsResult | undefined
    submittedAt: number
    isPending: boolean
  }
  saved: boolean
  saveFailed: boolean
  onRetry: () => void
  /** The deck this session drew from, so One more session draws from it again. */
  scope: { lang?: string | undefined; partner?: string | undefined }
}

/**
 * The end of a review under `flags.v3Home`, from `V-EchoDone`: what was
 * answered, what it earned, the streak it kept, how far into the day's paid
 * sessions it is — and One more session while there is a paid one left to
 * fill.
 *
 * Every number is the server's. Tokens are the batch's `award`, and nothing
 * is said about tokens when it paid none. The session count is the
 * summary's `sessionsToday`, fetched after the batch landed — the server's own
 * count on the UTC day it pays by; until that fetch is in, the screen says
 * what was answered and holds the button's place.
 */
export function EchoDoneV3({
  graded,
  queue,
  submit,
  saved,
  saveFailed,
  onRetry,
  scope,
}: EchoDoneV3Props) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [black] = useFonts({ Nunito_900Black })
  const reduce = useReduceMotion()
  const summary = useEchoSummary()

  /*
   * Settled once the batch is saved and the refetches its success started —
   * the summary, and the queue this session drew from — have come back.
   * `submittedAt` tells a refetch after the batch from a read before it,
   * so a summary cached from the tab is never taken for today's count.
   */
  const fetching = useIsFetching({ queryKey: keys.echo }) > 0
  const settled = saved && !fetching
  const since = submit.submittedAt
  const plan = planEchoDone({
    award: submit.data?.award,
    sessionsToday:
      settled && summary.data && summary.dataUpdatedAt > since
        ? summary.data.sessionsToday
        : undefined,
    dueNext: settled && queue.data && queue.dataUpdatedAt > since ? queue.data.dueCount : undefined,
  })
  const remembered = graded.filter((entry) => entry.grade !== 'again').length
  const nextMilestone =
    plan.streakDay !== null
      ? nextStreakMilestone(plan.streakDay, TOKEN_RULES.streakMilestones)
      : null
  const earned = plan.tokens !== null || plan.milestone !== null

  /*
   * The celebration, once per batch and only for one that paid — the
   * sessions, or a streak milestone crossed by a session past the cap: the
   * success haptic always, the confetti only when motion is allowed. It never takes a
   * touch and is over inside `CELEBRATION_MS`, so the buttons are live from
   * the first frame.
   */
  const colours = useMemo(() => PARTNER_HUES.map((hue) => v3.hues[hue]), [v3])
  const pieces = useMemo(() => ({ kind: 'flat', colours }) as const, [colours])
  const [raining, setRaining] = useState(false)
  const eventId = graded[0]?.reviewId
  useEffect(() => {
    if (!earned || !eventId) return
    if (!claimCelebration(`echo-done:${eventId}`)) return
    void notification('success')
    if (!reduce) setRaining(true)
  }, [earned, eventId, reduce])
  // `useReduceMotion` can answer after the first frame; a rain already
  // started stops where it is.
  useEffect(() => {
    if (reduce) setRaining(false)
  }, [reduce])
  useEffect(() => {
    if (!raining) return
    const timer = setTimeout(() => setRaining(false), CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [raining])

  function oneMore(): void {
    router.replace({
      pathname: '/(app)/echo/session',
      params: {
        ...(scope.lang ? { lang: scope.lang } : {}),
        ...(scope.partner ? { partner: scope.partner } : {}),
      },
    })
  }

  function done(): void {
    goBackTo('/(app)/(tabs)/echo')
  }

  function actions() {
    if (saveFailed) {
      return (
        <>
          <Text style={styles.failed}>{t('echo.saveFailedBody')}</Text>
          <Button label={t('common.tryAgain')} loading={submit.isPending} onPress={onRetry} />
          <Button variant="secondary" label={t('common.done')} onPress={done} />
        </>
      )
    }
    if (!settled) {
      // The primary's place, until it is known which of the two it is.
      return (
        <>
          <Skeleton height={56} radius={v3.radius.pill} />
          <Button variant="secondary" label={t('common.done')} onPress={done} />
        </>
      )
    }
    if (plan.more) {
      return (
        <>
          <Button icon="play" label={t('echo.oneMore')} onPress={oneMore} />
          <Button variant="secondary" label={t('common.done')} onPress={done} />
        </>
      )
    }
    return <Button label={t('common.done')} onPress={done} />
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <ScrollView contentContainerStyle={styles.body}>
        {/*
          The hero lands rather than appears: the check pops, the title and
          the line rise a beat apart, and the tokens chip pops whenever the
          award arrives — which is usually a moment after the rest.
        */}
        <View style={styles.hero}>
          <Land from="pop" style={styles.check}>
            <Feather name="check" size={40} color={v3.colors.blue} />
          </Land>
          <Land from="rise" delay={STAGGER}>
            <Text style={[styles.title, !black && styles.titleFallback]} accessibilityRole="header">
              {t('echo.doneTitle')}
            </Text>
          </Land>
          <Land from="rise" delay={STAGGER * 2}>
            <Text style={styles.heroLine}>
              {t('echo.cardCount', { count: graded.length })} ·{' '}
              {t('echo.rememberedCount', { count: remembered })}
            </Text>
          </Land>
          {plan.tokens !== null ? (
            <Land from="pop" style={styles.tokens}>
              <Text style={styles.tokensText}>
                {t('echo.tokensEarned', { count: plan.tokens })}
              </Text>
            </Land>
          ) : null}
        </View>

        {plan.streakDay !== null ? (
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push('/(app)/streak')}
            style={styles.streak}
          >
            <View style={styles.streakDisc}>
              <FlameGlyph size={v3.icon.xxl} color={v3.hues.tangerine} />
            </View>
            {plan.milestone ? (
              /*
               * A streak milestone (`TOKEN_RULES.streakMilestones`) reached
               * through Echo: the milestone by name
               * and what it paid, the bonus landing on its own bounce. Not
               * "streak kept", which is every other day's line.
               */
              <>
                <View style={styles.streakText}>
                  <Text style={styles.streakTitle}>
                    {t('chat.rewardStreak', { count: plan.milestone.day })}
                  </Text>
                  <Text style={styles.streakSub}>
                    {t('chat.celebrateStreakNote', { count: plan.milestone.tokens })}
                  </Text>
                </View>
                <Land from="pop" delay={STAGGER * 3} style={styles.bonus}>
                  <Text style={styles.bonusText}>
                    {t('tokens.shareAmount', { count: plan.milestone.tokens })}
                  </Text>
                </Land>
              </>
            ) : (
              <View style={styles.streakText}>
                <Text style={styles.streakTitle}>
                  {t('echo.streakKept', { day: plan.streakDay })}
                </Text>
                {nextMilestone ? (
                  <Text style={styles.streakSub}>
                    {t('home.streakNext', {
                      count: nextMilestone.day - plan.streakDay,
                      day: nextMilestone.day,
                    })}
                  </Text>
                ) : null}
              </View>
            )}
          </PressableScale>
        ) : null}

        {plan.sessions ? (
          <View style={styles.sessions}>
            <View style={styles.sessionsHead}>
              <Text style={styles.sessionsTitle}>
                {plan.sessions.kind === 'this'
                  ? t('echo.sessionOf', { done: plan.sessions.done, total: plan.sessions.cap })
                  : t('echo.sessionsAllDone', { count: plan.sessions.cap })}
              </Text>
              <View
                style={styles.pips}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {Array.from({ length: plan.sessions.cap }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.pip, index < (plan.sessions?.done ?? 0) && styles.pipOn]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.sessionsSub}>
              {t('echo.sessionsEarn', { count: plan.sessions.cap })}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>{actions()}</View>
      </ScrollView>
      {raining ? <Confetti pieces={pieces} count={36} rain={RAIN.celebration} /> : null}
    </Screen>
  )
}

/**
 * One piece of the hero arriving, once, when it mounts: `pop` scales up on
 * `SPRING.bounce` (the check, a chip), `rise` lifts 12 pt and fades in over
 * `TIMING.enter` (a line of text). Started from an effect, never in render;
 * with reduce motion the piece is simply there.
 */
function Land({
  from,
  delay = 0,
  style,
  children,
}: {
  from: 'pop' | 'rise'
  delay?: number
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reduce = useReduceMotion()
  const shown = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    shown.set(
      unlessReduced(reduce, 1, (to) =>
        withDelay(
          delay,
          from === 'pop' ? withSpring(to, SPRING.bounce) : withTiming(to, TIMING.enter),
        ),
      ),
    )
  }, [reduce, delay, from, shown])
  const motion = useAnimatedStyle(() => {
    const value = shown.get()
    return from === 'pop'
      ? { opacity: Math.min(1, value * 2), transform: [{ scale: 0.6 + 0.4 * value }] }
      : { opacity: value, transform: [{ translateY: (1 - value) * 12 }] }
  })
  return <Animated.View style={[style, motion]}>{children}</Animated.View>
}

const useStyles = makeStyles(({ v3 }) => ({
  body: {
    flexGrow: 1,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[16],
  },
  hero: {
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.hero,
    gap: v3.space[12],
    paddingBottom: v3.space[20],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[24],
  },
  check: {
    alignItems: 'center',
    backgroundColor: v3.colors.onBlue,
    borderRadius: v3.radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: { ...v3.type.display, color: v3.colors.onBlue, marginTop: v3.space[4] },
  titleFallback: { fontFamily: DISPLAY_FONT },
  heroLine: { ...v3.type.body, color: v3.colors.onBlue, fontWeight: '600' },
  tokens: {
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.onBlue,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: v3.space[20],
  },
  tokensText: { ...v3.type.headline, color: v3.colors.ink },
  streak: {
    alignItems: 'center',
    backgroundColor: v3.hues.tangerine,
    borderRadius: v3.radius.badge,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  streakDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  streakText: { flex: 1, minWidth: 0 },
  streakTitle: { ...v3.type.headline, color: v3.colors.ink },
  streakSub: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '600' },
  bonus: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: v3.space[14],
  },
  bonusText: { ...v3.type.headline, color: v3.hues.tangerine, fontVariant: ['tabular-nums'] },
  sessions: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[10],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  sessionsHead: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[10],
    justifyContent: 'space-between',
  },
  sessionsTitle: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  pips: { flexDirection: 'row', gap: v3.space[4] },
  pip: {
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: 10,
    width: 20,
  },
  pipOn: { backgroundColor: v3.colors.blue, borderColor: v3.colors.blue },
  sessionsSub: { ...v3.type.callout, color: v3.colors.muted },
  failed: { ...v3.type.callout, color: v3.colors.fg, textAlign: 'center' },
  // At the foot when there is room, under the blocks when there is not.
  actions: { gap: v3.space[10], marginTop: 'auto', paddingTop: v3.space[8] },
}))
