import { useSyncExternalStore } from 'react'
import type { CefrLevel, Gender } from '@langx/shared'

export interface OnboardingDraft {
  nativeLanguages: string[]
  learning: { code: string; level: CefrLevel }[]
  handle: string
  displayName: string
  birthYear: string
  gender: Gender
  bio: string
  interests: string[]
  country: string
  /** Uploaded during the wizard; written by `POST /profiles`, not by `confirm`. */
  avatarUrl: string
}

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

/**
 * Module-level state rather than a context provider or a route param.
 *
 * Onboarding is three screens that build one object, and expo-router remounts
 * a screen whenever it is navigated back to — component state would be lost on
 * "back", and serialising a growing draft through route params turns the URL
 * into a form encoding. A tiny store outside React is the honest shape: the
 * draft outlives any one screen and is thrown away on submit.
 */
let draft: OnboardingDraft = { ...EMPTY }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function updateDraft(patch: Partial<OnboardingDraft>): void {
  draft = { ...draft, ...patch }
  emit()
}

export function resetDraft(): void {
  draft = { ...EMPTY }
  emit()
}

export function getDraft(): OnboardingDraft {
  return draft
}

export function useOnboardingDraft(): OnboardingDraft {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => draft,
    () => draft,
  )
}
