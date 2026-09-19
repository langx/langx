import { companionSnapshotSchema } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { buildCompanionSnapshot, type CompanionSources } from './companionSnapshot'

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
