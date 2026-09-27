import { isReactionEmoji } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  emojiGroups,
  MAX_RECENT_REACTIONS,
  readRecentReactions,
  searchEmoji,
  withRecentReaction,
} from './emojiPicker'

describe('emojiGroups', () => {
  /**
   * The picker and the server must agree: an emoji on the grid that the schema
   * refuses is a tap that silently does nothing.
   */
  it('offers only emoji the server accepts as a reaction', () => {
    const refused = emojiGroups()
      .flatMap((group) => group.emoji)
      .filter((entry) => !isReactionEmoji(entry.emoji))
      .map((entry) => entry.emoji)
    expect(refused).toEqual([])
  })

  it('has every group, each with emoji and names', () => {
    const groups = emojiGroups()
    expect(groups.map((group) => group.id)).toEqual([
      'smileys',
      'people',
      'nature',
      'food',
      'travel',
      'activities',
      'objects',
      'symbols',
      'flags',
    ])
    for (const group of groups) {
      expect(group.emoji.length).toBeGreaterThan(0)
      for (const entry of group.emoji) expect(entry.name.length).toBeGreaterThan(0)
    }
  })

  it('carries the strip, so the picker is a superset of it', () => {
    const all = new Set(emojiGroups().flatMap((group) => group.emoji.map((entry) => entry.emoji)))
    for (const emoji of ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏']) {
      expect(all.has(emoji)).toBe(true)
    }
  })
})

describe('searchEmoji', () => {
  it('matches the start of any word in the name', () => {
    const hearts = searchEmoji('hea').map((entry) => entry.emoji)
    expect(hearts).toContain('❤️')
    expect(searchEmoji('red heart').map((entry) => entry.emoji)).toContain('❤️')
    expect(searchEmoji('  UNICORN ').map((entry) => entry.emoji)).toEqual(['🦄'])
  })

  it('finds nothing for an empty query or a word no name has', () => {
    expect(searchEmoji('')).toEqual([])
    expect(searchEmoji('   ')).toEqual([])
    expect(searchEmoji('qqqzzz')).toEqual([])
  })
})

describe('recent reactions', () => {
  it('puts the latest first, once, and keeps no more than the cap', () => {
    expect(withRecentReaction(['🔥', '🦄'], '🦄')).toEqual(['🦄', '🔥'])
    const full = searchEmoji('face')
      .slice(0, MAX_RECENT_REACTIONS)
      .map((entry) => entry.emoji)
    const next = withRecentReaction(full, '🦄')
    expect(next).toHaveLength(MAX_RECENT_REACTIONS)
    expect(next[0]).toBe('🦄')
  })

  it('reads anything storage hands back as a list of reactions', () => {
    expect(readRecentReactions(null)).toEqual([])
    expect(readRecentReactions({ emoji: '🔥' })).toEqual([])
    expect(readRecentReactions(['🔥', 7, 'text', 'a.b', '🦄'])).toEqual(['🔥', '🦄'])
    expect(withRecentReaction('garbage', '🔥')).toEqual(['🔥'])
  })
})
