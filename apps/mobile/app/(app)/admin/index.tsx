import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  useAdminFunnel,
  useAdminPulse,
  useAdminStats,
  type AdminFunnelWindow,
  type AdminStatsDto,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { BarList, type BarListRow } from '../../../src/components/admin/BarList'
import { Columns, type ColumnPoint } from '../../../src/components/admin/Columns'
import { Callout } from '../../../src/components/ui/Callout'
import { ListRow } from '../../../src/components/ui/ListRow'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { StatTile } from '../../../src/components/ui/StatTile'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN, adminPercent } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * The operator's first screen: who is here now, what is waiting, and where the
 * numbers are going.
 *
 * Three sources, on three clocks, and that is the whole shape of this file.
 * `GET /admin/stats` is one `Promise.all` with a minute of memory behind it —
 * see `modules/admin/stats.ts` for why each of its queries is cheap and why
 * the obvious ones that are not are deliberately absent. `GET /admin/pulse` is
 * one indexed count polled every fifteen seconds, which is what makes the card
 * at the top live. `GET /admin/funnel` leaves the building to ask PostHog, so
 * it is fetched per window, only when a window is looked at, and cached for
 * half an hour at both ends.
 *
 * Every chart here is a single series, drawn in one colour with no legend:
 * two measures on one pair of axes is the mistake this dashboard would make
 * first — messages outnumber new members by three orders of magnitude, and a
 * shared scale would flatten the series that matters into the baseline. So
 * they are separate charts under their own headings instead.
 */
