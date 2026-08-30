import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
  passwordSchema,
} from './password'

describe('passwordSchema', () => {
  it('accepts the shortest and longest allowed', () => {
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true)
  })

  it('refuses one character either side of them', () => {
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false)
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false)
  })

  /**
   * A trimming schema would accept `"  hunter  "`, store `"hunter"`, and then
   * fail every sign-in from a client that does not trim. Spaces count.
   */
  it('counts spaces rather than trimming them away', () => {
    expect(passwordSchema.safeParse('  abc ').success).toBe(true)
    expect(passwordSchema.safeParse(' ab ').success).toBe(false)
  })

  it('asks nothing about which characters are used', () => {
    expect(passwordSchema.safeParse('şşşşşş').success).toBe(true)
    expect(passwordSchema.safeParse('123456').success).toBe(true)
  })
})

describe('passwordProblem', () => {
  it('names the rule a form should point at', () => {
    expect(passwordProblem('short')).toBe('tooShort')
    expect(passwordProblem('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('tooLong')
    expect(passwordProblem('hunter2')).toBeNull()
  })

  it('agrees with the schema at every boundary', () => {
    for (const length of [
      0,
      PASSWORD_MIN_LENGTH - 1,
      PASSWORD_MIN_LENGTH,
      PASSWORD_MAX_LENGTH,
      PASSWORD_MAX_LENGTH + 1,
    ]) {
      const password = 'a'.repeat(length)
      expect(passwordProblem(password) === null).toBe(passwordSchema.safeParse(password).success)
    }
  })
})
