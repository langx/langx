import { describe, expect, it } from 'vitest'
import {
  BOUNTY_TOKEN_TTL_MS,
  bountyAwardUrl,
  signBountyToken,
  verifyBountyToken,
} from './bountyToken'

const SECRET = 's'.repeat(40)
const NOW = new Date('2026-05-10T12:00:00Z')
const input = {
  userId: 'user-1',
  reportId: 'report-1',
  expiresAt: NOW.getTime() + BOUNTY_TOKEN_TTL_MS,
}

describe('the bug bounty link', () => {
  it('names the reporter and the report it pays for', () => {
    const token = signBountyToken(SECRET, input)
    expect(verifyBountyToken(SECRET, token, NOW)).toEqual({
      userId: 'user-1',
      reportId: 'report-1',
    })
  })

  it('is refused once it has expired', () => {
    const token = signBountyToken(SECRET, input)
    const later = new Date(input.expiresAt + 1)
    expect(verifyBountyToken(SECRET, token, later)).toBeNull()
  })

  it('is refused under another secret', () => {
    const token = signBountyToken(SECRET, input)
    expect(verifyBountyToken('t'.repeat(40), token, NOW)).toBeNull()
  })

  it('will not let the expiry, the reporter or the report be edited in the URL', () => {
    const token = signBountyToken(SECRET, input)
    const [version, userId, reportId, expiry, sig] = token.split('.')

    const later = [version, userId, reportId, String(Number(expiry) + 60_000), sig].join('.')
    expect(verifyBountyToken(SECRET, later, NOW)).toBeNull()

    const someoneElse = [version, 'user-2', reportId, expiry, sig].join('.')
    expect(verifyBountyToken(SECRET, someoneElse, NOW)).toBeNull()

    const anotherReport = [version, userId, 'report-2', expiry, sig].join('.')
    expect(verifyBountyToken(SECRET, anotherReport, NOW)).toBeNull()
  })

  it('refuses anything that is not a token', () => {
    for (const bad of [undefined, '', 'nope', 'v1.user-1.report-1.notanumber.sig']) {
      expect(verifyBountyToken(SECRET, bad, NOW)).toBeNull()
    }
  })

  it('points at the API, with the token escaped', () => {
    expect(bountyAwardUrl('https://api.langx.io/', 'a.b+c')).toBe(
      'https://api.langx.io/feedback/award?token=a.b%2Bc',
    )
  })
})
