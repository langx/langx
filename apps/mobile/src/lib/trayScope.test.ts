import { describe, expect, it } from 'vitest'
import { belongsTo } from './trayScope'

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
