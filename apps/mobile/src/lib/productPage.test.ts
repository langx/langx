import { describe, expect, it } from 'vitest'
import { linkAddress, PRODUCT_TEXT_SCALE, wordFitScale } from './productPage'
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

describe('wordFitScale', () => {
  it('grows to the cap when the widest word has room to spare', () => {
    expect(wordFitScale(343, 169, PRODUCT_TEXT_SCALE.name)).toBe(PRODUCT_TEXT_SCALE.name)
  })

  it('stops short of where the widest word fills the line', () => {
    // German's "weiterkommen", 232pt at the default size, on a 375pt phone's 343pt column.
    const scale = wordFitScale(343, 232, PRODUCT_TEXT_SCALE.name)
    expect(scale).toBeLessThan(PRODUCT_TEXT_SCALE.name)
    expect(232 * scale).toBeLessThan(343)
    expect(232 * scale).toBeGreaterThan(343 * 0.97)
  })

  it('never shrinks below the default size, even for a word wider than the line', () => {
    expect(wordFitScale(343, 382, PRODUCT_TEXT_SCALE.name)).toBe(1)
  })

  it('guesses the cap until both widths are measured', () => {
    expect(wordFitScale(0, 232, PRODUCT_TEXT_SCALE.name)).toBe(PRODUCT_TEXT_SCALE.name)
    expect(wordFitScale(343, 0, PRODUCT_TEXT_SCALE.name)).toBe(PRODUCT_TEXT_SCALE.name)
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
