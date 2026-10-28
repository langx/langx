import { translate, type Catalog, type Locale, type Plural } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import { createTranslate } from './runtime'

/**
 * The counts that move with user data, in the languages that punish getting
 * them wrong.
 *
 * `catalogs.test.ts` proves the eight catalogues agree on every key and every
 * placeholder. It cannot prove the plural *forms* are the right words — that
 * `{count} сообщений` is wrong for one and right for eleven. These are the
 * six values a user actually watches change, pinned to their expected wording
 * so a well-meaning edit that flattens a plural back into a plain string
 * cannot land quietly.
 */
describe('counts that vary with user data inflect', () => {
  it('russian picks three different words for 1, 3 and 11', () => {
    const t = createTranslate('ru')
    expect(t('format.messages', { count: 1 })).toBe('1 сообщение')
    expect(t('format.messages', { count: 3 })).toBe('3 сообщения')
    expect(t('format.messages', { count: 11 })).toBe('11 сообщений')
    expect(t('welcomeBack.tokensCarried', { count: 1 })).toBe('1 токен')
    expect(t('welcomeBack.tokensCarried', { count: 22 })).toBe('22 токена')
    expect(t('welcomeBack.tokensCarried', { count: 25 })).toBe('25 токенов')
  })

  it('arabic distinguishes one, two and the 3-10 band', () => {
    const t = createTranslate('ar')
    expect(t('format.corrections', { count: 1 })).toBe('تصحيح واحد')
    expect(t('format.corrections', { count: 2 })).toBe('تصحيحان')
    expect(t('format.corrections', { count: 5 })).toBe('5 تصحيحات')
    expect(t('format.corrections', { count: 30 })).toBe('30 تصحيحًا')
  })

  it('english no longer says "1 tokens"', () => {
    const t = createTranslate('en')
    expect(t('welcomeBack.tokensBonus', { count: 1 })).toBe('1 token')
    expect(t('me.viewersLocked', { count: 1 })).toContain('1 person looked')
    expect(t('leaderboard.pays', { count: 1, amount: '1' })).toBe('Pays 1 token')
  })

  it('composes a two-count sentence from two pluralised halves', () => {
    const t = createTranslate('ru')
    const line = t('weekly.summary', {
      messages: t('format.messages', { count: 1 }),
      corrections: t('format.corrections', { count: 3 }),
    })
    // One message, three corrections — two different rules in one sentence,
    // which a single plural entry could never have got right.
    expect(line).toBe('На этой неделе: 1 сообщение и 3 исправления.')
  })

  it('pluralises the new feed counts in the two languages that split hardest', () => {
    // Recordings and comments arrived with the pronunciation section. Pinned
    // here because a count key is one edit away from becoming a plain string,
    // and the languages that show it are Russian and Arabic.
    const ru = createTranslate('ru')
    expect(ru('feed.answers', { count: 1 })).toBe('1 запись')
    expect(ru('feed.answers', { count: 3 })).toBe('3 записи')
    expect(ru('feed.answers', { count: 11 })).toBe('11 записей')
    expect(ru('feed.comments', { count: 1 })).toBe('1 комментарий')
    expect(ru('feed.comments', { count: 11 })).toBe('11 комментариев')

    const ar = createTranslate('ar')
    expect(ar('feed.answers', { count: 1 })).toBe('تسجيل واحد')
    expect(ar('feed.answers', { count: 2 })).toBe('تسجيلان')
    expect(ar('feed.answers', { count: 5 })).toBe('5 تسجيلات')
  })

  it('counts the replies a thread is hiding in every Russian and Arabic form', () => {
    // The one count comment replies added. "View 1 more replies" is the bug
    // in English; in these two it is three and five different wrong words.
    const ru = createTranslate('ru')
    expect(ru('feed.viewReplies', { count: 1 })).toBe('Показать ещё 1 ответ')
    expect(ru('feed.viewReplies', { count: 3 })).toBe('Показать ещё 3 ответа')
    expect(ru('feed.viewReplies', { count: 11 })).toBe('Показать ещё 11 ответов')

    const ar = createTranslate('ar')
    expect(ar('feed.viewReplies', { count: 1 })).toBe('عرض ردّ آخر')
    expect(ar('feed.viewReplies', { count: 2 })).toBe('عرض ردّين آخرين')
    expect(ar('feed.viewReplies', { count: 5 })).toBe('عرض 5 ردود أخرى')
    expect(ar('feed.viewReplies', { count: 12 })).toBe('عرض 12 ردًّا آخر')

    const en = createTranslate('en')
    expect(en('feed.viewReplies', { count: 1 })).toBe('View 1 more reply')
  })

  it("agrees the streak card's caption with the number drawn above it", () => {
    // The card draws the streak as a bare number with this line under it; a
    // plain string read "1 дней подряд" and "1 Tage" on every short streak.
    const ru = createTranslate('ru')
    expect(ru('share.cardStreakCaption', { count: 1 })).toBe('день подряд в LangX')
    expect(ru('share.cardStreakCaption', { count: 3 })).toBe('дня подряд в LangX')
    expect(ru('share.cardStreakCaption', { count: 12 })).toBe('дней подряд в LangX')
    const de = createTranslate('de')
    expect(de('share.cardStreakCaption', { count: 1 })).toBe('Tag in Folge auf LangX')
    expect(de('share.cardStreakCaption', { count: 7 })).toBe('Tage in Folge auf LangX')
    const ar = createTranslate('ar')
    expect(ar('share.cardStreakCaption', { count: 2 })).toBe('يومان متتاليان في LangX')
  })

  it('counts the messages a chat still needs before photos, in every Russian form', () => {
    // A new chat opens five messages away (MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES),
    // which is `many` — a form this entry did not have, so 5 read "5 сообщения".
    const ru = createTranslate('ru')
    expect(ru('chat.mediaLocked', { count: 3 })).toMatch(/ещё 3 сообщения\.$/)
    expect(ru('chat.mediaLocked', { count: 5 })).toMatch(/ещё 5 сообщений\.$/)
    expect(ru('chat.mediaLocked', { count: 21 })).toMatch(/ещё 21 сообщение\.$/)
  })

  it('keeps the Echo recap line true for 21 reviews as well as 1', () => {
    // The slide draws the count above the line, so no form has a placeholder
    // and the completeness check below cannot see a `one` written for a single
    // item. It read "это слово уже твоё" under 21 reviews.
    const ru = createTranslate('ru')
    expect(ru('recap.story.echoLine', { count: 21 })).toBe('карточка Echo повторена — это уже твоё')
    expect(ru('recap.story.echoLine', { count: 22 })).toBe(
      'карточки Echo повторены — эти слова уже твои',
    )
    expect(ru('recap.story.echoLine', { count: 25 })).toBe(
      'карточек Echo повторено — эти слова уже твои',
    )
  })
})

