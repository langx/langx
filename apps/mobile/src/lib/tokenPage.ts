import type Feather from '@expo/vector-icons/Feather'
import {
  COSMETICS,
  STICKER_GIFT_RULES,
  TOKEN_RULES,
  findCosmetic,
  isGiftableCosmetic,
  type CosmeticKind,
  type Locale,
  type TokenSummary,
} from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'
import { TOKEN_SITE } from './externalLinks'
import { todayBreakdown } from './poolBreakdown'
import { tokenAmountLabel, tokenSlot } from './tokenAmount'

/*
 * Every word on LangX Token's page (`TokenScreenV3`), built here rather than
 * in the screen so that `tokenPage.test.ts` can read the page exactly as it is
 * drawn, in all eight languages, and hold it to `docs/token-messaging-brief.md`.
 * That page is the one App Review reads against guideline 3.1.5(b), so a
 * banned word on it is a rejection, not a style slip — and a test over the
 * catalogue alone would miss a line the screen borrows from another
 * namespace, or a number it fills in.
 *
 * Every number comes from `TOKEN_RULES` or the catalogue and is printed in
 * the reader's digits. Nothing is added up for the copy: where the page needs
 * a figure the rules do not hold as one (the most a pool share can be), it is
 * worked out here, from the rules, the way the pool screen already does.
 */

type Glyph = keyof typeof Feather.glyphMap

/** Where a row goes. The screen owns the routes; this says only which. */
export type TokenPageTarget =
  'wallet' | 'pool' | 'leaderboard' | 'store' | 'frames' | 'titles' | 'stickers' | 'venus'

export interface TokenPageRow {
  key: string
  icon: Glyph
  title: string
  body: string
  /** A readout at the row's end, holding `TOKEN_MARK` where the spark goes: "+10 ✦". */
  value?: string
  /** `value` as a screen reader says it: "+10 tokens". */
  valueLabel?: string
  to?: TokenPageTarget
}

export interface TokenPageCopy {
  hero: { title: string; tagline: string; facts: string[] }
  earn: { title: string; rows: TokenPageRow[] }
  pool: { title: string; intro: string; steps: { key: string; title: string; body: string }[] }
  spend: { title: string; rows: TokenPageRow[] }
  not: { title: string; rows: { key: string; title: string; body: string }[] }
  faq: { key: string; question: string; answer: string }[]
  link: { title: string; url: string }
}

/** The pack the page links on its own, as Venus's page links back to it. */
export const VENUS_PACK_ID = 'stickers.venus'

/**
 * token.langx.io's language folders — each one checked on 27 October 2026 to
 * answer in its own language. English is the root, and so is any language the
 * site does not have: a `Record` over every locale, so adding one to the app
 * means deciding here whether the site has it.
 */
const TOKEN_SITE_FOLDERS: Record<Locale, string | null> = {
  en: null,
  tr: 'tr',
  es: 'es',
  ru: 'ru',
  ar: 'ar',
  fr: 'fr',
  de: 'de',
  'pt-BR': 'pt-br',
}

/** token.langx.io in the reader's language: `/tr/`, `/pt-br/`, or the root. */
export function tokenSiteUrl(locale: Locale): string {
  const folder = TOKEN_SITE_FOLDERS[locale]
  return folder ? `${TOKEN_SITE}/${folder}/` : `${TOKEN_SITE}/`
}

/** The most one person's share of a day's pool can be — what `poolShare` clamps to. */
export function poolShareCap(): number {
  return Math.floor(TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool)
}

function countOf(kind: CosmeticKind): number {
  return COSMETICS.filter((cosmetic) => cosmetic.kind === kind).length
}

/**
 * Everything on the page that is the same for every reader.
 *
 * `stickerGifts` is the flag of that name: the row on giving a pack is drawn
 * only while it is on, because with it off no pack page has a Give button and
 * the row would offer something the app does not do.
 */
