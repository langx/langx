import { useSyncExternalStore } from 'react'
import type { CefrLevel, Gender } from '@langx/shared'
import { FLAG_KEYS, clearFlag, readJsonFlag, writeJsonFlag } from '../lib/localFlags'

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

/**
 * Persistence lives inside this module rather than turning it into a context,
 * which keeps the decision above intact.
 *
 * Writes are debounced because `updateDraft` fires on every keystroke, and a
 * store write per character is both wasteful and — on native, where the store
 * is asynchronous — a way to have writes land out of order. A short delay
 * costs nothing here: the only reader is the next launch.
 */
const WRITE_DEBOUNCE_MS = 400
let writeTimer: ReturnType<typeof setTimeout> | undefined

let hydrated = false
const hydrationWaiters = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function schedulePersist(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    void writeJsonFlag(FLAG_KEYS.onboardingDraft, draft)
  }, WRITE_DEBOUNCE_MS)
}

/**
 * Reads the stored draft back, once per launch.
 *
 * Anything already typed in this session wins: hydration can finish after the
 * first screen has mounted, and overwriting live input with a stale copy is
 * far worse than losing the stale copy. Idempotent, so every caller can await
 * it without coordinating.
 */
export async function hydrateDraft(): Promise<void> {
  if (hydrated) return
  const stored = await readJsonFlag<Partial<OnboardingDraft>>(FLAG_KEYS.onboardingDraft)
  if (stored) draft = { ...EMPTY, ...stored, ...diffFromEmpty(draft) }
  hydrated = true
  emit()
  for (const waiter of hydrationWaiters) waiter()
  hydrationWaiters.clear()
}

export function isDraftHydrated(): boolean {
  return hydrated
}

/** Only the fields this session has actually touched. */
function diffFromEmpty(current: OnboardingDraft): Partial<OnboardingDraft> {
  const touched: Partial<OnboardingDraft> = {}
  for (const key of Object.keys(EMPTY) as (keyof OnboardingDraft)[]) {
    if (JSON.stringify(current[key]) !== JSON.stringify(EMPTY[key])) {
      Object.assign(touched, { [key]: current[key] })
    }
  }
  return touched
}

export function updateDraft(patch: Partial<OnboardingDraft>): void {
  draft = { ...draft, ...patch }
  emit()
  schedulePersist()
}

export function resetDraft(): void {
  draft = { ...EMPTY }
  if (writeTimer) clearTimeout(writeTimer)
  // Cleared rather than overwritten with an empty object: a finished
  // onboarding should leave nothing behind on the device.
  void clearFlag(FLAG_KEYS.onboardingDraft)
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
