import { describe, expect, it } from 'vitest'
import {
  ECHO_GRADES,
  newCardSrs,
  schedule,
  scheduledDelayMinutes,
  SRS_RULES,
  type EchoSrs,
} from './srs'

const NOW = new Date('2026-09-13T12:00:00Z')
const MINUTE = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/** A card already past its learning steps, so the review branch can be reached. */
function reviewing(overrides: Partial<EchoSrs> = {}): { srs: EchoSrs } {
  return {
    srs: {
      state: 'review',
      step: 0,
      due: NOW,
      interval: 10,
      ease: SRS_RULES.startingEase,
      reps: 3,
      lapses: 0,
      lastReviewedAt: new Date('2026-09-03T12:00:00Z'),
      ...overrides,
    },
  }
}

describe('newCardSrs', () => {
  it('is due immediately, so the first session can include it', () => {
    const srs = newCardSrs(NOW)
    expect(srs.due.getTime()).toBe(NOW.getTime())
    expect(srs).toMatchObject({ state: 'learning', step: 0, interval: 0, reps: 0, lapses: 0 })
    expect(srs.ease).toBe(SRS_RULES.startingEase)
    expect(srs.lastReviewedAt).toBeNull()
  })

  it('does not hand back the caller’s own Date', () => {
    const now = new Date(NOW.getTime())
    const srs = newCardSrs(now)
    now.setFullYear(2030)
    expect(srs.due.getFullYear()).toBe(2026)
  })
})

describe('the first review of a new card', () => {
  it('sends Again back to the first step', () => {
    const next = schedule({ srs: newCardSrs(NOW) }, 'again', NOW)
    expect(next.state).toBe('learning')
    expect(next.step).toBe(0)
    expect(next.due.getTime()).toBe(NOW.getTime() + 1 * MINUTE)
    expect(next.interval).toBe(0)
  })

  it('holds Hard on the step it is on', () => {
    const next = schedule({ srs: newCardSrs(NOW) }, 'hard', NOW)
    expect(next).toMatchObject({ state: 'learning', step: 0 })
    expect(next.due.getTime()).toBe(NOW.getTime() + 1 * MINUTE)
  })

  it('moves Good to the second step', () => {
    const next = schedule({ srs: newCardSrs(NOW) }, 'good', NOW)
    expect(next).toMatchObject({ state: 'learning', step: 1 })
    expect(next.due.getTime()).toBe(NOW.getTime() + 10 * MINUTE)
  })

  it('graduates Easy straight out of the steps', () => {
    const next = schedule({ srs: newCardSrs(NOW) }, 'easy', NOW)
    expect(next).toMatchObject({ state: 'review', step: 0, interval: SRS_RULES.easyIntervalDays })
    expect(next.due.getTime()).toBe(NOW.getTime() + SRS_RULES.easyIntervalDays * DAY)
  })

  it('leaves ease alone for every grade — a card this new has not been kept yet', () => {
    for (const grade of ECHO_GRADES) {
      expect(schedule({ srs: newCardSrs(NOW) }, grade, NOW).ease).toBe(SRS_RULES.startingEase)
    }
  })

  it('counts the review however it was graded', () => {
    for (const grade of ECHO_GRADES) {
      expect(schedule({ srs: newCardSrs(NOW) }, grade, NOW).reps).toBe(1)
    }
  })
})

describe('graduating', () => {
  it('takes two Goods, and lands a day out', () => {
    const first = schedule({ srs: newCardSrs(NOW) }, 'good', NOW)
    const second = schedule({ srs: first }, 'good', NOW)
    expect(second).toMatchObject({ state: 'review', interval: SRS_RULES.graduatingIntervalDays })
    expect(second.due.getTime()).toBe(NOW.getTime() + SRS_RULES.graduatingIntervalDays * DAY)
  })
})

