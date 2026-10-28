import { translate, type Catalog, type Locale, type Plural } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import { translator } from './index'

/**
 * Every Russian plural the server sends has every form a whole number can
 * pick.
 *
 * A missing form falls back to `other`, and Russian keeps `other` for
 * fractions: the nightly pool push and the digest had only `one` and `other`,
 * so 25 read with the noun 2–4 take. And `one` is 21, 31 and 101 as much as 1,
 * so a `one` that wrote "1" where the count belongs told someone the pool paid
 * 21 tokens that it paid them 1. The app's catalogue is held to the same in
 * apps/mobile/src/i18n/plurals.test.ts.
 *
 * Russian only, for now: some Arabic plurals still lean on the fallback. A
 * locale joins `HELD` once its catalogue passes.
 */
const HELD: Locale[] = ['ru']

const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

function plurals(node: Catalog, prefix = ''): [string, Plural][] {
  return Object.entries(node).flatMap(([key, value]): [string, Plural][] => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') return []
    if (Object.keys(value).every((category) => CATEGORIES.has(category)))
      return [[path, value as Plural]]
    return plurals(value as Catalog, path)
  })
}

/**
 * The forms `locale` picks for 0–1000, read off the real rule through
 * `translate` rather than restated here. The range stays below the exact
 * millions Spanish, French and Portuguese call `many`, which fall back to
 * `other` by design.
 */
function wholeNumberForms(locale: Locale): string[] {
  const probe: Catalog = {
    probe: { zero: 'zero', one: 'one', two: 'two', few: 'few', many: 'many', other: 'other' },
  }
  const forms = new Set(['other'])
  for (let n = 0; n <= 1000; n++) forms.add(translate(probe, probe, locale, 'probe', { count: n }))
  return [...forms].sort()
}

function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))
}

it('reads the forms a locale needs off its rule', () => {
  expect(wholeNumberForms('ru')).toEqual(['few', 'many', 'one', 'other'])
  expect(wholeNumberForms('en')).toEqual(['one', 'other'])
})

describe.each(HELD)('%s plurals', (locale) => {
  const entries = plurals(catalogs[locale])

  it('fill every form a whole number picks', () => {
    // Found at all — a walk that matched nothing would pass every check below.
    expect(entries.length).toBeGreaterThan(40)
    const forms = wholeNumberForms(locale) as (keyof Plural)[]
    const missing = entries.flatMap(([path, plural]) =>
      forms.filter((form) => plural[form] === undefined).map((form) => `${path}.${form}`),
    )
    expect(missing).toEqual([])
  })

  it('show the count in `one` wherever `other` shows it', () => {
    // A key may pass the number as {total} or {formatted}; it is held to that
    // name. Nothing the server sends is about exactly one, so nothing is
    // allowed to leave it out.
    const dropped = entries
      .filter(([, plural]) => {
        if (plural.one === undefined) return false
        const one = placeholders(plural.one)
        return [...placeholders(plural.other)].some((name) => !one.has(name))
      })
      .map(([path, plural]) => `${path}: ${plural.one}`)
    expect(dropped).toEqual([])
  })
})

describe('the Russian pushes and emails the review found', () => {
  const ru = translator('ru')

  it('tells someone the pool paid 21 tokens that it paid 21', () => {
    expect(ru('push.wallet.poolTitle', { count: 1 })).toBe('Вчерашний пул принёс вам 1 токен')
    expect(ru('push.wallet.poolTitle', { count: 21 })).toBe('Вчерашний пул принёс вам 21 токен')
    expect(ru('push.wallet.poolTitle', { count: 22 })).toBe('Вчерашний пул принёс вам 22 токена')
    expect(ru('push.wallet.poolTitle', { count: 25 })).toBe('Вчерашний пул принёс вам 25 токенов')
  })

  it('counts the digest in the case each number takes', () => {
    expect(ru('email.digestSubject', { count: 21 })).toBe('21 непрочитанное сообщение в LangX')
    expect(ru('email.feedDigestCorrections', { count: 3 })).toBe('3 исправления')
    expect(ru('email.feedDigestCorrections', { count: 25 })).toBe('25 исправлений')
    expect(ru('email.meetingsBody', { count: 21 })).toBe('Вы договорились о 21 звонке на завтра.')
  })
})

describe('the Arabic digest', () => {
  const ar = translator('ar')

  // Arabic counts 3–10 with a plural noun, 11–99 and 100 with a singular one,
  // and 2 with the dual and no number. The subjects had only `one` and
  // `other`, so 2 and 11 read with the noun 3–10 take.
  it('counts unread messages and replies in the form each number takes', () => {
    expect(ar('email.digestSubject', { count: 2 })).toBe('رسالتان غير مقروءتين في LangX')
    expect(ar('email.digestSubject', { count: 3 })).toBe('3 رسائل غير مقروءة في LangX')
    expect(ar('email.digestSubject', { count: 11 })).toBe('11 رسالة غير مقروءة في LangX')
    expect(ar('email.digestBody', { count: 100, names: 'Ana' })).toBe(
      'لديك 100 رسالة غير مقروءة من Ana.',
    )
    expect(ar('email.feedDigestSubject', { count: 2 })).toBe('ردّان على ما نشرته اليوم')
    expect(ar('email.feedDigestSubject', { count: 11 })).toBe('11 ردًّا على ما نشرته اليوم')
  })
})
