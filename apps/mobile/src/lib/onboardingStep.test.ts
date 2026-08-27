import { describe, expect, it } from 'vitest'
import type { OnboardingDraft } from '../hooks/useOnboardingDraft'
import { furthestOnboardingStep } from './onboardingStep'

const EMPTY: OnboardingDraft = {
  nativeLanguages: [],
  learning: [],
  handle: '',
  displayName: '',
  birthYear: '',
  gender: 'undisclosed',
  bio: '',
  interests: [],
  country: '',
  avatarUrl: '',
}

const draft = (patch: Partial<OnboardingDraft>): OnboardingDraft => ({ ...EMPTY, ...patch })
const withLanguages = { nativeLanguages: ['tr'], learning: [{ code: 'en', level: 'B1' as const }] }

describe('furthestOnboardingStep', () => {
  it('starts at the beginning for an empty draft', () => {
    expect(furthestOnboardingStep(EMPTY)).toBe('languages')
  })

  it('stays on languages until both directions are set', () => {
    expect(furthestOnboardingStep(draft({ nativeLanguages: ['tr'] }))).toBe('languages')
    expect(furthestOnboardingStep(draft({ learning: [{ code: 'en', level: 'B1' }] }))).toBe(
      'languages',
    )
  })

  it('moves on once a language pair exists', () => {
    expect(furthestOnboardingStep(draft(withLanguages))).toBe('about-you')
  })

  /** A half-filled form is not a finished step. */
  it('holds on about-you until both required fields are filled', () => {
    expect(furthestOnboardingStep(draft({ ...withLanguages, displayName: 'Ada' }))).toBe(
      'about-you',
    )
    expect(furthestOnboardingStep(draft({ ...withLanguages, birthYear: '1994' }))).toBe('about-you')
  })

  it('reaches the photo step with the required fields in place', () => {
    expect(
      furthestOnboardingStep(draft({ ...withLanguages, displayName: 'Ada', birthYear: '1994' })),
    ).toBe('photo')
  })

  /**
   * `handle` is the submit step. Landing there directly would skip the avatar
   * and interests without the user ever seeing that they were offered.
   */
  it('never resumes on the handle step, even with a handle already typed', () => {
    expect(
      furthestOnboardingStep(
        draft({ ...withLanguages, displayName: 'Ada', birthYear: '1994', handle: 'ada' }),
      ),
    ).toBe('photo')
  })

  it('treats whitespace as unfilled', () => {
    expect(
      furthestOnboardingStep(draft({ ...withLanguages, displayName: '   ', birthYear: '1994' })),
    ).toBe('about-you')
  })
})
