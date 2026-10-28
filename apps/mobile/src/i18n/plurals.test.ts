import { SUPPORTED_LOCALES, translate, type Catalog, type Locale, type Plural } from '@langx/shared'
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

describe('numbers the app is configured with', () => {
  // Each of these sentences used to carry its number as plain text. The
  // number comes from config, and the noun beside it only agreed with the
  // value of the day — or not even that: Russian Pro learns 5 languages.
  it('words the Pro language allowance for five', () => {
    const ru = createTranslate('ru')
    expect(ru('paywall.learningLanguagesBody', { count: 5 })).toBe(
      'Учи 5 языков одновременно, а не один.',
    )
    expect(ru('paywall.learningLanguagesBody', { count: 3 })).toBe(
      'Учи 3 языка одновременно, а не один.',
    )
  })

  it('counts a year-long streak gate in the accusative Arabic takes after 11', () => {
    const ar = createTranslate('ar')
    const gate = (threshold: number) =>
      ar('store.lockedStreak', { count: threshold, current: '12', threshold: String(threshold) })
    expect(gate(365)).toBe('‏12 من 365 يومًا')
    expect(gate(100)).toBe('‏12 من 100 يوم')
    expect(gate(7)).toBe('‏12 من 7 أيام')
  })

  it('agrees the free plan and account settings with their numbers', () => {
    const ru = createTranslate('ru')
    expect(ru('chats.emptyBody', { count: 5 })).toContain('начинать 5 новых чатов в день')
    expect(ru('chats.emptyBody', { count: 21 })).toContain('начинать 21 новый чат в день')
    expect(ru('auth.passwordRule', { count: 6 })).toBe('Не менее 6 символов')
    expect(ru('auth.passwordRule', { count: 21 })).toBe('Не менее 21 символа')
    expect(ru('settings.usernameBody', { count: 7 })).toBe('Можно менять раз в 7 дней')
    expect(ru('settings.usernameBody', { count: 2 })).toBe('Можно менять раз в 2 дня')

    const ar = createTranslate('ar')
    expect(ar('auth.passwordRule', { count: 6 })).toBe('6 أحرف على الأقل')
    expect(ar('auth.passwordRule', { count: 12 })).toBe('12 حرفًا على الأقل')
    expect(ar('editProfile.genderOnce', { count: 180 })).toBe('يمكنك تغيير هذا مرة كل 180 يومًا.')
    expect(ar('editProfile.genderOnce', { count: 200 })).toBe('يمكنك تغيير هذا مرة كل 200 يوم.')
    expect(ar('settings.usernameBody', { count: 2 })).toBe('غيّره مرة كل يومين')
  })

  it('words the sign-in link’s lifetime for any number of minutes', () => {
    // MAGIC_LINK_TTL_MINUTES, which the API also hands the magic-link plugin.
    // "через" takes the accusative and "в течение" the genitive, so 21 reads
    // two ways; Arabic counts 11–99 in the singular, written bare as the
    // catalogue's other minute counts are, so today's 15 reads as it did.
    const ru = createTranslate('ru')
    expect(ru('auth.signInLinkNote', { count: 15 })).toContain('действует 15 минут.')
    expect(ru('auth.signInLinkNote', { count: 21 })).toContain('действует 21 минуту.')
    expect(ru('auth.signInLinkNote', { count: 3 })).toContain('действует 3 минуты.')
    expect(ru('auth.signInLinkExpiredBody', { count: 15 })).toMatch(/в течение 15 минут\.$/)
    expect(ru('auth.signInLinkExpiredBody', { count: 21 })).toMatch(/в течение 21 минуты\.$/)
    const ar = createTranslate('ar')
    expect(ar('auth.signInLinkSentBody', { count: 15, email: 'a@b.c' })).toMatch(/خلال 15 دقيقة\.$/)
    expect(ar('auth.signInLinkSentBody', { count: 5, email: 'a@b.c' })).toMatch(/خلال 5 دقائق\.$/)
    expect(ar('auth.signInLinkSentBody', { count: 2, email: 'a@b.c' })).toMatch(/خلال دقيقتين\.$/)
  })

  it('names the age floor in the report reason for any age', () => {
    const ru = createTranslate('ru')
    expect(ru('report.underage', { count: 16 })).toBe('Младше 16 лет')
    expect(ru('report.underage', { count: 21 })).toBe('Младше 21 года')
    const ar = createTranslate('ar')
    expect(ar('report.underage', { count: 16 })).toBe('أقل من 16 عامًا')
    expect(ar('report.underage', { count: 5 })).toBe('أقل من 5 أعوام')
    expect(ar('report.underage', { count: 100 })).toBe('أقل من 100 عام')
  })

  it('agrees the token noun in the invite steps with the referral rules', () => {
    // `count` picks the form; the shown number is the reader's digits.
    const ru = createTranslate('ru')
    expect(ru('invite.step2', { count: 1000, activation: '1 000' })).toMatch(
      /получаешь 1 000 токенов\.$/,
    )
    expect(ru('invite.step2', { count: 21, activation: '21' })).toMatch(/получаешь 21 токен\.$/)
    // "с" takes the genitive: с 21 токена, с 1000 токенов.
    const invite = (count: number) =>
      ru('shared.inviteBody', {
        count,
        total: String(count),
        name: 'Ana',
        activation: '1',
        max: '5',
      })
    expect(invite(1000)).toContain('ты начнёшь с 1000 токенов;')
    expect(invite(21)).toContain('ты начнёшь с 21 токена;')
    const ar = createTranslate('ar')
    expect(ar('invite.step2', { count: 1000, activation: '1000' })).toMatch(/تكسب 1000 رمز\.$/)
    expect(ar('invite.step2', { count: 2, activation: '2' })).toMatch(/تكسب رمزين\.$/)
    expect(ar('invite.step2', { count: 50, activation: '50' })).toMatch(/تكسب 50 رمزًا\.$/)
  })
})

