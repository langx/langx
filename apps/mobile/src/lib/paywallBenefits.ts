import type Feather from '@expo/vector-icons/Feather'
import {
  PLAN_LIMITS,
  PRO_BENEFITS,
  type PlanFeature,
  type PlanLimits,
  type PlanTier,
  type ProBenefit,
} from '@langx/shared'
import type { MessageKey } from '../i18n'
import type { PartnerHue } from './theme/tokens'

/**
 * Copy for every benefit in `PRO_BENEFITS`, keyed by it.
 *
 * `Record<ProBenefit, ...>` is the enforcement: add a benefit to the shared
 * list without writing its copy and this file stops compiling, and there is no
 * way to advertise something the list does not contain. The three definitions
 * of "what Pro is" — the shared list, the rules test and the paywall — used to
 * be independent, so the first one to change made the other two lie.
 *
 * `shipped` exists because a plan can be sold before one of its features
 * lands, but a screen that describes it in the present tense while it does
 * nothing is selling something that does not exist. Making it a required
 * field means a feature cannot ship quietly half-true: someone has to come
 * back and flip it, which is what happened to `nearby` and `copilot`.
 *
 * `beta` is the step after: the feature works and every plan has it, but it is
 * still called a beta — Copilot, whose answers Pro only gives more of. So it is
 * named with its qualifier wherever it is listed, its numbers are the plans'
 * own, and it is never the reason the paywall says a refused feature "is part
 * of Pro": the free plan has it too.
 *
 * Here rather than in the screen so that the comparison below, which a test
 * can reach, reads the same `shipped` and `beta` the rows do.
 */
export interface BenefitCopy {
  title: MessageKey
  body: MessageKey
  icon: keyof typeof Feather.glyphMap
  /** The tile behind the glyph. A hue, so the rows read as v3's colour blocks. */
  hue: PartnerHue
  /**
   * Interpolated into `body`. Numbers come from `PLAN_LIMITS` rather than
   * being typed out, because a paywall quoting a limit the server no longer
   * enforces is the worst kind of wrong.
   */
  vars?: Record<string, string | number>
  /**
   * The comparison row's label, where the title would contradict the table:
   * "Unlimited new chats" over a free column reading 5. A capability's title
   * already names a thing either plan has or lacks, so it needs none.
   */
  compare?: MessageKey
  shipped: boolean
  /** Shipped and on every plan, but still called a beta. See above. */
  beta?: true
}

export const BENEFIT_COPY: Record<ProBenefit, BenefitCopy> = {
  unlimitedInitiations: {
    title: 'paywall.unlimitedChats',
    body: 'paywall.unlimitedChatsBody',
    icon: 'message-circle',
    hue: 'lilac',
    vars: { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 },
    compare: 'paywall.compareNewChats',
    shipped: true,
  },
  advancedFilters: {
    title: 'paywall.advancedFilters',
    body: 'paywall.advancedFiltersBody',
    icon: 'sliders',
    hue: 'lime',
    shipped: true,
  },
  boostedProfile: {
    title: 'paywall.boostedProfile',
    body: 'paywall.boostedProfileBody',
    icon: 'zap',
    hue: 'tangerine',
    shipped: true,
  },
  profileViewerIdentities: {
    title: 'paywall.whoViewed',
    body: 'paywall.whoViewedBody',
    icon: 'eye',
    hue: 'sky',
    shipped: true,
  },
  incognito: {
    title: 'paywall.incognito',
    body: 'paywall.incognitoBody',
    icon: 'eye-off',
    hue: 'aqua',
    shipped: true,
  },
  nearby: {
    // The body says what it does *and* what it costs the reader, because the
    // second half is the part they would otherwise find out after paying.
    title: 'paywall.nearby',
    body: 'paywall.nearbyBody',
    icon: 'map-pin',
    hue: 'mint',
    shipped: true,
  },
  sendTranslation: {
    title: 'paywall.sendTranslation',
    body: 'paywall.sendTranslationBody',
    icon: 'send',
    hue: 'sky',
    shipped: true,
  },
  deckExport: {
    title: 'paywall.deckExport',
    body: 'paywall.deckExportBody',
    icon: 'download',
    hue: 'lime',
    shipped: true,
  },
  /*
   * Translation sells as the chat allowance above does, by naming the free
   * plan's limit: Pro's has no number to quote. Languages below are the paid
   * number instead, because Pro raises that allowance rather than removing it.
   */
  translationQuota: {
    title: 'paywall.translationQuota',
    body: 'paywall.translationQuotaBody',
    icon: 'globe',
    hue: 'aqua',
    vars: { count: PLAN_LIMITS.free.translationsPer24h ?? 0 },
    compare: 'paywall.compareTranslations',
    shipped: true,
  },
  learningLanguages: {
    title: 'paywall.learningLanguages',
    body: 'paywall.learningLanguagesBody',
    icon: 'book-open',
    hue: 'tangerine',
    vars: { count: PLAN_LIMITS.pro.maxLearningLanguages },
    compare: 'paywall.compareLanguages',
    shipped: true,
  },
  // Sold like translations, by the free plan's number: every plan has
  // Copilot, and what Pro adds is more answers a day.
  copilot: {
    title: 'paywall.copilot',
    body: 'paywall.copilotBody',
    icon: 'cpu',
    hue: 'lilac',
    vars: { count: PLAN_LIMITS.free.copilotPer24h ?? 0 },
    compare: 'paywall.compareCopilot',
    shipped: true,
    beta: true,
  },
  welcomePack: {
    title: 'paywall.welcomePack',
    body: 'paywall.welcomePackBody',
    icon: 'gift',
    hue: 'mint',
    shipped: true,
  },
}

