import { describe, expect, it } from 'vitest'
import { appLinkForToken, MAGIC_LINK_FAILED_PATH } from './magicLink'

describe('appLinkForToken', () => {
  it('opens the app rather than a browser', () => {
    expect(appLinkForToken('abc')).toBe('langx://magic-link?token=abc')
  })

  it('escapes a token that is not plain characters', () => {
    expect(appLinkForToken('a b&c')).toBe('langx://magic-link?token=a%20b%26c')
  })
})

describe('MAGIC_LINK_FAILED_PATH', () => {
  /** Relative on purpose: Better Auth's origin check accepts a path, and it resolves on the API. */
  it('is a path, not a URL', () => {
    expect(MAGIC_LINK_FAILED_PATH.startsWith('/')).toBe(true)
    expect(MAGIC_LINK_FAILED_PATH).not.toContain('://')
  })
})