/**
 * Every Russian plural has every form a whole number can pick.
 *
 * A missing form falls back to `other`, and Russian keeps `other` for
 * fractions: an entry with only `one` and `other` gave 25 the noun 2–4 take.
 * And `one` is 21, 31 and 101 as much as 1, so a `one` that wrote "1" where
 * the count belongs told someone with 21 of something that they had 1. The
 * server's catalogue is held to the same in apps/api/src/i18n/plurals.test.ts.
 *
 * Russian only, for now: some Turkish and Arabic plurals still lean on the
 * fallback. A locale joins `HELD` once its catalogue passes.
 */
const HELD: Locale[] = ['ru']

/**
 * `one` forms that leave the number out on purpose. Each count is a product
 * setting rather than something a person piles up, and the sentence is
 * written for that setting being exactly one — "a week", "today's session".
 * 21 would read them too, but none of these settings will be 21, and a digit
 * makes the value the app ships with read worse: "Начать 1 бесплатную неделю".
 */
const EXACTLY_ONE: Partial<Record<Locale, string[]>> = {
  ru: [
    // TOKEN_RULES.caps.echoSessionsPerDay. "Все 1 сегодняшнее занятие" is not
    // Russian, and a cap of 1 is the one that would land here.
    'echo.sessionsAllDone',
    'echo.sessionsEarn',
    // PRO_GIFT_RULES.giveAWeek: the programme gives a week.
    'invite.weekTitle',
    'invite.weekTitleGive',
    // The store's free trial, in whole weeks: one.
    'paywall.startTrial',
  ],
}

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

/** True when `one` leaves out a placeholder — the count, by whatever name — that `other` shows. */
function dropsCount(plural: Plural): boolean {
  if (plural.one === undefined) return false
  const one = placeholders(plural.one)
  return [...placeholders(plural.other)].some((name) => !one.has(name))
}

it('reads the forms a locale needs off its rule', () => {
  expect(wholeNumberForms('ru')).toEqual(['few', 'many', 'one', 'other'])
  expect(wholeNumberForms('en')).toEqual(['one', 'other'])
})

describe.each(HELD)('%s plurals', (locale) => {
  const entries = plurals(catalogs[locale])
  const allowed = new Set(EXACTLY_ONE[locale] ?? [])

  it('fill every form a whole number picks', () => {
    // Found at all — a walk that matched nothing would pass every check below.
    expect(entries.length).toBeGreaterThan(100)
    const forms = wholeNumberForms(locale) as (keyof Plural)[]
    const missing = entries.flatMap(([path, plural]) =>
      forms.filter((form) => plural[form] === undefined).map((form) => `${path}.${form}`),
    )
    expect(missing).toEqual([])
  })

  it('show the count in `one` wherever `other` shows it', () => {
    // A key may pass the number as {amount} or {formatted}; it is held to that
    // name. A unit word drawn beside a number the screen renders itself
    // ("карточка ждёт") has no placeholder in any form, so this cannot tell
    // whether its `one` still holds at 21; the recap line is pinned above.
    const dropped = entries
      .filter(([path, plural]) => !allowed.has(path) && dropsCount(plural))
      .map(([path, plural]) => `${path}: ${plural.one}`)
    expect(dropped).toEqual([])
  })

  it('allows only `one` forms that still leave the number out', () => {
    const stale = [...allowed].filter((path) => {
      const plural = entries.find(([key]) => key === path)?.[1]
      return plural === undefined || !dropsCount(plural)
    })
    expect(stale).toEqual([])
  })
})
