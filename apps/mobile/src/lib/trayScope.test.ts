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
})
