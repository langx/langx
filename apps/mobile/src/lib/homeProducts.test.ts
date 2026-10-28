import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { COSMETICS, SUPPORTED_LOCALES, TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  HOME_PRODUCT_LOOK,
  HOME_PRODUCT_NAMES,
  HOME_PRODUCTS,
  columnInner,
  homeCardsBeside,
  homeProductLines,
  homeVenusCard,
  measuredWords,
} from './homeProducts'
import { VENUS_PACK_ID } from './tokenPage'
import { formatCount } from './transparency'
import { streakRowVenus } from './venusStreakRow'
import type { VenusVideo } from './venusStory'

const en = createTranslate('en')

/** The pack's size as the catalogue has it, so no test retypes it. */
const STICKERS = COSMETICS.find((cosmetic) => cosmetic.id === VENUS_PACK_ID)?.stickers?.length ?? 0

/** Each page's screen, where its colour and mark are set. */
const SCREENS = {
  venus: 'src/screens/VenusScreenV3.tsx',
  copilot: 'src/screens/CopilotScreenV3.tsx',
  token: 'src/screens/TokenScreenV3.tsx',
  transparency: 'src/screens/TransparencyScreenV3.tsx',
} as const

describe('Home’s product cards', () => {
  it('has the four products, in the plan’s order', () => {
    expect(HOME_PRODUCTS).toEqual(['venus', 'copilot', 'token', 'transparency'])
  })

  it('opens a page that exists for every card', () => {
    for (const product of HOME_PRODUCTS) {
      const route = HOME_PRODUCT_LOOK[product].route
      // `/(app)/venus` is `app/(app)/venus.tsx`.
      expect(existsSync(path.join('app', `${route.slice(1)}.tsx`)), route).toBe(true)
    }
  })

  it('wears the colour and the mark its own page opens with', () => {
    for (const product of HOME_PRODUCTS) {
      const { tone, mark } = HOME_PRODUCT_LOOK[product]
      const source = readFileSync(SCREENS[product], 'utf8')
      expect(source, product).toContain(`mark="${mark}"`)
      expect(
        source.includes(`tone="${tone}"`) || source.includes(`TONE = '${tone}'`),
        `${product} is ${tone}`,
      ).toBe(true)
    }
  })

  it('names every card in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const product of HOME_PRODUCTS) {
        const key = HOME_PRODUCT_NAMES[product]
        expect(t(key), `${locale} ${key}`).not.toBe(key)
      }
    }
  })
})

describe('homeProductLines', () => {
  const stickers = en('stickerPack.count', { count: STICKERS })

  it('says each live number, from the data it is handed', () => {
    const lines = homeProductLines(en, 'en', {
      member: true,
      venusDay: 12,
      balance: 1240,
      members: 12345,
    })
    expect(lines).toEqual({
      venus: `${stickers} · Day 12`,
      copilot: 'Beta',
      token: '1,240 tokens',
      transparency: '12,345 members',
    })
  })

  it('takes the plural entry for a count of one', () => {
    const lines = homeProductLines(en, 'en', { member: true, balance: 1, members: 1 })
    expect(lines.token).toBe('1 token')
    expect(lines.transparency).toBe('1 member')
  })

  it('counts members with every form Russian and Arabic have', () => {
    const ru = createTranslate('ru')
    const members = (count: number) =>
      homeProductLines(ru, 'ru', { member: true, members: count }).transparency
    expect(members(1)).toBe('1 участник')
    expect(members(3)).toBe('3 участника')
    expect(members(5)).toBe(`5 участников`)
    expect(members(12345)).toBe(`${formatCount(12345, 'ru')} участников`)

    const ar = createTranslate('ar')
    const arMembers = (count: number) =>
      homeProductLines(ar, 'ar', { member: true, members: count }).transparency
    expect(arMembers(1)).toBe('عضو واحد')
    expect(arMembers(2)).toBe('عضوان')
    expect(arMembers(3)).toBe(`${formatCount(3, 'ar')} أعضاء`)
  })

  it('groups digits the reader’s way', () => {
    const de = createTranslate('de')
    expect(homeProductLines(de, 'de', { member: true, members: 12345 }).transparency).toBe(
      `${formatCount(12345, 'de')} Mitglieder`,
    )
    expect(formatCount(12345, 'de')).toBe('12.345')
  })

  it('says something true without a zero while a number is on its way', () => {
    const lines = homeProductLines(en, 'en', { member: true })
    expect(lines.venus).toBe(stickers)
    expect(lines.token).toBe(en('tokens.page.factPoints'))
    expect(lines.transparency).toBe(en('transparency.page.factOpenSource'))
  })

  it('gives a guest no balance, and what an account starts with instead', () => {
    // A balance handed in by mistake is still not a guest's to see.
    const lines = homeProductLines(en, 'en', { member: false, balance: 1240, members: 12345 })
    expect(lines.token).toBe(
      en('tokens.page.guestTitle', {
        count: TOKEN_RULES.signupBonus,
        amount: TOKEN_RULES.signupBonus.toLocaleString('en'),
      }),
    )
    expect(lines.token).not.toContain('1,240')
    expect(lines.venus).toBe(stickers)
    expect(lines.transparency).toBe('12,345 members')
  })

  it('fills every placeholder in every language, for an account and a guest', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const facts of [
        { member: true, venusDay: 12, balance: 1240, members: 12345 },
        { member: true, venus: 'ready' as const, venusDay: 12 },
        { member: true },
        { member: false, members: 2 },
      ]) {
        for (const [product, line] of Object.entries(homeProductLines(t, locale, facts))) {
          expect(line.trim(), `${locale} ${product}`).not.toBe('')
          expect(line, `${locale} ${product}`).not.toMatch(/[{}]/)
        }
      }
    }
  })
})

