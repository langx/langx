import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { shiftDayKey, type Locale } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useActivity, useRepairDay, useWallet } from '../api/queries'
import { LoadFailed } from '../components/LoadFailed'
import {
  DayPaint,
  HistoryMapBlock,
  type HistoryMapLegendItem,
} from '../components/streak/HistoryMapBlock'
import { StreakRepairCard } from '../components/streak/StreakBlocks'
import { EmptyStateV3 } from '../components/ui/EmptyStateV3'
import { IconButton } from '../components/ui/IconButton'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useLocale, useT } from '../i18n'
import { historyMap, historyRepairOffer, type HistoryMapState } from '../lib/historyMap'
import { queryFailed } from '../lib/listState'
import { dayLabel } from '../lib/messageGroups'
import { goBackTo } from '../lib/navigation'
import { confirmAndRepair } from '../lib/repairFlow'
import { streakDayDetail, streakHistory, type StreakDayKind } from '../lib/streakHistory'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'

/**
 * The range the streak screens ask `/me/activity` for — twenty weeks and one
 * more — so this page reads the same cache entry as the streak page, and the
 * map's oldest column is never short of rows.
 */
const ACTIVITY_WEEKS = 20

/** Nine weeks: what the board draws beside its legend on a 390pt phone. */
const MAP_WEEKS = 9

/** The list's window, as today's history page has it. */
const LIST_DAYS = 60

/**
 * The redesign's streak history, behind `flags.v3Home`
 * (`app/(app)/streak/history` picks it). Drawn from `V-StreakHistory`.
 *
 * The activity map comes back here. #1818's streak screen left it out
 * because the board moves it to this page; until this page existed, the flag
 * hid the map altogether. With it: the map, the missed day a repair can still
 * reach, and the days one by one.
 *
 * Every day on this page is the streak's own: `today` and every row come
 * from `/me/activity`, keyed by the day in the profile's time zone — the one
 * the streak is kept on — exactly as today's map reads them. Nothing here is
 * placed by the ledger's UTC day.
 */
