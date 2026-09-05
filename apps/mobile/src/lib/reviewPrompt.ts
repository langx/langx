import { TOKEN_RULES } from '@langx/shared'

/**
 * When to ask for a store review.
 *
 * Pure, so `vitest.config.ts` reaches it — the same split as `tips.ts`: the
 * rules live here, the storage and the React wiring in `useReviewPrompt`.
 *
 * The prompt is Apple's and Google's own sheet, and both ration it (iOS shows
 * it at most three times a year whatever we ask). So the question this file
 * answers is not "may we ask" but "is this a moment worth spending one of
 * those on": a streak milestone the day it lands, or a correction written —
 * the moments where somebody has just got something out of the app.
 */

export interface ReviewPromptState {
  /** ISO timestamp of the last time the sheet was requested, or null. */
  askedAt: string | null
  askedCount: number
  /** The app version the sheet was last requested under. */
  askedVersion: string | null
  /** Corrections written on this device since install — a local counter. */
  corrections: number
}

export const DEFAULT_REVIEW_STATE: ReviewPromptState = {
  askedAt: null,
  askedCount: 0,
  askedVersion: null,
  corrections: 0,
}

export const REVIEW_RULES = {
  /** iOS allows three a year; ninety days keeps us under that on our own. */
  minGapDays: 90,
  /** The Nth correction ever written on this device asks; others do not. */
  correctionThresholds: [3, 25, 100] as readonly number[],
} as const

export type ReviewTrigger = { kind: 'streakMilestone'; day: number } | { kind: 'correction' }

export function parseReviewPromptState(raw: unknown): ReviewPromptState {
  if (!raw || typeof raw !== 'object') return DEFAULT_REVIEW_STATE
  const r = raw as Record<string, unknown>
  return {
    askedAt: typeof r['askedAt'] === 'string' ? r['askedAt'] : null,
    askedCount:
      typeof r['askedCount'] === 'number' && Number.isFinite(r['askedCount'])
        ? Math.max(0, Math.floor(r['askedCount']))
        : 0,
    askedVersion: typeof r['askedVersion'] === 'string' ? r['askedVersion'] : null,
    corrections:
      typeof r['corrections'] === 'number' && Number.isFinite(r['corrections'])
        ? Math.max(0, Math.floor(r['corrections']))
        : 0,
  }
}

/** One more correction written; call before `shouldAskForReview` for it. */
export function noteCorrection(state: ReviewPromptState): ReviewPromptState {
  return { ...state, corrections: state.corrections + 1 }
}

export interface ReviewContext {
  now: Date
  /** The running app version — one ask per version, so a fix can be judged. */
  version: string
  /** Streak days that pay a milestone; defaults to the shared table's keys. */
  milestones?: readonly number[]
}

/**
 * Is this the moment? Never twice in one version, never inside the gap, and
 * only for a trigger that actually landed: a day that is a milestone, or a
 * correction count on the threshold list.
 */
export function shouldAskForReview(
  state: ReviewPromptState,
  trigger: ReviewTrigger,
  context: ReviewContext,
): boolean {
  if (state.askedVersion === context.version) return false
  if (state.askedAt) {
    const since = context.now.getTime() - new Date(state.askedAt).getTime()
    if (!Number.isFinite(since) || since < REVIEW_RULES.minGapDays * 24 * 60 * 60 * 1000) {
      return false
    }
  }
  if (trigger.kind === 'streakMilestone') {
    const milestones = context.milestones ?? Object.keys(TOKEN_RULES.streakMilestones).map(Number)
    return milestones.includes(trigger.day)
  }
  return REVIEW_RULES.correctionThresholds.includes(state.corrections)
}

export function markAsked(state: ReviewPromptState, now: Date, version: string): ReviewPromptState {
  return {
    ...state,
    askedAt: now.toISOString(),
    askedCount: state.askedCount + 1,
    askedVersion: version,
  }
}
