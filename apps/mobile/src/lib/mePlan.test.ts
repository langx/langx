import { BADGE_KINDS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  blockHues,
  nextBadgeAction,
  planFirstWeek,
  showStats,
  type FirstWeekInput,
  type FirstWeekThread,
} from './mePlan'

const ME = 'me'

function thread(over: Partial<FirstWeekThread> = {}): FirstWeekThread {
  return {
    lastMessage: { senderId: 'them' },
    bothSpoke: false,
    partner: { displayName: 'Yuki' },
    ...over,
  }
}

/** A first day with everything loaded and nothing done yet. */
function day1(over: Partial<FirstWeekInput> = {}): FirstWeekInput {
  return {
    meId: ME,
    firstWeek: { corrected: false },
    threads: [],
    echoCards: 0,
    invited: 0,
    ...over,
  }
}

describe('planFirstWeek', () => {
  it('starts at none of four', () => {
    expect(planFirstWeek(day1())).toEqual({
      done: { hello: false, correction: false, echo: false, invite: false },
      count: 0,
    })
  })

  it('is no list at all past the first week, or from an API that does not say', () => {
    expect(planFirstWeek(day1({ firstWeek: undefined }))).toBeNull()
    // Nothing else is waited for once the week is over.
    expect(
      planFirstWeek(
        day1({
          firstWeek: undefined,
          threads: undefined,
          echoCards: undefined,
          invited: undefined,
        }),
      ),
    ).toBeNull()
  })

  it('waits for every source rather than ticking steps in one by one', () => {
    expect(planFirstWeek(day1({ threads: undefined }))).toBeUndefined()
    expect(planFirstWeek(day1({ echoCards: undefined }))).toBeUndefined()
    expect(planFirstWeek(day1({ invited: undefined }))).toBeUndefined()
  })

  it('counts a hello this person wrote, answered or not, and names who it went to', () => {
    const sent = planFirstWeek(day1({ threads: [thread({ lastMessage: { senderId: ME } })] }))
    expect(sent?.done.hello).toBe(true)
    expect(sent?.helloTo).toBe('Yuki')
    expect(planFirstWeek(day1({ threads: [thread({ bothSpoke: true })] }))?.done.hello).toBe(true)
  })

  it('does not count a hello somebody else sent that was never answered', () => {
    expect(planFirstWeek(day1({ threads: [thread()] }))?.done.hello).toBe(false)
  })

  it('does not count answering the @langx welcome', () => {
    const official = thread({
      bothSpoke: true,
      partner: { displayName: 'LangX', official: true },
    })
    expect(planFirstWeek(day1({ threads: [official] }))?.done.hello).toBe(false)
  })

  it('ticks each of the other three from its own source', () => {
    const plan = planFirstWeek(day1({ firstWeek: { corrected: true }, echoCards: 3, invited: 1 }))
    expect(plan?.done).toEqual({ hello: false, correction: true, echo: true, invite: true })
    expect(plan?.count).toBe(3)
  })

  it('goes away once all four are done', () => {
    expect(
      planFirstWeek(
        day1({
          firstWeek: { corrected: true },
          threads: [thread({ bothSpoke: true })],
          echoCards: 1,
          invited: 2,
        }),
      ),
    ).toBeNull()
  })
})

describe('nextBadgeAction', () => {
  it('has an answer for every badge kind', () => {
    for (const kind of BADGE_KINDS) expect(nextBadgeAction(kind)).not.toBeUndefined()
  })

  it('offers a correction for teaching and a chat for talking', () => {
    expect(nextBadgeAction('correction')).toBe('correct')
    expect(nextBadgeAction('messages')).toBe('write')
    expect(nextBadgeAction('tokens')).toBe('write')
  })

  it('offers nothing for a badge a press does not bring closer', () => {
    expect(nextBadgeAction('streak')).toBeNull()
    expect(nextBadgeAction('veteran')).toBeNull()
    expect(nextBadgeAction('origin')).toBeNull()
  })
})

describe('showStats', () => {
  it('hides a row of zeros', () => {
    expect(showStats([0, 0, 0])).toBe(false)
  })

  it('keeps a zero beside a real number, and anything not yet arrived', () => {
    expect(showStats([0, 4, 0])).toBe(true)
    expect(showStats([0, undefined, 0])).toBe(true)
  })
})

describe('blockHues', () => {
  it('keeps the asked-for hues when none is the person’s own', () => {
    expect(blockHues('tangerine', ['lime', 'aqua', 'lilac', 'mint'])).toEqual([
      'lime',
      'aqua',
      'lilac',
      'mint',
    ])
  })

  it('swaps the person’s own hue for one not on the screen', () => {
    const hues = blockHues('aqua', ['lime', 'aqua', 'lilac', 'mint'])
    expect(hues).not.toContain('aqua')
    expect(new Set(hues).size).toBe(4)
    expect(hues).toEqual(['lime', 'sky', 'lilac', 'mint'])
  })
})
