import { useCallback, useEffect } from 'react'
import { Platform } from 'react-native'
import { track } from '../lib/analytics'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import {
  DEFAULT_REVIEW_STATE,
  markAsked,
  noteCorrection,
  parseReviewPromptState,
  shouldAskForReview,
  type ReviewPromptState,
  type ReviewTrigger,
} from '../lib/reviewPrompt'
import { appVersion } from './useAppConfig'

/**
 * Give the toast or the reveal of the triggering action a moment to settle
 * before the store's sheet drops over it.
 */
const SETTLE_MS = 1500

/*
 * A module-level store, like `useTips`: the trigger fires from a hook in the
 * app layout (check-in) and from two screens (corrections), and all of them
 * have to agree on whether the sheet was already shown this version.
 */
let state: ReviewPromptState = DEFAULT_REVIEW_STATE
let hydrated = false
let hydrating: Promise<void> | null = null

function hydrate(): Promise<void> {
  if (hydrated) return Promise.resolve()
  hydrating ??= readJsonFlag<unknown>(FLAG_KEYS.reviewPrompt).then((stored) => {
    state = parseReviewPromptState(stored)
    hydrated = true
  })
  return hydrating
}

function publish(next: ReviewPromptState): void {
  state = next
  void writeJsonFlag(FLAG_KEYS.reviewPrompt, next)
}

/**
 * Ask the store for a review at a good moment — and only then.
 *
 * `request(trigger)` is the whole surface. It is a no-op on web (there is no
 * sheet), for a guest (nothing to review yet), when the rules in
 * `lib/reviewPrompt.ts` say no, and when the platform says it cannot show
 * one. The sheet itself is Apple's or Google's; we own only the timing.
 */
export function useReviewPrompt(): { request: (trigger: ReviewTrigger) => void } {
  const { data: session } = authClient.useSession()
  const isGuest = shouldGateGuest(session?.user)

  useEffect(() => {
    void hydrate()
  }, [])

  const request = useCallback(
    (trigger: ReviewTrigger): void => {
      if (Platform.OS === 'web' || isGuest) return
      void (async () => {
        await hydrate()
        if (trigger.kind === 'correction') publish(noteCorrection(state))
        const now = new Date()
        const version = appVersion()
        if (!shouldAskForReview(state, trigger, { now, version })) return
        try {
          const StoreReview = await import('expo-store-review')
          if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return
          // Recorded before the sheet, not after: the OS may decide not to
          // show it and tells us nothing either way, and asking again a day
          // later would spend the same ration twice.
          publish(markAsked(state, now, version))
          track({ name: 'review_prompted', properties: { trigger: trigger.kind } })
          await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
          await StoreReview.requestReview()
        } catch {
          // No module on this binary, or the OS declined. Nothing to show.
        }
      })()
    },
    [isGuest],
  )

  return { request }
}
