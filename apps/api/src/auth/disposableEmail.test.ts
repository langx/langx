import { describe, expect, it } from 'vitest'
import { isDisposableEmail } from './disposableEmail'

describe('isDisposableEmail', () => {
  it('refuses a listed domain, whatever its case', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true)
    expect(isDisposableEmail('Someone@MAILINATOR.com')).toBe(true)
  })

  it('refuses a subdomain of a listed domain', () => {
    expect(isDisposableEmail('someone@inbox.mailinator.com')).toBe(true)
    expect(isDisposableEmail('someone@a.b.mailinator.com.')).toBe(true)
  })

  it('allows an ordinary domain', () => {
    expect(isDisposableEmail('sofia@gmail.com')).toBe(false)
    expect(isDisposableEmail('sofia@example.com')).toBe(false)
  })

  it('does not refuse a parent of a listed subdomain', () => {
    // The list names `0-mailer.dynv6.net`, not `dynv6.net`.
    expect(isDisposableEmail('someone@0-mailer.dynv6.net')).toBe(true)
    expect(isDisposableEmail('someone@dynv6.net')).toBe(false)
  })

  it('leaves the boot warm-up and guest addresses alone', () => {
    expect(isDisposableEmail('bootstrap-warmup@internal.langx.invalid')).toBe(false)
    expect(isDisposableEmail('guest@guest.langx.invalid')).toBe(false)
  })

  it('answers false for something that is not an address', () => {
    expect(isDisposableEmail('mailinator.com')).toBe(false)
  })
})
