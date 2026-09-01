import { describe, expect, it } from 'vitest'
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
    expect(t('welcomeBack.tokensCarried', { count: 1 })).toBe('1 жетон')
    expect(t('welcomeBack.tokensCarried', { count: 22 })).toBe('22 жетона')
    expect(t('welcomeBack.tokensCarried', { count: 25 })).toBe('25 жетонов')
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
})
