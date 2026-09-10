import type { OnboardingDraft } from '../hooks/useOnboardingDraft'

/**
 * The wizard's screens, in order. Both language questions live on the
 * `languages` screen, behind two tabs — v3 merged them back, with Continue
 * driving the tab change so the sequence survives the merge.
 */
export const ONBOARDING_STEPS = ['languages', 'levels', 'about-you', 'handle', 'photo'] as const
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
 * when the app died. `photo` is never returned: it is the step after the
 * profile exists (v3 claims the username first, then asks for a picture), and
 * a profile is exactly what stops the gate from sending anyone here at all.
 */
/**
 * What a guest fills in: the two language questions and nothing else.
 *
 * A handle, a display name, a birth date and a gender are all required by
 * `onboardingProfileSchema` — and a guest supplies none of them, because a
 * guest cannot be looked at. They browse; they do not appear.
 *
 * The draft they leave behind is the whole of the "not asked again" promise:
 * `furthestOnboardingStep` reads it after they register and returns
 * `about-you`, because the languages and levels are already there.
 */
export const GUEST_ONBOARDING_STEPS = ['languages', 'levels'] as const

/**
 * Whether the draft already holds what a step asks for.
 *
 * Two readers: the resume above, and `onboarding_step_completed`, whose
 * `resumed` property says whether the person was answering the question or
 * confirming an answer the device already had. One function so those two can
 * never drift apart.
 *
 * `photo` is always false — the picture is uploaded onto a profile that
 * already exists and never travels in the draft.
 */
export function isStepAnswered(step: OnboardingStep, draft: OnboardingDraft): boolean {
  switch (step) {
    // Either language list empty means the languages screen — it opens on the
    // tab that still has work in it.
    case 'languages':
      return draft.nativeLanguages.length > 0 && draft.learning.length > 0
    // A level is not optional and has no default: the whole of discovery is
    // the fit between what you speak and how well you speak it.
    case 'levels':
      return isStepAnswered('languages', draft) && draft.learning.every((e) => e.level !== null)
    case 'about-you':
      return Boolean(draft.displayName.trim() && draft.birthDate.trim())
    case 'handle':
      return Boolean(draft.handle.trim())
    case 'photo':
      return false
  }
}

export function furthestOnboardingStep(draft: OnboardingDraft): OnboardingStep {
  if (!isStepAnswered('languages', draft)) return 'languages'
  if (!isStepAnswered('levels', draft)) return 'levels'
  if (!isStepAnswered('about-you', draft)) return 'about-you'
  return 'handle'
}

export function onboardingHref(step: OnboardingStep): `/(onboarding)/${OnboardingStep}` {
  return `/(onboarding)/${step}`
}
