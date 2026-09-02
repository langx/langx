import { describe, expect, it } from 'vitest'
import type { OnboardingDraft } from '../hooks/useOnboardingDraft'
import { furthestOnboardingStep, GUEST_ONBOARDING_STEPS, ONBOARDING_STEPS } from './onboardingStep'

const EMPTY: OnboardingDraft = {
  nativeLanguages: [],
  learning: [],
  handle: '',
  displayName: '',
  birthDate: '',
  gender: 'undisclosed',
  bio: '',
  interests: [],
  referredByHandle: '',
  referredBySource: 'manual' as const,
  country: '',
  avatarUrl: '',
}

const draft = (patch: Partial<OnboardingDraft>): OnboardingDraft => ({ ...EMPTY, ...patch })
const withLanguages = {
  nativeLanguages: ['tr'],
  learning: [{ code: 'en', level: 'intermediate' as const }],
}

describe('furthestOnboardingStep', () => {
  it('starts at the beginning for an empty draft', () => {
    expect(furthestOnboardingStep(EMPTY)).toBe('languages')
  })

  /**
   * Both language questions live on the languages screen now (v3's tabs), so
   * a draft with native languages but nothing to learn still belongs there —
   * the screen itself opens on the learning tab in that state.
   */
  it('stays on languages until both language questions are answered', () => {
    expect(furthestOnboardingStep(draft({ nativeLanguages: [] }))).toBe('languages')
    expect(furthestOnboardingStep(draft({ nativeLanguages: ['tr'] }))).toBe('languages')
  })

  /**
   * The step that only exists because the previous one does: a learning
   * language with no level yet sends you here, not past it.
   */
  it('holds on levels until every learning language has one', () => {
    expect(
      furthestOnboardingStep(
        draft({ nativeLanguages: ['tr'], learning: [{ code: 'en', level: null }] }),
      ),
    ).toBe('levels')
    expect(
      furthestOnboardingStep(
        draft({
          nativeLanguages: ['tr'],
          learning: [
            { code: 'en', level: 'intermediate' },
            { code: 'de', level: null },
          ],
        }),
      ),
    ).toBe('levels')
  })

  it('moves on once a language pair exists', () => {
    expect(furthestOnboardingStep(draft(withLanguages))).toBe('about-you')
  })

  /** A half-filled form is not a finished step. */
  it('holds on about-you until both required fields are filled', () => {
    expect(furthestOnboardingStep(draft({ ...withLanguages, displayName: 'Ada' }))).toBe(
      'about-you',
    )
    expect(furthestOnboardingStep(draft({ ...withLanguages, birthDate: '1994-03-07' }))).toBe(
      'about-you',
    )
  })

  it('reaches the photo step with the required fields in place', () => {
    expect(
      furthestOnboardingStep(
        draft({ ...withLanguages, displayName: 'Ada', birthDate: '1994-03-07' }),
      ),
    ).toBe('photo')
  })

  /**
   * `handle` is the submit step. Landing there directly would skip the avatar
   * and interests without the user ever seeing that they were offered.
   */
  it('never resumes on the handle step, even with a handle already typed', () => {
    expect(
      furthestOnboardingStep(
        draft({ ...withLanguages, displayName: 'Ada', birthDate: '1994-03-07', handle: 'ada' }),
      ),
    ).toBe('photo')
  })

  it('treats whitespace as unfilled', () => {
    expect(
      furthestOnboardingStep(
        draft({ ...withLanguages, displayName: '   ', birthDate: '1994-03-07' }),
      ),
    ).toBe('about-you')
  })
})

describe('the guest path', () => {
  /**
   * The whole of "we do not ask for your languages twice". A guest fills in
   * languages and levels; after they register, the draft is still there and
   * this is what reads it.
   */
  it('drops a registering guest on about-you, not back at languages', () => {
    const draft = {
      ...EMPTY,
      nativeLanguages: ['tr'],
      learning: [{ code: 'en', level: 'intermediate' as const }],
    }
    expect(furthestOnboardingStep(draft)).toBe('about-you')
  })

  it('covers exactly the steps a guest is shown', () => {
    expect(GUEST_ONBOARDING_STEPS).toEqual(['languages', 'levels'])
    for (const step of GUEST_ONBOARDING_STEPS) {
      expect(ONBOARDING_STEPS).toContain(step)
    }
  })
})
