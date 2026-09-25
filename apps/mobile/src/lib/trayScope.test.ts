import { SECURITY_PUSH_TRAY_MS, type TraySync } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  belongsTo,
  clearedBySync,
  deliveredAtMs,
  finishedWith,
  questionsFor,
  traySyncFrom,
  type TrayFacts,
} from './trayScope'

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

describe('what a sweep clears: on opening, or after a read on another device', () => {
  const now = Date.UTC(2026, 8, 25, 8, 0)
  const nothingKnown: TrayFacts = { readThreads: new Set(), rows: [] }
  const actor = { _id: 'u2', handle: 'sofia', displayName: 'Sofia' }

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
    for (const kind of ['social', 'badgeEarned', 'profileVisits', 'wallet']) {
      expect(questionsFor([{ kind }]), kind).toEqual({ threads: [], inbox: true })
    }
    expect(questionsFor([null, 'message', {}])).toEqual({ threads: [], inbox: false })
  })

  /** Read on a laptop, answered from the notification, or read before this existed. */
  it('clears the message pushes of threads the server says are read', () => {
    const facts: TrayFacts = { readThreads: new Set(['c1']), rows: [] }
    expect(finishedWith({ kind: 'message', conversationId: 'c1' }, now, facts, now)).toBe(true)
    expect(finishedWith({ kind: 'message', conversationId: 'c2' }, now, facts, now)).toBe(false)
    expect(finishedWith({ kind: 'meetingReminder', conversationId: 'c1' }, now, facts, now)).toBe(
      false,
    )
  })

  /** It has no row in the centre, so nothing can mark it read. */
  it('clears a sign-in alert a day after it arrived, and not before', () => {
    const security = { kind: 'security' }
    expect(finishedWith(security, now - SECURITY_PUSH_TRAY_MS + 1, nothingKnown, now)).toBe(false)
    expect(finishedWith(security, now - SECURITY_PUSH_TRAY_MS, nothingKnown, now)).toBe(true)
  })

  it('clears a push once the row it announced is read, and only that one', () => {
    const facts: TrayFacts = {
      readThreads: new Set(),
      rows: [
        { kind: 'like', postId: 'p1', actor, read: true },
        { kind: 'like', postId: 'p2', actor, read: false },
        { kind: 'follow', actor, read: true },
      ],
    }
    expect(finishedWith({ kind: 'social', postId: 'p1' }, now, facts, now)).toBe(true)
    expect(finishedWith({ kind: 'social', postId: 'p2' }, now, facts, now)).toBe(false)
    expect(finishedWith({ kind: 'social', handle: 'sofia' }, now, facts, now)).toBe(true)
    expect(finishedWith({ kind: 'social', handle: 'marco' }, now, facts, now)).toBe(false)
  })

  /** A like row read, and a comment on the same post not yet: the push is about both. */
  it('keeps a push while any row it belongs to is unread', () => {
    const facts: TrayFacts = {
      readThreads: new Set(),
      rows: [
        { kind: 'like', postId: 'p1', actor, read: true },
        { kind: 'postComment', postId: 'p1', actor, read: false },
      ],
    }
    expect(finishedWith({ kind: 'social', postId: 'p1' }, now, facts, now)).toBe(false)
  })

  it('settles the repeating kinds by their rows, as a tap does', () => {
    const read: TrayFacts = {
      readThreads: new Set(),
      rows: [
        { kind: 'badgeEarned', read: true },
        { kind: 'profileVisits', read: true },
        { kind: 'walletPool', read: true },
      ],
    }
    for (const kind of ['badgeEarned', 'profileVisits', 'wallet']) {
      expect(finishedWith({ kind }, now, read, now), kind).toBe(true)
      expect(finishedWith({ kind }, now, nothingKnown, now), kind).toBe(false)
    }
  })

  /** Not found is not read: the centre could not be asked, or the row is further back. */
  it('keeps a push whose rows are not in view', () => {
    for (const data of [{ kind: 'social', postId: 'p1' }, { kind: 'badgeEarned' }]) {
      expect(finishedWith(data, now, nothingKnown, now)).toBe(false)
    }
  })

  it('leaves the reminders, billing and bounties to their own screens', () => {
    const facts: TrayFacts = {
      readThreads: new Set(['c1']),
      rows: [{ kind: 'walletPool', read: true }],
    }
    const old = now - 30 * SECURITY_PUSH_TRAY_MS
    for (const kind of [
      'bountyPaid',
      'billing',
      'streakReminder',
      'echo',
      'meetingReminder',
      'promotion',
    ]) {
      expect(finishedWith({ kind, conversationId: 'c1' }, old, facts, now), kind).toBe(false)
    }
  })

  it('leaves anything it does not recognise', () => {
    const facts: TrayFacts = {
      readThreads: new Set(['c1']),
      rows: [{ kind: 'badgeEarned', read: true }],
    }
    for (const data of [null, undefined, 'message', {}, { conversationId: 'c1' }]) {
      expect(finishedWith(data, 0, facts, now)).toBe(false)
    }
  })

  /** iOS hands over seconds and Android milliseconds, under the same name. */
  it('reads a delivery time in seconds or in milliseconds', () => {
    expect(deliveredAtMs(now / 1000)).toBe(now)
    expect(deliveredAtMs(now)).toBe(now)
  })
})

