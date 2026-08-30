import { describe, expect, it } from 'vitest'
import { passwordIssueKey, passwordPairReady, PASSWORD_MAX_LENGTH } from './passwordForm'

describe('passwordIssueKey', () => {
  it('says nothing about a form nobody has filled in', () => {
    expect(passwordIssueKey('', '')).toBeUndefined()
  })

  it('names the length rule while it is still being broken', () => {
    expect(passwordIssueKey('abc', '')).toBe('auth.passwordTooShort')
    expect(passwordIssueKey('a'.repeat(PASSWORD_MAX_LENGTH + 1), '')).toBe('auth.passwordTooLong')
  })

  /**
   * Length first: a six-character minimum that is also mistyped should say
   * which of the two to fix, and the one the person can act on is the rule.
   */
  it('prefers the length rule over the mismatch', () => {
    expect(passwordIssueKey('abc', 'xyz')).toBe('auth.passwordTooShort')
  })

  it('reports a mismatch only once there is something to compare', () => {
    expect(passwordIssueKey('hunter2', '')).toBeUndefined()
    expect(passwordIssueKey('hunter2', 'hunter')).toBe('auth.passwordsDoNotMatch')
    expect(passwordIssueKey('hunter2', 'hunter2')).toBeUndefined()
  })
})

describe('passwordPairReady', () => {
  it('needs both a legal password and a matching confirmation', () => {
    expect(passwordPairReady('hunter2', 'hunter2')).toBe(true)
    expect(passwordPairReady('hunter2', 'hunter')).toBe(false)
    expect(passwordPairReady('abc', 'abc')).toBe(false)
    expect(passwordPairReady('', '')).toBe(false)
  })
})
