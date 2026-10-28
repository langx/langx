import {
  MAGIC_LINK_TTL_MINUTES,
  MINIMUM_AGE,
  SUPPORTED_LOCALES,
  type Catalog,
  type Locale,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { translator, type ServerMessageKey } from '../i18n'
import { catalogs } from '../i18n/catalogs'
import type { FeedDigestItem } from '../modules/notifications/feedDigest'
import {
  existingAccountLinkEmail,
  feedDigestSection,
  magicLinkEmail,
  suspendedEmail,
} from './templates'

/**
 * Sentences that carried a number from config as text, and the feed digest's
 * account of what it counts.
 *
 * The sign-in link's lifetime was "15 minutes" in every language while
 * `auth.ts` held its own `15 * 60`, and "Under 16" was the report reason in
 * every language beside `MINIMUM_AGE`; a change to either rule would have
 * left eight sentences quoting the old one, and nothing would have failed.
 */

/** The messages whose number comes from config, never from the sentence. */
const CONFIGURED: ServerMessageKey[] = [
  'email.magicLinkBody',
  'email.magicLinkText',
  'email.existingLinkBody',
  'email.existingLinkText',
  'reportReason.underage',
]

/** Every wording of a key in one locale: the string, or each plural form. */
function forms(locale: Locale, key: string): string[] {
  let node: unknown = catalogs[locale]
  for (const part of key.split('.')) node = (node as Catalog)[part]
  return typeof node === 'string' ? [node] : Object.values(node as Record<string, string>)
}

const url = 'https://langx.io/magic-link?token=abc'

/** One post, answered three ways — three replies, as the template counts them. */
const items: FeedDigestItem[] = [
  {
    excerpt: 'Ich habe gestern Kuchen gegessen',
    postId: 'p1',
    corrections: 1,
    answers: 1,
    comments: 1,
  },
]

describe.each(SUPPORTED_LOCALES)('%s', (locale) => {
  const t = translator(locale)

  it('writes no number into a sentence that quotes config', () => {
    const written = CONFIGURED.flatMap((key) =>
      forms(locale, key)
        .filter((text) => /\p{Nd}/u.test(text))
        .map((text) => `${key}: ${text}`),
    )
    expect(written).toEqual([])
  })

  it('tells the reader how long the sign-in link lasts, from the plugin’s own number', () => {
    const magic = magicLinkEmail(url, locale)
    expect(magic.html).toContain(t('email.magicLinkBody', { count: MAGIC_LINK_TTL_MINUTES }))
    expect(magic.text).toBe(t('email.magicLinkText', { url, count: MAGIC_LINK_TTL_MINUTES }))
    const existing = existingAccountLinkEmail(url, locale)
    expect(existing.html).toContain(t('email.existingLinkBody', { count: MAGIC_LINK_TTL_MINUTES }))
    expect(existing.text).toBe(t('email.existingLinkText', { url, count: MAGIC_LINK_TTL_MINUTES }))
    for (const body of [magic.text, existing.text]) {
      expect(body).toContain(String(MAGIC_LINK_TTL_MINUTES))
      expect(body).not.toMatch(/\{\w+\}/)
    }
  })

  it('names the age floor in the suspension it gives as the reason', () => {
    const mail = suspendedEmail(locale, { until: null, reason: 'underage' })
    expect(mail.text).toContain(t('reportReason.underage', { count: MINIMUM_AGE }))
    expect(mail.text).toContain(String(MINIMUM_AGE))
  })

  it('counts the feed digest’s replies in its subject and its opening line', () => {
    const section = feedDigestSection(locale, { items, morePosts: 0 })
    for (const line of [section.subject, section.text[0]!]) {
      expect(line).toContain('3')
      expect(line).not.toMatch(/\{\w+\}/)
    }
    expect(section.text[0]).not.toBe(section.subject)
  })
})

describe('the feed digest', () => {
  /*
   * `feedDigest.ts` gathers the last 24 hours of replies to posts of any age,
   * and the template passes their total as the count. So "today" goes with
   * the replies — "what you posted today" said the posts were today's — and
   * the posts are "what you posted": all three replies here are on one post,
   * and "your posts" would have been wrong about that.
   */
  const opening = (locale: Locale) => {
    const section = feedDigestSection(locale, { items, morePosts: 0 })
    return [section.subject, section.text[0]]
  }

  it('says the replies came today, and not that the posts did', () => {
    expect(opening('en')).toEqual([
      '3 replies today to what you posted',
      'What you posted got 3 replies today.',
    ])
    expect(opening('de')).toEqual([
      'Heute 3 Antworten auf das, was du gepostet hast',
      'Du hast heute 3 Antworten auf das bekommen, was du gepostet hast.',
    ])
    expect(opening('ru')).toEqual([
      '3 ответа за сегодня на то, что ты публикуешь',
      'Сегодня на то, что ты публикуешь, пришло 3 ответа.',
    ])
    expect(opening('fr')).toEqual([
      '3 réponses aujourd’hui à ce que tu as publié',
      'Ce que tu as publié a reçu 3 réponses aujourd’hui.',
    ])
    expect(opening('tr')).toEqual([
      'Paylaştığına bugün 3 yanıt geldi',
      'Paylaştığına bugün toplam 3 yanıt geldi.',
    ])
  })

  it('never calls what was answered "your posts"', () => {
    const plural =
      /ваши посты|твои посты|deine Beiträge|tus publicaciones|seus posts|vos publications|tes publications|paylaştıkların/iu
    const said = SUPPORTED_LOCALES.flatMap((locale) => {
      const t = translator(locale)
      return Array.from({ length: 121 }, (_, count) => [
        t('email.feedDigestSubject', { count }),
        t('email.feedDigestBody', { count }),
      ])
        .flat()
        .filter((text) => plural.test(text))
        .map((text) => `${locale}: ${text}`)
    })
    expect(said).toEqual([])
  })
})

/**
 * Russian and French speak to the reader as «ты» and « tu », in the app and in
 * what the server sends. The server's catalogues still say «вы» / « vous » in
 * places; the lines rewritten for the numbers above are held to the informal
 * form here, the same signs `apps/mobile/src/i18n/addressForm.test.ts` looks
 * for: the pronoun, and a plural imperative where an imperative stands.
 */
const FORMAL: Partial<Record<Locale, RegExp[]>> = {
  ru: [
    /(?<!\p{L})(?:вы|вас|вам|вами|ваш\p{L}*)(?!\p{L})/iu,
    /(?:^|[.,!?…:;—«(]\s*)\p{L}+(?:йте|ьте|ите)(?!\p{L})/iu,
  ],
  fr: [
    /(?<![\p{L}-])(?:vous|votre|vos)(?!\p{L})/iu,
    /(?:^|[.,!?…:;—«(]\s*)(?!(?:chez|assez|nez)(?!\p{L}))\p{L}+ez(?![\p{L}-])/iu,
  ],
}

describe.each(Object.entries(FORMAL))('the %s lines rewritten here', (locale, signs) => {
  it('address one reader informally', () => {
    const keys: ServerMessageKey[] = [
      ...CONFIGURED,
      'email.feedDigestSubject',
      'email.feedDigestBody',
    ]
    const formal = keys.flatMap((key) =>
      forms(locale as Locale, key)
        .filter((text) => signs.some((sign) => sign.test(text)))
        .map((text) => `${key}: ${text}`),
    )
    expect(formal).toEqual([])
  })
})
