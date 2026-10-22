import { describe, expect, it } from 'vitest'
import { chatRowPreview } from './chatRowPreview'

describe('chatRowPreview', () => {
  it('prints the newest message as it was sent', () => {
    expect(chatRowPreview({ body: 'See you Friday' })).toEqual({ text: 'See you Friday' })
  })

  it('says the newest message was deleted rather than leaving the row blank', () => {
    // What `applyDeleteSideEffects` leaves behind on the conversation.
    expect(chatRowPreview({ body: '', deleted: true })).toEqual({ key: 'chat.deleted' })
  })
})