export function tokenPageCopy(
  t: TranslateFn,
  locale: Locale,
  { stickerGifts = false }: { stickerGifts?: boolean } = {},
): TokenPageCopy {
  const n = (value: number) => value.toLocaleString(locale)
  // A token amount as a readout: the number beside the spark, and the words
  // a screen reader says instead.
  const earned = (amount: number) => ({
    value: tokenSlot(t, amount, locale, '+'),
    valueLabel: tokenAmountLabel(t, amount, locale, '+'),
  })
  const price = (amount: number) => ({
    value: tokenSlot(t, amount, locale),
    valueLabel: tokenAmountLabel(t, amount, locale),
  })

  const { award, caps, sinks, pool, referral } = TOKEN_RULES
  const milestones = Object.keys(TOKEN_RULES.streakMilestones)
    .map(Number)
    .sort((a, b) => a - b)
  const firstMilestone = milestones[0] ?? 0
  const lastMilestone = milestones.at(-1) ?? 0
  // Read off the pack itself: the plan said thirty, the pack holds sixty.
  const venusStickers = findCosmetic(VENUS_PACK_ID)?.stickers?.length ?? 0
  const frames = countOf('frame')
  const titles = countOf('title')
  const packs = countOf('stickers')
  // A gift is a new copy bought at the pack's own price, so what one costs
  // at the least is the cheapest pack that can be given.
  const giftPrices = COSMETICS.filter(isGiftableCosmetic).map((cosmetic) => cosmetic.price)

  /**
   * Giving a pack: onward to the packs, where each one's page has the Give
   * button. The price is in the words, as the packs' own row leaves it to
   * each pack: "from 1,000" as a readout took half the row and left the
   * sentence a word a line.
   */
  function giftRow(from: number): TokenPageRow {
    const { sendsPerWeek } = STICKER_GIFT_RULES
    return {
      key: 'giftPack',
      icon: 'gift',
      title: t('tokens.page.giftTitle'),
      body: `${t('tokens.page.giftBody', {
        amount: tokenAmountLabel(t, from, locale),
      })} ${t('tokens.page.giftWeekly', { count: sendsPerWeek, amount: n(sendsPerWeek) })}`,
      to: 'stickers',
    }
  }

  const spendRows: TokenPageRow[] = [
    {
      key: 'freeze',
      icon: 'shield',
      title: t('store.streakFreeze'),
      body: `${t('tokens.page.freezeBody')} ${t('tokens.page.freezeKeep', {
        count: sinks.maxBankedStreakFreezes,
        amount: n(sinks.maxBankedStreakFreezes),
      })}`,
      ...price(sinks.streakFreeze),
      to: 'store',
    },
    {
      key: 'repair',
      icon: 'rotate-ccw',
      title: t('tokens.page.repairTitle'),
      body: `${t('tokens.page.repairWindow', {
        count: sinks.dayRepairMaxAgeDays,
        amount: n(sinks.dayRepairMaxAgeDays),
      })} ${t('tokens.page.repairMonthly', {
        count: sinks.dayRepairPerMonth,
        amount: n(sinks.dayRepairPerMonth),
      })}`,
      ...price(sinks.dayRepair),
      to: 'store',
    },
    {
      key: 'frames',
      icon: 'user',
      title: t('store.frames'),
      body: t('storeHome.framesBody', { count: frames }),
      to: 'frames',
    },
    {
      key: 'titles',
      icon: 'tag',
      title: t('store.titles'),
      body: t('tokens.page.titlesBody', { count: titles, amount: n(titles) }),
      to: 'titles',
    },
    {
      key: 'stickers',
      icon: 'smile',
      title: t('store.stickers'),
      body: t('storeHome.packsBody', { count: packs }),
      to: 'stickers',
    },
    ...(stickerGifts && giftPrices.length > 0 ? [giftRow(Math.min(...giftPrices))] : []),
    {
      key: 'venus',
      icon: 'heart',
      title: t('tokens.page.venusTitle'),
      body: t('tokens.page.venusBody', { count: venusStickers, amount: n(venusStickers) }),
      value: t('tokens.page.free'),
      to: 'venus',
    },
  ]

  return {
    hero: {
      title: t('tokens.page.title'),
      tagline: t('tokens.page.tagline'),
      facts: [
        t('tokens.page.factPoints'),
        t('tokens.page.factBought'),
        t('tokens.page.factTraded'),
      ],
    },
    earn: {
      title: t('tokens.page.earn'),
      rows: [
        {
          key: 'message',
          icon: 'message-circle',
          title: t('tokenKind.message'),
          body: t('tokens.page.messagesBody', {
            perDay: n(caps.messagesPerDay),
            perPartner: n(caps.messagesPerPartnerPerDay),
          }),
          ...earned(award.message),
        },
        {
          key: 'correction',
          icon: 'edit-3',
          title: t('tokenKind.correction'),
          body: t('tokens.page.correctionsBody', {
            perPartner: n(caps.correctionsPerPartnerPerDay),
          }),
          ...earned(award.correction),
        },
        {
          key: 'pronunciation',
          icon: 'mic',
          title: t('tokenKind.pronunciation'),
          body: t('tokens.page.pronunciationBody'),
          ...earned(award.pronunciation),
        },
        {
          key: 'mutual',
          icon: 'repeat',
          title: t('tokens.page.mutualTitle'),
          body: t('tokens.page.mutualBody'),
          ...earned(award.mutualConversation),
        },
        {
          key: 'echo',
          icon: 'layers',
          title: t('tokenKind.echo'),
          body: t('tokens.page.echoBody', { perDay: n(caps.echoSessionsPerDay) }),
          ...earned(award.echoSession),
        },
        {
          key: 'streak',
          icon: 'trending-up',
          title: t('tokenKind.streak'),
          body: t('tokens.page.streakBody', {
            count: lastMilestone,
            first: n(firstMilestone),
            last: n(lastMilestone),
          }),
        },
        {
          key: 'invite',
          icon: 'user-plus',
          title: t('tokenKind.referral'),
          body: t('tokens.page.inviteBody', { amount: n(referral.inviteeTotal) }),
          ...earned(referral.activation),
        },
        {
          key: 'gift',
          icon: 'gift',
          title: t('gift.title'),
          body: t('gift.body'),
        },
      ],
    },
    pool: {
      title: t('tokens.page.pool'),
      intro: t('tokens.page.poolIntro', { count: pool.total, amount: n(pool.total) }),
      steps: [
        {
          key: 'take-part',
          title: t('tokens.page.poolTakePart'),
          body: t('tokens.page.poolTakePartBody'),
        },
        {
          key: 'shared',
          title: t('tokens.page.poolShared'),
          body: t('tokens.page.poolSharedBody'),
        },
        {
          key: 'arrives',
          title: t('tokens.page.poolArrives'),
          body: t('tokens.page.poolArrivesBody', {
            hour: pool.payoutHourUtc,
            cap: n(poolShareCap()),
          }),
        },
      ],
    },
    spend: { title: t('tokens.page.spend'), rows: spendRows },
    not: {
      title: t('tokens.page.not'),
      rows: [
        { key: 'sale', title: t('tokens.page.notSale'), body: t('tokens.page.notSaleBody') },
        { key: 'cash', title: t('tokens.page.notCash'), body: t('tokens.page.notCashBody') },
        { key: 'crypto', title: t('tokens.page.notCrypto'), body: t('tokens.page.notCryptoBody') },
        { key: 'pro', title: t('tokens.page.notPro'), body: t('tokens.page.notProBody') },
      ],
    },
    faq: [
      {
        key: 'crypto',
        question: t('tokens.page.faq.crypto'),
        answer: t('tokens.page.faq.cryptoAnswer'),
      },
      {
        key: 'price',
        question: t('tokens.page.faq.price'),
        answer: t('tokens.page.faq.priceAnswer'),
      },
      { key: 'send', question: t('tokens.page.faq.send'), answer: t('tokens.page.faq.sendAnswer') },
      {
        key: 'spend',
        question: t('tokens.page.faq.spend'),
        answer: t('tokens.page.faq.spendAnswer'),
      },
      { key: 'pro', question: t('tokens.page.faq.pro'), answer: t('tokens.page.faq.proAnswer') },
      {
        key: 'day',
        question: t('tokens.page.faq.day'),
        answer: t('tokens.page.faq.dayAnswer', {
          messages: n(caps.messagesPerDay),
          sessions: n(caps.echoSessionsPerDay),
          cap: n(poolShareCap()),
          corrections: n(caps.correctionsPerPartnerPerDay),
        }),
      },
      { key: 'rank', question: t('tokens.page.faq.rank'), answer: t('tokens.page.faq.rankAnswer') },
      {
        key: 'before',
        question: t('tokens.page.faq.before'),
        answer: t('tokens.page.faq.beforeAnswer', {
          divisor: n(TOKEN_RULES.legacyTokenDivisor),
          bonus: n(TOKEN_RULES.welcomeBackBonus),
        }),
      },
    ],
    link: { title: t('tokens.page.link'), url: tokenSiteUrl(locale) },
  }
}

