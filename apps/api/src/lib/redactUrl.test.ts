import { describe, expect, it } from 'vitest'
import { REDACTED, redactUrl } from './redactUrl'

describe('redactUrl', () => {
  it('leaves a URL without a query string alone', () => {
    expect(redactUrl('/health')).toBe('/health')
  })

  it('leaves a query string with nothing secret in it alone', () => {
    // Byte for byte: re-encoding every URL would change what the logs look
    // like on every request, for no gain.
    expect(redactUrl('/discovery?tab=foryou&limit=20')).toBe('/discovery?tab=foryou&limit=20')
  })

  it('redacts the token that ends an account', () => {
    expect(redactUrl('/account/delete/confirm?token=abc123')).toBe(
      `/account/delete/confirm?token=${REDACTED}`,
    )
  })

  it('redacts an unsubscribe token', () => {
    expect(redactUrl('/email/unsubscribe?token=signed.claim.here')).toBe(
      `/email/unsubscribe?token=${REDACTED}`,
    )
  })

  it('redacts both spellings Meta sends of the verify token', () => {
    // The real handshake carries the value twice, dotted and underscored.
    const url =
      '/webhooks/instagram?hub.mode=subscribe&hub.challenge=594685316' +
      '&hub.verify_token=s3cret&hub_mode=subscribe&hub_challenge=594685316&hub_verify_token=s3cret'
    const redacted = redactUrl(url)
    expect(redacted).not.toContain('s3cret')
    // The challenge has to survive: it is what the handshake is about, and a
    // log with it missing cannot be used to debug a refused subscription.
    expect(redacted).toContain('hub.challenge=594685316')
  })

  it('keeps the rest of the query string', () => {
    expect(redactUrl('/email/unsubscribe?token=abc&locale=tr')).toBe(
      `/email/unsubscribe?token=${REDACTED}&locale=tr`,
    )
  })
})