describe('a card in review', () => {
  it('multiplies Good by the ease', () => {
    const next = schedule(reviewing({ interval: 10, ease: 2.5 }), 'good', NOW)
    expect(next.interval).toBe(25)
    expect(next.due.getTime()).toBe(NOW.getTime() + 25 * DAY)
    expect(next.ease).toBe(2.5)
  })

  it('lowers the ease on Hard and still moves the card forward', () => {
    const next = schedule(reviewing({ interval: 10, ease: 2.5 }), 'hard', NOW)
    expect(next.interval).toBe(12)
    expect(next.ease).toBeCloseTo(2.35, 10)
  })

  it('never lets Hard stand still — a one-day interval would round back to one', () => {
    const next = schedule(reviewing({ interval: 1 }), 'hard', NOW)
    expect(next.interval).toBe(2)
  })

  it('puts Easy beyond Good, and raises the ease', () => {
    const good = schedule(reviewing({ interval: 10, ease: 2.5 }), 'good', NOW)
    const easy = schedule(reviewing({ interval: 10, ease: 2.5 }), 'easy', NOW)
    expect(easy.interval).toBeGreaterThan(good.interval)
    expect(easy.ease).toBeCloseTo(2.65, 10)
  })

  it('orders the three passing grades', () => {
    const card = reviewing({ interval: 20 })
    const hard = schedule(card, 'hard', NOW).interval
    const good = schedule(card, 'good', NOW).interval
    const easy = schedule(card, 'easy', NOW).interval
    expect(hard).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it('caps an interval at a year', () => {
    const next = schedule(reviewing({ interval: 300, ease: 2.5 }), 'easy', NOW)
    expect(next.interval).toBe(SRS_RULES.maximumIntervalDays)
    expect(next.due.getTime()).toBe(NOW.getTime() + SRS_RULES.maximumIntervalDays * DAY)
  })
})

describe('a lapse', () => {
  it('resets the card to learning, throws the interval away and lowers the ease', () => {
    const next = schedule(reviewing({ interval: 30, ease: 2.5, lapses: 0 }), 'again', NOW)
    expect(next.state).toBe('learning')
    expect(next.step).toBe(0)
    expect(next.interval).toBe(0)
    expect(next.lapses).toBe(1)
    expect(next.ease).toBeCloseTo(2.3, 10)
    expect(next.due.getTime()).toBe(NOW.getTime() + 1 * MINUTE)
  })

  it('stops lowering the ease at the floor, however many times it is failed', () => {
    let card = reviewing({ interval: 30 })
    for (let failed = 0; failed < 10; failed += 1) {
      const next = schedule(card, 'again', NOW)
      expect(next.ease).toBeGreaterThanOrEqual(SRS_RULES.minimumEase)
      // Back to review, so the next Again is another lapse rather than a
      // learning-step repeat, which does not touch ease at all.
      card = { srs: { ...next, state: 'review', interval: 30 } }
    }
    expect(card.srs.ease).toBe(SRS_RULES.minimumEase)
  })
})

describe('determinism', () => {
  it('gives the same answer for the same card, grade and instant', () => {
    for (const grade of ECHO_GRADES) {
      expect(schedule({ srs: newCardSrs(NOW) }, grade, NOW)).toEqual(
        schedule({ srs: newCardSrs(NOW) }, grade, NOW),
      )
      expect(schedule(reviewing(), grade, NOW)).toEqual(schedule(reviewing(), grade, NOW))
    }
  })

  it('does not mutate the card it was given', () => {
    const card = reviewing({ interval: 10, ease: 2.5 })
    const before = { ...card.srs }
    schedule(card, 'again', NOW)
    expect(card.srs).toEqual(before)
  })
})

describe('scheduledDelayMinutes', () => {
  it('answers in minutes while the card is still learning', () => {
    expect(scheduledDelayMinutes({ srs: newCardSrs(NOW) }, 'good', NOW)).toBe(10)
    expect(scheduledDelayMinutes({ srs: newCardSrs(NOW) }, 'again', NOW)).toBe(1)
  })

  it('answers in minutes for a card measured in days, so one unit covers both', () => {
    expect(scheduledDelayMinutes(reviewing({ interval: 10, ease: 2.5 }), 'good', NOW)).toBe(
      25 * 24 * 60,
    )
  })
})
