import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import { latestToActOn } from './latestToActOn'

const ME = 'me'
const THEM = 'them'

function message(id: string, senderId: string, extra: Partial<MessageDto> = {}): MessageDto {
  return {
    _id: id,
    conversationId: 'c1',
    senderId,
    type: 'text',
    body: `body of ${id}`,
    createdAt: '2026-10-19T12:00:00.000Z',
    ...extra,
  }
}

describe('latestToActOn', () => {
  it('is their newest message, past any of mine that came after it', () => {
    const items = [message('m2', ME), message('t2', THEM), message('t1', THEM)]
    expect(latestToActOn(items, ME)?._id).toBe('t2')
  })

  it('is nothing when they have not written yet', () => {
    expect(latestToActOn([message('m1', ME)], ME)).toBeUndefined()
    expect(latestToActOn([], ME)).toBeUndefined()
  })

  it('is nothing before the viewer is known, when every message would look like theirs', () => {
    expect(latestToActOn([message('m1', ME)], undefined)).toBeUndefined()
  })

  it('does not fall back past their newest to an older sentence', () => {
    const items = [message('photo', THEM, { type: 'image' }), message('t1', THEM)]
    expect(latestToActOn(items, ME)).toBeUndefined()
  })

  it('skips a withdrawn message, a correction and a call', () => {
    expect(latestToActOn([message('t', THEM, { deleted: true })], ME)).toBeUndefined()
    expect(latestToActOn([message('c', THEM, { type: 'correction' })], ME)).toBeUndefined()
    expect(latestToActOn([message('k', THEM, { type: 'call' })], ME)).toBeUndefined()
  })

  it('skips a view-once message and an empty body', () => {
    // With a body, so it is the view-once mark alone that refuses it.
    const viewOnce = message('v', THEM, {
      viewOnce: { kind: 'image', replay: false, opens: 0, opensLeft: 1 },
    })
    expect(latestToActOn([viewOnce], ME)).toBeUndefined()
    expect(latestToActOn([message('e', THEM, { body: '   ' })], ME)).toBeUndefined()
  })
})
