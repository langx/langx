import { describe, expect, it } from 'vitest'
import { playableIds, shouldPlay } from './videoVisibility'

describe('playableIds', () => {
  it('plays what is on screen', () => {
    expect([...playableIds({ viewable: ['a', 'b'], focused: true })]).toEqual(['a', 'b'])
  })

  it('plays nothing once the tab is left', () => {
    expect(playableIds({ viewable: ['a', 'b'], focused: false }).size).toBe(0)
  })

  it('plays nothing when nothing is on screen', () => {
    expect(playableIds({ viewable: [], focused: true }).size).toBe(0)
  })
})

describe('shouldPlay', () => {
  it('is true only for a post in the set', () => {
    const playing = playableIds({ viewable: ['a'], focused: true })
    expect(shouldPlay('a', playing)).toBe(true)
    expect(shouldPlay('b', playing)).toBe(false)
  })

  it('is false for a bubble with no post behind it — chat, and the viewer', () => {
    expect(shouldPlay(undefined, new Set(['a']))).toBe(false)
  })
})
