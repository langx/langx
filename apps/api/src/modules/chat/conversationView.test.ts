import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { SPOILER_MASK } from '@langx/shared'
import type { Conversation } from './conversations'
import { toConversationView } from './conversationView'

function conversation(body: string): Conversation {
  const now = new Date('2026-09-27T09:00:00.000Z')
  return {
    _id: new ObjectId(),
    pairKey: 'a:b',
    participants: ['a', 'b'],
    lastMessage: { body, senderId: 'a', createdAt: now },
    unread: {},
    createdAt: now,
    updatedAt: now,
  } as Conversation
}

describe('toConversationView', () => {
  /** The chat list row has nowhere to tap a spoiler open, so it never prints one. */
  it('shows the last message without its markers, and with its spoiler covered', () => {
    const view = toConversationView(conversation('*wow* ||he was the killer||'), 'b')
    expect(view.lastMessage.body).toBe(`wow ${SPOILER_MASK}`)
  })

  it('leaves a message with nothing to format as it was written', () => {
    expect(toConversationView(conversation('2*3*4 = 24'), 'b').lastMessage.body).toBe('2*3*4 = 24')
  })

  /**
   * `unreplied` reads who wrote last, and a call's row is "written" by
   * whoever placed it — which says nothing about whose turn it is.
   */
  it('does not leave a call both people took waiting for an answer', () => {
    const withCall = (outcome: 'completed' | 'missed' | 'declined'): Conversation => {
      const thread = conversation('📞 Voice call')
      thread.lastMessage.call = { media: 'audio', outcome }
      return thread
    }
    // `a` placed it; `b` is the one who was called.
    expect(toConversationView(withCall('completed'), 'b').unreplied).toBe(false)
    // A call they missed is theirs to return, like a message they have not answered.
    expect(toConversationView(withCall('missed'), 'b').unreplied).toBe(true)
    expect(toConversationView(withCall('missed'), 'a').unreplied).toBe(false)
  })

  it('carries what the call was, so each reader can word it for themselves', () => {
    const thread = conversation('📹 Video call')
    thread.lastMessage.call = { media: 'video', outcome: 'completed', durationSeconds: 192 }
    expect(toConversationView(thread, 'b').lastMessage.call).toEqual({
      media: 'video',
      outcome: 'completed',
      durationSeconds: 192,
    })
  })
})