describe('Venus’s card', () => {
  const video: VenusVideo = {
    day: 12,
    locale: 'en',
    cut: 'day',
    dayKey: '2026-10-27',
    fileName: 'venus-day012-en.mp4',
    url: 'https://media.example/venus/en/venus-day012-en.mp4',
    coverUrl: null,
  }
  const stickers = en('stickerPack.count', { count: STICKERS })
  const line = (venus: ReturnType<typeof streakRowVenus>) =>
    homeProductLines(en, 'en', { member: true, venus, venusDay: video.day }).venus

  it('offers today’s video with the dot, and says it is ready, until it is watched', () => {
    const venus = streakRowVenus(video, {}, 'me')
    expect(homeVenusCard(venus)).toEqual({ play: true, ready: true })
    expect(line(venus)).toBe('Today’s video is ready')
  })

  it('keeps ▶ for a replay once it is watched, and goes back to her own line', () => {
    const venus = streakRowVenus(video, { me: video.dayKey }, 'me')
    expect(homeVenusCard(venus)).toEqual({ play: true, ready: false })
    expect(line(venus)).toBe(`${stickers} · Day 12`)
  })

  it('claims nothing about watching until the device has said what was watched', () => {
    const venus = streakRowVenus(video, undefined, 'me')
    expect(homeVenusCard(venus)).toEqual({ play: true, ready: false })
    expect(line(venus)).toBe(`${stickers} · Day 12`)
  })

  it('has no ▶ and no dot without a video, and keeps her line', () => {
    const venus = streakRowVenus(null, {}, 'me')
    expect(homeVenusCard(venus)).toEqual({ play: false, ready: false })
    expect(homeProductLines(en, 'en', { member: true, venus }).venus).toBe(stickers)
  })

  it('says the video is ready in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      const ready = homeProductLines(t, locale, { member: true, venus: 'ready', venusDay: 12 })
      expect(ready.venus, locale).toBe(t('home.streakRow.venusReady'))
      expect(ready.venus, locale).not.toBe('home.streakRow.venusReady')
    }
  })
})

describe('homeCardsBeside', () => {
  it('stacks the cards at the larger text sizes, whatever the words', () => {
    expect(homeCardsBeside({ stacked: true, inner: 400, words: [10] })).toBe(false)
  })

  it('keeps them side by side until anything is measured', () => {
    expect(homeCardsBeside({ stacked: false, inner: 0, words: [] })).toBe(true)
    expect(homeCardsBeside({ stacked: false, inner: 130, words: [] })).toBe(true)
  })

  it('stacks them once any word would not fit half a row', () => {
    expect(homeCardsBeside({ stacked: false, inner: 130, words: [60, 129.5] })).toBe(true)
    expect(homeCardsBeside({ stacked: false, inner: 130, words: [60, 131] })).toBe(false)
  })
})

