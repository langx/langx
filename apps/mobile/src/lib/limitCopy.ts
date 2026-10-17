import { isPaidTier, PLAN_LIMITS, TOKEN_RULES, type PlanTier } from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'

/**
 * Sentences that quote a number the server enforces.
 *
 * Both used to say something a person could not check: that a paid plan
 * "removes" the translation limit (Pro has a finite one) and that a missed day
 * could be bought back "for a month" (the window is `dayRepairMaxAgeDays`
 * days). Each was a literal in eight catalogues, so a change to the rule left
 * eight stale sentences and nothing failed. The number is read from the same
 * config the server enforces here, and the catalogue holds a `{count}`.
 *
 * Here and not at the call sites so one test can pin the pair, and so the two
 * screens that show the translation limit cannot quote different numbers.
 */

/** Said when a translation is refused. The tier-neutral truth: what Pro allows. */
export function translationQuotaText(t: TranslateFn): string {
  return t('chat.translationQuota', { count: PLAN_LIMITS.pro.translationsPer24h })
}

/** The streak page's note on what a freeze and a repair each cover. */
export function streakProtectText(t: TranslateFn): string {
  return t('streak.protectBody', { count: TOKEN_RULES.sinks.dayRepairMaxAgeDays })
}

/**
 * Whether a refused translation may lead on to the paywall.
 *
 * Pro has a translation limit of its own, so the refusal reaches a Pro account
 * too, and for that account there is nothing to buy: the alert says what the
 * limit is and stops there. Nothing is ever sold to a paid, gifted or lifetime
 * Pro account. The tier is the one `useEffectiveTier` returns, which has
 * already been through `effectivePlanTier`: a lapsed subscription whose webhook
 * was late reads as free here, as it does everywhere else.
 */
export function offersPlansAtTranslationLimit(tier: PlanTier): boolean {
  return !isPaidTier(tier)
}
