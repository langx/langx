import type { MonthlyRecapDto, YearlyRecapDto } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  daysInMonth,
  isQuietRecap,
  numeralSize,
  recapCalendar,
  recapCardInput,
  recapSlides,
  swipeIntent,
  tapDirection,
  yearCalendar,
} from './recapStory'

const SEPTEMBER: MonthlyRecapDto = {
  month: '2026-09',
  messages: 248,
  corrections: 37,
  echoReviews: 0,
  tokens: 612,
  currentStreak: 3,
  partners: 12,
  activeDays: 5,
  activeDates: [2, 3, 20, 29, 30],
}

const YEAR: YearlyRecapDto = {
  year: '2026',
  messages: 1900,
  corrections: 210,
  echoReviews: 400,
  tokens: 5200,
  currentStreak: 3,
  partners: 40,
  activeDays: 49,
  activeMonths: [31, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
}

describe('recapSlides', () => {
  it('gives a number a slide only when it is not zero', () => {
    expect(recapSlides(SEPTEMBER)).toEqual([
      'intro',
      'messages',
      'corrections',
      'streak',
      'summary',
    ])
  })

  it('keeps the streak slide for active days even with no streak left', () => {
    expect(recapSlides({ ...SEPTEMBER, currentStreak: 0 })).toContain('streak')
    expect(recapSlides({ ...SEPTEMBER, currentStreak: 0, activeDays: 0 })).not.toContain('streak')
  })

  it('calls a month with nothing sent or reviewed quiet', () => {
    expect(isQuietRecap(SEPTEMBER)).toBe(false)
    expect(isQuietRecap({ ...SEPTEMBER, messages: 0, corrections: 0 })).toBe(true)
  })
})

describe('recapCalendar', () => {
  it('has one square per day of the month', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(recapCalendar(SEPTEMBER)).toHaveLength(30)
  })

  it('marks as the streak only the run that reaches the month’s end', () => {
    const days = recapCalendar(SEPTEMBER)
    // 29 and 30 run to the end; 20 is ordinary activity, 2 and 3 too.
    expect(days[28]).toBe('streak')
    expect(days[29]).toBe('streak')
    expect(days[19]).toBe('active')
    expect(days[1]).toBe('active')
    expect(days[0]).toBe('idle')
  })

  it('draws no streak the reader no longer has, and none longer than theirs', () => {
    expect(recapCalendar({ ...SEPTEMBER, currentStreak: 0 })).not.toContain('streak')
    const capped = recapCalendar({ ...SEPTEMBER, currentStreak: 1 })
    expect(capped.filter((day) => day === 'streak')).toHaveLength(1)
    expect(capped[28]).toBe('active')
  })
})

describe('the story’s gestures', () => {
  it('goes back from the third the reading starts in, mirrored right to left', () => {
    expect(tapDirection(50, 390, false)).toBe('previous')
    expect(tapDirection(300, 390, false)).toBe('next')
    expect(tapDirection(350, 390, true)).toBe('previous')
    expect(tapDirection(50, 390, true)).toBe('next')
  })

  it('steps on a swipe across, closes on one down, and ignores a nudge', () => {
    expect(swipeIntent(-120, 10, -200, 0, false)).toBe('next')
    expect(swipeIntent(120, 10, 200, 0, false)).toBe('previous')
    expect(swipeIntent(120, 10, 200, 0, true)).toBe('next')
    expect(swipeIntent(-20, 5, -900, 0, false)).toBe('next')
    expect(swipeIntent(5, 200, 0, 100, false)).toBe('close')
    expect(swipeIntent(10, 4, 50, 0, false)).toBeNull()
    expect(swipeIntent(0, -200, 0, -900, false)).toBeNull()
  })

  it('shrinks a numeral that would not fit an iPhone SE', () => {
    expect(numeralSize('88', 334, 150)).toBe(150)
    expect(numeralSize('1,204', 319, 150)).toBeLessThan(150)
  })
})

describe('recapCardInput', () => {
  it('sends the words for every number and no number', () => {
    const input = recapCardInput(createTranslate('en'), SEPTEMBER, 'en', {
      native: 'Spanish',
      learning: 'Turkish',
    })
    expect(input.labels.messages).toBe('messages sent')
    expect(input.labels.currentStreak).toBe('day streak, still going')
    expect(input.people).toBe('in two languages, with 12 people')
    expect(input.languages).toBe('Spanish → learning Turkish')
    expect(JSON.stringify(input.labels)).not.toMatch(/\d/)
  })

  it('leaves out the people line for a month spoken to nobody', () => {
    const input = recapCardInput(createTranslate('ru'), { ...SEPTEMBER, partners: 0 }, 'ru')
    expect(input.people).toBeUndefined()
    expect(input.languages).toBeUndefined()
    // Russian takes the genitive plural after 248.
    expect(input.labels.messages).toBe('сообщений')
  })
})

describe('Your Year', () => {
  it('plays the month’s slides, from the year’s numbers', () => {
    expect(recapSlides(YEAR)).toEqual([
      'intro',
      'messages',
      'corrections',
      'echo',
      'streak',
      'summary',
    ])
    expect(isQuietRecap({ ...YEAR, messages: 0, corrections: 0, echoReviews: 0 })).toBe(true)
  })

  it('shades a square per month by how much of it was active', () => {
    const shares = yearCalendar(YEAR)
    expect(shares).toHaveLength(12)
    expect(shares[0]).toBe(1)
    // February 2026 has 28 days.
    expect(shares[1]).toBe(0.5)
    expect(shares[2]).toBe(0)
    expect(shares[11]).toBeCloseTo(4 / 31)
  })

  it('asks the server for the year’s card, under the year’s kicker', () => {
    const input = recapCardInput(createTranslate('tr'), YEAR, 'tr')
    expect(input.month).toBe('2026')
    expect(input.kicker).toBe('Yılım')
  })
})
