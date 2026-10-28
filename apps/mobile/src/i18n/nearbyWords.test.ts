import { SUPPORTED_LOCALES, type Catalog, type Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * What the Nearby sort is called.
 *
 * Turkish "Yakında" means "soon", and it was the Discover tab's name from
 * the first translation: a Turkish reader saw "For you · Active · Soon".
 * #2086 renamed the paywall's line to "Yakındakiler", the people nearby,
 * and left the tab and every sentence that names it behind — the paywall
 * then offered a feature the tab bar did not seem to have.
 *
 * The word itself cannot be banned: it still means "soon" on the paywall's
 * comparison column, Copilot's own account and Venus's videos. So the check
 * is on the strings that name the sort, and on the tab and the paywall
 * calling it the same thing in every language.
 */

function text(locale: Locale, path: string): string {
  const value = path
    .split('.')
    .reduce<Catalog | string>(
      (node, key) => (node as Catalog)[key] as Catalog | string,
      catalogs[locale],
    )
  if (typeof value !== 'string') throw new Error(`${locale} ${path} is not a string`)
  return value
}

/** Letter lookarounds rather than `\b`, which does not know "ı" is a letter. */
const SOON = /(?<!\p{L})yakında(?!\p{L})/iu

/** Every Turkish string that names the Nearby sort or its tab. */
const NAMES_NEARBY = [
  'discover.nearby',
  'paywall.nearby',
  'discover.locationOffBody',
  'discover.nobodySharingBody',
  'discover.nearbyNeedsPermissionTitle',
  'discover.nearbyServicesOffBody',
  'filters.distanceBody',
  'tour.discoverSortsBody',
  'howItWorks.discoverBody',
  'location.guide.askableBody',
]

describe('the Turkish Nearby sort', () => {
  it('recognises "soon" when it sees it', () => {
    expect(SOON.test('Yakında')).toBe(true)
    expect(SOON.test('Yakında’nın ne kadar uzağa bakacağını sınırlar.')).toBe(true)
    expect(SOON.test('Yakındakiler')).toBe(false)
  })

  it('is called "Yakındakiler" on the tab and on the paywall', () => {
    expect(text('tr', 'discover.nearby')).toBe('Yakındakiler')
    expect(text('tr', 'paywall.nearby')).toBe('Yakındakiler')
  })

  it.each(NAMES_NEARBY)('is never "Yakında" in %s', (path) => {
    expect(text('tr', path)).not.toMatch(SOON)
  })
})

describe.each(SUPPORTED_LOCALES)('Nearby in %s', (locale) => {
  it('has one name on the tab and on the paywall', () => {
    expect(text(locale, 'paywall.nearby')).toBe(text(locale, 'discover.nearby'))
  })
})