/**
 * The rows the paywall leads with when it opened from a gate; the comparison
 * holds the rest.
 *
 * Chosen for what somebody on the free plan actually runs into — the chat
 * allowance, translations, the viewer list — and for bodies short enough to
 * read at a glance. Opened from a locked feature, that feature takes the first
 * place instead (`highlightsFor`).
 */
const HIGHLIGHTS: readonly ProBenefit[] = [
  'unlimitedInitiations',
  'translationQuota',
  'profileViewerIdentities',
  'advancedFilters',
]

/** How many highlight rows a gate shows: enough to sell, few enough to keep the plans on screen. */
export const HIGHLIGHT_COUNT = 3

export function highlightsFor(refused: PlanFeature | null): readonly ProBenefit[] {
  const lead = refused === null ? HIGHLIGHTS : [refused, ...HIGHLIGHTS.filter((b) => b !== refused)]
  return lead.slice(0, HIGHLIGHT_COUNT)
}

/**
 * What the plan page's "What you have" ticks for somebody on Pro: every
 * benefit, less the welcome pack unless it was handed over. The pack comes
 * with a purchase or a store's free week and never with a gift of Pro (the
 * API's `earnsWelcomePack`), so a gift's plan page would otherwise tick a
 * pack that is not in the wallet. `welcomePackAt` is the profile's own record
 * of the hand-over.
 */
export function benefitsHeld(
  welcomePackAt: Readonly<Record<string, string | undefined>> | undefined,
): readonly ProBenefit[] {
  const given = Object.values(welcomePackAt ?? {}).some((at) => at !== undefined)
  return given ? PRO_BENEFITS : PRO_BENEFITS.filter((benefit) => benefit !== 'welcomePack')
}

/**
 * The refused capability the paywall may name as part of Pro, or `null`.
 *
 * Only one that is on for everybody who buys and out of beta. Nothing in the
 * app opens the paywall over a feature that has not shipped or is in beta, but
 * the feature is a route param, so a hand-typed or stale link can still carry
 * one — and "Copilot is part of Pro" would be untrue, since the free plan has
 * Copilot too and Pro only answers more. Such a link gets the general page,
 * where the table says what each plan gets.
 */
export function sellableFeature(feature: PlanFeature | null): PlanFeature | null {
  return feature !== null && fullyOn(BENEFIT_COPY[feature]) ? feature : null
}

/** Shipped and out of beta: listed with no qualifier, and the only kind the paywall names as part of Pro. */
export function fullyOn(copy: BenefitCopy): boolean {
  return copy.shipped && copy.beta !== true
}

/**
 * The qualifier a benefit is listed with — "Soon" or "Beta" — or `null` when
 * it is neither. One answer for the paywall's rows, the comparison and the
 * plan page's "What you have", so the three cannot drift.
 */
export function pendingTag(copy: BenefitCopy): MessageKey | null {
  if (!copy.shipped) return 'paywall.compareSoon'
  return copy.beta ? 'paywall.betaTag' : null
}

/**
 * Names for the contextual line, derived from the copy above rather than
 * retyped — the paywall must not call a capability one thing in its list and
 * another in the sentence explaining why the screen opened.
 */
export const FEATURE_TITLE: Record<PlanFeature, MessageKey> = {
  advancedFilters: BENEFIT_COPY.advancedFilters.title,
  boostedProfile: BENEFIT_COPY.boostedProfile.title,
  sendTranslation: BENEFIT_COPY.sendTranslation.title,
  deckExport: BENEFIT_COPY.deckExport.title,
  profileViewerIdentities: BENEFIT_COPY.profileViewerIdentities.title,
  incognito: BENEFIT_COPY.incognito.title,
  nearby: BENEFIT_COPY.nearby.title,
  copilot: BENEFIT_COPY.copilot.title,
}

/**
 * Where each benefit's two cells come from. A quota reads its row in
 * `PLAN_LIMITS`; a capability reads its flag there; the welcome pack is not in
 * the table at all, because it is something Pro gives once rather than a
 * limit, and the free plan simply does not get it.
 *
 * `Record<ProBenefit, ...>`, so a benefit added to the shared list without
 * saying where its numbers live stops this compiling.
 */
type BenefitSource = { limit: keyof PlanLimits } | { feature: PlanFeature } | { proOnly: true }

