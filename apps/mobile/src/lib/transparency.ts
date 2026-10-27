import {
  ACCOUNT_DELETION_GRACE_DAYS,
  PUBLIC_STATS_TTL_MS,
  type PublicStatsDay,
} from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n/runtime'
import { allExternalLinks, type ExternalLink } from './externalLinks'

/**
 * The Transparency page's arithmetic and wording, apart from the screen so
 * vitest can reach it (`screens/TransparencyScreenV3.tsx`).
 */

/**
 * A count in the reader's own way of writing numbers — `12,345`, `12.345`,
 * `12 345` — as the platform's locale data has it. Never shortened: the page
 * exists to say exactly how many, and `12k` would round the one thing it
 * promises away.
 */
export function formatCount(value: number, locale: string): string {
  return value.toLocaleString(locale)
}

/**
 * How long the server keeps an answer, in the minutes the page says it in:
 * "at most once every 10 minutes". Read from the server's own constant, so
 * the sentence cannot outlive a change to it.
 */
export const COUNTED_EVERY_MINUTES = Math.round(PUBLIC_STATS_TTL_MS / 60_000)

/**
 * The longest a total can be, written out, and still be set in Title in a
 * half-width tile on a 375pt phone at the largest text size the tile allows:
 * "12,345" fits there and "123,456" does not.
 */
export const TOTALS_TITLE_CHARS = 6

/**
 * The type step for the four totals, chosen once for all four so they stay
 * one size side by side: Title while every one fits, Headline once any one
 * is longer. Never shortened to "123k" instead — see `formatCount`.
 */
export function totalsStep(shown: readonly string[]): 'title' | 'headline' {
  return shown.every((text) => text.length <= TOTALS_TITLE_CHARS) ? 'title' : 'headline'
}

/** The three series the 30-day chart switches between. */
export const TRANSPARENCY_METRICS = ['members', 'messages', 'corrections'] as const
export type TransparencyMetric = (typeof TRANSPARENCY_METRICS)[number]

/** One series as the chart's columns, oldest day first, as the server sends them. */
export function seriesOf(
  daily: readonly PublicStatsDay[],
  metric: TransparencyMetric,
): { key: string; value: number }[] {
  return daily.map((day) => ({ key: day.day, value: day[metric] }))
}

/** Everything one series counted across the window. */
export function seriesTotal(daily: readonly PublicStatsDay[], metric: TransparencyMetric): number {
  return daily.reduce((sum, day) => sum + day[metric], 0)
}

/**
 * "Counted 4 minutes ago", from when the server counted, not from when the
 * answer arrived — a kept answer can be most of twenty minutes old (ten on
 * the server, ten more in a cache on the way), and the page says so rather
 * than implying the numbers are live. A clock that runs ahead of the server's
 * reads as "just now", never as a time in the future.
 */
export function countedAgo(generatedAt: string, t: TranslateFn, now: Date = new Date()): string {
  const at = Date.parse(generatedAt)
  if (Number.isNaN(at)) return ''
  const minutes = Math.floor(Math.max(0, now.getTime() - at) / 60_000)
  if (minutes < 1) return t('transparency.page.countedNow')
  if (minutes < 60) return t('transparency.page.countedMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('transparency.page.countedHours', { count: hours })
  return t('transparency.page.countedDays', { count: Math.floor(hours / 24) })
}

/** The Kitchen rows the page's support section draws, by the words they already carry. */
export const SUPPORT_LINKS = ['kitchen.sponsor', 'kitchen.patron', 'kitchen.joinDiscord'] as const

/** The Kitchen rows for taking part in the project itself. */
export const TAKE_PART_LINKS = [
  'kitchen.fundamentals',
  'kitchen.issues',
  'kitchen.releases',
] as const

/**
 * Rows of `externalLinks.ts` by their label key, in the order asked for.
 *
 * Read from that table rather than written out again, so the page and Our
 * Kitchen can never send a person to two different places for one name. A
 * key that matches nothing is left out rather than drawn as a dead row; the
 * test holds every key the page asks for to a row that exists.
 */
export function linksFor(keys: readonly MessageKey[]): ExternalLink[] {
  const all = allExternalLinks()
  return keys.flatMap((key) => {
    const link = all.find((row) => row.labelKey === key)
    return link ? [link] : []
  })
}

/** The one row of the table the page's link card opens: insight.langx.io. */
export function insightLink(): ExternalLink | undefined {
  return linksFor(['kitchen.insights'])[0]
}

/** A row's name: its brand, or its words in the reader's language. */
export function linkTitle(link: ExternalLink, t: TranslateFn): string {
  return link.label ?? (link.labelKey ? t(link.labelKey) : link.url)
}

export interface TransparencyQuestion {
  key: string
  question: string
  answer: string
}

/**
 * The page's questions, worded. Here rather than in the screen so a test can
 * read every answer in every language, filled in: the numbers come from
 * `packages/shared` and the names of the places they point to from the
 * catalogue, so an answer cannot name a row by a word the row does not use.
 *
 * Twelve, past the six to eight the other product pages keep to, because
 * the plan asks this page to answer each of them and none is the site's to
 * answer instead: each one is a question about trust, and a page about
 * trust that sends the hard ones elsewhere has answered them.
 */
export function transparencyQuestions(t: TranslateFn): TransparencyQuestion[] {
  const q = (key: string, question: MessageKey, answer: string) => ({
    key,
    question: t(question),
    answer,
  })
  return [
    q('real', 'transparency.page.qReal', t('transparency.page.aReal')),
    q('revenue', 'transparency.page.qRevenue', t('transparency.page.aRevenue')),
    q('guests', 'transparency.page.qGuests', t('transparency.page.aGuests')),
    q(
      'updates',
      'transparency.page.qUpdates',
      t('transparency.page.aUpdates', { count: COUNTED_EVERY_MINUTES }),
    ),
    q('mine', 'transparency.page.qMine', t('transparency.page.aMine')),
    q('open', 'transparency.page.qOpen', t('transparency.page.aOpen')),
    q('safe', 'transparency.page.qSafe', t('transparency.page.aSafe')),
    q('e2e', 'transparency.page.qE2E', t('transparency.page.aE2E')),
    q(
      'export',
      'transparency.page.qExport',
      t('transparency.page.aExport', {
        count: ACCOUNT_DELETION_GRACE_DAYS,
        settings: t('settings.title'),
        account: t('settings.accountSection'),
        exportData: t('settings.exportData'),
        deleteAccount: t('settings.deleteAccount'),
      }),
    ),
    q(
      'contribute',
      'transparency.page.qContribute',
      t('transparency.page.aContribute', {
        contribute: t('transparency.page.contribute'),
        issues: t('kitchen.issues'),
      }),
    ),
    q('support', 'transparency.page.qSupport', t('transparency.page.aSupport')),
    q(
      'vulnerability',
      'transparency.page.qVulnerability',
      t('transparency.page.aVulnerability', { policy: t('transparency.page.securityLink') }),
    ),
  ]
}
