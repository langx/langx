import { describe, expect, it } from 'vitest'
import { askSummary, asksOf, normaliseAsks } from './postAsks'

describe('asksOf', () => {
  it('reads the stored asks when the post carries them', () => {
    expect(asksOf({ asks: ['correction', 'pronunciation'], kind: 'correction' })).toEqual([
      'correction',
      'pronunciation',
    ])
    // A moment: the field is there and empty, which is not the same as absent.
    expect(asksOf({ asks: [], kind: 'correction' })).toEqual([])
  })

  it('derives them from the old kind on a post written before asks', () => {
    expect(asksOf({ kind: 'pronunciation' })).toEqual(['pronunciation'])
    expect(asksOf({ kind: 'correction' })).toEqual(['correction'])
    expect(asksOf({ kind: 'moment' })).toEqual([])
  })

  it('reads a post with no kind at all as a correction ask', () => {
    // Every post from before `kind` existed was one, and none was backfilled.
    expect(asksOf({})).toEqual(['correction'])
  })

  it('hands back a copy, so a caller cannot edit the cached post', () => {
    const asks = ['correction'] as const
    const read = asksOf({ asks })
    read.push('pronunciation')
    expect(asks).toEqual(['correction'])
  })
})

describe('askSummary', () => {
  it('names every combination', () => {
    expect(askSummary([])).toBe('none')
    expect(askSummary(['correction'])).toBe('correction')
    expect(askSummary(['pronunciation'])).toBe('pronunciation')
    expect(askSummary(['pronunciation', 'correction'])).toBe('both')
  })
})

describe('normaliseAsks', () => {
  it('sorts, deduplicates and drops what is not an ask', () => {
    expect(normaliseAsks(['pronunciation', 'correction', 'pronunciation', 'moment'])).toEqual([
      'correction',
      'pronunciation',
    ])
    expect(normaliseAsks([])).toEqual([])
  })
})
