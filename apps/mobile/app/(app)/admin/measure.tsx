import { ADMIN_MEASURE_WEEKS_DEFAULT, type AdminMeasure } from '@langx/shared'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useAdminHeardAbout, useAdminMeasure } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminBlockV3,
  AdminCaptionV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminScreenV3,
} from '../../../src/components/admin/AdminKitV3'
import { BarList, type BarListRow } from '../../../src/components/charts/BarList'
import { StatTable } from '../../../src/components/admin/StatTable'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import {
  countCell,
  dayLabel,
  rateCell,
  refusalKindLabel,
  replyTime,
  utcStamp,
  weekLabel,
} from '../../../src/lib/adminMeasure'
import { ADMIN } from '../../../src/lib/adminStrings'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * The baseline every later change is judged against: who comes back, who gets
 * going, whether first messages are answered, and which limits people run into.
 *
 * One request (`GET /admin/measure`) for all of it, because the sections share
 * the one expensive read on the server and the answer is kept there for five
 * minutes. Nothing here polls and nothing here can be pulled to refresh — the
 * figures cannot change inside that window, and a gesture that looked like it
 * recomputed them would be lying.
 *
 * **No figure on this screen is ever written down outside it.** The repo is
 * public and the numbers are the kind a paywall must not sit beside
 * (`docs/decisions.md` → _The analytics dashboard is private_); they reach a
 * decision as "the figures shared on <date>", in chat.
 *
 * What it cannot show is said at the bottom rather than left as a gap:
 * paywall views and installs are PostHog's.
 */

/** Four weeks is a month's trend; twelve is the first window a Day-30 reading has mature cohorts. */
const WEEK_CHOICES = [4, ADMIN_MEASURE_WEEKS_DEFAULT, 26] as const

