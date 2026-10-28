import { SUPPORTED_LOCALES, translate, type Catalog, type Locale, type Plural } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import { translator } from './index'

/**
 * Every plural the server sends has exactly the forms its language picks for
 * a whole number.
 *
 * A missing form falls back to `other`, and `other` is rarely the form a
 * missing one would have said. Russian keeps it for fractions, so the nightly
 * pool push and the digest read 25 with the noun 2–4 take; Arabic keeps it for
 * 100–102, so "5 people viewed your profile" and "11 new badges" took the
 * words for a hundred. And Russian `one` is 21, 31 and 101 as much as 1, so a
 * `one` that wrote "1" where the count belongs told someone the pool paid 21
 * tokens that it paid them 1. The app's catalogue is held to the same in
 * apps/mobile/src/i18n/plurals.test.ts.
 *
 * The forms come off the table `translate` uses (`pluralRules.ts`), the one
 * the phone reads too.
 */

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
 * The whole numbers 0–1000 each form of `locale` takes, read off the real
 * rule through `translate` rather than restated here. The range stays below
 * the exact millions Spanish, French and Portuguese call `many`, which fall
 * back to `other` by design.
 */
function wholeNumbers(locale: Locale): Map<keyof Plural, number[]> {
  const probe: Catalog = {
    probe: { zero: 'zero', one: 'one', two: 'two', few: 'few', many: 'many', other: 'other' },
  }
  const forms = new Map<keyof Plural, number[]>([['other', []]])
  for (let n = 0; n <= 1000; n++) {
    const form = translate(probe, probe, locale, 'probe', { count: n }) as keyof Plural
    forms.set(form, [...(forms.get(form) ?? []), n])
  }
  return forms
}

function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))
}

/**
 * The forms that must show the count: those more than one number from 1 up
 * picks. Arabic `one` and `two` are a single number each, so "رد واحد" and
 * "ردّان" may say it in words; zero is left out because French and Portuguese
 * file it under `one` with 1, and nothing the server sends counts zero.
 */
function countedForms(locale: Locale): (keyof Plural)[] {
  return [...wholeNumbers(locale)]
    .filter(([form, numbers]) => form !== 'other' && numbers.filter((n) => n > 0).length > 1)
    .map(([form]) => form)
}

it('reads the forms a locale needs off its rule', () => {
  expect([...wholeNumbers('ar').keys()].sort()).toEqual([
    'few',
    'many',
    'one',
    'other',
    'two',
    'zero',
  ])
  expect([...wholeNumbers('en').keys()].sort()).toEqual(['one', 'other'])
  expect(countedForms('ru').sort()).toEqual(['few', 'many', 'one'])
  expect(countedForms('ar').sort()).toEqual(['few', 'many'])
})

describe.each(SUPPORTED_LOCALES)('%s plurals', (locale) => {
  const entries = plurals(catalogs[locale])
  const forms = [...wholeNumbers(locale).keys()]

  it('fill every form a whole number picks', () => {
    // Found at all — a walk that matched nothing would pass every check below.
    expect(entries.length).toBeGreaterThan(40)
    const missing = entries.flatMap(([path, plural]) =>
      forms.filter((form) => plural[form] === undefined).map((form) => `${path}.${form}`),
    )
    expect(missing).toEqual([])
  })

  it('fill no form a whole number never picks', () => {
    const extra = entries.flatMap(([path, plural]) =>
      Object.keys(plural)
        .filter((form) => !forms.includes(form as keyof Plural))
        .map((form) => `${path}.${form}`),
    )
    expect(extra).toEqual([])
  })

  it('show the count in every form more than one number reads', () => {
    // A key may pass the number as {total} or {formatted}; it is held to that
    // name. Russian `one` is held too: nothing the server sends is about
    // exactly one, so no `one` there may leave the number out.
    const counted = countedForms(locale)
    const dropped = entries.flatMap(([path, plural]) => {
      const shown = [...placeholders(plural.other)]
      return counted
        .filter((form) => {
          const text = plural[form]
          return text !== undefined && shown.some((name) => !placeholders(text).has(name))
        })
        .map((form) => `${path}.${form}: ${plural[form]}`)
    })
    expect(dropped).toEqual([])
  })
})

