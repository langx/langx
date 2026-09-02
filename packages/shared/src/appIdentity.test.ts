import { describe, expect, it } from 'vitest'
import { postUrl, profileUrl, WEB_HOST } from './appIdentity'
import { RESERVED_HANDLES } from './reservedHandles'

describe('postUrl', () => {
  it('points at the web host, under /post', () => {
    expect(postUrl('64f1c0ffee')).toBe(`https://${WEB_HOST}/post/64f1c0ffee`)
  })

  it('shares its origin with profile links, so one constant moves both', () => {
    const origin = profileUrl('a').replace(/\/a$/, '')
    expect(postUrl('a').startsWith(`${origin}/post/`)).toBe(true)
  })

  /**
   * A handle called `post` would sit exactly where post links resolve. The
   * static route wins, so the link would still open — but the person who
   * claimed the handle would have a profile address that never reaches them.
   */
  it('cannot be shadowed by a handle', () => {
    expect(RESERVED_HANDLES.has('post')).toBe(true)
  })

  it('escapes an id that is not a plain ObjectId', () => {
    expect(postUrl('a b/c')).toBe(`https://${WEB_HOST}/post/a%20b%2Fc`)
  })
})
