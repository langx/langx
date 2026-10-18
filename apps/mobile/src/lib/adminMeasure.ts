import type { AdminMoneyItem, AdminRate } from '@langx/shared'
import { ADMIN, adminPercent } from './adminStrings'

/**
 * What the measurement screen prints, decided away from the screen.
 *
 * Mobile vitest cannot load a component, so everything with a branch in it —
 * an empty denominator, a duration crossing from minutes to days, a RevenueCat
 * event this panel has no word for — is here, where it can be pinned.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-11-09` → `9 Nov`. A week is named by the Monday that starts it. */
export function weekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split('-')
  const name = MONTHS[Number(month) - 1]
  return name && day ? `${Number(day)} ${name}` : weekStart
}

export interface TableCell {
  main: string
  /** The line under it — who the main figure is out of. */
  sub?: string
}

/**
 * A rate and the people behind it. An empty denominator is a dash and nothing
 * else: `0%` would claim that nobody came back, when what is true is that
 * nobody could have yet.
 */
export function rateCell(rate: AdminRate): TableCell {
  if (rate.of === 0) return { main: '—' }
  return {
    main: adminPercent(rate.count, rate.of),
    sub: ADMIN.measure.ratio(rate.count, rate.of),
  }
}

/** A count, with an optional share of a whole underneath it. */
export function countCell(count: number, of?: number): TableCell {
  return of === undefined || of === 0
    ? { main: count.toLocaleString('en') }
    : { main: count.toLocaleString('en'), sub: adminPercent(count, of) }
}

/** `null` is "nobody replied", not "no time". */
export function replyTime(minutes: number | null): string {
  if (minutes === null) return '—'
  const { duration } = ADMIN.measure
  if (minutes < 1) return duration.underMinute
  if (minutes < 60) return duration.minutes(Math.round(minutes))
  const hours = minutes / 60
  if (hours < 48) return duration.hours(Math.round(hours * 10) / 10)
  return duration.days(Math.round((hours / 24) * 10) / 10)
}

/** The label for a quota kind, or the raw word for one this build has never heard of. */
export function refusalKindLabel(kind: string): string {
  const labels: Record<string, string> = ADMIN.measure.refusals.kinds
  return labels[kind] ?? kind
}

/**
 * One line of the money timeline, as words.
 *
 * Takes what the server recorded and says it plainly. An event type this build
 * has no word for is shown as RevenueCat spelled it — better the raw word than
 * a timeline that silently drops a line.
 */
export function moneyItemTitle(item: AdminMoneyItem): string {
  switch (item.kind) {
    case 'gift':
      return `${ADMIN.money.gift.title}: ${ADMIN.money.gift.length(item.months, item.weeks)}`
    case 'churn':
      return ADMIN.money.churn
    case 'store': {
      const events: Record<string, string> = ADMIN.money.events
      return events[item.event] ?? item.event
    }
  }
}

/** The second line: where it came from, and what it did to the clock. */
export function moneyItemDetail(item: AdminMoneyItem): string {
  const parts: string[] = [ADMIN.money.day(item.daysAfterJoin)]
  if (item.kind === 'gift') {
    const sources: Record<string, string> = ADMIN.money.gift.sources
    const statuses: Record<string, string> = ADMIN.money.gift.statuses
    parts.push(sources[item.source] ?? item.source, statuses[item.status] ?? item.status)
  } else if (item.kind === 'store') {
    parts.push(`${item.store} · ${item.productId}`)
    if (item.periodDays !== null) parts.push(ADMIN.money.period(item.periodDays))
    if (item.sandbox) parts.push(ADMIN.money.sandbox)
  }
  return parts.join(' · ')
}

/** `2026-09-01` → `1 Sep 2026`. */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split('-')
  const name = MONTHS[Number(month) - 1]
  return name && date && year ? `${Number(date)} ${name} ${year}` : day
}

/** `2026-11-09T13:05:00.000Z` → `9 Nov 13:05`, in UTC like the rest of the panel. */
export function utcStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${hh}:${mm}`
}
