import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN_LENGTH, passwordSchema, passwordTooShort } from './password'

describe('passwordSchema', () => {
  it('accepts the shortest allowed and refuses one character less', () => {
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false)
  })

  /**
   * The rule is a floor, not a range. A ceiling is the one number that can
   * reject what a password manager just generated.
   */
  it('has no upper bound of its own', () => {
    expect(passwordSchema.safeParse('correct horse battery staple').success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(200)).success).toBe(true)
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

describe('passwordTooShort', () => {
  it('agrees with the schema at the boundary', () => {
    for (const length of [0, PASSWORD_MIN_LENGTH - 1, PASSWORD_MIN_LENGTH, 64]) {
      const password = 'a'.repeat(length)
      expect(!passwordTooShort(password)).toBe(passwordSchema.safeParse(password).success)
    }
  })
})
