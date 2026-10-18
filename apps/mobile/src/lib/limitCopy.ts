import {
  isPaidTier,
  QUOTA_WINDOW_MS,
  TOKEN_RULES,
  type PlanLimits,
  type PlanTier,
} from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'

/**
 * Sentences about a limit the server enforces.
 *
 * Both used to say something a person could not check: that a paid plan
 * "removes" the translation limit (Pro had a finite one then) and that a
 * missed day could be bought back "for a month" (the window is
 * `dayRepairMaxAgeDays` days). Each was a literal in eight catalogues, so a
 * change to the rule left eight stale sentences and nothing failed. A number
 * is read from the same config the server enforces here, and the catalogue
 * holds a `{count}`.
 *
 * Here and not at the call sites so one test can pin each sentence to its
 * rule, and so the two places that word a refused translation say the same.
 */

/**
 * The name the server gives the fair-use ceiling on a refusal, in `limit`.
 * Spelled as the `PlanLimits` key it is, so a rename on either side stops
 * this compiling rather than quietly turning every refusal into the paywall.
 */
const TRANSLATION_FAIR_USE = 'translationFairUsePer24h' satisfies keyof PlanLimits

/**
 * Whether a refused translation hit the fair-use ceiling rather than the free
 * plan's daily allowance.
 *
 * Both are `QUOTA_EXCEEDED`; the ceiling carries `limit`, as the post cap
 * does (`postRefusal.ts`). Duck-typed for that file's reason: the error class
 * lives in `api/client`, which vitest cannot load.
 */
export function isTranslationFairUse(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return (error as { limit?: unknown }).limit === TRANSLATION_FAIR_USE
}

const HOUR_MS = 60 * 60 * 1000

/**
 * Said when a translation is refused: the free allowance, which Pro removes,
 * or the fair-use ceiling, which is the same for everyone, names no plan, and
 * says when it resets — the rolling window the server counts in, in hours.
 */
export function translationQuotaText(t: TranslateFn, fairUse: boolean): string {
  return fairUse
    ? t('chat.translationFairUse', { count: QUOTA_WINDOW_MS / HOUR_MS })
    : t('chat.translationQuota')
}

/** The streak page's note on what a freeze and a repair each cover. */
export function streakProtectText(t: TranslateFn): string {
  return t('streak.protectBody', { count: TOKEN_RULES.sinks.dayRepairMaxAgeDays })
}

/**
 * Whether a refused translation may lead on to the paywall, for this account.
 *
 * Nothing is ever sold to a paid, gifted or lifetime Pro account, and Pro has
 * no allowance left to sell anyway. Nor is anybody sent there from the
 * fair-use ceiling (`isTranslationFairUse`), which has nothing above it — so
 * the callers ask both. The tier is the one `useEffectiveTier` returns, which
 * has already been through `effectivePlanTier`: a lapsed subscription whose
 * webhook was late reads as free here, as it does everywhere else.
 */
export function offersPlansAtTranslationLimit(tier: PlanTier): boolean {
  return !isPaidTier(tier)
}
