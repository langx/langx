import { shiftDayKey } from '@langx/shared'
import { useMemo, useRef } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { usePublicActivity, useActivity, useRepairDay, useWallet } from '../api/queries'
import { activityGrid, repairEffect, type ActivityCell } from '../lib/activityMap'
import { confirmAlert, showAlert } from '../lib/alert'
import { dayLabel } from '../lib/messageGroups'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale, useT } from '../i18n'
import { showToast } from '../lib/toast'

/** Half a year, which is as much as fits without the squares becoming dots. */
const WEEKS = 26

/**
 * Every day this person showed up, and the ones they can still buy back.
 *
 * The grid is drawn from `streakDays` rather than from `dailyActivity`: the
 * streak's day is the user's local one and `dailyActivity` counts UTC days, so
 * shading the squares from the latter would slide the whole map by one for
 * anyone far enough east or west. One source, one meaning.
 */
export interface ActivityMapProps {
  /**
   * Somebody else's map. Read-only: no counts behind the shading, no repair —
   * buying back a day of a stranger's history is not a thing, and the endpoint
   * would refuse anyway.
   */
  handle?: string
}

export function ActivityMap({ handle }: ActivityMapProps = {}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const to = new Date().toISOString().slice(0, 10)
  // Generous: the server clamps the range, and the grid only draws what it needs.
  const from = shiftDayKey(to, -(WEEKS + 1) * 7)
  const own = useActivity(from, to, !handle)
  const theirs = usePublicActivity(handle ?? '', from, to)
  const wallet = useWallet()
  const repair = useRepairDay()
  const scroller = useRef<ScrollView>(null)

  // One shape from two endpoints. The public one carries an intensity rather
  // than a count — the exact number is the private part — so it is turned back
  // into the count the shading came from.
  const source = handle ? theirs : own
  const columns = useMemo(() => {
    const data = handle ? theirs.data : own.data
    if (!data || (handle && theirs.data?.visible === false)) return []
    const days = handle
      ? new Map((theirs.data?.days ?? []).map((d) => [d.day, INTENSITY_ACTIONS[d.intensity] ?? 1]))
      : new Map((own.data?.days ?? []).map((d) => [d.day, d.actions]))
    return activityGrid({
      today:
        (handle ? theirs.data?.today : own.data?.today) ?? new Date().toISOString().slice(0, 10),
      weeks: WEEKS,
      days,
      maxAgeDays: own.data?.repair.maxAgeDays ?? 0,
      streak: (handle ? theirs.data?.streak : own.data?.streak) ?? undefined,
    })
  }, [handle, own.data, theirs.data])

  if (source.isPending) return <ActivityIndicator style={styles.loading} />
  if (!source.data) return null
  // A profile that turned the map off says nothing at all, rather than showing
  // six months of empty squares that look like an inactive person.
  if (handle && theirs.data?.visible === false) return null

  const rules = own.data?.repair ?? { price: 0, maxAgeDays: 0, perMonth: 0, usedThisMonth: 0 }
  const today = (handle ? theirs.data?.today : own.data?.today) ?? ''
  const days = handle ? [] : (own.data?.days ?? [])
  const filled = new Set(days.map((d) => d.day))
  const left = Math.max(0, rules.perMonth - rules.usedThisMonth)

  async function onPressDay(cell: ActivityCell): Promise<void> {
    if (handle || cell.state !== 'repairable') return
    if (left === 0) {
      await showAlert(
        t('activity.noRepairsTitle'),
        t('activity.perMonth', { count: rules.perMonth }),
      )
      return
    }

    const effect = repairEffect({
      day: cell.day,
      today,
      filled,
      price: rules.price,
      balance: wallet.data?.balance ?? 0,
    })
    if (!effect.affordable) {
      await showAlert(
        t('activity.notEnoughTokensTitle'),
        t('activity.notEnoughTokensBody', {
          price: rules.price,
          balance: wallet.data?.balance ?? 0,
        }),
      )
      return
    }

    /**
     * The whole point of the confirmation: it says what the purchase does
     * *before* it happens, including when the answer is "nothing much". A
     * square in the middle of a fortnight nobody was active in fills and joins
     * no streak, and saying so is worth more than the sale.
     */
    const label = dayLabel(cell.day, { t, locale, now: new Date(`${today}T12:00:00`) })
    const streakLine = effect.changesStreak
      ? t('activity.streakChange', { before: effect.streakBefore, count: effect.streakAfter })
      : t('activity.noStreakChange')
    const confirmed = await confirmAlert({
      title: t('activity.fillInTitle', { day: label }),
      message: t('activity.balanceChange', {
        streakLine,
        before: wallet.data?.balance ?? 0,
        after: effect.balanceAfter,
      }),
      confirmLabel: t('activity.fillIt'),
    })
    if (!confirmed) return

    repair.mutate(cell.day, {
      onSuccess: () => showToast(t('activity.filled')),
      onError: () => void showAlert(t('activity.fillFailed'), t('common.retry')),
    })
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('chat.activity')}</Text>
        {/* Only the owner can buy a day back, so only the owner is told how
            many are left — and the line wraps rather than running off the
            card, which is where it went before. */}
        {handle ? null : (
          <Text style={styles.hint}>
            {left > 0
              ? t('activity.repairsLeft', {
                  count: left,
                  total: rules.perMonth,
                  price: rules.price,
                })
              : t('activity.noRepairsThisMonth')}
          </Text>
        )}
      </View>

      {/*
        Opened at the far end, because the grid runs oldest-first and the newest
        week is the one worth seeing. Left alone it opens on six months ago,
        which is a calendar of nothing. `onContentSizeChange` rather than an
        effect: the offset only means anything once the columns have a width.
      */}
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {columns.map((column) => (
          <View key={column[0]?.day} style={styles.column}>
            {column.map((cell) => (
              <Pressable
                key={cell.day}
                accessibilityRole={cell.state === 'repairable' ? 'button' : undefined}
                accessibilityLabel={
                  cell.state === 'repairable'
                    ? t('activity.fillInDay', { day: cell.day })
                    : undefined
                }
                disabled={Boolean(handle) || cell.state !== 'repairable'}
                onPress={() => void onPressDay(cell)}
                style={[
                  styles.cell,
                  cell.state === 'future' && styles.future,
                  cell.state === 'repairable' && styles.repairable,
                  cell.intensity > 0 && {
                    backgroundColor: colors.streak,
                    opacity: 0.25 + cell.intensity * 0.1875,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

/**
 * The public map sends a bucket, not a count. Turning it back into the lowest
 * count in each bucket is enough to reproduce the same shade, and is the only
 * thing the grid needs from it.
 */
const INTENSITY_ACTIONS: Record<number, number> = { 1: 1, 2: 3, 3: 10, 4: 30 }

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  /**
   * The card this sits in has no padding of its own — its children bring
   * theirs. Without this the title sat against the border and the grid ran out
   * from under the corner radius.
   */
  wrap: { gap: spacing.sm, paddingHorizontal: 14, paddingVertical: spacing.md },
  head: {
    alignItems: 'baseline',
    columnGap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  title: { ...font.heading, color: colors.text, fontSize: 15 },
  hint: { ...font.caption, color: colors.textMuted },
  grid: { flexDirection: 'row', gap: 3, paddingVertical: spacing.xs },
  column: { gap: 3 },
  /**
   * `border`, not `surface`. The map sits on a card whose own background is
   * `surface`, so an empty square drawn in it disappears — and a calendar
   * whose empty days are invisible is not a calendar, it is a scatter of dots.
   * The gaps are half of what the grid is for.
   */
  cell: { backgroundColor: colors.border, borderRadius: 3, height: 13, width: 13 },
  // Drawn as a gap rather than a square: a day that has not happened is not an
  // empty day.
  future: { backgroundColor: 'transparent' },
  repairable: { borderColor: colors.border, borderStyle: 'dashed', borderWidth: 1 },
}))
