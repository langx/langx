import type { AdminMoneyItem } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  countCell,
  dayLabel,
  moneyItemDetail,
  moneyItemTitle,
  rateCell,
  refusalKindLabel,
  replyTime,
  utcStamp,
  weekLabel,
} from './adminMeasure'

describe('weekLabel', () => {
  it('names a week by the day it starts, without a leading zero', () => {
    expect(weekLabel('2026-11-09')).toBe('9 Nov')
    expect(weekLabel('2026-12-28')).toBe('28 Dec')
  })

  it('shows what it was given when that is not a date', () => {
    expect(weekLabel('soon')).toBe('soon')
  })
})

describe('rateCell', () => {
  it('shows a share and the people behind it', () => {
    expect(rateCell({ count: 1, of: 4 })).toEqual({ main: '25%', sub: '1 of 4' })
  })

  it('is a dash, not 0%, when nobody could have met it yet', () => {
    expect(rateCell({ count: 0, of: 0 })).toEqual({ main: '—' })
  })

  it('shows a real zero as a zero', () => {
    expect(rateCell({ count: 0, of: 5 })).toEqual({ main: '0%', sub: '0 of 5' })
  })
})

describe('countCell', () => {
  it('adds a share only when there is a whole to take it of', () => {
    expect(countCell(3, 4)).toEqual({ main: '3', sub: '75%' })
    expect(countCell(3)).toEqual({ main: '3' })
    expect(countCell(0, 0)).toEqual({ main: '0' })
  })
})

describe('replyTime', () => {
  it('is a dash when nobody replied', () => {
    expect(replyTime(null)).toBe('—')
  })

  it('moves from minutes to hours to days as the wait grows', () => {
    expect(replyTime(0.4)).toBe('under a minute')
    expect(replyTime(12)).toBe('12 min')
    expect(replyTime(90)).toBe('1.5 h')
    expect(replyTime(47 * 60)).toBe('47 h')
    expect(replyTime(72 * 60)).toBe('3 days')
  })
})

describe('refusalKindLabel', () => {
  it('words a limit it knows and shows one it does not as it was recorded', () => {
    expect(refusalKindLabel('initiations')).toBe('New conversations')
    // #1793's ceiling on scripts, which used to show as its raw key.
    expect(refusalKindLabel('translationFairUse')).toBe('Translations — fair-use ceiling')
    expect(refusalKindLabel('unknown')).toBe('Unknown')
    expect(refusalKindLabel('somethingNew')).toBe('somethingNew')
  })
})

describe('the money timeline lines', () => {
  const store: AdminMoneyItem = {
    kind: 'store',
    at: '2026-11-09T13:05:00.000Z',
    daysAfterJoin: 3,
    event: 'INITIAL_PURCHASE',
    store: 'APP_STORE',
    productId: 'pro_monthly',
    expiresAt: '2026-11-16T13:05:00.000Z',
    periodDays: 7,
    sandbox: false,
  }

  it('says a store event in words and how long the period it opened was', () => {
    expect(moneyItemTitle(store)).toBe('Subscription started')
    expect(moneyItemDetail(store)).toBe(
      'day 3 after joining · APP_STORE · pro_monthly · opens a 7-day period',
    )
  })

  it('flags a sandbox event so it is not read as money', () => {
    expect(moneyItemDetail({ ...store, sandbox: true })).toContain('sandbox')
  })

  it('shows a RevenueCat event it has no word for as RevenueCat spelled it', () => {
    expect(moneyItemTitle({ ...store, event: 'SOMETHING_NEW' })).toBe('SOMETHING_NEW')
  })

  it('says a gift with its length, source and state', () => {
    const gift: AdminMoneyItem = {
      kind: 'gift',
      at: '2026-11-09T13:05:00.000Z',
      daysAfterJoin: 0,
      source: 'streak',
      months: 0,
      weeks: 1,
      status: 'granted',
      endsAt: '2026-11-16T13:05:00.000Z',
    }
    expect(moneyItemTitle(gift)).toBe('Gift of Pro: 1 week')
    expect(moneyItemDetail(gift)).toBe('day of joining · for a streak · granted')
    expect(moneyItemTitle({ ...gift, months: 1, weeks: 2 })).toBe(
      'Gift of Pro: 1 month and 2 weeks',
    )
  })

  it('says the fall to free, and a day that is before the profile existed', () => {
    const churn: AdminMoneyItem = {
      kind: 'churn',
      at: '2026-11-09T13:05:00.000Z',
      daysAfterJoin: -2,
      tier: 'pro',
    }
    expect(moneyItemTitle(churn)).toBe('Fell back to free')
    expect(moneyItemDetail(churn)).toBe('before joining')
  })
})

describe('dayLabel', () => {
  it('is the day, month and year', () => {
    expect(dayLabel('2026-09-01')).toBe('1 Sep 2026')
  })

  it('shows what it was given when that is not a day', () => {
    expect(dayLabel('someday')).toBe('someday')
  })
})

describe('utcStamp', () => {
  it('is the day, month and time in UTC', () => {
    expect(utcStamp('2026-11-09T13:05:00.000Z')).toBe('9 Nov 13:05')
    expect(utcStamp('2026-01-02T03:04:00.000Z')).toBe('2 Jan 03:04')
  })

  it('shows what it was given when that is not a time', () => {
    expect(utcStamp('later')).toBe('later')
  })
})
