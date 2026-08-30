import { describe, expect, it } from 'vitest'
import { allExternalLinks, KITCHEN_SECTIONS, LEGAL_LINKS } from './externalLinks'

describe('external links', () => {
  it('are all https, because an app that opens http teaches people to accept it', () => {
    for (const link of allExternalLinks()) {
      expect(link.url.startsWith('https://'), link.url).toBe(true)
    }
  })

  it('carry exactly one of a brand name and a translatable key', () => {
    for (const link of allExternalLinks()) {
      expect(Boolean(link.label) !== Boolean(link.labelKey), link.url).toBe(true)
    }
  })

  /**
   * Not a style rule: a row nobody can tell apart from the one above it is a
   * row nobody taps, and the sections are long enough that a duplicate would
   * be invisible in review.
   */
  it('do not repeat a destination inside one section', () => {
    for (const section of KITCHEN_SECTIONS) {
      const urls = section.rows.map((row) => row.url)
      expect(new Set(urls).size, section.titleKey).toBe(urls.length)
    }
  })

  it('offers the five the stores ask to be reachable in-app', () => {
    const urls = LEGAL_LINKS.map((link) => link.url)
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://langx.io/privacy-policy',
        'https://langx.io/terms-conditions',
        'https://langx.io/cookie-policy',
        'https://langx.io/data-deletion',
        'https://github.com/langx/langx/blob/main/SECURITY.md',
      ]),
    )
  })
})