export default function AdminHomeScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()

  const stats = useAdminStats()
  const pulse = useAdminPulse()
  const [funnelWindow, setFunnelWindow] = useState<AdminFunnelWindow>('30d')

  const queue = stats.data?.queue
  const audience = stats.data?.audience
  const money = stats.data?.money
  const shared = stats.data?.public
  /*
   * The charts' own series, cut in the operator's zone rather than in UTC —
   * `shared` keeps the totals, the streaks and the languages, which are
   * counts over everything and have no day in them.
   */
  const daily = audience?.daily ?? []

  const refresh = (): void => {
    void stats.refetch()
    void pulse.refetch()
  }

  return (
    <AdminGate>
      <Screen scroll fluid onRefresh={refresh} refreshing={stats.isFetching}>
        <ScreenHeader title={ADMIN.home.title} onBack={() => goBackTo('/(app)/settings')} />

        <Callout tone="warning" icon="shield">
          <Text style={styles.calloutBody}>{ADMIN.warning}</Text>
        </Callout>

        {/*
         * Above the queue, and outside the dashboard's own loading branch: it
         * is on its own request and its own clock, so a slow `/admin/stats`
         * must not hold back the one number on this screen that is about now.
         */}
        <LiveCard />

        {stats.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={80} />
            <Skeleton height={200} />
          </View>
        ) : stats.isError ? (
          <Callout tone="error">
            <Text style={styles.calloutBody}>{ADMIN.home.failedToLoad}</Text>
          </Callout>
        ) : (
          <>
            <View style={styles.group}>
              {/*
               * Tinted only when there is something in it. A zero beside
               * "Reports" is the normal state of this panel, and a queue that
               * always looks urgent is one nobody reads.
               */}
              <ListRow
                title={ADMIN.home.reports}
                accessory={<QueueCount count={queue?.reports ?? 0} />}
                onPress={() => router.push('/(app)/admin/reports')}
              />
              <ListRow
                title={ADMIN.home.appeals}
                accessory={<QueueCount count={queue?.appeals ?? 0} />}
                onPress={() => router.push('/(app)/admin/reports?tab=appeals')}
              />
              <ListRow
                title={ADMIN.home.feedback}
                accessory={<QueueCount count={queue?.feedback ?? 0} />}
                onPress={() => router.push('/(app)/admin/feedback')}
              />
              <ListRow
                title={ADMIN.home.broadcast}
                onPress={() => router.push('/(app)/admin/broadcast')}
              />
              <ListRow title={ADMIN.home.users} onPress={() => router.push('/(app)/admin/users')} />
              <ListRow
                title={ADMIN.home.system}
                onPress={() => router.push('/(app)/admin/system')}
                last
              />
            </View>

            <Heading>{ADMIN.home.sections.audience}</Heading>
            {/*
             * Where the days on this screen turn over. One line, once: the
             * strips below are the reader's own days except where a caption
             * or a label says UTC, and which zone that is cannot be guessed
             * from the numbers.
             */}
            <Text style={styles.muted}>{ADMIN.home.daysIn(stats.data?.timeZone ?? '')}</Text>
            <View style={styles.tiles}>
              <StatTile value={count(audience?.joinedToday)} label={ADMIN.home.joinedToday} />
              <StatTile value={count(audience?.joinedLastMonth)} label={ADMIN.home.joinedMonth} />
              <StatTile value={count(audience?.activeToday)} label={ADMIN.home.activeToday} />
              <StatTile value={count(audience?.seenLastMonth)} label={ADMIN.home.seenMonth} />
            </View>

            {/*
             * The one strip on this screen that is not the reader's own day,
             * and it says so in its caption. `dailyActivity` is bucketed per
             * UTC day with no sub-day grain to re-cut — see the note at the
             * top of `modules/admin/stats.ts`.
             */}
            <Chart
              title={ADMIN.home.charts.activeDaily}
              caption={`${ADMIN.home.charts.lastDays(audience?.activeDaily.length || 30)} · ${ADMIN.home.charts.activeDailyNote}`}
              points={(audience?.activeDaily ?? []).map(dayPoint)}
            />
            <Chart
              title={ADMIN.home.charts.newMembers}
              caption={ADMIN.home.charts.lastDays(daily.length || 30)}
              points={daily.map((day) => ({ key: day.day, value: day.members }))}
            />

            <Heading>{ADMIN.home.sections.talking}</Heading>
            <View style={styles.tiles}>
              <StatTile value={count(audience?.profiles)} label={ADMIN.home.profiles} />
              <StatTile value={count(audience?.messages)} label={ADMIN.home.messages} />
              <StatTile
                value={count(shared?.totals.corrections)}
                label={ADMIN.home.corrections}
                tone="success"
              />
              <StatTile value={count(shared?.totals.languages)} label={ADMIN.home.languageCount} />
            </View>

            <Chart
              title={ADMIN.home.charts.messagesDaily}
              caption={ADMIN.home.charts.lastDays(daily.length || 30)}
              points={daily.map((day) => ({ key: day.day, value: day.messages }))}
            />
            {/*
             * Green, because a correction is always the green pair in this app
             * — see the palette's note. It is a separate chart rather than a
             * second series over the messages above it for the reason at the
             * top of this file.
             */}
            <Chart
              title={ADMIN.home.charts.correctionsDaily}
              caption={ADMIN.home.charts.lastDays(daily.length || 30)}
              color={colors.success}
              points={daily.map((day) => ({ key: day.day, value: day.corrections }))}
            />

            <View style={styles.tiles}>
              <StatTile
                value={count(shared?.streaks.longest)}
                label={ADMIN.home.streaks.longest}
                icon="zap"
                iconColor={colors.streak}
              />
              <StatTile value={count(shared?.streaks.active)} label={ADMIN.home.streaks.active} />
            </View>

            <Heading>{ADMIN.home.sections.languages}</Heading>
            <Text style={styles.subheading}>{ADMIN.home.languages.learning}</Text>
            <BarList
              rows={(shared?.learning ?? []).slice(0, TOP_LANGUAGES).map(languageRow)}
              empty={ADMIN.home.languages.none}
            />
            <Text style={styles.subheading}>{ADMIN.home.languages.native}</Text>
            <BarList
              rows={(shared?.native ?? []).slice(0, TOP_LANGUAGES).map(languageRow)}
              color={colors.pro}
              empty={ADMIN.home.languages.none}
            />

            <Heading>{ADMIN.home.sections.funnel}</Heading>
            <SegmentedControl
              options={FUNNEL_WINDOWS}
              selected={[funnelWindow]}
              onToggle={setFunnelWindow}
              accessibilityLabel={ADMIN.home.sections.funnel}
            />
            <Funnel window={funnelWindow} />

            <Heading>{ADMIN.home.sections.money}</Heading>
            <View style={styles.tiles}>
              <StatTile
                value={count(money?.tiers.pro)}
                label={ADMIN.home.pro}
                onPress={() => router.push('/(app)/admin/members?tier=pro')}
              />
              <StatTile
                value={count(money?.tiers.proPlus)}
                label={ADMIN.home.proPlus}
                onPress={() => router.push('/(app)/admin/members?tier=pro_plus')}
              />
              <StatTile value={count(money?.tiers.free)} label={ADMIN.home.free} />
              <StatTile value={count(money?.tiers.total)} label={ADMIN.home.totalMembers} />
            </View>
            {money ? <PaidShare tiers={money.tiers} /> : null}

            <Chart
              title={ADMIN.home.charts.tokensDaily}
              caption={ADMIN.home.charts.lastDays(money?.tokensDaily.length || 30)}
              color={colors.primary}
              points={(money?.tokensDaily ?? []).map(dayPoint)}
            />

            <Heading>{ADMIN.home.poolYesterday}</Heading>
            {money?.pool ? (
              <Text style={styles.line}>
                {money.pool.paid} {ADMIN.home.poolPaid} · {money.pool.distributed}{' '}
                {ADMIN.home.poolDistributed}
              </Text>
            ) : (
              <Text style={styles.muted}>{ADMIN.home.poolNone}</Text>
            )}

            {audience?.builds.length ? (
              <>
                <Heading>{ADMIN.home.builds}</Heading>
                <BarList
                  rows={audience.builds.slice(0, TOP_BUILDS).map((build) => ({
                    key: `${build.platform}-${build.version}`,
                    label: build.version,
                    hint: build.platform,
                    value: build.count,
                  }))}
                  color={colors.textMuted}
                  empty={ADMIN.home.languages.none}
                />
              </>
            ) : null}
          </>
        )}
      </Screen>
    </AdminGate>
  )
}