/**
 * Every plural has exactly the forms its language picks for a whole number.
 *
 * A missing form falls back to `other`, and `other` is rarely the form a
 * missing one would have said. Russian keeps it for fractions, so an entry
 * with only `one` and `other` gave 25 the noun 2–4 take; Arabic keeps it for
 * 100–102, so 5 and 11 read like a hundred; and Turkish keeps nothing else, so
 * a Turkish entry without `one` is merely relying on the fallback to agree. A
 * form the language never picks is dead text a translator still has to keep
 * up. The server's catalogue is held to the same in
 * apps/api/src/i18n/plurals.test.ts.
 *
 * The forms come off the table `translate` uses (`pluralRules.ts`), not off
 * `Intl`: Hermes has no `Intl.PluralRules`, and the phone is what reads these.
 */

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
 * picks. Russian `one` is 1, 21 and 31; Arabic `few` is 3–10 and 103–110.
 * English `one`, or Arabic `one` and `two`, is a single number, so "one
 * correction" and "تصحيحان" may say it in words. Zero is left out because
 * French and Portuguese file it under `one` with 1, and their `one` sentences
 * are written for one.
 */
function countedForms(locale: Locale): (keyof Plural)[] {
  return [...wholeNumbers(locale)]
    .filter(([form, numbers]) => form !== 'other' && numbers.filter((n) => n > 0).length > 1)
    .map(([form]) => form)
}

/** The forms of `plural` that leave out a placeholder — the count, by whatever name — that `other` shows. */
function dropsCount(plural: Plural, forms: (keyof Plural)[]): (keyof Plural)[] {
  const shown = [...placeholders(plural.other)]
  return forms.filter((form) => {
    const text = plural[form]
    return text !== undefined && shown.some((name) => !placeholders(text).has(name))
  })
}

it('reads the forms a locale needs off its rule', () => {
  const forms = (locale: Locale) => [...wholeNumbers(locale).keys()].sort()
  expect(forms('ru')).toEqual(['few', 'many', 'one', 'other'])
  expect(forms('ar')).toEqual(['few', 'many', 'one', 'other', 'two', 'zero'])
  expect(forms('en')).toEqual(['one', 'other'])
  expect(forms('fr')).toEqual(['one', 'other'])
  expect(countedForms('ru').sort()).toEqual(['few', 'many', 'one'])
  expect(countedForms('ar').sort()).toEqual(['few', 'many'])
  expect(countedForms('fr')).toEqual([])
})

describe.each(SUPPORTED_LOCALES)('%s plurals', (locale) => {
  const entries = plurals(catalogs[locale])
  const forms = [...wholeNumbers(locale).keys()]
  const allowed = new Set(EXACTLY_ONE[locale] ?? [])

  it('fill every form a whole number picks', () => {
    // Found at all — a walk that matched nothing would pass every check below.
    expect(entries.length).toBeGreaterThan(100)
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
    // A key may pass the number as {amount} or {formatted}; it is held to that
    // name. A unit word drawn beside a number the screen renders itself
    // ("карточка ждёт") has no placeholder in any form, so this cannot tell
    // whether its `one` still holds at 21; the recap line is pinned above.
    const counted = countedForms(locale)
    const dropped = entries.flatMap(([path, plural]) =>
      dropsCount(plural, counted)
        .filter((form) => !(form === 'one' && allowed.has(path)))
        .map((form) => `${path}.${form}: ${plural[form]}`),
    )
    expect(dropped).toEqual([])
  })

  it('allows only `one` forms that still leave the number out', () => {
    const stale = [...allowed].filter((path) => {
      const plural = entries.find(([key]) => key === path)?.[1]
      return plural === undefined || !dropsCount(plural, ['one']).length
    })
    expect(stale).toEqual([])
  })
})