const BENEFIT_SOURCE: Record<ProBenefit, BenefitSource> = {
  unlimitedInitiations: { limit: 'initiationsPer24h' },
  translationQuota: { limit: 'translationsPer24h' },
  learningLanguages: { limit: 'maxLearningLanguages' },
  advancedFilters: { feature: 'advancedFilters' },
  boostedProfile: { feature: 'boostedProfile' },
  profileViewerIdentities: { feature: 'profileViewerIdentities' },
  incognito: { feature: 'incognito' },
  nearby: { feature: 'nearby' },
  sendTranslation: { feature: 'sendTranslation' },
  deckExport: { feature: 'deckExport' },
  copilot: { limit: 'copilotPer24h' },
  welcomePack: { proOnly: true },
}

/** One cell of the Free and Pro comparison. */
export type CompareCell =
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'count'; count: number }
  | { kind: 'unlimited' }
  /** Pro's cell for a feature that has not shipped: never a tick for something that does nothing yet. */
  | { kind: 'soon' }

export interface CompareRow {
  benefit: ProBenefit
  label: MessageKey
  /** "Beta" beside the label of a benefit in beta, whose cells are real numbers; `null` otherwise. */
  tag: MessageKey | null
  free: CompareCell
  pro: CompareCell
}

function cellFor(
  source: BenefitSource,
  tier: PlanTier,
  limits: Record<PlanTier, PlanLimits>,
): CompareCell {
  if ('proOnly' in source) return { kind: tier === 'pro' ? 'yes' : 'no' }
  if ('feature' in source) return { kind: limits[tier][source.feature] ? 'yes' : 'no' }
  const value = limits[tier][source.limit]
  if (value === null) return { kind: 'unlimited' }
  // Every quota and cap in `PlanLimits` is a number or `null`; the booleans
  // are capabilities, which the branch above already took.
  return typeof value === 'number'
    ? { kind: 'count', count: value }
    : { kind: value ? 'yes' : 'no' }
}

/**
 * The rows the comparison opens with: the three numbers somebody on the free
 * plan meets first, then the two things Pro adds that they can see from where
 * they are. The rest follow in `PRO_BENEFITS` order behind "See everything".
 */
export const COMPARE_LEAD: readonly ProBenefit[] = [
  'unlimitedInitiations',
  'translationQuota',
  'profileViewerIdentities',
  'advancedFilters',
  'learningLanguages',
]

/**
 * The Free and Pro comparison, every cell read off `PLAN_LIMITS`.
 *
 * Pure, so a test holds the table to the config: a limit that changes in
 * `packages/shared` changes this table and nothing else has to. A benefit that
 * has not shipped or is in beta goes last. One that has not shipped reads
 * "Soon" in the Pro column, never a tick; one in beta reads its numbers like
 * any other, with "Beta" beside its label.
 */
export function compareRows(limits: Record<PlanTier, PlanLimits> = PLAN_LIMITS): CompareRow[] {
  const rest = PRO_BENEFITS.filter((benefit) => !COMPARE_LEAD.includes(benefit))
  const order = [
    ...COMPARE_LEAD,
    ...rest.filter((benefit) => fullyOn(BENEFIT_COPY[benefit])),
    ...rest.filter((benefit) => !fullyOn(BENEFIT_COPY[benefit])),
  ]
  return order.map((benefit) => {
    const copy = BENEFIT_COPY[benefit]
    const source = BENEFIT_SOURCE[benefit]
    return {
      benefit,
      label: copy.compare ?? copy.title,
      tag: copy.shipped ? pendingTag(copy) : null,
      free: cellFor(source, 'free', limits),
      pro: copy.shipped ? cellFor(source, 'pro', limits) : { kind: 'soon' },
    }
  })
}

/**
 * Whether the comparison stacks, each row's name on a line of its own over
 * its two cells (`CompareTable`): past the default text size always, and at
 * it when a word of any row's name is wider than the column the name has
 * beside the cells. `words` is each name's widest word and `column` that
 * column's width, both measured, so the answer follows the reader's language
 * and screen rather than a list of either. Side by side, a word wider than
 * its column broke in the middle on a phone, and on the web pushed its row's
 * cells past the table's edge: German's "Übersetzungen", 117pt, in the 92pt
 * a 320pt phone leaves the column.
 *
 * Measured and drawn at the same size, so no slack: German's
 * "Willkommenspaket", 144pt, fits the 147pt a 375pt phone leaves, and stays
 * side by side. Side by side until both are measured, as it always was.
 *
 * The words are measured at 1× (`WidestWord` ignores the text size), but a
 * name below the default size is drawn smaller — `maxFontSizeMultiplier`
 * only caps above 1 — so they are scaled down to what is drawn. Otherwise a
 * phone set to Small would stack rows that fit whole beside their cells.
 */
export function compareStacked({
  fontScale,
  column,
  words,
}: {
  fontScale: number
  column: number
  words: readonly number[]
}): boolean {
  if (fontScale > 1) return true
  if (column <= 0) return false
  return words.some((width) => width * fontScale > column)
}
