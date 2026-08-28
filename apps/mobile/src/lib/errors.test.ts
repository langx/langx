import { describe, expect, it } from 'vitest'
import { errorCodeOf } from './errors'

/**
 * `ApiRequestError` is deliberately not imported: `api/client` reaches
 * `react-native` through `apiFetch`, which this test setup cannot parse.
 * `errorCodeOf` is structural precisely because the two error shapes it has
 * to cover share nothing but the field, so a stand-in with the same shape
 * tests the same thing.
 */
class RestErrorLike extends Error {
  readonly code: string
  readonly status: number
  constructor(status: number, code: string) {
    super('Request failed')
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

describe('errorCodeOf', () => {
  it('reads the code off a REST failure', () => {
    expect(errorCodeOf(new RestErrorLike(402, 'QUOTA_EXCEEDED'))).toBe('QUOTA_EXCEEDED')
  })

  /**
   * `emitWithAck` rejects with a plain Error carrying `.code`, which is why
   * `instanceof ApiRequestError` never matched on the socket path.
   */
  it('reads the code off a socket ack failure', () => {
    expect(errorCodeOf(Object.assign(new Error('nope'), { code: 'RATE_LIMITED' }))).toBe(
      'RATE_LIMITED',
    )
  })

  it('is undefined for an error carrying no code', () => {
    expect(errorCodeOf(new Error('boom'))).toBeUndefined()
  })

  it('is undefined for things that are not errors at all', () => {
    expect(errorCodeOf(null)).toBeUndefined()
    expect(errorCodeOf('QUOTA_EXCEEDED')).toBeUndefined()
    expect(errorCodeOf({ code: 42 })).toBeUndefined()
  })
})