/** Eight rows is what fits without the section becoming the screen. */
const TOP_LANGUAGES = 8
const TOP_BUILDS = 6

const FUNNEL_WINDOWS: readonly { value: AdminFunnelWindow; label: string }[] = [
  { value: '30d', label: ADMIN.home.funnel.lastMonth },
  { value: 'all', label: ADMIN.home.funnel.allTime },
]

/**
 * How many people are in the app at this moment, and the hour behind them.
 *
 * The number is counted fresh on every poll; the columns are a minute each,
 * recorded server-side so the chart has a past the moment this opens rather
 * than drawing itself while somebody watches. A minute nobody sampled is a gap
 * and not a zero — see `modules/admin/pulse.ts`.
 *
 * The whole card is the target rather than the chart alone: the number, the
 * chart and the window under it are three views of one set of people, so any
 * of them is a reasonable place to press to go and read their names.
 */
function LiveCard() {
  const styles = useStyles()
  const { colors } = useTheme()
  const pulse = useAdminPulse()

  if (!pulse.data) return <Skeleton height={148} />

  const { online, history, windowMs } = pulse.data
  const recorded = history.filter((point) => point.online !== null)
  const peak = Math.max(...recorded.map((point) => point.online ?? 0), 0)

  return (
    <Pressable
      style={styles.live}
      onPress={() => router.push('/(app)/admin/online')}
      accessibilityRole="button"
      accessibilityLabel={`${online} ${ADMIN.home.live.online}, ${ADMIN.home.live.seeWho}`}
    >
      <View style={styles.liveTop}>
        <View style={styles.badge}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.badgeText}>{ADMIN.home.live.badge}</Text>
        </View>
        {recorded.length > 0 ? (
          <Text style={styles.muted}>{ADMIN.home.live.peak(peak)}</Text>
        ) : null}
      </View>

      <View style={styles.liveValue}>
        <Text style={styles.hero}>{online.toLocaleString('en')}</Text>
        <Text style={styles.heroLabel}>{ADMIN.home.live.online}</Text>
      </View>
      <Text style={styles.muted}>
        {ADMIN.home.live.window(Math.round(windowMs / 60000))} · {ADMIN.home.live.seeWho}
      </Text>

      <View style={styles.liveChart}>
        {recorded.length === 0 ? (
          <Text style={styles.muted}>{ADMIN.home.live.warmingUp}</Text>
        ) : (
          <>
            <Columns
              points={history.map((point) => ({ key: point.at, value: point.online }))}
              color={colors.success}
              height={56}
              accessibilityLabel={`${ADMIN.home.live.online}, ${ADMIN.home.live.peak(peak)}`}
            />
            <View style={styles.axis}>
              <Text style={styles.axisLabel}>{ADMIN.home.live.hourAgo}</Text>
              <Text style={styles.axisLabel}>{ADMIN.home.live.now}</Text>
            </View>
          </>
        )}
      </View>
    </Pressable>
  )
}

/**
 * The funnel, per window.
 *
 * Every step is measured against the first one, so the bars read as a funnel
 * rather than as a ranked list; the line under each carries the step-to-step
 * rate, which is where the hole actually is. An instance with no PostHog key
 * says so in place of the chart — no analytics is a supported way to run
 * LangX, not a broken screen.
 */
function Funnel({ window }: { window: AdminFunnelWindow }) {
  const styles = useStyles()
  const funnel = useAdminFunnel(window)

  if (funnel.isPending) return <Text style={styles.muted}>{ADMIN.home.funnel.loading}</Text>
  if (funnel.isError || !funnel.data)
    return <Text style={styles.muted}>{ADMIN.home.funnel.failed}</Text>
  if ('reason' in funnel.data)
    return <Text style={styles.muted}>{ADMIN.home.funnel[funnel.data.reason]}</Text>

  const { steps } = funnel.data
  const top = steps[0]?.count ?? 0
  const rows: BarListRow[] = steps.map((step, i) => {
    const previous = i === 0 ? step.count : (steps[i - 1]?.count ?? 0)
    return {
      key: `${i}-${step.label}`,
      label: step.label,
      value: step.count,
      hint:
        i === 0
          ? ADMIN.home.funnel.top
          : ADMIN.home.funnel.ofPrevious(adminPercent(step.count, previous)),
    }
  })

  return <BarList rows={rows} scale={top} empty={ADMIN.home.funnel.none} />
}

