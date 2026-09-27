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
})
