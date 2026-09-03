import { describe, expect, it } from 'vitest'
import { deviceLinkQrUrl, postUrl, profileUrl, WEB_HOST } from './appIdentity'
import { deviceLinkTarget } from './appScheme'
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

describe('deviceLinkTarget', () => {
  it('opens the app rather than a browser', () => {
    // The scan happens on the phone that already holds the session. An https
    // link took it to a browser where nobody is signed in, which is the one
    // place the approval cannot be given.
    expect(deviceLinkTarget('ABCD2345')).toBe('langx://link-device?user_code=ABCD2345')
  })

  it('carries the parameter name the screen already reads', () => {
    expect(deviceLinkTarget('X').includes('user_code=')).toBe(true)
  })

  it('escapes a code that is not plain characters', () => {
    expect(deviceLinkTarget('A B&C')).toBe('langx://link-device?user_code=A%20B%26C')
  })
})

describe('deviceLinkQrUrl', () => {
  it('asks the API for the picture, by code and nothing else', () => {
    expect(deviceLinkQrUrl('https://api.langx.io/', 'ABCD2345')).toBe(
      'https://api.langx.io/public/qr/link/ABCD2345',
    )
  })
})
