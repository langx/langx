import { describe, expect, it } from 'vitest'
import { linkAddress, PRODUCT_TEXT_SCALE } from './productPage'
import { v3Type } from './theme/tokens'

describe('PRODUCT_TEXT_SCALE', () => {
  // The reader's text size from the smallest default to past iOS's largest
  // accessibility size (AX5 is about 3.57× Body).
  const scales = [1, 1.2, 1.5, 2, 2.5, 3, 3.571, 4]
  const size = (fontSize: number, cap: number, scale: number) => fontSize * Math.min(scale, cap)

  it('keeps the name over the headings, the headings over the rows, the rows over their lines', () => {
    for (const scale of scales) {
      const name = size(v3Type.title.fontSize, PRODUCT_TEXT_SCALE.name, scale)
      const heading = size(v3Type.headline.fontSize, PRODUCT_TEXT_SCALE.heading, scale)
      const rowTitle = size(v3Type.button.fontSize, PRODUCT_TEXT_SCALE.rowTitle, scale)
      const text = size(v3Type.callout.fontSize, PRODUCT_TEXT_SCALE.text, scale)
      expect(name, `name at ${scale}×`).toBeGreaterThanOrEqual(heading)
      expect(heading, `heading at ${scale}×`).toBeGreaterThanOrEqual(rowTitle)
      expect(rowTitle, `row title at ${scale}×`).toBeGreaterThanOrEqual(text)
    }
  })
})

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
