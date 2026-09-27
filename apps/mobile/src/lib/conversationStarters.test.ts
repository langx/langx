import { CONVERSATION_STALE_DAYS, CONVERSATION_TOPICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'
import { STARTERS_SHOWN, pickStarters, startersDue } from './conversationStarters'

const NOW = Date.parse('2026-09-27T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()

describe('startersDue', () => {
  it('offers starters in a thread with no message', () => {
    expect(startersDue(undefined, NOW)).toBe(true)
  })

  it('stays quiet in a thread that is still going', () => {
    expect(startersDue(daysAgo(0), NOW)).toBe(false)
    expect(startersDue(daysAgo(CONVERSATION_STALE_DAYS - 0.01), NOW)).toBe(false)
  })

  it('offers them again once the last message is old enough', () => {
    expect(startersDue(daysAgo(CONVERSATION_STALE_DAYS), NOW)).toBe(true)
    expect(startersDue(daysAgo(40), NOW)).toBe(true)
  })

  it('takes the threshold from its argument', () => {
    expect(startersDue(daysAgo(2), NOW, 1)).toBe(true)
    expect(startersDue(daysAgo(2), NOW, 3)).toBe(false)
  })

  it('treats a date it cannot read as fresh', () => {
    expect(startersDue('not a date', NOW)).toBe(false)
  })
})

describe('pickStarters', () => {
  it('returns the same topics for the same seed and round', () => {
    expect(pickStarters('conv-1', 0)).toEqual(pickStarters('conv-1', 0))
    expect(pickStarters('conv-1', 4)).toEqual(pickStarters('conv-1', 4))
  })

  it('returns three distinct known topics', () => {
    const picked = pickStarters('conv-1', 0)
    expect(picked).toHaveLength(STARTERS_SHOWN)
    expect(new Set(picked).size).toBe(STARTERS_SHOWN)
    for (const topic of picked) expect(CONVERSATION_TOPICS).toContain(topic)
  })

  it('orders topics differently for different seeds', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e']
    const openings = new Set(seeds.map((seed) => pickStarters(seed, 0).join()))
    expect(openings.size).toBeGreaterThan(1)
  })

  it('never repeats a chip that is on screen when shuffled', () => {
    const first = pickStarters('conv-1', 0)
    const second = pickStarters('conv-1', 1)
    expect(second.filter((topic) => first.includes(topic))).toEqual([])
  })

  it('shows every topic before any comes back', () => {
    const rounds = Math.floor(CONVERSATION_TOPICS.length / STARTERS_SHOWN)
    const seen = Array.from({ length: rounds }, (_, round) => pickStarters('conv-1', round)).flat()
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('keeps going past the end of the list', () => {
    const picked = pickStarters('conv-1', 1000)
    expect(picked).toHaveLength(STARTERS_SHOWN)
    expect(new Set(picked).size).toBe(STARTERS_SHOWN)
  })
})

describe('topic wording', () => {
  it('has an English line for every topic, and no line without a topic', () => {
    expect(Object.keys(en.chat.topics).sort()).toEqual([...CONVERSATION_TOPICS].sort())
  })
})
