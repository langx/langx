import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import type { Message } from './conversations'
import { toMessageView } from './messageView'

const ME = 'me'
const THEM = 'them'

function message(overrides: Partial<Message> = {}): Message {
  return {
    _id: new ObjectId(),
    conversationId: new ObjectId(),
    senderId: THEM,
    type: 'text',
    body: 'hello',
    createdAt: new Date('2026-08-29T09:00:00.000Z'),
    ...overrides,
  }
}

describe('toMessageView', () => {
  it('turns ids and dates into the strings the wire uses', () => {
    const doc = message({ deliveredAt: new Date('2026-08-29T09:00:01.000Z') })
    const view = toMessageView(doc, ME)
    expect(view._id).toBe(doc._id.toHexString())
    expect(view.conversationId).toBe(doc.conversationId.toHexString())
    expect(view.createdAt).toBe('2026-08-29T09:00:00.000Z')
    expect(view.deliveredAt).toBe('2026-08-29T09:00:01.000Z')
  })

  /** The whole reason this function exists. */
  it('never ships who hid the message, only whether the viewer did', () => {
    const doc = message({ hiddenFor: [THEM] })
    expect(toMessageView(doc, THEM).hidden).toBe(true)
    expect(toMessageView(doc, ME).hidden).toBeUndefined()
    expect(JSON.stringify(toMessageView(doc, ME))).not.toContain('hiddenFor')
  })

  it('reports the viewer their own reaction, and everyone the whole tally', () => {
    const doc = message({ reactions: { '👍': [THEM], '🔥': [ME] } })
    expect(toMessageView(doc, ME).myReaction).toBe('🔥')
    expect(toMessageView(doc, THEM).myReaction).toBe('👍')
    expect(toMessageView(doc, ME).reactions).toEqual({ '👍': [THEM], '🔥': [ME] })
  })

  /** `$pull` leaves the key behind, and an empty one would draw an empty badge. */
  it('drops an emoji nobody has chosen any more', () => {
    const doc = message({ reactions: { '👍': [], '🔥': [ME] } })
    expect(toMessageView(doc, ME).reactions).toEqual({ '🔥': [ME] })
  })

  it('omits reactions entirely when there are none', () => {
    expect(toMessageView(message({ reactions: {} }), ME).reactions).toBeUndefined()
  })

  /**
   * The row survives because it is half of someone else's thread, so the
   * emptying has to happen on the way out — a reader who queried the
   * collection directly would otherwise still find the body.
   */
  it('empties a withdrawn message rather than removing it', () => {
    const doc = message({
      body: 'regretted',
      deletedAt: new Date(),
      deletedBy: THEM,
      media: { url: 'https://cdn/x.jpg', contentType: 'image/jpeg', sizeBytes: 1 },
      replyTo: { messageId: new ObjectId(), senderId: ME, preview: 'quoted' },
      reactions: { '🔥': [ME] },
    })
    const view = toMessageView(doc, ME)
    expect(view.deleted).toBe(true)
    expect(view.body).toBe('')
    expect(view.media).toBeUndefined()
    expect(view.replyTo).toBeUndefined()
    expect(view.reactions).toBeUndefined()
    // The row keeps its place in the timeline.
    expect(view.createdAt).toBe('2026-08-29T09:00:00.000Z')
  })

  it('carries a reply quote through unchanged', () => {
    const target = new ObjectId()
    const view = toMessageView(
      message({ replyTo: { messageId: target, senderId: ME, preview: 'the original' } }),
      ME,
    )
    expect(view.replyTo).toEqual({
      messageId: target.toHexString(),
      senderId: ME,
      preview: 'the original',
    })
  })
})
