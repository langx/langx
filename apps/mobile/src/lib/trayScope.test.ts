import { SECURITY_PUSH_TRAY_MS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { belongsTo, deliveredAtMs, questionsFor, staleOnOpen, type TrayFacts } from './trayScope'

describe('which shade notifications a read clears', () => {
  it('clears the message pushes of the thread that was read', () => {
    expect(
      belongsTo(
        { kind: 'message', conversationId: 'c1', senderId: 'u2' },
        { conversationId: 'c1' },
      ),
    ).toBe(true)
  })

  it('leaves the pushes of every other thread', () => {
    expect(belongsTo({ kind: 'message', conversationId: 'c2' }, { conversationId: 'c1' })).toBe(
      false,
    )
  })

  /** A reminder is about a time, not a message, and reading the thread does not answer it. */
  it('leaves a meeting reminder for the same conversation', () => {
    expect(
      belongsTo({ kind: 'meetingReminder', conversationId: 'c1' }, { conversationId: 'c1' }),
    ).toBe(false)
  })

  it('clears every kind with a row in the centre on "Mark all read"', () => {
    for (const kind of ['social', 'badgeEarned', 'profileVisits', 'wallet']) {
      expect(belongsTo({ kind }, 'inbox'), kind).toBe(true)
    }
  })

  it('leaves messages and the kinds the centre does not show', () => {
    for (const kind of [
      'message',
      'security',
      'billing',
      'streakReminder',
      'echo',
      'meetingReminder',
    ]) {
      expect(belongsTo({ kind, conversationId: 'c1' }, 'inbox'), kind).toBe(false)
    }
  })

  it('clears what the wallet shows when the wallet is opened', () => {
    for (const kind of ['wallet', 'bountyPaid']) {
      expect(belongsTo({ kind }, 'wallet'), kind).toBe(true)
    }
    for (const kind of ['message', 'social', 'security', 'badgeEarned']) {
      expect(belongsTo({ kind, conversationId: 'c1' }, 'wallet'), kind).toBe(false)
    }
  })

  /** Anything unrecognised stays: clearing a notification nobody read is the worse mistake. */
  it('leaves anything it does not recognise', () => {
    for (const data of [null, undefined, 'message', {}, { conversationId: 'c1' }]) {
      expect(belongsTo(data, { conversationId: 'c1' })).toBe(false)
      expect(belongsTo(data, 'inbox')).toBe(false)
    }
  })

  describe('one row tapped in the centre', () => {
    const actor = { _id: 'u2', handle: 'sofia', displayName: 'Sofia' }

    it('clears the follow push from that follower, and no other', () => {
      const row = { kind: 'follow' as const, actor }
      expect(belongsTo({ kind: 'social', handle: 'sofia' }, { row })).toBe(true)
      expect(belongsTo({ kind: 'social', handle: 'marco' }, { row })).toBe(false)
      expect(belongsTo({ kind: 'social', postId: 'p1' }, { row })).toBe(false)
    })

    it('clears every push about the post a reply or a like row is about', () => {
      for (const kind of [
        'postComment',
        'postCorrection',
        'pronunciationAnswer',
        'like',
      ] as const) {
        const row = { kind, postId: 'p1', actor }
        expect(belongsTo({ kind: 'social', postId: 'p1' }, { row }), kind).toBe(true)
        expect(belongsTo({ kind: 'social', postId: 'p2' }, { row }), kind).toBe(false)
        expect(belongsTo({ kind: 'social', handle: 'sofia' }, { row }), kind).toBe(false)
      }
    })

    /** A row whose post is gone matches nothing, rather than every post push without one. */
    it('clears nothing for a post row with no post', () => {
      expect(belongsTo({ kind: 'social' }, { row: { kind: 'like' } })).toBe(false)
    })

    it('clears the whole pile on the kinds that repeat', () => {
      expect(belongsTo({ kind: 'badgeEarned' }, { row: { kind: 'badgeEarned' } })).toBe(true)
      expect(belongsTo({ kind: 'profileVisits' }, { row: { kind: 'profileVisits' } })).toBe(true)
      expect(belongsTo({ kind: 'wallet' }, { row: { kind: 'walletPool' } })).toBe(true)
      expect(belongsTo({ kind: 'wallet' }, { row: { kind: 'badgeEarned' } })).toBe(false)
    })

    it('never clears a message', () => {
      expect(
        belongsTo({ kind: 'message', conversationId: 'c1' }, { row: { kind: 'profileVisits' } }),
      ).toBe(false)
    })
  })
})

describe('what the app clears from the shade when it opens', () => {
  const now = Date.UTC(2026, 8, 25, 8, 0)
  const nothingRead: TrayFacts = { readThreads: new Set(), inboxRead: false }

  it('asks only about what the shade holds', () => {
    expect(
      questionsFor([
        { kind: 'message', conversationId: 'c1' },
        { kind: 'message', conversationId: 'c1' },
        { kind: 'message', conversationId: 'c2' },
        { kind: 'meetingReminder', conversationId: 'c3' },
        { kind: 'security' },
      ]),
    ).toEqual({ threads: ['c1', 'c2'], inbox: false })
    expect(questionsFor([{ kind: 'social', postId: 'p1' }])).toEqual({ threads: [], inbox: true })
    expect(questionsFor([null, 'message', {}])).toEqual({ threads: [], inbox: false })
  })

  /** Read on a laptop, answered from the notification, or read before this existed. */
  it('clears the message pushes of threads the server says are read', () => {
    const facts: TrayFacts = { readThreads: new Set(['c1']), inboxRead: false }
    expect(staleOnOpen({ kind: 'message', conversationId: 'c1' }, now, facts, now)).toBe(true)
    expect(staleOnOpen({ kind: 'message', conversationId: 'c2' }, now, facts, now)).toBe(false)
    expect(staleOnOpen({ kind: 'meetingReminder', conversationId: 'c1' }, now, facts, now)).toBe(
      false,
    )
  })

  it('clears a sign-in alert a day after it arrived, and not before', () => {
    const security = { kind: 'security' }
    expect(staleOnOpen(security, now - SECURITY_PUSH_TRAY_MS + 1, nothingRead, now)).toBe(false)
    expect(staleOnOpen(security, now - SECURITY_PUSH_TRAY_MS, nothingRead, now)).toBe(true)
  })

  it("clears the centre's kinds only once nothing there is unread", () => {
    const read: TrayFacts = { readThreads: new Set(), inboxRead: true }
    for (const kind of ['social', 'badgeEarned', 'profileVisits']) {
      expect(staleOnOpen({ kind }, now, read, now), kind).toBe(true)
      expect(staleOnOpen({ kind }, now, nothingRead, now), kind).toBe(false)
    }
  })

  /** The gift-ready push has no row, so a clear centre says nothing about it. */
  it('leaves the wallet, the reminders and billing to their own screens', () => {
    const read: TrayFacts = { readThreads: new Set(['c1']), inboxRead: true }
    const old = now - 30 * SECURITY_PUSH_TRAY_MS
    for (const kind of [
      'wallet',
      'bountyPaid',
      'billing',
      'streakReminder',
      'echo',
      'meetingReminder',
      'promotion',
    ]) {
      expect(staleOnOpen({ kind, conversationId: 'c1' }, old, read, now), kind).toBe(false)
    }
  })

  it('leaves anything it does not recognise', () => {
    const read: TrayFacts = { readThreads: new Set(['c1']), inboxRead: true }
    for (const data of [null, undefined, 'message', {}, { conversationId: 'c1' }]) {
      expect(staleOnOpen(data, 0, read, now)).toBe(false)
    }
  })

  /** iOS hands over seconds and Android milliseconds, under the same name. */
  it('reads a delivery time in seconds or in milliseconds', () => {
    expect(deliveredAtMs(now / 1000)).toBe(now)
    expect(deliveredAtMs(now)).toBe(now)
  })
})