describe('columnInner', () => {
  it('is 0 until the row is measured, which keeps the columns', () => {
    const inner = columnInner({ width: 0, columns: 3, gap: 6, inset: 2 })
    expect(inner).toBe(0)
    expect(homeCardsBeside({ stacked: false, inner, words: [500] })).toBe(true)
  })

  it('shares the row out less the gaps, then takes each column’s inset', () => {
    // Home's cards: two halves with a 10pt gap and 14pt of padding.
    expect(columnInner({ width: 343, columns: 2, gap: 10, inset: 14 })).toBe(138.5)
    // Today's three: a 375pt phone leaves the goals a 315pt row.
    expect(columnInner({ width: 315, columns: 3, gap: 6, inset: 2 })).toBe(97)
  })

  it('puts Today’s three in rows only once a goal’s word is wider than a column', () => {
    const inner = columnInner({ width: 315, columns: 3, gap: 6, inset: 2 })
    // A word with room to spare, and one a point too wide.
    expect(homeCardsBeside({ stacked: false, inner, words: [60, 93] })).toBe(true)
    expect(homeCardsBeside({ stacked: false, inner, words: [60, 98] })).toBe(false)
    // The same words, a narrower phone: the 93pt word no longer fits.
    const narrow = columnInner({ width: 290, columns: 3, gap: 6, inset: 2 })
    expect(homeCardsBeside({ stacked: false, inner: narrow, words: [60, 93] })).toBe(false)
  })
})

describe('measuredWords', () => {
  it('splits at spaces, as before', () => {
    expect(measuredWords('  Karten   wiederholen ')).toEqual(['Karten', 'wiederholen'])
    expect(measuredWords('')).toEqual([])
  })

  it('splits Russian’s goal after its hyphen, where a line breaks it', () => {
    // The goal itself, from the catalogue, so a new wording is still covered.
    const label = createTranslate('ru')('home.streakChats')
    expect(label).toContain('кому-нибудь')
    expect(measuredWords(label)).toEqual(['Написать', 'кому-', 'нибудь'])
  })

  it('keeps every hyphen with the piece before it', () => {
    expect(measuredWords('Ende-zu-Ende-verschlüsselt')).toEqual([
      'Ende-',
      'zu-',
      'Ende-',
      'verschlüsselt',
    ])
    expect(measuredWords('E-Mail-Adresse')).toEqual(['E-', 'Mail-', 'Adresse'])
  })

  it('leaves whole a hyphen no line breaks at', () => {
    // Before a figure in any script, leading, doubled, or at the end.
    expect(measuredWords('COVID-19')).toEqual(['COVID-19'])
    expect(measuredWords('كوفيد-١٩')).toEqual(['كوفيد-١٩'])
    expect(measuredWords('-5')).toEqual(['-5'])
    expect(measuredWords('a--b')).toEqual(['a--b'])
    expect(measuredWords('Audio-')).toEqual(['Audio-'])
  })

  it('keeps Today’s three in columns in Russian once the word is measured in two', () => {
    // A 375pt phone's goals row, as above, and the Russian goals' words as
    // the web build draws them: "кому-нибудь" whole is wider than a column,
    // "кому-" and "нибудь" are not, and "Повторить" is now the widest.
    const inner = columnInner({ width: 315, columns: 3, gap: 6, inset: 2 })
    const others = [75.3, 61.3, 61.1, 85.6, 74.4]
    expect(homeCardsBeside({ stacked: false, inner, words: [...others, 102.7] })).toBe(false)
    expect(homeCardsBeside({ stacked: false, inner, words: [...others, 45.7, 57] })).toBe(true)
  })

  it('cuts every locale’s goals after each hyphen between letters, and nowhere else', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const key of ['home.streakChats', 'home.todayCorrect', 'home.streakEcho'] as const) {
        const where = `${locale} ${key}`
        const words = t(key).split(/\s+/).filter(Boolean)
        expect(measuredWords(t(key)), where).toEqual(words.flatMap((word) => measuredWords(word)))
        for (const word of words) {
          const pieces = measuredWords(word)
          expect(pieces.join(''), where).toBe(word)
          pieces.forEach((piece, at) => {
            // No piece still holds a place a line breaks…
            expect(piece, where).not.toMatch(/\p{L}-\p{L}/u)
            // …and every cut is one: after a letter's hyphen, before a letter.
            if (at < pieces.length - 1) expect(piece, where).toMatch(/\p{L}-$/u)
            if (at > 0) expect(piece, where).toMatch(/^\p{L}/u)
          })
        }
      }
    }
  })
})
