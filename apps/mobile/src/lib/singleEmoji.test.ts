import { describe, expect, it } from 'vitest'
import { bigEmojiCount, isBigEmoji, MAX_BIG_EMOJI } from './singleEmoji'

describe('bigEmojiCount', () => {
  it('counts plain emoji', () => {
    expect(bigEmojiCount('😀')).toBe(1)
    expect(bigEmojiCount('😀😀')).toBe(2)
    expect(bigEmojiCount('😀 😀 😀')).toBe(3)
  })

  /** One emoji, four code points. Counting code points would call this four. */
  it('treats a ZWJ sequence as one', () => {
    expect(bigEmojiCount('👨‍👩‍👧‍👦')).toBe(1)
    expect(bigEmojiCount('👨‍👩‍👧‍👦👨‍👩‍👧‍👦')).toBe(2)
  })

  it('treats a skin-tone modifier and a variation selector as part of the emoji', () => {
    expect(bigEmojiCount('👍🏽')).toBe(1)
    expect(bigEmojiCount('❤️')).toBe(1)
    expect(bigEmojiCount('👍🏽❤️')).toBe(2)
  })

  it('treats a flag as one, and a lone regional indicator as not an emoji', () => {
    expect(bigEmojiCount('🇹🇷')).toBe(1)
    expect(bigEmojiCount('🇹🇷🇷🇺')).toBe(2)
    expect(bigEmojiCount('\u{1F1F9}')).toBe(0)
  })

  /**
   * The trap `\p{Emoji}` walks into: the digits carry the property, so "7"
   * would have rendered as a 64px hero.
   */
  it('does not treat bare digits, # or * as emoji', () => {
    expect(bigEmojiCount('7')).toBe(0)
    expect(bigEmojiCount('2026')).toBe(0)
    expect(bigEmojiCount('#')).toBe(0)
    expect(bigEmojiCount('*')).toBe(0)
    expect(bigEmojiCount('7️⃣')).toBe(1)
  })

  it('is zero for anything with words in it', () => {
    expect(bigEmojiCount('')).toBe(0)
    expect(bigEmojiCount('   ')).toBe(0)
    expect(bigEmojiCount('ok 😀')).toBe(0)
    expect(bigEmojiCount('😀 nice')).toBe(0)
    expect(bigEmojiCount('merhaba')).toBe(0)
    // Punctuation is words too — "!" is not a hero.
    expect(bigEmojiCount('😀!')).toBe(0)
  })
})

describe('isBigEmoji', () => {
  it('is true up to the cap and false past it', () => {
    expect(isBigEmoji('😀')).toBe(true)
    expect(isBigEmoji('😀'.repeat(MAX_BIG_EMOJI))).toBe(true)
    // Past the cap it is a sentence in emoji, which reads better at body size.
    expect(isBigEmoji('😀'.repeat(MAX_BIG_EMOJI + 1))).toBe(false)
    expect(isBigEmoji('hello')).toBe(false)
  })
})
