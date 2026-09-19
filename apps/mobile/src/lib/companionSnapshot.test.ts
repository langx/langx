import { companionSnapshotSchema } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { buildCompanionSnapshot, countedToday, type CompanionSources } from './companionSnapshot'

const sources: CompanionSources = {
  unread: 3,
  profile: { streak: { current: 42, longest: 108, lastQualifiedDay: '2026-09-18' } },
  echo: { due: 12, nextDue: '2026-09-20T06:00:00.000Z' },
}

/** The keys the widget's three labels come from, in English. */
const t = ((key: string) =>
  ({
    'me.dayStreak': 'Day streak',
    'inbox.unread': 'Unread',
    'echo.tileDue': 'cards due',
  })[key] ?? key) as never

const at = new Date('2026-09-19T08:30:00.000Z')

describe('buildCompanionSnapshot', () => {
  it('produces a blob the schema accepts', () => {
    const snapshot = buildCompanionSnapshot(sources, 'en', t, at)

    expect(companionSnapshotSchema.parse(snapshot)).toEqual(snapshot)
    expect(snapshot.writtenAt).toBe('2026-09-19T08:30:00.000Z')
  })

  it('carries the numbers the three tiles show', () => {
    const snapshot = buildCompanionSnapshot(sources, 'en', t, at)

    expect(snapshot.unread).toBe(3)
    expect(snapshot.streak).toEqual({ current: 42, longest: 108, lastQualifiedDay: '2026-09-18' })
    expect(snapshot.echo.due).toBe(12)
  })

  it('labels the numbers in the reader s language, from the app s own keys', () => {
    const turkish = ((key: string) =>
      ({
        'me.dayStreak': 'Günlük seri',
        'inbox.unread': 'Okunmamış',
        'echo.tileDue': 'kart hazır',
      })[key] ?? key) as never

    expect(buildCompanionSnapshot(sources, 'tr', turkish, at).labels).toEqual({
      streak: 'Günlük seri',
      unread: 'Okunmamış',
      cardsDue: 'kart hazır',
    })
  })

  /*
   * The one rule this file is really guarding: the day stays raw. Deciding
   * "today has counted" here would answer at write time and keep answering it
   * after midnight, which is the hour the widget most needs to be right.
   */
  it('copies lastQualifiedDay across rather than deciding whether today counted', () => {
    const today = buildCompanionSnapshot(
      {
        ...sources,
        profile: { streak: { current: 42, longest: 108, lastQualifiedDay: '2026-09-19' } },
      },
      'en',
      t,
      at,
    )
    const yesterday = buildCompanionSnapshot(sources, 'en', t, at)

    expect(today.streak.lastQualifiedDay).toBe('2026-09-19')
    expect(yesterday.streak.lastQualifiedDay).toBe('2026-09-18')
    expect(Object.keys(today.streak)).toEqual(['current', 'longest', 'lastQualifiedDay'])
  })

  it('has a null day for an account that has never had one', () => {
    const fresh = buildCompanionSnapshot(
      { ...sources, profile: { streak: { current: 0, longest: 108, lastQualifiedDay: null } } },
      'en',
      t,
      at,
    )

    expect(companionSnapshotSchema.parse(fresh).streak.lastQualifiedDay).toBeNull()
  })

  it('collapses a missing nextDue into null rather than a second empty state', () => {
    const older = buildCompanionSnapshot({ ...sources, echo: { due: 0 } }, 'en', t, at)

    expect(older.echo.nextDue).toBeNull()
    expect(() => companionSnapshotSchema.parse(older)).not.toThrow()
  })
})

describe('countedToday', () => {
  const on = (lastQualifiedDay: string | null) =>
    buildCompanionSnapshot(
      { ...sources, profile: { streak: { current: 1, longest: 1, lastQualifiedDay } } },
      'en',
      t,
      at,
    )

  /*
   Every moment below is built from **local** components — `new Date(y, m, d,
   …)` rather than an ISO string — because that is the calendar `deviceDayKey`
   reads, and it is the only way these assertions mean the same thing wherever
   they run. Written with a fixed `-04:00`, the last one passed in Toronto and
   failed on a UTC runner: it was asserting something about the machine. That
   is the confusion this function exists to keep out of the widget.
  */
  const localNoon = new Date(2026, 8, 19, 12, 0)

  it('is true only when the last qualifying day is the device’s own today', () => {
    expect(countedToday(on('2026-09-19'), localNoon)).toBe(true)
    expect(countedToday(on('2026-09-18'), localNoon)).toBe(false)
  })

  /** An account that has never had a qualifying day is not "done for today". */
  it('is false when nothing has ever counted', () => {
    expect(countedToday(on(null), localNoon)).toBe(false)
  })

  /**
   * The answer is asked again, not frozen. This is the whole reason the day
   * travels raw instead of as a flag computed when the app last wrote: the
   * widget wakes after a midnight the app slept through, and has to say the
   * new day's answer about the same blob.
   */
  it('turns false once the device rolls into the next day', () => {
    const snapshot = on('2026-09-19')

    expect(countedToday(snapshot, new Date(2026, 8, 19, 23, 59))).toBe(true)
    expect(countedToday(snapshot, new Date(2026, 8, 20, 0, 1))).toBe(false)
  })
})