/** What share of the members on a plan are paying for one. */
function PaidShare({ tiers }: { tiers: AdminStatsDto['money']['tiers'] }) {
  const styles = useStyles()
  const paid = tiers.pro + tiers.proPlus
  const fraction = tiers.total > 0 ? paid / tiers.total : 0
  const label = ADMIN.home.paidShare(paid, tiers.total)

  return (
    <View style={styles.meter}>
      {/*
       * A meter rather than a stacked bar of the three tiers. Free is most of
       * the ground here, so the two paid segments would be slivers a reader
       * could not compare — and the question this answers is one number, not
       * three.
       */}
      <ProgressBar value={fraction} height={6} accessibilityLabel={label} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  )
}

/** A chart and the two lines that say what it plots. */
function Chart({
  title,
  caption,
  points,
  color,
}: {
  title: string
  caption: string
  points: ColumnPoint[]
  color?: string
}) {
  const styles = useStyles()
  /*
   * Thirty columns are too narrow to label one by one — a date under each at
   * 10px is unreadable whatever it says — so a series that carries no labels
   * of its own gets its two ends instead. That is the whole x axis it needs:
   * the caption above says how long the window is, and these say where it
   * starts and stops.
   */
  const ends = points.some((point) => point.label)
    ? null
    : [points[0]?.key, points.at(-1)?.key].map(monthDay)

  return (
    <View style={styles.chart}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.axisLabel}>{caption}</Text>
      </View>
      <Columns
        points={points}
        {...(color ? { color } : {})}
        accessibilityLabel={`${title}, ${caption}`}
      />
      {ends ? (
        <View style={styles.axis}>
          <Text style={styles.axisLabel}>{ends[0]}</Text>
          <Text style={styles.axisLabel}>{ends[1]}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** `2026-09-19` as `Sep 19`. English, like the rest of this surface. */
function monthDay(day: string | undefined): string {
  if (!day) return ''
  const at = new Date(`${day}T00:00:00Z`)
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function Heading({ children }: { children: string }) {
  const styles = useStyles()
  return <Text style={styles.heading}>{children}</Text>
}

/** The number beside a queue row, in ink only when there is something in it. */
function QueueCount({ count: n }: { count: number }) {
  const styles = useStyles()
  return <Text style={[styles.queueCount, n > 0 && styles.queueCountOpen]}>{n}</Text>
}

/**
 * A day key as one column. `slice(8)` is the day of the month — the labels sit
 * under a thirty-column chart at 10px, and a full date there is illegible
 * whatever it says.
 */
function dayPoint(day: { day: string; count: number }): ColumnPoint {
  return { key: day.day, value: day.count, label: day.day.slice(8) }
}

function languageRow(language: { code: string; name: string; count: number }): BarListRow {
  return { key: language.code, label: language.name, value: language.count }
}

/** English throughout, like the rest of this surface. */
function count(value: number | undefined): string {
  return (value ?? 0).toLocaleString('en')
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12, marginTop: 16 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  group: { marginTop: 16 },
  heading: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  subheading: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  line: { fontSize: 15, color: theme.colors.text, marginBottom: 4 },
  muted: { fontSize: 13, color: theme.colors.textMuted },

  // The one panel on this screen that is a surface. Everything else sits on
  // the ground with dividers between, which is v3's rule; the live card is
  // lifted because it is the only thing here that changes while you look at it.
  live: {
    backgroundColor: theme.colors.fill,
    borderRadius: theme.radius.lg,
    gap: 4,
    marginTop: 16,
    padding: 16,
  },
  liveTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  badge: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  badgeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  liveValue: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
  // The one hero figure on the screen, and the only number drawn this big.
  hero: { ...theme.font.title, color: theme.colors.text, fontSize: 44, lineHeight: 52 },
  heroLabel: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '600' },
  liveChart: { marginTop: 12 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { color: theme.colors.textFaint, fontSize: 11 },

  chart: { marginTop: 18 },
  chartHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },

  meter: { gap: 8, marginTop: 16 },

  queueCount: { color: theme.colors.textFaint, fontSize: 15, fontVariant: ['tabular-nums'] },
  queueCountOpen: { color: theme.colors.text, fontWeight: '700' },
}))
