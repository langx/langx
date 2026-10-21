import { describe, expect, it } from 'vitest'
import { copilotErrorKey, copilotRetryAt } from './copilotErrors'

/** The shape `ApiRequestError` has, which vitest cannot import. */
function refusal(status: number, code: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error('Request failed'), { status, code, ...extra })
}

describe('copilotErrorKey', () => {
  it.each(['off', 'age'])('hides Copilot when it is not for this person (%s)', (reason) => {
    expect(copilotErrorKey(refusal(503, 'COPILOT_UNAVAILABLE', { reason }))).toBe('off')
  })

  it.each([
    ['partner_age', 'copilot.errPartnerAge'],
    ['busy', 'copilot.errBusy'],
    ['no_answer', 'copilot.errNoAnswer'],
    // A reason this build has never heard of reads as no answer, which is
    // true of every reason there is.
    ['something_new', 'copilot.errNoAnswer'],
  ] as const)('words %s as %s', (reason, key) => {
    expect(copilotErrorKey(refusal(503, 'COPILOT_UNAVAILABLE', { reason }))).toBe(key)
  })

  it('brings the consent sheet back when the agreement is gone', () => {
    expect(copilotErrorKey(refusal(409, 'COPILOT_CONSENT_REQUIRED'))).toBe('consent')
  })

  it('says when the allowance comes back, when the server says', () => {
    const retryAt = '2026-10-21T08:00:00.000Z'
    const withTime = refusal(429, 'QUOTA_EXCEEDED', { limit: 'copilotPer24h', retryAt })
    expect(copilotErrorKey(withTime)).toBe('copilot.errQuota')
    expect(copilotRetryAt(withTime)).toBe(retryAt)
    const without = refusal(429, 'QUOTA_EXCEEDED', { limit: 'copilotPer24h' })
    expect(copilotErrorKey(without)).toBe('copilot.errQuotaNoTime')
    expect(copilotRetryAt(without)).toBeUndefined()
  })

  it('says the request never got there when no server answered', () => {
    expect(copilotErrorKey(new TypeError('Network request failed'))).toBe('copilot.errNetwork')
  })

  it.each([refusal(400, 'VALIDATION_FAILED'), refusal(500, 'INTERNAL'), refusal(502, 'UNKNOWN')])(
    'has one line for a refusal it has no words for',
    (error) => {
      expect(copilotErrorKey(error)).toBe('copilot.errNoAnswer')
    },
  )
})
