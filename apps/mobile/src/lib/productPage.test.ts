import { describe, expect, it } from 'vitest'
import { linkAddress, toneWash } from './productPage'

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

describe('toneWash', () => {
  it('appends the strength as two hex digits', () => {
    expect(toneWash('#ff9f52', 0.18)).toBe('#ff9f522e')
  })

  it('pads a faint wash to two digits, so the colour stays eight long', () => {
    expect(toneWash('#3b6cf6', 0.02)).toBe('#3b6cf605')
  })

  it('holds the strength between nothing and the full colour', () => {
    expect(toneWash('#5fdc98', -1)).toBe('#5fdc9800')
    expect(toneWash('#5fdc98', 2)).toBe('#5fdc98ff')
  })
})
