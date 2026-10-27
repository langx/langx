import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { COSMETICS, SUPPORTED_LOCALES, TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  HOME_PRODUCT_LOOK,
  HOME_PRODUCT_NAMES,
  HOME_PRODUCTS,
  homeCardsBeside,
  homeProductLines,
  homeVenusCard,
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

describe('the LangX section', () => {
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
      expect(t('home.products.title')).not.toBe('home.products.title')
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

describe('homeVenusCard', () => {
  const video: VenusVideo = {
    day: 12,
    locale: 'en',
    cut: 'day',
    dayKey: '2026-10-27',
    fileName: 'venus-day012-en.mp4',
    url: 'https://media.example/venus/en/venus-day012-en.mp4',
    coverUrl: null,
  }

  it('offers today’s video, with the dot, until it is watched', () => {
    expect(homeVenusCard(streakRowVenus(video, {}, 'me'))).toEqual({
      line: 'home.streakRow.venusReady',
      play: true,
      dot: true,
    })
  })

  it('keeps ▶ for a replay once it is watched, and drops the dot', () => {
    expect(homeVenusCard(streakRowVenus(video, { me: video.dayKey }, 'me'))).toEqual({
      line: 'home.streakRow.venusWatched',
      play: true,
      dot: false,
    })
  })

  it('says neither seen nor ready until the device has said what was watched', () => {
    expect(homeVenusCard(streakRowVenus(video, undefined, 'me'))).toEqual({
      line: 'home.streakRow.venusMeet',
      play: true,
      dot: false,
    })
  })

  it('is there without a video, with no ▶, inviting a person to meet her', () => {
    expect(homeVenusCard(streakRowVenus(null, {}, 'me'))).toEqual({
      line: 'home.streakRow.venusMeet',
      play: false,
      dot: false,
    })
  })

  it('says each state in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const state of ['ready', 'watched', 'unknown', 'none'] as const) {
        const { line } = homeVenusCard(state)
        expect(t(line), `${locale} ${state}`).not.toBe(line)
      }
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
