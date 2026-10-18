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
 * back and flip it, which is what happened to `nearby` and has not yet
 * happened to `copilot`.
 *
 * Here rather than in the screen so that the comparison below, which a test
 * can reach, reads the same `shipped` the rows do.
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
  copilot: {
    title: 'paywall.copilot',
    body: 'paywall.copilotBody',
    icon: 'cpu',
    hue: 'lilac',
    shipped: false,
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
 * The refused capability the paywall may name as part of Pro, or `null`.
 *
 * Only a shipped one. Nothing in the app opens the paywall over a feature that
 * has not shipped — Copilot's controls do not exist yet — but the feature is a
 * route param, so a hand-typed or stale link can still carry one, and "Copilot
 * is part of Pro" over a feature that does nothing sells it as present. Such a
 * link gets the general page, where the table already says "Soon".
 */
export function sellableFeature(feature: PlanFeature | null): PlanFeature | null {
  return feature !== null && BENEFIT_COPY[feature].shipped ? feature : null
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
  copilot: { feature: 'copilot' },
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
 * has not shipped goes last and reads "Soon" in the Pro column, never a tick.
 */
export function compareRows(limits: Record<PlanTier, PlanLimits> = PLAN_LIMITS): CompareRow[] {
  const rest = PRO_BENEFITS.filter((benefit) => !COMPARE_LEAD.includes(benefit))
  const order = [
    ...COMPARE_LEAD,
    ...rest.filter((benefit) => BENEFIT_COPY[benefit].shipped),
    ...rest.filter((benefit) => !BENEFIT_COPY[benefit].shipped),
  ]
  return order.map((benefit) => {
    const copy = BENEFIT_COPY[benefit]
    const source = BENEFIT_SOURCE[benefit]
    return {
      benefit,
      label: copy.compare ?? copy.title,
      free: cellFor(source, 'free', limits),
      pro: copy.shipped ? cellFor(source, 'pro', limits) : { kind: 'soon' },
    }
  })
}
