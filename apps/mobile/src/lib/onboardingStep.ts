import type { OnboardingDraft } from '../hooks/useOnboardingDraft'

/** The wizard's screens, in order. */
export const ONBOARDING_STEPS = ['languages', 'about-you', 'photo', 'handle'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

/**
 * The furthest screen a draft has earned the right to open on.
 *
 * v1 did this and did it right: `auth.effect.ts` put the user back on the step
 * they had reached, every launch. v2 sent everyone to step one, so closing the
 * app after filling in three screens meant filling in three screens again.
 *
 * It reads what a step *requires*, not what the user last looked at — a draft
 * with languages but no name belongs on `about-you` whichever screen was open
 * when the app died. `handle` is never returned: it is the submit step, and
 * dropping someone straight onto "claim your username" skips the two optional
 * fields before it without them ever seeing that they existed.
 */
export function furthestOnboardingStep(draft: OnboardingDraft): OnboardingStep {
  if (draft.nativeLanguages.length === 0 || draft.learning.length === 0) return 'languages'
  if (!draft.displayName.trim() || !draft.birthYear.trim()) return 'about-you'
  return 'photo'
}

export function onboardingHref(step: OnboardingStep): `/(onboarding)/${OnboardingStep}` {
  return `/(onboarding)/${step}`
}
