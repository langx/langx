import { describe, expect, it } from 'vitest'
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from './unsubscribeToken'

const SECRET = 'a-secret-at-least-thirty-two-characters'

describe('unsubscribe tokens', () => {
  it('round-trips a scope', () => {
    const token = signUnsubscribeToken(SECRET, 'user-1', 'messages')
    expect(verifyUnsubscribeToken(SECRET, token)).toEqual({ userId: 'user-1', scope: 'messages' })
  })

  it('round-trips the everything scope', () => {
    const token = signUnsubscribeToken(SECRET, 'user-1', 'all')
    expect(verifyUnsubscribeToken(SECRET, token)?.scope).toBe('all')
  })

  it('refuses a tampered signature', () => {
    const token = signUnsubscribeToken(SECRET, 'user-1', 'messages')
    expect(verifyUnsubscribeToken(SECRET, `${token}x`)).toBeNull()
  })

  /**
   * The part that matters: the user id is in the clear, so without this a
   * link to one inbox would unsubscribe anybody whose id you could guess.
   */
  it('refuses a token signed for somebody else', () => {
    const token = signUnsubscribeToken(SECRET, 'user-1', 'messages')
    const forged = token.replace('user-1', 'user-2')
    expect(verifyUnsubscribeToken(SECRET, forged)).toBeNull()
  })

  it('refuses a scope swapped after signing', () => {
    const token = signUnsubscribeToken(SECRET, 'user-1', 'messages')
    expect(verifyUnsubscribeToken(SECRET, token.replace('messages', 'promotions'))).toBeNull()
  })

  it('refuses a token from another secret', () => {
    const token = signUnsubscribeToken('another-secret-of-adequate-length', 'user-1', 'streak')
    expect(verifyUnsubscribeToken(SECRET, token)).toBeNull()
  })

  it('refuses a scope that is not a kind', () => {
    expect(verifyUnsubscribeToken(SECRET, 'v1.user-1.everything.abc')).toBeNull()
  })

  /** `timingSafeEqual` throws on a length mismatch; a short token must not 500. */
  it('survives rubbish without throwing', () => {
    for (const junk of ['', 'x', 'v1.user-1', 'v1.user-1.messages.', 'a.b.c.d.e']) {
      expect(verifyUnsubscribeToken(SECRET, junk)).toBeNull()
    }
    expect(verifyUnsubscribeToken(SECRET, undefined)).toBeNull()
  })

  it('builds a url that survives a token in a query string', () => {
    const token = signUnsubscribeToken(SECRET, 'user/1', 'messages')
    const url = unsubscribeUrl('https://api.langx.io/', token)
    expect(url.startsWith('https://api.langx.io/email/unsubscribe?token=')).toBe(true)
    const parsed = new URL(url)
    expect(verifyUnsubscribeToken(SECRET, parsed.searchParams.get('token') ?? undefined)).toEqual({
      userId: 'user/1',
      scope: 'messages',
    })
  })
})
