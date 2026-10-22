import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { localDayKey, shiftDayKey } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { activityRange } from './activityMap'

/*
 * The server answers `/me/activity` and `/profiles/:handle/activity` in the
 * profile's own day, so a range has to hold that day wherever the profile is —
 * from the last zone to reach a date to the first.
 */
const ZONES = [
  'Pacific/Kiritimati', // +14
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Europe/Istanbul',
  'UTC',
  'America/Toronto',
  'America/Vancouver',
  'Pacific/Pago_Pago', // -11
  'Etc/GMT+12', // -12
]

// Every hour of 22 October 2026, plus both sides of Toronto's clocks going back.
const INSTANTS = [
  ...Array.from({ length: 24 }, (_, h) => new Date(Date.UTC(2026, 9, 22, h, 30))),
  new Date('2026-11-01T05:30:00Z'),
  new Date('2026-11-01T06:30:00Z'),
]

describe('activityRange', () => {
  it('reaches the profile’s today and the oldest day asked for, in every zone', () => {
    for (const now of INSTANTS) {
      const { from, to } = activityRange(14, now)
      for (const zone of ZONES) {
        const today = localDayKey(now, zone)
        expect(to >= today, `${zone} at ${now.toISOString()}: to`).toBe(true)
        expect(from <= shiftDayKey(today, -14), `${zone} at ${now.toISOString()}: from`).toBe(true)
      }
    }
  })

  /**
   * The store's repair offer. 21:00 in Toronto is already the next UTC date;
   * a window cut on that date started a day short of the oldest repairable
   * day, which then read as unfilled and was offered for a streak with no gap.
   */
  it('holds the oldest repairable day in a Toronto evening', () => {
    const now = new Date('2026-10-23T01:00:00Z') // 21:00 on the 22nd in Toronto
    const today = localDayKey(now, 'America/Toronto')
    expect(today).toBe('2026-10-22')
    expect(activityRange(14, now).from <= '2026-10-08').toBe(true)
  })

  /** Today in Auckland is tomorrow's UTC date until 13:00 there. */
  it('holds today’s row on an Auckland morning', () => {
    const now = new Date('2026-10-22T20:00:00Z') // 09:00 on the 23rd in Auckland
    expect(activityRange(14, now).to >= '2026-10-23').toBe(true)
  })
})

describe('activity range callers', () => {
  const callers = [
    'src/components/ActivityMap.tsx',
    'src/components/ActivityMapV3.tsx',
    'src/hooks/useCompanionSnapshot.ts',
    'src/hooks/useStoreV3.ts',
    'app/(app)/wallet/store.tsx',
    'app/(app)/streak/history.tsx',
  ]

  it.each(callers)('%s asks for its range through activityRange', (file) => {
    const source = readFileSync(resolve(__dirname, '../..', file), 'utf8')
    expect(source).toContain('activityRange(')
    expect(source).not.toMatch(/const to = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/)
    expect(source).not.toMatch(/const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/)
  })
})
