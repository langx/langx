import { describe, expect, it } from 'vitest'
import { HANDLE_MIN_LENGTH, handleSchema, newHandleSchema } from './handle'
import { RESERVED_HANDLES, couldBeHandle, isReservedHandle } from './reservedHandles'

describe('the two handle schemas', () => {
  /**
   * The distinction the whole change rests on. v1 handles came across under a
   * three-character rule, so tightening the *reading* schema would make an
   * existing account's own profile answer 400 on every lookup — including the
   * link they have already shared.
   */
  it('still resolves a three-character handle that already exists', () => {
    expect(handleSchema.safeParse('ada').success).toBe(true)
    expect(newHandleSchema.safeParse('ada').success).toBe(false)
  })

  it('claims at the new floor and above', () => {
    expect(newHandleSchema.safeParse('a'.repeat(HANDLE_MIN_LENGTH - 1)).success).toBe(false)
    expect(newHandleSchema.safeParse('a'.repeat(HANDLE_MIN_LENGTH)).success).toBe(true)
    expect(newHandleSchema.safeParse('adam').success).toBe(true)
    expect(newHandleSchema.safeParse('behic_sakar').success).toBe(true)
  })

  it('keeps the shared rules — case, charset, first character, length ceiling', () => {
    expect(newHandleSchema.parse('Behic_01')).toBe('behic_01')
    expect(newHandleSchema.safeParse('1abcd').success).toBe(false)
    expect(newHandleSchema.safeParse('be-hic').success).toBe(false)
    expect(newHandleSchema.safeParse('a'.repeat(21)).success).toBe(false)
  })

  it('refuses a reserved word at claim time but still resolves one', () => {
    // Resolvable on purpose: if a route name were ever held by a real account
    // from before this rule, their profile must not 400.
    expect(handleSchema.safeParse('settings').success).toBe(true)
    expect(newHandleSchema.safeParse('settings').success).toBe(false)
    expect(newHandleSchema.safeParse('SETTINGS').success).toBe(false)
  })
})

describe('RESERVED_HANDLES', () => {
  it('holds the words that would let somebody sit on a route', () => {
    for (const word of ['api', 'app', 'www', 'admin', 'login', 'settings', 'discover', 'me']) {
      expect(isReservedHandle(word), word).toBe(true)
    }
  })

  it('does not reserve an ordinary name', () => {
    for (const word of ['behic', 'ada_lovelace', 'polyglot99']) {
      expect(isReservedHandle(word), word).toBe(false)
    }
  })

  /**
   * Charset, not length. `me` is two characters and no handle can be that
   * short today, so reserving it protects nothing right now — but it costs
   * nothing either, and it is exactly what would be forgotten if the floor
   * ever moved. What *would* be pointless is an entry no handle could ever
   * contain, like `edit-profile`: that makes the set look more protective
   * than it is.
   */
  it('contains only strings a handle could be made of', () => {
    for (const word of RESERVED_HANDLES) {
      expect(word, word).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it('reserves the route names long enough to be claimed today', () => {
    for (const word of ['settings', 'discover', 'leaderboard']) {
      expect(couldBeHandle(word), word).toBe(true)
      expect(isReservedHandle(word), word).toBe(true)
    }
  })

  it('is matched case- and whitespace-insensitively, like a claim would be', () => {
    expect(isReservedHandle('  Admin ')).toBe(true)
  })
})