/** What the "Yours" rows read: whatever has arrived, each part on its own. */
export interface TokenYours {
  balance?: number
  today?: Pick<TokenSummary['today'], 'messages' | 'corrections' | 'distinctPartners'>
  /** This week's place: a number, `null` with nothing earned this week, absent until it loads. */
  rank?: number | null
}

/**
 * An account's own three rows — the balance, today, this week's place — each
 * one a way into the wallet page that holds the whole of it.
 *
 * "Today" is today's counts, never tokens: the summary holds no "earned
 * today", and the pool's share for today is deliberately never projected
 * (`tokenSummarySchema.pool`), so the honest line is what was done.
 */
export function tokenYoursRows(t: TranslateFn, locale: Locale, yours: TokenYours): TokenPageRow[] {
  const { balance, today, rank } = yours
  return [
    {
      key: 'wallet',
      icon: 'credit-card',
      title: t('wallet.title'),
      body: t('tokens.page.walletBody'),
      ...(balance === undefined
        ? {}
        : {
            value: tokenSlot(t, balance, locale),
            valueLabel: tokenAmountLabel(t, balance, locale),
          }),
      to: 'wallet',
    },
    {
      key: 'today',
      icon: 'activity',
      title: t('tokens.todaySoFar'),
      body: today ? todayBreakdown(t, today) : t('tokens.page.todayFallback'),
      to: 'pool',
    },
    {
      key: 'rank',
      icon: 'bar-chart-2',
      title: t('leaderboard.placeWeek'),
      body: rank === null ? t('tokens.page.rankNone') : t('tokens.page.rankBody'),
      ...(typeof rank === 'number'
        ? { value: t('tokens.page.rank', { rank: rank.toLocaleString(locale) }) }
        : {}),
      to: 'leaderboard',
    },
  ]
}

/** A guest's line where "Yours" would be: what an account starts with, and the way to one. */
export function tokenGuestRow(t: TranslateFn, locale: Locale): TokenPageRow {
  return {
    key: 'guest',
    icon: 'user-plus',
    title: t('tokens.page.guestTitle', {
      count: TOKEN_RULES.signupBonus,
      amount: TOKEN_RULES.signupBonus.toLocaleString(locale),
    }),
    body: t('tokens.page.guestBody'),
  }
}