export default function AdminMeasureScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [weeks, setWeeks] = useState<number>(ADMIN_MEASURE_WEEKS_DEFAULT)
  const measure = useAdminMeasure(weeks)

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.measure.title} back="/(app)/admin">
        <AdminCaptionV3>{ADMIN.measure.intro}</AdminCaptionV3>
        <AdminCaptionV3>{ADMIN.measure.clocks}</AdminCaptionV3>

        <View style={styles.control}>
          <SegmentedControl
            options={WEEK_CHOICES.map((value) => ({
              value: String(value),
              label: ADMIN.measure.weeks(value),
            }))}
            selected={[String(weeks)]}
            onToggle={(value) => setWeeks(Number(value))}
            accessibilityLabel={ADMIN.measure.window}
          />
        </View>

        {measure.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={220} />
            <Skeleton height={160} />
          </View>
        ) : measure.isError || !measure.data ? (
          <AdminNoteV3 tone="danger" icon="alert-circle">
            {ADMIN.measure.failedToLoad}
          </AdminNoteV3>
        ) : (
          <>
            {measure.data.truncated ? (
              <AdminNoteV3 tone="warning">{ADMIN.measure.truncated}</AdminNoteV3>
            ) : null}
            <Cohorts data={measure.data} />
            <FirstMessages data={measure.data} />
            <Refusals data={measure.data} barColor={v3.colors.blue} />
            <HeardAbout barColor={v3.colors.blue} />

            <AdminCaptionV3 style={styles.footnote}>{ADMIN.measure.notHere}</AdminCaptionV3>
            <AdminCaptionV3>
              {ADMIN.measure.generated(utcStamp(measure.data.generatedAt))}
            </AdminCaptionV3>
          </>
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

function Cohorts({ data }: { data: AdminMeasure }) {
  const words = ADMIN.measure.cohorts

  const rowOf = (row: AdminMeasure['cohorts'][number]) => ({
    key: row.weekStart,
    cells: [
      { main: weekLabel(row.weekStart) },
      countCell(row.signedUp),
      rateCell(row.returned.d1),
      rateCell(row.returned.d7),
      rateCell(row.returned.d30),
      rateCell(row.activated),
    ],
  })

  return (
    <>
      <AdminHeadingV3
        title={words.title}
        hint={words.hint(data.rules.activationWindowHours, data.rules.activationConversations)}
      />
      {data.cohortTotals.signedUp === 0 ? <AdminCaptionV3>{words.nobody}</AdminCaptionV3> : null}
      <AdminBlockV3>
        <StatTable
          accessibilityLabel={words.title}
          columns={[
            { title: words.week, flex: 1.1 },
            { title: words.joined, flex: 0.9 },
            { title: words.day1 },
            { title: words.day7 },
            { title: words.day30 },
            { title: words.activated, flex: 1.1 },
          ]}
          rows={data.cohorts.map(rowOf)}
          total={{
            key: 'total',
            cells: [
              { main: words.total },
              countCell(data.cohortTotals.signedUp),
              rateCell(data.cohortTotals.returned.d1),
              rateCell(data.cohortTotals.returned.d7),
              rateCell(data.cohortTotals.returned.d30),
              rateCell(data.cohortTotals.activated),
            ],
          }}
        />
      </AdminBlockV3>
      <AdminCaptionV3>{words.returnSource(dayLabel(data.rules.returnRecordedFrom))}</AdminCaptionV3>
    </>
  )
}

function FirstMessages({ data }: { data: AdminMeasure }) {
  const words = ADMIN.measure.firstMessages

  const rowOf = (key: string, label: string, row: AdminMeasure['firstMessageTotals']) => ({
    key,
    cells: [
      { main: label },
      countCell(row.started),
      {
        main: row.settled === 0 ? '—' : String(row.unanswered),
        ...(row.settled === 0 ? {} : { sub: words.outOf(row.settled) }),
      },
      { main: row.settled === 0 ? '—' : String(row.neverAnswered) },
      { main: replyTime(row.medianReplyMinutes) },
    ],
  })

  return (
    <>
      <AdminHeadingV3 title={words.title} hint={words.hint(data.rules.unansweredAfterHours)} />
      {data.firstMessageTotals.started === 0 ? <AdminCaptionV3>{words.none}</AdminCaptionV3> : null}
      <AdminBlockV3>
        <StatTable
          accessibilityLabel={words.title}
          columns={[
            { title: words.week, flex: 1.1 },
            { title: words.opened, flex: 0.9 },
            { title: words.unanswered(data.rules.unansweredAfterHours), flex: 1.1 },
            { title: words.never },
            { title: words.median, flex: 1.3 },
          ]}
          rows={data.firstMessages.map((row) =>
            rowOf(row.weekStart, weekLabel(row.weekStart), row),
          )}
          total={rowOf('total', words.total, data.firstMessageTotals)}
        />
      </AdminBlockV3>
      <AdminCaptionV3>{words.medianNote}</AdminCaptionV3>
    </>
  )
}

function Refusals({ data, barColor }: { data: AdminMeasure; barColor: string }) {
  const words = ADMIN.measure.refusals
  const { windowDays, kinds } = data.refusals

  const rows: BarListRow[] = kinds.map((row) => ({
    key: row.kind,
    label: refusalKindLabel(row.kind),
    value: row.refusals,
    hint: words.people(row.people),
  }))

  return (
    <>
      <AdminHeadingV3 title={words.title} hint={words.hint(windowDays)} />
      <AdminBlockV3>
        <BarList rows={rows} color={barColor} empty={words.none(windowDays)} />
      </AdminBlockV3>
    </>
  )
}

/**
 * The heard-about poll. Its own request rather than a field of the measure
 * response: it has no window of weeks, and the measure read is cached for five
 * minutes where a fresh answer here should show within one.
 */
function HeardAbout({ barColor }: { barColor: string }) {
  const styles = useStyles()
  const words = ADMIN.measure.heardAbout
  const heard = useAdminHeardAbout()

  if (heard.isPending) return <Skeleton height={160} />
  if (heard.isError || !heard.data) {
    return (
      <AdminNoteV3 tone="danger" icon="alert-circle">
        {words.failedToLoad}
      </AdminNoteV3>
    )
  }

  const { results, recent } = heard.data
  const labelOf = (id: string) => words.options[id] ?? id
  const rows: BarListRow[] = Object.entries(results.counts).map(([id, count]) => ({
    key: id,
    label: labelOf(id),
    value: count,
  }))

  return (
    <>
      <AdminHeadingV3 title={words.title} hint={words.hint(results.total)} />
      {results.total === 0 ? <AdminCaptionV3>{words.none}</AdminCaptionV3> : null}
      {/* Every option is a row, zeros included, so `empty` never shows. */}
      <AdminBlockV3>
        <BarList rows={rows} color={barColor} empty={words.none} />
      </AdminBlockV3>
      {recent.length > 0 ? <AdminHeadingV3 title={words.recent} /> : null}
      {recent.map((row) => (
        <Text key={row.userId} style={styles.recent}>
          {`${row.handle ? `@${row.handle}` : '—'}${row.country ? ` (${row.country})` : ''} → ${labelOf(row.optionId)} · ${utcStamp(row.createdAt)}`}
        </Text>
      ))}
    </>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  control: { marginTop: v3.space[6] },
  recent: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  footnote: { marginTop: v3.space[16] },
}))
