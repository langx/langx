import { SUPPORTED_LOCALES, TOKEN_RULES, type Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from '../i18n/catalogs'
import { createTranslate } from '../i18n/runtime'
import { TOKEN_SITE } from './externalLinks'
import {
  poolShareCap,
  tokenGuestRow,
  tokenPageCopy,
  tokenSiteUrl,
  tokenYoursRows,
  type TokenPageRow,
} from './tokenPage'

/*
 * LangX Token's page is what App Review is pointed at for guideline 3.1.5(b),
 * and `docs/token-messaging-brief.md` is the rule it is read against. These
 * tests read the page the way it is drawn — every line `tokenPage.ts` builds,
 * plus the few the screen and its components add — in all eight languages.
 */

/** Every line a reader can see or hear on the page, labelled with where it sits. */
function pageLines(locale: Locale): { where: string; text: string }[] {
  const t = createTranslate(locale)
  const copy = tokenPageCopy(t, locale)
  const lines: { where: string; text: string }[] = []
  const add = (where: string, text: string) => lines.push({ where, text })
  const rows = (where: string, list: readonly TokenPageRow[]) => {
    for (const row of list) {
      add(`${where}.${row.key}.title`, row.title)
      add(`${where}.${row.key}.body`, row.body)
      if (row.value !== undefined) add(`${where}.${row.key}.value`, row.value)
      if (row.valueLabel !== undefined) add(`${where}.${row.key}.valueLabel`, row.valueLabel)
    }
  }

  add('hero.title', copy.hero.title)
  add('hero.tagline', copy.hero.tagline)
  copy.hero.facts.forEach((fact, i) => add(`hero.facts.${String(i)}`, fact))
  add('yours.title', t('tokens.page.yours'))
  // Both ends of what an account can see: everything loaded with a place on
  // the board, and nothing loaded yet next to "not on the board this week".
  rows(
    'yours.full',
    tokenYoursRows(t, locale, {
      balance: 1234,
      today: { messages: 3, corrections: 1, distinctPartners: 2 },
      rank: 7,
    }),
  )
  rows('yours.empty', tokenYoursRows(t, locale, { rank: null }))
  rows('guest', [tokenGuestRow(t, locale)])
  add('earn.title', copy.earn.title)
  rows('earn', copy.earn.rows)
  add('pool.title', copy.pool.title)
  add('pool.intro', copy.pool.intro)
  for (const step of copy.pool.steps) {
    add(`pool.${step.key}.title`, step.title)
    add(`pool.${step.key}.body`, step.body)
  }
  add('spend.title', copy.spend.title)
  rows('spend', copy.spend.rows)
  add('not.title', copy.not.title)
  for (const row of copy.not.rows) {
    add(`not.${row.key}.title`, row.title)
    add(`not.${row.key}.body`, row.body)
  }
  add('faq.title', t('productPage.questions'))
  for (const item of copy.faq) {
    add(`faq.${item.key}.question`, item.question)
    add(`faq.${item.key}.answer`, item.answer)
  }
  add('link.title', copy.link.title)
  add('link.hint', t('productPage.opensInBrowser'))
  return lines
}

interface Banned {
  /**
   * The words the brief itself uses in the negative — "not a cryptocurrency",
   * "cannot be traded, staked or withdrawn". Banned everywhere except the
   * handful of sentences that say exactly that (`NEGATIONS`).
   */
  negatable: RegExp[]
  /** The words no line may hold, negated or not. */
  never: RegExp[]
}

/*
 * Stems rather than whole words, so an inflection cannot slip past — and so
 * each list is the translation of the brief's list, not of English spellings.
 * Words a language uses for "earn" are left alone where they would also catch
 * the sentence the page needs ("kazan", "gagner", "ganar").
 *
 * es "bote", pt "bolo" and fr "cagnotte" are on it as "jackpot": each is what
 * a lottery's prize pot is called, which is why the page says "fondo", "fundo"
 * and "pot commun" for the daily pool.
 */
const BANNED: Record<Locale, Banned> = {
  en: {
    negatable: [
      /crypto/i,
      /\btrad(e|ed|es|er|ers|ing|able)\b/i,
      /\bstak(e|ed|es|ing)\b/i,
      /withdr/i,
      /cash(ed|ing)? out/i,
    ],
    never: [
      /wallet address/i,
      /connect (a |your )?wallet/i,
      /\binvest/i,
      /\bpay-?outs?\b/i,
      /refer and earn/i,
      /affiliat/i,
      /commission/i,
      /\bwin(s|ner|ners|ning)?\b/i,
      /\bprizes?\b/i,
      /\bluck/i,
      /jackpot/i,
      /\bspin/i,
      /\bodds\b/i,
      /\bchances?\b/i,
      /marketplace/i,
      /\bcoins?\b/i,
      /earn tokens faster/i,
      /learn to earn/i,
    ],
  },
  tr: {
    negatable: [/kripto/i, /takas/i, /ticaret/i, /stake/i, /çekil/i, /para çek/i, /nakd/i],
    never: [
      /cüzdan adres/i,
      /yatırım/i,
      /komisyon/i,
      /ikramiye/i,
      /şans/i,
      /çark/i,
      /olasılık/i,
      /ihtimal/i,
      /pazar yeri/i,
      /madeni para/i,
      /davet et ve kazan/i,
      /piyango/i,
    ],
  },
  de: {
    negatable: [/krypto/i, /handel/i, /stak/i, /auszahl/i, /ausgezahlt/i, /abheb/i],
    never: [
      /investi/i,
      /gewinn/i,
      /glück/i,
      /jackpot/i,
      /chance/i,
      /marktplatz/i,
      /münze/i,
      /provision/i,
      /affiliate/i,
      /wallet-?adresse/i,
      /verlos/i,
    ],
  },
  es: {
    negatable: [/cripto/i, /intercambi/i, /comerci/i, /negoci/i, /stak/i, /retir/i, /cobrar/i],
    never: [
      /invert/i,
      /inversi/i,
      /afiliad/i,
      /comisi/i,
      /premio/i,
      /suerte/i,
      /ruleta/i,
      /probabilidad/i,
      /azar/i,
      /\bmonedas?\b/i,
      /ganador/i,
      /sorteo/i,
      /\bbote\b/i,
    ],
  },
  fr: {
    negatable: [/crypto/i, /échang/i, /négoci/i, /stak/i, /retir/i, /encaiss/i],
    never: [
      /investi/i,
      /affili/i,
      /commission/i,
      /chance/i,
      /jackpot/i,
      /gros lot/i,
      /cagnotte/i,
      /\broue\b/i,
      /probabilit/i,
      /gagnant/i,
      /loterie/i,
      /\bmonnaies?\b/i,
    ],
  },
  'pt-BR': {
    negatable: [/cripto/i, /\btroc/i, /negoci/i, /stak/i, /\bsac(ar|ad|o)/i, /saque/i, /retir/i],
    never: [
      /invest/i,
      /afiliad/i,
      /comiss/i,
      /prêmio/i,
      /\bsorte\b/i,
      /roleta/i,
      /probabilidade/i,
      /\bchance/i,
      /\bmoedas?\b/i,
      /\bbol(o|ão|ada)\b/i,
      /ganhador/i,
      /vencedor/i,
      /sorteio/i,
      /loteria/i,
    ],
  },
  ru: {
    negatable: [
      /крипт/iu,
      /торг/iu,
      /обмен/iu,
      /трейд/iu,
      /стейк/iu,
      /выв(од|ест|оди)/iu,
      /обналич/iu,
    ],
    never: [
      /инвест/iu,
      /выплат/iu,
      /партн[её]рск/iu,
      /комисси/iu,
      /выигр/iu,
      /побед/iu,
      /приз/iu,
      /удач/iu,
      /везени/iu,
      /джекпот/iu,
      /рулетк/iu,
      /шанс/iu,
      /монет/iu,
      /лотере/iu,
      /адрес кошел/iu,
    ],
  },
  ar: {
    // "عملة" is "currency" as well as "coin", so it sits with the words
    // "ليست عملة مشفّرة" — "not a cryptocurrency" — has to use.
    negatable: [
      /مشف/u,
      /كريبتو/u,
      /عملة/u,
      /عملات/u,
      /تداول/u,
      /متاجرة/u,
      /مبادلة/u,
      /رهن/u,
      /سحب/u,
      /تسييل/u,
    ],
    never: [
      /استثمار/u,
      /عمولة/u,
      /ربح/u,
      /أرباح/u,
      /فوز/u,
      /فائز/u,
      /جائز/u,
      /محظوظ/u,
      /الحظ/u,
      /احتمال/u,
      /فرصة/u,
      /يانصيب/u,
      /عجلة/u,
    ],
  },
}

/**
 * The sentences allowed to say what the token is not in the brief's own
 * words: its one-line version, the question it answers, and the two short
 * forms of it. Pinned in English below, so that widening one cannot pass
 * quietly as "one of the allowed lines".
 */
const NEGATIONS = [
  'tokens.page.factTraded',
  'tokens.page.notCrypto',
  'tokens.page.faq.crypto',
  'tokens.page.faq.cryptoAnswer',
] as const

describe('the token page holds to the messaging brief', () => {
  it('allows the negations only in the brief’s own words', () => {
    const t = createTranslate('en')
    expect(NEGATIONS.map((key) => t(key))).toEqual([
      'Can’t be traded',
      'Not a cryptocurrency',
      'Is it a cryptocurrency?',
      'No. It’s a point you earn and spend inside LangX. It can’t be bought, sold, traded, staked or withdrawn, and it never will be.',
    ])
  })

  it.each(SUPPORTED_LOCALES)('uses none of the banned words in %s', (locale) => {
    const t = createTranslate(locale)
    const negations = new Set<string>(NEGATIONS.map((key) => t(key)))
    const { negatable, never } = BANNED[locale]
    const found: string[] = []
    for (const { where, text } of pageLines(locale)) {
      const rules = negations.has(text) ? never : [...negatable, ...never]
      for (const rule of rules) if (rule.test(text)) found.push(`${where}: ${String(rule)}`)
    }
    expect(found).toEqual([])
  })

  /*
   * A list of stems that matches nothing would pass the test above in any
   * language. The wallet's disclaimer says "cannot be traded or withdrawn" in
   * all eight, so each list has to catch its own language's version of it.
   */
  it.each(SUPPORTED_LOCALES)('has a %s list that recognises the words it bans', (locale) => {
    const disclaimer = createTranslate(locale)('wallet.disclaimer')
    expect(BANNED[locale].negatable.some((rule) => rule.test(disclaimer))).toBe(true)
  })

  it('never says gift tokens stay off the leaderboards', () => {
    // They count in every period (`tokenAggregates`), so the brief's older
    // "never moves a leaderboard" would now be false on this page.
    const t = createTranslate('en')
    const gift = tokenPageCopy(t, 'en').earn.rows.find((row) => row.key === 'gift')
    expect(gift?.body).toBeDefined()
    expect(gift?.body).not.toMatch(/leaderboard|board|rank/i)
  })
})

describe('the token page’s numbers', () => {
  /*
   * "Every number from TOKEN_RULES" made checkable: a translator cannot type
   * one, because no message in the page's block may hold a digit of its own.
   * `{hour}:00` is the only figure written out, and it is a clock face.
   */
  it.each(SUPPORTED_LOCALES)('come only through placeholders in %s', (locale) => {
    const page = (catalogs[locale].tokens as { page: unknown }).page
    const typed: string[] = []
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string') {
        const bare = value.replace(/\{\w+\}/g, '').replace(':00', '')
        if (/[0-9٠-٩]/.test(bare)) typed.push(`${path}: ${value}`)
      } else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`)
      }
    }
    walk(page, 'tokens.page')
    expect(typed).toEqual([])
  })

  it('reads them off the rules', () => {
    const t = createTranslate('en')
    const copy = tokenPageCopy(t, 'en')
    const body = (key: string) => copy.earn.rows.find((row) => row.key === key)?.body ?? ''
    const { caps, pool, referral } = TOKEN_RULES
    expect(body('message')).toContain(String(caps.messagesPerDay))
    expect(body('message')).toContain(String(caps.messagesPerPartnerPerDay))
    expect(body('invite')).toContain(referral.inviteeTotal.toLocaleString('en'))
    expect(copy.pool.intro).toContain(pool.total.toLocaleString('en'))
    expect(poolShareCap()).toBe(Math.floor(pool.total * pool.maxShareOfPool))
    expect(copy.pool.steps.at(-1)?.body).toContain(`${String(pool.payoutHourUtc)}:00 UTC`)
    expect(tokenGuestRow(t, 'en').title).toContain(String(TOKEN_RULES.signupBonus))
  })
})

describe('the "Yours" rows', () => {
  const t = createTranslate('en')

  it('show the place on this week’s board once it is known', () => {
    const rank = tokenYoursRows(t, 'en', { rank: 7 }).find((row) => row.key === 'rank')
    expect(rank?.value).toBe('#7')
    expect(rank?.body).toBe(t('tokens.page.rankBody'))
  })

  it('say how to get on the board when nothing was earned this week', () => {
    const rank = tokenYoursRows(t, 'en', { rank: null }).find((row) => row.key === 'rank')
    expect(rank?.value).toBeUndefined()
    expect(rank?.body).toBe(t('tokens.page.rankNone'))
  })

  it('leave the balance blank until it arrives, and every row leads somewhere', () => {
    const rows = tokenYoursRows(t, 'en', {})
    expect(rows.find((row) => row.key === 'wallet')?.value).toBeUndefined()
    expect(rows.every((row) => row.to !== undefined)).toBe(true)
  })
})

describe('the Arabic page', () => {
  /*
   * The page's components set every line in the layout's direction
   * (`useTextDirection`), so a line that is only a name — "LangX Token" —
   * needs nothing to sit on the right. A sentence that opens with "Pro" or
   * "LangX" and goes on in Arabic still does: Android takes a paragraph's
   * direction from its first letter whatever the style says, and lays that
   * word out at the wrong end of the sentence. The catalogue's answer, used
   * elsewhere too, is a leading right-to-left mark.
   */
  it('opens every sentence that mixes in Latin words right to left', () => {
    const latinFirst = pageLines('ar')
      .filter(({ text }) => /^[^\p{L}‏]*\p{Script=Latin}/u.test(text))
      .filter(({ text }) => /\p{Script=Arabic}/u.test(text))
      .map(({ where, text }) => `${where}: ${text}`)
    expect(latinFirst).toEqual([])
  })
})

describe('tokenSiteUrl', () => {
  it('sends English to the root and Brazilian Portuguese to the site’s own folder', () => {
    expect(tokenSiteUrl('en')).toBe(`${TOKEN_SITE}/`)
    expect(tokenSiteUrl('pt-BR')).toBe(`${TOKEN_SITE}/pt-br/`)
  })

  it.each(SUPPORTED_LOCALES)('gives %s an address on token.langx.io', (locale) => {
    expect(tokenSiteUrl(locale)).toMatch(/^https:\/\/token\.langx\.io\/([a-z-]+\/)?$/)
  })
})