export function StreakHistoryScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [blackLoaded] = useFonts({ Nunito_900Black })

  // A day past UTC's date. `today` is the profile's day, and east of UTC it
  // is already tomorrow there before UTC midnight; ending the range on the
  // UTC date left today's row out, so a day already checked in read as
  // missed. No zone is more than a day ahead, and the two streak pages ask
  // for the same range, so they still share one cache entry.
  const to = shiftDayKey(new Date().toISOString().slice(0, 10), 1)
  const activity = useActivity(shiftDayKey(to, -(ACTIVITY_WEEKS + 1) * 7), to)
  const wallet = useWallet()
  const repairDay = useRepairDay()
  const pull = usePullToRefresh(() => Promise.all([activity.refetch(), wallet.refetch()]))

  const data = activity.data
  const map = useMemo(
    () =>
      data
        ? historyMap({ today: data.today, weeks: MAP_WEEKS, days: data.days, streak: data.streak })
        : null,
    [data],
  )
  const rows = useMemo(
    () =>
      data
        ? streakHistory({
            today: data.today,
            from: shiftDayKey(data.today, -LIST_DAYS),
            days: data.days,
          })
        : [],
    [data],
  )

  if (!data || !map) {
    return (
      <Screen ground={v3.colors.bg}>
        <HistoryHeader black={blackLoaded} />
        {activity.isPending && !queryFailed(activity) ? (
          <View style={styles.stack}>
            <Skeleton height={MAP_HEIGHT} radius={v3.radius.badge} />
            <Skeleton height={60} radius={v3.radius.tile} />
            <Skeleton height={60} radius={v3.radius.tile} />
            <Skeleton height={60} radius={v3.radius.tile} />
          </View>
        ) : (
          <LoadFailed onRetry={() => void activity.refetch()} />
        )}
      </Screen>
    )
  }

  const known = map.counts.done + map.counts.opened + map.counts.bought
  if (rows.length === 0 && known === 0) {
    return (
      <Screen scroll ground={v3.colors.bg} {...pull}>
        <HistoryHeader black={blackLoaded} />
        <EmptyStateV3
          art="chats"
          line={t('streak.emptyBody')}
          actionLabel={t('home.streakChats')}
          onAction={() => router.navigate('/(app)/(tabs)/chats')}
        />
      </Screen>
    )
  }

  const now = new Date(`${data.today}T12:00:00`)
  const filled = new Set(data.days.map((day) => day.day))
  const offer = historyRepairOffer({
    map,
    today: data.today,
    days: data.days,
    usedThisMonth: data.repair.usedThisMonth,
    perMonth: data.repair.perMonth,
  })

  function buyBack(day: string, left: number): void {
    if (!data) return
    void confirmAndRepair({
      day,
      today: data.today,
      filled,
      price: data.repair.price,
      balance: wallet.data?.balance ?? 0,
      left,
      perMonth: data.repair.perMonth,
      t,
      locale,
      repair: (repaired, handlers) => repairDay.mutate(repaired, handlers),
    })
  }

  const legend: HistoryMapLegendItem[] = (
    [
      ['done', t('streak.checkedInUnknownTime')],
      ['opened', t('streak.openedOnly')],
      ['bought', t('streak.bought')],
      ['missed', t('streak.missed')],
    ] as const
  ).map(([state, label]) => ({
    state,
    label,
    accessibilityLabel: t('streak.legendA11y', {
      state: label,
      days: t('format.days', { count: map.counts[state] }),
    }),
  }))

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      <HistoryHeader black={blackLoaded} />
      <View style={styles.stack}>
        <HistoryMapBlock
          columns={map.columns}
          months={map.monthOf.map((day) => (day ? monthName(day, locale) : null))}
          legend={legend}
          accessibilityLabel={t('streak.mapA11y', { count: map.elapsed })}
        />

        {offer ? (
          <StreakRepairCard
            title={t('streak.repairTitle', { day: dayLabel(offer.day, { t, locale, now }) })}
            body={t('store.repairDayBody', { left: offer.left })}
            button={t('streak.repairButton', { count: data.repair.price })}
            pending={repairDay.isPending}
            onPress={() => buyBack(offer.day, offer.left)}
          />
        ) : null}

        {rows.length > 0 ? (
          <>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('streak.dayByDay')}
            </Text>
            <View style={styles.list}>
              {rows.map((row, index) => {
                const day = dayLabel(row.day, { t, locale, now })
                const what = streakDayDetail(t, locale, row)
                return (
                  <View
                    key={row.day}
                    accessible
                    accessibilityLabel={`${day}. ${what}`}
                    style={[styles.row, index > 0 && styles.rowEdge]}
                  >
                    <DayMark kind={row.kind} />
                    <View style={styles.rowWords}>
                      <Text style={styles.rowDay}>{day}</Text>
                      <Text
                        style={[
                          styles.rowWhat,
                          row.kind === 'missed' && styles.whatMissed,
                          row.kind === 'bought' && styles.whatBought,
                        ]}
                      >
                        {what}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  )
}

function HistoryHeader({ black }: { black: boolean }) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  return (
    <View style={styles.header}>
      <IconButton
        icon={isRtl ? 'chevron-right' : 'chevron-left'}
        accessibilityLabel={t('common.backPlain')}
        onPress={() => goBackTo('/(app)/streak')}
      />
      <Text style={[styles.title, !black && styles.titleFallback]} accessibilityRole="header">
        {t('tokens.history')}
      </Text>
      <Text style={styles.subtitle}>{t('streak.historyBody')}</Text>
    </View>
  )
}

const MARK: Record<StreakDayKind, 'check' | 'more-vertical' | 'plus' | 'x'> = {
  checkedIn: 'check',
  openedOnly: 'more-vertical',
  bought: 'plus',
  missed: 'x',
}

const PAINT: Record<StreakDayKind, HistoryMapState> = {
  checkedIn: 'done',
  openedOnly: 'opened',
  bought: 'bought',
  missed: 'missed',
}

/** The row's square: the map's own paint for that kind of day, and a glyph. */
function DayMark({ kind }: { kind: StreakDayKind }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const color =
    kind === 'missed' ? v3.colors.danger : kind === 'openedOnly' ? v3.colors.fg : v3.colors.ink
  return (
    <View style={styles.mark}>
      <DayPaint state={PAINT[kind]} radius={MARK_CORNER} />
      <Feather name={MARK[kind]} size={v3.icon.sm} color={color} />
    </View>
  )
}

/** "Oct", "окт.", "أكتوبر" — read in UTC, because a day key carries no zone. */
function monthName(day: string, locale: Locale): string {
  const at = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(at)
}

/** The map block's height at the default text size, so the page does not jump. */
const MAP_HEIGHT = 196

const MARK_CORNER = 11

const useStyles = makeStyles(({ v3 }) => ({
  header: {
    gap: v3.space[2],
    marginStart: -v3.space[10],
    paddingBottom: v3.space[8],
  },
  title: { ...v3.type.title, color: v3.colors.fg, paddingStart: v3.space[10] },
  titleFallback: { fontFamily: DISPLAY_FONT },
  subtitle: { ...v3.type.callout, color: v3.colors.muted, paddingStart: v3.space[10] },
  stack: { gap: v3.space[8], paddingBottom: v3.space[16] },
  sectionTitle: {
    ...v3.type.headline,
    color: v3.colors.fg,
    marginTop: v3.space[6],
    paddingHorizontal: v3.space[6],
  },
  list: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 60,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: 9,
  },
  rowEdge: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  rowWords: { flex: 1, gap: 1, minWidth: 0 },
  rowDay: { ...v3.type.button, color: v3.colors.fg },
  rowWhat: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600', lineHeight: 18 },
  whatMissed: { color: v3.colors.danger },
  whatBought: { color: v3.colors.echoText },
  mark: {
    alignItems: 'center',
    borderRadius: MARK_CORNER,
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 36,
  },
}))
