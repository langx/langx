import { describe, expect, it } from 'vitest'
import { authErrorKey, errorCodeOf, oauthReturnErrorKey, signInFailureKey } from './errors'

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

describe('oauthReturnErrorKey', () => {
  /**
   * The whole point of reading the code at all. A redirect sign-in cannot
   * tell the caller anything, so cancelling at Google and failing at Google
   * arrive at this screen looking identical — as a query parameter — and only
   * one of them is worth a message.
   */
  it('says nothing when the person cancelled at the provider', () => {
    expect(oauthReturnErrorKey('access_denied')).toBeUndefined()
    expect(oauthReturnErrorKey('user_cancelled_authorize')).toBeUndefined()
  })

  it('says nothing when the redirect carried no error at all', () => {
    expect(oauthReturnErrorKey(undefined)).toBeUndefined()
  })

  it('reports everything else as a failed sign-in', () => {
    expect(oauthReturnErrorKey('oauth_provider_not_found')).toBe('errors.signInFailed')
    expect(oauthReturnErrorKey('email_not_found')).toBe('errors.signInFailed')
    expect(oauthReturnErrorKey('state_not_found')).toBe('errors.signInFailed')
  })

  it('says why when the API refused the new account', () => {
    expect(oauthReturnErrorKey('SIGN_UP_LIMIT_REACHED')).toBe('errors.signUpLimitReached')
    expect(oauthReturnErrorKey('DISPOSABLE_EMAIL')).toBe('errors.disposableEmail')
  })
})

describe('authErrorKey', () => {
  it('names both sign-up refusals', () => {
    expect(authErrorKey({ code: 'SIGN_UP_LIMIT_REACHED' })).toBe('errors.signUpLimitReached')
    expect(authErrorKey({ code: 'DISPOSABLE_EMAIL' })).toBe('errors.disposableEmail')
  })
})

describe('signInFailureKey', () => {
  it('names a known code', () => {
    expect(signInFailureKey({ code: 'INVALID_EMAIL_OR_PASSWORD' }, true)).toBe(
      'errors.invalidCredentials',
    )
  })

  it('falls back to the generic failure, or to offline, for an unknown code', () => {
    expect(signInFailureKey({ code: 'SOMETHING_NEW' }, true)).toBe('errors.signInFailed')
    expect(signInFailureKey({ code: 'SOMETHING_NEW' }, false)).toBe('common.offline')
  })

  // The call that threw has no error object at all, and must still say something.
  it('says something for a call that threw', () => {
    expect(signInFailureKey(undefined, true)).toBe('errors.signInFailed')
    expect(signInFailureKey(undefined, false)).toBe('common.offline')
  })
})
