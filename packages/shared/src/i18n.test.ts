import { describe, expect, it } from 'vitest'
import { translate, type Catalog } from './i18n'

describe('translate', () => {
  const catalog: Catalog = {
    among: 'Among them: {names}.',
    invited: 'You were invited by {name}. Say hi.',
    missing: 'Hello {name}.',
  }

  it('does not double the stop after a value that ends in one', () => {
    expect(translate(catalog, catalog, 'en', 'among', { names: 'Ada L.' })).toBe(
      'Among them: Ada L.',
    )
    expect(translate(catalog, catalog, 'en', 'invited', { name: 'Ada L.' })).toBe(
      'You were invited by Ada L. Say hi.',
    )
  })

  it('keeps the stop after a value that does not end in one', () => {
    expect(translate(catalog, catalog, 'en', 'among', { names: 'Ada and Cher' })).toBe(
      'Among them: Ada and Cher.',
    )
  })

  it('leaves a placeholder with no parameter, stop and all', () => {
    expect(translate(catalog, catalog, 'en', 'missing', {})).toBe('Hello {name}.')
  })
})
