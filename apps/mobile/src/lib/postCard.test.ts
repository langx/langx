import { describe, expect, it } from 'vitest'
import { postCardAction, postCardKind } from './postCard'

const post = {
  asks: [] as ('correction' | 'pronunciation')[],
  mine: false,
  correctedByViewer: false,
  answeredByViewer: false,
}

describe('postCardKind', () => {
  it('calls a post that asks for something an ask', () => {
    expect(postCardKind(['correction'])).toBe('ask')
    expect(postCardKind(['pronunciation'])).toBe('ask')
    expect(postCardKind(['correction', 'pronunciation'])).toBe('ask')
  })

  it('calls a post that asks for nothing a moment', () => {
    expect(postCardKind([])).toBe('moment')
  })
})

describe('postCardAction', () => {
  it('never offers to correct a moment, which the server would refuse', () => {
    expect(postCardAction(post)).toBe('comment')
    expect(postCardAction({ ...post, mine: true })).toBe('comment')
  })

  it('offers the help that was asked for', () => {
    expect(postCardAction({ ...post, asks: ['correction'] })).toBe('correct')
    expect(postCardAction({ ...post, asks: ['pronunciation'] })).toBe('record')
  })

  it('offers the correction first on a post that asks for both, then the recording', () => {
    const both = { ...post, asks: ['correction', 'pronunciation'] as typeof post.asks }
    expect(postCardAction(both)).toBe('correct')
    expect(postCardAction({ ...both, correctedByViewer: true })).toBe('record')
    expect(postCardAction({ ...both, correctedByViewer: true, answeredByViewer: true })).toBe(
      'view',
    )
  })

  it('offers no help on your own post', () => {
    expect(postCardAction({ ...post, asks: ['correction'], mine: true })).toBe('view')
    expect(postCardAction({ ...post, asks: ['pronunciation'], mine: true })).toBe('view')
  })

  it('opens the post once you have helped', () => {
    expect(postCardAction({ ...post, asks: ['correction'], correctedByViewer: true })).toBe('view')
    expect(postCardAction({ ...post, asks: ['pronunciation'], answeredByViewer: true })).toBe(
      'view',
    )
  })
})
