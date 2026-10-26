import { describe, expect, it } from 'vitest'
import { linkAddress } from './productPage'

describe('linkAddress', () => {
  it('drops the scheme and keeps the host', () => {
    expect(linkAddress('https://copilot.langx.io')).toBe('copilot.langx.io')
  })

  it('keeps a path, which carries the reader’s language', () => {
    expect(linkAddress('https://token.langx.io/tr/')).toBe('token.langx.io/tr')
  })

  it('keeps a query, since that is part of where the card goes', () => {
    expect(linkAddress('https://insight.langx.io/?range=30d')).toBe('insight.langx.io/?range=30d')
  })

  it('leaves an address with no scheme as it is', () => {
    expect(linkAddress('langx.io')).toBe('langx.io')
  })
})
