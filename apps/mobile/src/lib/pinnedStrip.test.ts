import { SPOILER_MASK } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { pinnedAuthor, pinnedLine, type PinnedSource } from './pinnedStrip'

const text = (body: string, extra: Partial<PinnedSource> = {}): PinnedSource => ({
  type: 'text',
  body,
  senderId: 'maria',
  ...extra,
})

describe('pinnedLine', () => {
  it('holds the line with an ellipsis while the message has not loaded', () => {
    expect(pinnedLine(undefined)).toEqual({ text: '…' })
  })

  it('prints the text on one line, without its markers', () => {
    expect(pinnedLine(text('See you *Friday*\nat   the café'))).toEqual({
      text: 'See you Friday at the café',
    })
  })

  it('masks a spoiler rather than printing it', () => {
    expect(pinnedLine(text('The end: ||he lives||'))).toEqual({
      text: `The end: ${SPOILER_MASK}`,
    })
  })

  it('names a message with no words by its kind', () => {
    expect(pinnedLine({ type: 'image', body: '', senderId: 'maria' })).toEqual({
      key: 'messageMeta.photo',
    })
    expect(pinnedLine({ type: 'audio', body: '  ', senderId: 'maria' })).toEqual({
      key: 'chat.voiceMessage',
    })
    expect(pinnedLine(text(''))).toEqual({ key: 'messageMeta.message' })
  })

  it('keeps a photo caption', () => {
    expect(pinnedLine({ type: 'image', body: 'Our street', senderId: 'maria' })).toEqual({
      text: 'Our street',
    })
  })

  it('never prints a view-once caption', () => {
    expect(
      pinnedLine({ type: 'image', body: 'secret', senderId: 'maria', viewOnce: { mode: 'once' } }),
    ).toEqual({ key: 'messageMeta.photo' })
  })

  it('says a pinned message was deleted, not what it said', () => {
    expect(pinnedLine(text('withdrawn words', { deleted: true }))).toEqual({
      key: 'chat.deleted',
    })
  })

  it('says a message gone from this copy is deleted', () => {
    expect(pinnedLine(null)).toEqual({ key: 'chat.deleted' })
    expect(pinnedAuthor(null, 'me', 'Maria')).toBeNull()
  })
})

describe('pinnedAuthor', () => {
  it('puts You in front of your own message', () => {
    expect(pinnedAuthor(text('hi', { senderId: 'me' }), 'me', 'Maria')).toEqual({
      key: 'messageMeta.you',
    })
  })

  it('puts the partner in front of theirs by name', () => {
    expect(pinnedAuthor(text('hi'), 'me', 'Maria')).toEqual({ text: 'Maria' })
  })

  it('leaves the line bare until the partner has a name', () => {
    expect(pinnedAuthor(text('hi'), 'me', undefined)).toBeNull()
    expect(pinnedAuthor(text('hi'), 'me', '')).toBeNull()
  })

  it('knows nobody until both the message and the viewer are known', () => {
    expect(pinnedAuthor(undefined, 'me', 'Maria')).toBeNull()
    expect(pinnedAuthor(text('hi'), undefined, 'Maria')).toBeNull()
  })
})