describe('what a silent push clears while the app is closed', () => {
  const at = Date.UTC(2026, 8, 25, 12, 0)
  const before = at - 60_000
  const sync: TraySync = {
    kind: 'traySync',
    at,
    unread: 1,
    unreadThreads: ['c2'],
    inboxClear: true,
  }

  it('clears the pushes of threads no longer unread, and keeps the rest', () => {
    expect(clearedBySync({ kind: 'message', conversationId: 'c1' }, before, sync, at)).toBe(true)
    expect(clearedBySync({ kind: 'message', conversationId: 'c2' }, before, sync, at)).toBe(false)
  })

  /** A background push can be held back for minutes; a message meanwhile is news it predates. */
  it('never touches what arrived after the server looked', () => {
    for (const data of [
      { kind: 'message', conversationId: 'c1' },
      { kind: 'social', postId: 'p1' },
      { kind: 'security' },
    ]) {
      expect(clearedBySync(data, at, sync, at + SECURITY_PUSH_TRAY_MS)).toBe(false)
    }
  })

  /** Too many unread threads to list: the push says nothing about any of them. */
  it('leaves every message when there is no list', () => {
    const unlisted: TraySync = { kind: 'traySync', at, unread: 50, inboxClear: true }
    expect(clearedBySync({ kind: 'message', conversationId: 'c1' }, before, unlisted, at)).toBe(
      false,
    )
  })

  it("clears the centre's kinds only when nothing there is unread", () => {
    for (const kind of ['social', 'badgeEarned', 'profileVisits']) {
      expect(clearedBySync({ kind }, before, sync, at), kind).toBe(true)
      expect(clearedBySync({ kind }, before, { ...sync, inboxClear: false }, at), kind).toBe(false)
    }
  })

  /** The gift-ready push has no row, so a clear centre says nothing about it. */
  it('leaves the wallet, the reminders and billing', () => {
    for (const kind of ['wallet', 'bountyPaid', 'billing', 'streakReminder', 'echo', 'promotion']) {
      expect(clearedBySync({ kind }, before, sync, at), kind).toBe(false)
    }
    expect(clearedBySync({ kind: 'meetingReminder', conversationId: 'c1' }, before, sync, at)).toBe(
      false,
    )
  })

  it('clears a sign-in alert by the same day rule as opening the app', () => {
    const arrived = at - 2 * 60_000
    expect(
      clearedBySync({ kind: 'security' }, arrived, sync, arrived + SECURITY_PUSH_TRAY_MS),
    ).toBe(true)
    expect(clearedBySync({ kind: 'security' }, arrived, sync, at)).toBe(false)
  })

  describe('reading the payload the background task is handed', () => {
    it('reads a sync out of `dataString`, as both platforms deliver it', () => {
      const payload = { notification: null, data: { dataString: JSON.stringify(sync) } }
      expect(traySyncFrom(payload)).toEqual(sync)
    })

    /** Android runs the task for every push that arrives in the background. */
    it('ignores every other push, and anything malformed', () => {
      for (const payload of [
        { data: { dataString: JSON.stringify({ kind: 'message', conversationId: 'c1' }) } },
        { data: { dataString: JSON.stringify({ kind: 'traySync' }) } },
        { data: { dataString: '{not json' } },
        { data: {} },
        { actionIdentifier: 'reply', notification: {} },
        null,
        undefined,
      ]) {
        expect(traySyncFrom(payload)).toBeNull()
      }
    })
  })
})
