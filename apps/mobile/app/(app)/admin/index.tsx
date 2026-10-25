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
import {
  AdminBlockV3,
  AdminCaptionV3,
  AdminHeadingV3,
  AdminNavRowV3,
  AdminNoteV3,
  AdminRowsV3,
  AdminScreenV3,
  AdminStatV3,
  AdminStatsV3,
  AdminSubheadingV3,
  useAdminWide,
} from '../../../src/components/admin/AdminKitV3'
import { BarList, type BarListRow } from '../../../src/components/admin/BarList'
import { Columns, type ColumnPoint } from '../../../src/components/admin/Columns'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN, adminPercent } from '../../../src/lib/adminStrings'
import { isDebugPanelEnabled } from '../../../src/lib/debugPanel'
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
 *
 * Drawn from `V-Admin`: on a desk the queues and the doors sit in a column
 * beside the live card and the numbers; on a phone it is one column, the live
 * card first.
 */
export default function AdminHomeScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const wide = useAdminWide()

  const stats = useAdminStats()
  const pulse = useAdminPulse()
  const [funnelWindow, setFunnelWindow] = useState<AdminFunnelWindow>('30d')

  const queue = stats.data?.queue
  const audience = stats.data?.audience
  const money = stats.data?.money
  const shared = stats.data?.public
  // The three per-day charts are the public page's own series, in UTC like
  // everything else on this screen.
  const daily = shared?.daily ?? []

  const refresh = (): void => {
    void stats.refetch()
    void pulse.refetch()
  }

  /*
   * Copilot's only way in until its screens exist. An operator's page, not a
   * developer's: it is how Copilot is tried on a real build before anybody
   * else can reach it, so it is not behind the debug flag. The gallery is a
   * developer's page rather than an operator's, so it only exists where the
   * other debug surfaces do: a dev build with the flag set.
   */
  const extras = (
    <AdminRowsV3>
      <AdminNavRowV3
        icon="star"
        title={ADMIN.copilot.entryRow}
        onPress={() => router.push('/(app)/admin/copilot')}
      />
      {isDebugPanelEnabled() ? (
        <AdminNavRowV3
          icon="layout"
          title={ADMIN.gallery.entryRow}
          onPress={() => router.push('/(app)/admin/gallery')}
        />
      ) : null}
    </AdminRowsV3>
  )

  /*
   * The queues and the doors, inside the dashboard's loading branch as they
   * always were: the counts beside the queues are `/admin/stats`'s.
   */
  const doors = stats.isPending ? (
    <Skeleton height={190} />
  ) : stats.isError ? null : (
    <>
      {/*
       * Tinted only when there is something in it. A zero beside "Reports" is
       * the normal state of this panel, and a queue that always looks urgent
       * is one nobody reads.
       */}
      <AdminRowsV3>
        <AdminNavRowV3
          icon="flag"
          hue="tangerine"
          title={ADMIN.home.reports}
          count={queue?.reports ?? 0}
          onPress={() => router.push('/(app)/admin/reports')}
        />
        <AdminNavRowV3
          icon="life-buoy"
          hue="lilac"
          title={ADMIN.home.appeals}
          count={queue?.appeals ?? 0}
          onPress={() => router.push('/(app)/admin/reports?tab=appeals')}
        />
        <AdminNavRowV3
          icon="inbox"
          hue="sky"
          title={ADMIN.home.feedback}
          count={queue?.feedback ?? 0}
          onPress={() => router.push('/(app)/admin/feedback')}
        />
        <AdminNavRowV3
          icon="shield"
          hue="mint"
          title={ADMIN.home.moderators}
          count={queue?.modActions ?? 0}
          onPress={() => router.push('/(app)/admin/moderators')}
        />
      </AdminRowsV3>
      <AdminRowsV3>
        <AdminNavRowV3
          icon="send"
          title={ADMIN.home.broadcast}
          onPress={() => router.push('/(app)/admin/broadcast')}
        />
        <AdminNavRowV3
          icon="search"
          title={ADMIN.home.users}
          onPress={() => router.push('/(app)/admin/users')}
        />
        <AdminNavRowV3
          icon="gift"
          title={ADMIN.home.giftCodes}
          onPress={() => router.push('/(app)/admin/gift-codes')}
        />
        <AdminNavRowV3
          icon="bar-chart-2"
          title={ADMIN.home.measure}
          onPress={() => router.push('/(app)/admin/measure')}
        />
        <AdminNavRowV3
          icon="toggle-right"
          title={ADMIN.home.flags}
          onPress={() => router.push('/(app)/admin/flags')}
        />
        <AdminNavRowV3
          icon="cpu"
          title={ADMIN.home.system}
          onPress={() => router.push('/(app)/admin/system')}
        />
      </AdminRowsV3>
    </>
  )

  const dashboard = stats.isPending ? (
    <View style={styles.loading}>
      <Skeleton height={80} />
      <Skeleton height={200} />
    </View>
  ) : stats.isError ? (
    <AdminNoteV3 tone="danger" icon="alert-circle">
      {ADMIN.home.failedToLoad}
    </AdminNoteV3>
  ) : (
    <>
      {/* Where the days on this screen turn over. One line, once. */}
      <AdminHeadingV3 title={ADMIN.home.sections.audience} hint={ADMIN.home.allUtc} />
      <AdminStatsV3>
        <AdminStatV3 value={count(audience?.joinedToday)} label={ADMIN.home.joinedToday} />
        <AdminStatV3 value={count(audience?.joinedLastMonth)} label={ADMIN.home.joinedMonth} />
        <AdminStatV3 value={count(audience?.activeToday)} label={ADMIN.home.activeToday} />
        <AdminStatV3 value={count(audience?.seenLastMonth)} label={ADMIN.home.seenMonth} />
      </AdminStatsV3>

      <Chart
        title={ADMIN.home.charts.activeDaily}
        caption={ADMIN.home.charts.lastDays(audience?.activeDaily.length || 30)}
        points={(audience?.activeDaily ?? []).map(dayPoint)}
      />
      <Chart
        title={ADMIN.home.charts.newMembers}
        caption={ADMIN.home.charts.lastDays(daily.length || 30)}
        points={daily.map((day) => ({ key: day.day, value: day.members }))}
      />

      <AdminHeadingV3 title={ADMIN.home.sections.talking} />
      <AdminStatsV3>
        <AdminStatV3 value={count(audience?.profiles)} label={ADMIN.home.profiles} />
        <AdminStatV3 value={count(audience?.messages)} label={ADMIN.home.messages} />
        <AdminStatV3 value={count(shared?.totals.corrections)} label={ADMIN.home.corrections} />
        <AdminStatV3 value={count(shared?.totals.languages)} label={ADMIN.home.languageCount} />
      </AdminStatsV3>

      <Chart
        title={ADMIN.home.charts.messagesDaily}
        caption={ADMIN.home.charts.lastDays(daily.length || 30)}
        points={daily.map((day) => ({ key: day.day, value: day.messages }))}
      />
      {/*
       * Green, because a correction is always the green pair in this app — see
       * the palette's note. It is a separate chart rather than a second series
       * over the messages above it for the reason at the top of this file.
       */}
      <Chart
        title={ADMIN.home.charts.correctionsDaily}
        caption={ADMIN.home.charts.lastDays(daily.length || 30)}
        color={v3.colors.correction}
        points={daily.map((day) => ({ key: day.day, value: day.corrections }))}
      />

      <AdminStatsV3>
        <AdminStatV3 value={count(shared?.streaks.longest)} label={ADMIN.home.streaks.longest} />
        <AdminStatV3 value={count(shared?.streaks.active)} label={ADMIN.home.streaks.active} />
      </AdminStatsV3>

      <AdminHeadingV3 title={ADMIN.home.sections.languages} />
      <AdminBlockV3>
        <AdminSubheadingV3>{ADMIN.home.languages.learning}</AdminSubheadingV3>
        <BarList
          rows={(shared?.learning ?? []).slice(0, TOP_LANGUAGES).map(languageRow)}
          empty={ADMIN.home.languages.none}
        />
      </AdminBlockV3>
      <AdminBlockV3>
        <AdminSubheadingV3>{ADMIN.home.languages.native}</AdminSubheadingV3>
        <BarList
          rows={(shared?.native ?? []).slice(0, TOP_LANGUAGES).map(languageRow)}
          color={v3.hues.lilac}
          empty={ADMIN.home.languages.none}
        />
      </AdminBlockV3>

      <AdminHeadingV3 title={ADMIN.home.sections.funnel} />
      <SegmentedControl
        options={FUNNEL_WINDOWS}
        selected={[funnelWindow]}
        onToggle={setFunnelWindow}
        accessibilityLabel={ADMIN.home.sections.funnel}
      />
      <AdminBlockV3>
        <Funnel window={funnelWindow} />
      </AdminBlockV3>

      <AdminHeadingV3 title={ADMIN.home.sections.money} />
      <AdminStatsV3>
        <AdminStatV3
          value={count(money?.tiers.pro)}
          label={ADMIN.home.pro}
          onPress={() => router.push('/(app)/admin/members?tier=pro')}
        />
        <AdminStatV3
          value={count(money ? money.tiers.pro - money.tiers.gifted : undefined)}
          label={ADMIN.home.paid}
        />
        <AdminStatV3 value={count(money?.tiers.gifted)} label={ADMIN.home.gifted} />
        <AdminStatV3 value={count(money?.tiers.free)} label={ADMIN.home.free} />
        <AdminStatV3 value={count(money?.tiers.total)} label={ADMIN.home.totalMembers} />
      </AdminStatsV3>
      {money ? <PaidShare tiers={money.tiers} /> : null}

      <Chart
        title={ADMIN.home.charts.tokensDaily}
        caption={ADMIN.home.charts.lastDays(money?.tokensDaily.length || 30)}
        points={(money?.tokensDaily ?? []).map(dayPoint)}
      />

      <AdminHeadingV3 title={ADMIN.home.poolYesterday} />
      {money?.pool ? (
        <Text style={styles.line}>
          {money.pool.paid} {ADMIN.home.poolPaid} · {money.pool.distributed}{' '}
          {ADMIN.home.poolDistributed}
        </Text>
      ) : (
        <AdminCaptionV3>{ADMIN.home.poolNone}</AdminCaptionV3>
      )}

      {audience?.builds.length ? (
        <>
          <AdminHeadingV3 title={ADMIN.home.builds} />
          <AdminBlockV3>
            <BarList
              rows={audience.builds.slice(0, TOP_BUILDS).map((build) => ({
                key: `${build.platform}-${build.version}`,
                label: build.version,
                hint: build.platform,
                value: build.count,
              }))}
              color={v3.colors.muted}
              empty={ADMIN.home.languages.none}
            />
          </AdminBlockV3>
        </>
      ) : null}
    </>
  )

  return (
    <AdminGate>
      <AdminScreenV3
        title={ADMIN.home.title}
        back="/(app)/settings"
        onRefresh={refresh}
        refreshing={stats.isFetching}
      >
        <AdminNoteV3 tone="warning" icon="shield">
          {ADMIN.warning}
        </AdminNoteV3>

        {/*
         * The live card is outside the dashboard's own loading branch on both
         * layouts: it is on its own request and its own clock, so a slow
         * `/admin/stats` must not hold back the one number on this screen
         * that is about now.
         */}
        {wide ? (
          <View style={styles.split}>
            <View style={styles.side}>
              {doors}
              {extras}
            </View>
            <View style={styles.main}>
              <LiveCard />
              {dashboard}
            </View>
          </View>
        ) : (
          <>
            <LiveCard />
            {doors}
            {extras}
            {dashboard}
          </>
        )}
      </AdminScreenV3>
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
 * How many people are in the app at this moment, and the day behind them.
 *
 * The number is counted fresh on every poll; the columns are a quarter hour each,
 * recorded server-side so the chart has a past the moment this opens rather
 * than drawing itself while somebody watches. A minute nobody sampled is a gap
 * and not a zero — see `modules/admin/pulse.ts`.
 *
 * The whole card is the target rather than the chart alone: the number, the
 * chart and the window under it are three views of one set of people, so any
 * of them is a reasonable place to press to go and read their names.
 *
 * The one hue block on the screen, because it is the only thing here that
 * changes while you look at it. Ink on the hue in both schemes, as everything
 * on a hue is.
 */
function LiveCard() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const pulse = useAdminPulse()

  if (!pulse.data) return <Skeleton height={168} />

  const { online, history, windowMs } = pulse.data
  const recorded = history.filter((point) => point.online !== null)
  const peak = Math.max(...recorded.map((point) => point.online ?? 0), 0)

  return (
    <Pressable
      style={({ pressed }) => [styles.live, pressed && styles.livePressed]}
      onPress={() => router.push('/(app)/admin/online')}
      accessibilityRole="button"
      accessibilityLabel={`${online} ${ADMIN.home.live.online}, ${ADMIN.home.live.seeWho}`}
    >
      <View style={styles.liveTop}>
        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>{ADMIN.home.live.badge}</Text>
        </View>
        {recorded.length > 0 ? (
          <Text style={styles.liveCaption}>{ADMIN.home.live.peak(peak)}</Text>
        ) : null}
      </View>

      <View style={styles.liveValue}>
        <Text style={styles.hero}>{online.toLocaleString('en')}</Text>
        <Text style={styles.heroLabel}>{ADMIN.home.live.online}</Text>
      </View>
      <Text style={styles.liveCaption}>
        {ADMIN.home.live.window(Math.round(windowMs / 60000))} · {ADMIN.home.live.seeWho}
      </Text>

      <View style={styles.liveChart}>
        {recorded.length === 0 ? (
          <Text style={styles.liveCaption}>{ADMIN.home.live.warmingUp}</Text>
        ) : (
          <>
            <Columns
              points={history.map((point) => ({ key: point.at, value: point.online }))}
              color={v3.colors.ink}
              height={56}
              gap={1}
              accessibilityLabel={`${ADMIN.home.live.online}, ${ADMIN.home.live.peak(peak)}`}
            />
            <View style={styles.axis}>
              <Text style={styles.axisLabel}>{ADMIN.home.live.dayAgo}</Text>
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

/**
 * What share of the members are paying for Pro — a gift or a lifetime grant is
 * Pro that nobody pays for, so it is taken out.
 */
function PaidShare({ tiers }: { tiers: AdminStatsDto['money']['tiers'] }) {
  const paid = tiers.pro - tiers.gifted
  const fraction = tiers.total > 0 ? paid / tiers.total : 0
  const label = ADMIN.home.paidShare(paid, tiers.total)

  return (
    <AdminBlockV3>
      {/*
       * A meter rather than a stacked bar. Free is most of the ground here,
       * so the paid segment would be a sliver — and the question this answers
       * is one number.
       */}
      <ProgressBar value={fraction} height={6} accessibilityLabel={label} />
      <AdminCaptionV3>{label}</AdminCaptionV3>
    </AdminBlockV3>
  )
}

/** A chart and the two lines that say what it plots, on its own grey block. */
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
   * No x axis. Every series here ends today and the caption above says how
   * many days it covers, so dates under the columns only repeat it — and at
   * thirty columns a date under each is unreadable at any size.
   */
  return (
    <AdminBlockV3>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.muted}>{caption}</Text>
      </View>
      <Columns
        points={points}
        {...(color ? { color } : {})}
        accessibilityLabel={`${title}, ${caption}`}
      />
    </AdminBlockV3>
  )
}

/** A day key as one column. */
function dayPoint(day: { day: string; count: number }): ColumnPoint {
  return { key: day.day, value: day.count }
}

function languageRow(language: { code: string; name: string; count: number }): BarListRow {
  return { key: language.code, label: language.name, value: language.count }
}

/** English throughout, like the rest of this surface. */
function count(value: number | undefined): string {
  return (value ?? 0).toLocaleString('en')
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  split: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[24] },
  side: { gap: v3.space[10], width: 400 },
  main: { flex: 1, gap: v3.space[10], minWidth: 0 },
  line: { ...v3.type.callout, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  muted: { ...v3.type.caption, color: v3.colors.muted },

  live: {
    backgroundColor: v3.hues.mint,
    borderRadius: v3.radius.block,
    gap: v3.space[4],
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[16],
  },
  livePressed: { opacity: 0.85 },
  liveTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  badge: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  dot: { backgroundColor: v3.colors.ink, borderRadius: 4, height: 8, width: 8 },
  badgeText: { ...v3.type.label, color: v3.colors.ink, letterSpacing: 0.6 },
  liveValue: { alignItems: 'baseline', flexDirection: 'row', gap: v3.space[8] },
  // The one hero figure on the screen, and the only number drawn this big.
  hero: { ...v3.type.display, color: v3.colors.ink },
  heroLabel: { ...v3.type.button, color: v3.colors.ink },
  liveCaption: { ...v3.type.caption, color: v3.colors.ink },
  liveChart: { marginTop: v3.space[10] },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: v3.space[6] },
  axisLabel: { ...v3.type.label, color: v3.colors.ink },

  chartHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
  },
  chartTitle: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
}))
