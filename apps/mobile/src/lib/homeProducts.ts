import { COSMETICS, TOKEN_RULES, type Locale } from '@langx/shared'
import type { ProductMarkName } from '../components/product/ProductMark'
import type { ProductTone } from '../components/product/tone'
import type { MessageKey, TranslateFn } from '../i18n/runtime'
import { tokenAmountLabel } from './tokenAmount'
import { VENUS_PACK_ID } from './tokenPage'
import { formatCount } from './transparency'
import type { StreakRowVenus } from './venusStreakRow'

/*
 * Home's "LangX" section (plan #2067, §8): a card for each product page,
 * Venus's carrying today's video (decision 1 of 27 Oct). What each card says
 * is decided here, apart from the screen, so vitest can read it in every
 * language.
 */

/** The section's cards, in the plan's order. */
export const HOME_PRODUCTS = ['venus', 'copilot', 'token', 'transparency'] as const
export type HomeProduct = (typeof HOME_PRODUCTS)[number]

/**
 * Each card's colour, mark and page: the colour and mark its own page opens
 * with (`ProductHero` on `VenusScreenV3`, `CopilotScreenV3`, `TokenScreenV3`
 * and `TransparencyScreenV3`), so a card and the page it opens look like one
 * thing. `components/product/tone.ts` says why each colour is the one it is.
 */
export const HOME_PRODUCT_LOOK = {
  venus: { tone: 'sky', mark: 'venus', route: '/(app)/venus' },
  copilot: { tone: 'blue', mark: 'copilot', route: '/(app)/copilot' },
  token: { tone: 'lime', mark: 'token', route: '/(app)/token' },
  transparency: { tone: 'mint', mark: 'transparency', route: '/(app)/transparency' },
} as const satisfies Record<
  HomeProduct,
  { tone: ProductTone; mark: ProductMarkName; route: string }
>

/** Each card's name: the title its page carries, or the product's own name. */
export const HOME_PRODUCT_NAMES = {
  venus: 'venus.page.title',
  copilot: 'home.products.copilot',
  token: 'tokens.page.title',
  transparency: 'transparency.page.title',
} as const satisfies Record<HomeProduct, MessageKey>

/** Venus's free pack, counted from the catalogue as her page counts it. */
const VENUS_STICKERS =
  COSMETICS.find((cosmetic) => cosmetic.id === VENUS_PACK_ID)?.stickers?.length ?? 0

/** What the cards can say live: each part absent until it is known. */
export interface HomeProductFacts {
  /** An account, not a guest. Only an account has a balance. */
  member: boolean
  /** The day of today's Venus video, when the bucket holds one for today. */
  venusDay?: number | undefined
  /** What Home makes of today's Venus video (`streakRowVenus`); none for a guest. */
  venus?: StreakRowVenus | undefined
  /** The wallet's balance, once it has arrived. */
  balance?: number | undefined
  /** `GET /public/stats`'s count of members, once it has arrived. */
  members?: number | undefined
}

/**
 * Each card's one line under its name. Every number in it is read from the
 * data or the code — the catalogue, `TOKEN_RULES`, the wallet, the public
 * stats — and while a number is on its way, or for a guest who has none, the
 * line is something true without it rather than a zero or a skeleton:
 *
 * - Venus: "Today's video is ready" while it waits to be watched
 *   (`homeVenusCard`); otherwise her pack's size, and today's video's day
 *   once there is one.
 * - Copilot: "Beta", in the paywall's phrasing (`paywall.betaTag`).
 * - LangX Token: an account's balance; for a guest, what an account starts
 *   with, as the Token page tells one.
 * - Transparency: the member count from the public stats; until it arrives,
 *   or if it cannot, "Open source".
 */
export function homeProductLines(
  t: TranslateFn,
  locale: Locale,
  facts: HomeProductFacts,
): Record<HomeProduct, string> {
  const stickers = t('stickerPack.count', { count: VENUS_STICKERS })
  return {
    venus: homeVenusCard(facts.venus ?? 'none').ready
      ? t('home.streakRow.venusReady')
      : facts.venusDay
        ? `${stickers} · ${t('venus.strip.day', { day: facts.venusDay })}`
        : stickers,
    copilot: t('paywall.betaTag'),
    token: !facts.member
      ? t('tokens.page.guestTitle', {
          count: TOKEN_RULES.signupBonus,
          amount: TOKEN_RULES.signupBonus.toLocaleString(locale),
        })
      : facts.balance === undefined
        ? t('tokens.page.factPoints')
        : tokenAmountLabel(t, facts.balance, locale),
    transparency:
      facts.members === undefined
        ? t('transparency.page.factOpenSource')
        : t('home.products.members', {
            count: facts.members,
            amount: formatCount(facts.members, locale),
          }),
  }
}

/**
 * What Venus's card in the "LangX" section does with today's video, from
 * `streakRowVenus`'s reading of today and no rule of its own:
 *
 * - `ready` — a video not yet watched to its end: ▶ on the card's corner, the
 *   unwatched dot on her mark, and "Today's video is ready" in place of her
 *   line.
 * - `watched` — ▶ stays, for a replay; the dot goes and her line comes back.
 * - `unknown` — a video, but not yet whether it was watched: drawn as
 *   `watched` is, which claims nothing either way, so the card never says
 *   "ready" and then changes its mind.
 * - `none` — no video (flag off, today not counted, no file): no ▶, no dot,
 *   her line. The card opens her page whatever the state.
 */
export interface HomeVenusCard {
  /** A ▶ on the card's corner that plays today's video. */
  play: boolean
  /** The unwatched dot on her mark, and "Today's video is ready" for her line. */
  ready: boolean
}

export function homeVenusCard(state: StreakRowVenus): HomeVenusCard {
  return { play: state !== 'none', ready: state === 'ready' }
}

/**
 * Whether two cards sit side by side: when the reader's text size has not
 * stacked them already (`useStacked`), and every word they print fits the
 * inside of a half-width card on one line. `words` are the measured widths of
 * the words the cards print, each at its drawn size; `inner` is what half the
 * row leaves a card once its padding is taken. Until anything is measured the answer is "side
 * by side", the layout of nearly every phone, so measuring only ever takes
 * room away and the cards do not move on a phone where they fit.
 */
export function homeCardsBeside({
  stacked,
  inner,
  words,
}: {
  stacked: boolean
  inner: number
  words: readonly number[]
}): boolean {
  if (stacked) return false
  if (inner <= 0 || words.length === 0) return true
  return words.every((width) => width <= inner)
}
