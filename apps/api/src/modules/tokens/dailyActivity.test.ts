import { describe, expect, it } from 'vitest'
import { countersOf, type DailyActivity } from './dailyActivity'

describe('countersOf', () => {
  it('reads a fully shaped document', () => {
    const doc = {
      messages: 3,
      corrections: 2,
      mutualConversations: 1,
      partners: ['a', 'b'],
    } as DailyActivity

    expect(countersOf(doc)).toEqual({
      messages: 3,
      corrections: 2,
      mutualConversations: 1,
      distinctPartners: 2,
    })
  })

  it('handles a document written by a correction, which has no partners', () => {
    // The regression. `$addToSet: { partners }` only runs when there is a
    // partner, and a correction has none — so a day that starts with teaching
    // produces a document with no `partners` field at all. Reading `.length`
    // off it was a 500 on the entire token summary.
    const doc = { messages: 0, corrections: 1, mutualConversations: 0 } as DailyActivity
    expect(countersOf(doc).distinctPartners).toBe(0)
    expect(countersOf(doc).corrections).toBe(1)
  })

  it('handles no activity at all', () => {
    expect(countersOf(null)).toEqual({
      messages: 0,
      corrections: 0,
      mutualConversations: 0,
      distinctPartners: 0,
    })
  })
})
