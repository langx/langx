import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import { copilotEmptyThread } from './copilotErrors'
import { createReplyIdeasCache, replyIdeasFor } from './replyIdeas'

const ME = 'me'
const THEM = 'them'

function message(id: string, senderId: string, extra: Partial<MessageDto> = {}): MessageDto {
  return {
    _id: id,
    conversationId: 'c1',
    senderId,
    type: 'text',
    body: `body of ${id}`,
    createdAt: '2026-10-21T12:00:00.000Z',
    ...extra,
  }
}

describe('replyIdeasFor', () => {
  it('is their newest message when it is the thread’s newest and the composer is empty', () => {
    const items = [message('t2', THEM), message('m1', ME)]
    expect(replyIdeasFor(items, ME, '', false)?._id).toBe('t2')
    expect(replyIdeasFor(items, ME, '   ', false)?._id).toBe('t2')
  })

  it('is nothing once I have answered — never an older line of theirs', () => {
    const items = [message('m2', ME), message('t2', THEM)]
    expect(replyIdeasFor(items, ME, '', false)).toBeUndefined()
  })

  it('is nothing while there is a draft or a correction', () => {
    const items = [message('t1', THEM)]
    expect(replyIdeasFor(items, ME, 'Hal', false)).toBeUndefined()
    expect(replyIdeasFor(items, ME, '', true)).toBeUndefined()
  })

  it('is nothing for a photo, a voice note, a call, a withdrawn or a view-once message', () => {
    const cases: Partial<MessageDto>[] = [
      { type: 'image' },
      { type: 'audio' },
      { type: 'call' },
      { type: 'correction' },
      { deleted: true },
      { viewOnce: { kind: 'image', replay: false, opens: 0, opensLeft: 1 } },
      { body: '  ' },
    ]
    for (const extra of cases) {
      expect(replyIdeasFor([message('t1', THEM, extra)], ME, '', false)).toBeUndefined()
    }
  })

  it('is nothing in an empty thread, or before the viewer is known', () => {
    expect(replyIdeasFor([], ME, '', false)).toBeUndefined()
    expect(replyIdeasFor([message('t1', THEM)], undefined, '', false)).toBeUndefined()
  })
})

describe('createReplyIdeasCache', () => {
  it('gives back what was kept, for that reader and that message only', () => {
    const cache = createReplyIdeasCache()
    cache.set(ME, 't1', ['Hi!', 'Sure.', 'Why?'])
    expect(cache.get(ME, 't1')).toEqual(['Hi!', 'Sure.', 'Why?'])
    expect(cache.get(ME, 't2')).toBeUndefined()
    expect(cache.get('someone-else', 't1')).toBeUndefined()
  })

  it('lets the oldest go past its limit, and counts a rewrite as new', () => {
    const cache = createReplyIdeasCache(2)
    cache.set(ME, 'a', ['1'])
    cache.set(ME, 'b', ['2'])
    cache.set(ME, 'a', ['1 again'])
    cache.set(ME, 'c', ['3'])
    expect(cache.get(ME, 'b')).toBeUndefined()
    expect(cache.get(ME, 'a')).toEqual(['1 again'])
    expect(cache.get(ME, 'c')).toEqual(['3'])
  })
})

describe('copilotEmptyThread', () => {
  it('is the server’s nothing-to-reply-to, and nothing else', () => {
    expect(copilotEmptyThread({ code: 'VALIDATION_FAILED', reason: 'empty_thread' })).toBe(true)
    expect(copilotEmptyThread({ code: 'VALIDATION_FAILED', reason: 'not_explainable' })).toBe(
      false,
    )
    expect(copilotEmptyThread({ code: 'COPILOT_UNAVAILABLE', reason: 'empty_thread' })).toBe(false)
    expect(copilotEmptyThread(new Error('offline'))).toBe(false)
  })
})