describe('the Russian pushes and emails the review found', () => {
  const ru = translator('ru')

  it('tells someone the pool paid 21 tokens that it paid 21', () => {
    expect(ru('push.wallet.poolTitle', { count: 1 })).toBe('Вчерашний пул принёс тебе 1 токен')
    expect(ru('push.wallet.poolTitle', { count: 21 })).toBe('Вчерашний пул принёс тебе 21 токен')
    expect(ru('push.wallet.poolTitle', { count: 22 })).toBe('Вчерашний пул принёс тебе 22 токена')
    expect(ru('push.wallet.poolTitle', { count: 25 })).toBe('Вчерашний пул принёс тебе 25 токенов')
  })

  it('counts the digest in the case each number takes', () => {
    expect(ru('email.digestSubject', { count: 21 })).toBe('21 непрочитанное сообщение в LangX')
    expect(ru('email.feedDigestCorrections', { count: 3 })).toBe('3 исправления')
    expect(ru('email.feedDigestCorrections', { count: 25 })).toBe('25 исправлений')
    expect(ru('email.meetingsBody', { count: 21 })).toBe('На завтра у тебя назначен 21 звонок.')
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
    expect(ar('email.feedDigestSubject', { count: 11 })).toBe('11 ردًا على ما نشرته اليوم')
  })

  // The letter is sent with corrections + answers + comments as its count, so
  // every form counts replies. The body once said "{count} people replied",
  // and one person can leave several.
  it('counts replies in the feed digest body, never the people who left them', () => {
    expect(ar('email.feedDigestBody', { count: 0 })).toBe('وصلك اليوم 0 رد على ما نشرته.')
    expect(ar('email.feedDigestBody', { count: 2 })).toBe('وصلك اليوم ردّان على ما نشرته.')
    expect(ar('email.feedDigestBody', { count: 3 })).toBe('وصلتك اليوم 3 ردود على ما نشرته.')
    expect(ar('email.feedDigestBody', { count: 11 })).toBe('وصلك اليوم 11 ردًا على ما نشرته.')
    expect(ar('email.feedDigestBody', { count: 100 })).toBe('وصلك اليوم 100 رد على ما نشرته.')
    // 0–120 reaches all six forms, 100 and up included.
    const people = Array.from({ length: 121 }, (_, count) =>
      ar('email.feedDigestBody', { count }),
    ).filter((text) => /شخص|أشخاص/.test(text))
    expect(people).toEqual([])
  })
})

describe('the Arabic pushes and emails that leaned on the fallback', () => {
  const ar = translator('ar')

  it('says two, a handful, dozens and a hundred four different ways', () => {
    expect(ar('push.profileVisitsTitle', { count: 2 })).toBe('شخصان اطّلعا على ملفك')
    expect(ar('push.profileVisitsTitle', { count: 5 })).toBe('5 أشخاص اطّلعوا على ملفك')
    expect(ar('push.profileVisitsTitle', { count: 11 })).toBe('11 شخصًا اطّلعوا على ملفك')
    expect(ar('push.profileVisitsTitle', { count: 100 })).toBe('100 شخص اطّلعوا على ملفك')
  })

  it('counts the digest and the calls in the form each number takes', () => {
    expect(ar('email.digestSubject', { count: 2 })).toBe('رسالتان غير مقروءتين في LangX')
    expect(ar('email.digestSubject', { count: 12 })).toBe('12 رسالة غير مقروءة في LangX')
    expect(ar('email.feedDigestComments', { count: 30 })).toBe('30 تعليقًا')
    expect(ar('email.meetingsBody', { count: 2 })).toBe('اتفقت على مكالمتين غدًا.')
  })

  it('names a streak milestone of a hundred days without the 11–99 accusative', () => {
    // The milestones are 100 and 365 days; "100 يومًا" is wrong and
    // "365 يومًا" right, so the sentence says the streak reached the number.
    expect(ar('proGift.introStreak', { count: 1, days: 100 })).toBe(
      '🔥 سلسلتك وصلت إلى 100، هذا مذهل! تقديرًا لك، شهر من Pro هدية منّا.',
    )
  })

  it('words the deletion grace period from its config', () => {
    expect(ar('email.deleteDoneBody', { count: 30 })).toBe(
      'سجّل الدخول خلال 30 يومًا ويعود كل شيء.',
    )
    expect(translator('ru')('email.deleteDoneBody', { count: 30 })).toBe(
      'Войди в течение 30 дней — и всё вернётся.',
    )
  })
})
