import { describe, expect, it } from 'vitest'
import { WEB_HOST } from './appIdentity'
import { verifyEmailUrl } from './emailLinks'

describe('verifyEmailUrl', () => {
  it('is a page on the web host, never the API endpoint that spends the token', () => {
    const url = verifyEmailUrl('abc')
    expect(url).toBe(`https://${WEB_HOST}/verify-email?token=abc`)
    expect(url).not.toContain('/api/')
  })

  it('escapes a token that is not plain characters', () => {
    expect(verifyEmailUrl('a b&c')).toBe(`https://${WEB_HOST}/verify-email?token=a%20b%26c`)
  })
})
