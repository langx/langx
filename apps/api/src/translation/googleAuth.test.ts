import { describe, expect, it } from 'vitest'
import { parseServiceAccountJson } from './googleAuth'

describe('parseServiceAccountJson', () => {
  it('accepts a minimal valid service account key', () => {
    const account = parseServiceAccountJson(
      JSON.stringify({ client_email: 'svc@project.iam.gserviceaccount.com', private_key: 'PEM' }),
    )
    expect(account).toEqual({
      client_email: 'svc@project.iam.gserviceaccount.com',
      private_key: 'PEM',
    })
  })

  it('rejects invalid JSON', () => {
    expect(() => parseServiceAccountJson('{not json')).toThrow(/not valid JSON/)
  })

  it('rejects JSON missing client_email or private_key', () => {
    expect(() => parseServiceAccountJson(JSON.stringify({ private_key: 'PEM' }))).toThrow(
      /client_email or private_key/,
    )
    expect(() =>
      parseServiceAccountJson(JSON.stringify({ client_email: 'svc@project.iam.gserviceaccount.com' })),
    ).toThrow(/client_email or private_key/)
  })
})
