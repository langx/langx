import type { EchoCard } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  ECHO_SNAPSHOT_MAX_AGE_MS,
  ECHO_SNAPSHOT_VERSION,
  emptySnapshot,
  offlineQueue,
  parseSnapshot,
  snapshotIsFresh,
  withPending,
  withoutPending,
  type PendingReview,
} from './echoSnapshot'

const NOW = new Date('2026-09-14T12:00:00Z')

function card(id: string): EchoCard {
  return {
    _id: id,
    front: 'Ça va ?',
    back: 'How are you?',
    lang: 'fr',
    source: { kind: 'pack', packId: 'fr:absoluteBeginner', itemId: `fr:absoluteBeginner#${id}` },
    srs: {
      state: 'review',
      step: 0,
      due: NOW.toISOString(),
      interval: 10,
      ease: 2.5,
      reps: 2,
      lapses: 0,
      lastReviewedAt: null,
    },
    createdAt: NOW.toISOString(),
  }
}

function pending(reviewId: string, cardId: string): PendingReview {
  return { reviewId, cardId, grade: 'good', durationMs: 900, at: NOW.toISOString() }
}

describe('reading what was left on the device', () => {
  it('refuses anything it did not write', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('{}')).toBeNull()
    expect(parseSnapshot({ version: 999, cards: [], pending: [], savedAt: '' })).toBeNull()
    // A half-written file after a kill is the ordinary case, not the exotic one.
    expect(parseSnapshot({ version: ECHO_SNAPSHOT_VERSION, cards: [] })).toBeNull()
  })

  it('keeps a file it did write', () => {
    const snapshot = withPending(emptySnapshot(NOW), [pending('r-1', 'c-1')])
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('drops pending entries that lost their shape', () => {
    const parsed = parseSnapshot({
      version: ECHO_SNAPSHOT_VERSION,
      cards: [],
      pending: [pending('r-1', 'c-1'), { reviewId: 'r-2' }, null],
      savedAt: NOW.toISOString(),
    })
    expect(parsed?.pending).toHaveLength(1)
  })
})

describe('how stale a saved queue may be', () => {
  it('holds for three days and not longer', () => {
    const snapshot = emptySnapshot(NOW)
    const almost = new Date(NOW.getTime() + ECHO_SNAPSHOT_MAX_AGE_MS)
    const past = new Date(NOW.getTime() + ECHO_SNAPSHOT_MAX_AGE_MS + 1)
    expect(snapshotIsFresh(snapshot, almost)).toBe(true)
    expect(snapshotIsFresh(snapshot, past)).toBe(false)
  })

  it('treats an unreadable date as stale rather than as now', () => {
    expect(snapshotIsFresh({ ...emptySnapshot(NOW), savedAt: 'nonsense' }, NOW)).toBe(false)
  })
})

describe('the queue a session draws on with no network', () => {
  it('is empty once the saved copy is too old to be honest', () => {
    const snapshot = { ...emptySnapshot(NOW), cards: [card('c-1')] }
    const later = new Date(NOW.getTime() + ECHO_SNAPSHOT_MAX_AGE_MS + 1)
    expect(offlineQueue(snapshot, later)).toEqual([])
  })

  it('leaves out cards already answered offline', () => {
    // They are waiting in `pending`; asking for a second answer in one sitting
    // would have the ledger refuse it, and the answer would vanish.
    const snapshot = withPending({ ...emptySnapshot(NOW), cards: [card('c-1'), card('c-2')] }, [
      pending('r-1', 'c-1'),
    ])
    expect(offlineQueue(snapshot, NOW).map((c) => c._id)).toEqual(['c-2'])
  })
})

describe('grades waiting to reach the server', () => {
  it('keeps one per review id, and the first one', () => {
    const first = pending('r-1', 'c-1')
    const second = { ...first, durationMs: 4000 }
    const snapshot = withPending(withPending(emptySnapshot(NOW), [first]), [second])
    expect(snapshot.pending).toEqual([first])
  })

  it('adds without losing what was already there', () => {
    const snapshot = withPending(withPending(emptySnapshot(NOW), [pending('r-1', 'c-1')]), [
      pending('r-2', 'c-2'),
    ])
    expect(snapshot.pending.map((p) => p.reviewId)).toEqual(['r-1', 'r-2'])
  })

  it('forgets only what the server accepted', () => {
    const snapshot = withPending(emptySnapshot(NOW), [pending('r-1', 'c-1'), pending('r-2', 'c-2')])
    expect(withoutPending(snapshot, ['r-1']).pending.map((p) => p.reviewId)).toEqual(['r-2'])
  })

  it('never drops a grade for being old — it is work somebody did', () => {
    const old = { ...emptySnapshot(new Date('2020-01-01T00:00:00Z')) }
    const snapshot = withPending(old, [pending('r-1', 'c-1')])
    expect(snapshotIsFresh(snapshot, NOW)).toBe(false)
    expect(snapshot.pending).toHaveLength(1)
  })
})

describe('the saved queue drawn for one session', () => {
  const chat = (id: string, lang: string, partnerId: string): EchoCard => ({
    ...card(id),
    lang,
    source: { kind: 'chat', conversationId: 'conv', messageId: `m-${id}`, partnerId },
  })

  /*
   * The file holds whichever deck was last fetched, not the one asked for. A
   * Spanish session opened on a train drew the French deck saved the day
   * before — a mixed deck, which review never is.
   */
  it('draws only the language the session is for', () => {
    const snapshot = { ...emptySnapshot(NOW), cards: [card('fr-1'), chat('es-1', 'es', 'p-1')] }
    expect(offlineQueue(snapshot, NOW, { lang: 'es' }).map((c) => c._id)).toEqual(['es-1'])
    expect(offlineQueue(snapshot, NOW, { lang: 'de' })).toEqual([])
  })

  it('draws only what one partner wrote when the session is theirs', () => {
    const snapshot = {
      ...emptySnapshot(NOW),
      cards: [card('pack-1'), chat('c-1', 'fr', 'anna'), chat('c-2', 'fr', 'ben')],
    }
    expect(offlineQueue(snapshot, NOW, { lang: 'fr', partner: 'anna' }).map((c) => c._id)).toEqual([
      'c-1',
    ])
  })

  it('draws everything saved when the session names neither', () => {
    const snapshot = { ...emptySnapshot(NOW), cards: [card('fr-1'), chat('es-1', 'es', 'p-1')] }
    expect(offlineQueue(snapshot, NOW).map((c) => c._id)).toEqual(['fr-1', 'es-1'])
  })
})
