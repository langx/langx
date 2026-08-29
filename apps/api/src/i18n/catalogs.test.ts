import { SUPPORTED_LOCALES, type Catalog, type Message } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import { en } from './messages/en'
import { localeFromHeader, translator } from './index'

function isPlural(value: Message | Catalog): boolean {
  return typeof value === 'object' && typeof (value as { other?: unknown }).other === 'string'
}

/** Placeholders used by a key, unioned across a plural's forms. */
function placeholdersByKey(catalog: Catalog, prefix = ''): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const add = (key: string, text: string) => {
    const set = out.get(key) ?? new Set<string>()
    for (const match of text.matchAll(/\{(\w+)\}/g)) set.add(match[1]!)
    out.set(key, set)
  }
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') add(path, value)
    else if (isPlural(value)) {
      for (const form of Object.values(value)) if (typeof form === 'string') add(path, form)
    } else {
      for (const [inner, set] of placeholdersByKey(value as Catalog, path)) out.set(inner, set)
    }
  }
  return out
}

const english = placeholdersByKey(en)

describe.each(SUPPORTED_LOCALES.filter((l) => l !== 'en'))('%s', (locale) => {
  const translated = placeholdersByKey(catalogs[locale])

  it('has exactly English’s keys', () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort())
  })

  it('keeps every placeholder — a dropped {url} is an email nobody can act on', () => {
    const wrong: string[] = []
    for (const [key, expected] of english) {
      const actual = translated.get(key) ?? new Set<string>()
      const missing = [...expected].filter((name) => !actual.has(name))
      const extra = [...actual].filter((name) => !expected.has(name))
      if (missing.length || extra.length) {
        wrong.push(`${key}: missing ${missing.join(',') || '—'}, extra ${extra.join(',') || '—'}`)
      }
    }
    expect(wrong).toEqual([])
  })
})

describe('localeFromHeader', () => {
  it('reads a browser-shaped Accept-Language', () => {
    expect(localeFromHeader('tr-TR,tr;q=0.9,en-US;q=0.8')).toBe('tr')
    expect(localeFromHeader('pt-PT,pt;q=0.9')).toBe('pt-BR')
  })

  it('falls back to English for an absent or unknown header', () => {
    expect(localeFromHeader(undefined)).toBe('en')
    expect(localeFromHeader('')).toBe('en')
    expect(localeFromHeader('ja,ko;q=0.9')).toBe('en')
  })
})

describe('translator', () => {
  it('pluralises a streak the way each language does', () => {
    // Russian: 1 is `one`, 3 is `few`, 11 is `many` — three different words
    // for a number a `!== 1` check would have got wrong twice.
    const ru = translator('ru')
    expect(ru('push.streakTitle', { count: 1 })).toContain('дня')
    expect(ru('push.streakTitle', { count: 3 })).toContain('дней')
    expect(ru('push.streakTitle', { count: 11 })).toContain('дней')
  })

  it('words an email in the reader’s language', () => {
    expect(translator('tr')('email.verifySubject')).toBe('LangX e-posta adresini doğrula')
    expect(translator('en')('email.verifySubject')).toBe('Verify your LangX email')
  })
})
