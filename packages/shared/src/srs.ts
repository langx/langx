/**
 * When a card comes back.
 *
 * SM-2, the algorithm Anki and every descendant of SuperMemo still run on,
 * with the learning steps that make the first few minutes of a new card
 * bearable. FSRS schedules better and is the obvious replacement, but it
 * wants parameters fitted to a review history that does not exist yet — so
 * the whole thing sits behind one function, and swapping it later is
 * contained to this file.
 *
 * **One implementation, both sides.** The client computes the next due date
 * optimistically so a session feels instant; the server recomputes from the
 * ledger and is authoritative. They are the same function here for the reason
 * `effectivePlanTier` is here: two implementations of one rule is how the app
 * says "due tomorrow" while the API says "due in three days", and the
 * mismatch reads as a bug in the feature rather than as a duplicated rule.
 *
 * Which is also why there is no interval fuzz. Anki scatters intervals by a
 * few percent so that cards learned together do not come back together; doing
 * it here would need a random number, and a random number is exactly what
 * stops the two sides agreeing.
 */

const MS_PER_MINUTE = 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Self-graded on the reveal. Four, in the order they are drawn. */
export const ECHO_GRADES = ['again', 'hard', 'good', 'easy'] as const
export type EchoGrade = (typeof ECHO_GRADES)[number]

/**
 * Two states, not Anki's four.
 *
 * `relearning` exists in Anki to give a lapsed card its own, shorter step
 * list. Ours are one minute and ten minutes, which is already the shortest
 * useful pair, so a third state would differ from `learning` in nothing but
 * its name — and a state that behaves identically is a state somebody will
 * eventually branch on by mistake.
 */
export const ECHO_SRS_STATES = ['learning', 'review'] as const
export type EchoSrsState = (typeof ECHO_SRS_STATES)[number]

export interface EchoSrs {
  state: EchoSrsState
  /**
   * Index into `SRS_RULES.learningStepsMinutes`, and 0 in `review`.
   *
   * Not in the design document's field list, and unimplementable without:
   * with two learning steps, nothing else distinguishes a card due in one
   * minute from one due in ten.
   */
  step: number
  due: Date
  /** Whole days. 0 while learning, where `step` drives `due` instead. */
  interval: number
  ease: number
  reps: number
  lapses: number
  lastReviewedAt: Date | null
}

export const SRS_RULES = {
  startingEase: 2.5,
  /** Ease never falls below this, however many times a card is failed. */
  minimumEase: 1.3,
  learningStepsMinutes: [1, 10],
  easyBonus: 1.3,
  /** A lapse throws the interval away rather than shortening it. */
  lapseIntervalMultiplier: 0,
  hardIntervalMultiplier: 1.2,
  /** Where a card lands when it finishes the learning steps on `good`. */
  graduatingIntervalDays: 1,
  /** Where `easy` lands it instead, skipping the remaining steps. */
  easyIntervalDays: 4,
  /**
   * A year. Past it the schedule stops being a claim about memory and starts
   * being a claim about the app still existing.
   */
  maximumIntervalDays: 365,
  easeDelta: { again: -0.2, hard: -0.15, good: 0, easy: 0.15 },
  /** Cards in one session, and so the size of the due queue a request gets. */
  sessionSize: 10,
} as const

function afterMinutes(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * MS_PER_MINUTE)
}

function afterDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * MS_PER_DAY)
}

function cappedInterval(days: number): number {
  return Math.min(SRS_RULES.maximumIntervalDays, days)
}

function easeAfter(ease: number, grade: EchoGrade): number {
  return Math.max(SRS_RULES.minimumEase, ease + SRS_RULES.easeDelta[grade])
}

function stepMinutes(step: number): number {
  const steps = SRS_RULES.learningStepsMinutes
  return steps[Math.min(Math.max(step, 0), steps.length - 1)] ?? steps[0]
}

/** A card the moment it is made: due now, so the first session can include it. */
export function newCardSrs(now: Date): EchoSrs {
  return {
    state: 'learning',
    step: 0,
    due: new Date(now.getTime()),
    interval: 0,
    ease: SRS_RULES.startingEase,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
  }
}

/** What `state`, `step`, `due`, `interval`, `ease` and `lapses` become. */
type Scheduled = Pick<EchoSrs, 'state' | 'step' | 'due' | 'interval' | 'ease' | 'lapses'>

function graduate(srs: EchoSrs, now: Date, days: number): Scheduled {
  return {
    state: 'review',
    step: 0,
    interval: cappedInterval(days),
    due: afterDays(now, days),
    ease: srs.ease,
    lapses: srs.lapses,
  }
}

function fromLearning(srs: EchoSrs, grade: EchoGrade, now: Date): Scheduled {
  // Ease is not touched here. It describes how hard a card is to *keep*, and
  // a card still inside its first ten minutes has not been kept yet.
  const stay = (step: number): Scheduled => ({
    state: 'learning',
    step,
    interval: 0,
    due: afterMinutes(now, stepMinutes(step)),
    ease: srs.ease,
    lapses: srs.lapses,
  })

  if (grade === 'again') return stay(0)
  if (grade === 'hard') return stay(srs.step)
  if (grade === 'easy') return graduate(srs, now, SRS_RULES.easyIntervalDays)

  const next = srs.step + 1
  if (next < SRS_RULES.learningStepsMinutes.length) return stay(next)
  return graduate(srs, now, SRS_RULES.graduatingIntervalDays)
}

function fromReview(srs: EchoSrs, grade: EchoGrade, now: Date): Scheduled {
  const ease = easeAfter(srs.ease, grade)

  if (grade === 'again') {
    // Back to the first learning step, and the interval is thrown away
    // rather than shortened: a sentence you could not produce at all is not
    // a sentence you half-remember.
    return {
      state: 'learning',
      step: 0,
      interval: Math.round(srs.interval * SRS_RULES.lapseIntervalMultiplier),
      due: afterMinutes(now, stepMinutes(0)),
      ease,
      lapses: srs.lapses + 1,
    }
  }

  // Every branch is floored at a full day more than it had, because
  // `Math.round(1 * 1.2)` is 1: without the floor, a card somebody keeps
  // marking Hard is a loop they can only leave by lying about it.
  const good = Math.max(srs.interval + 1, Math.round(srs.interval * ease))
  const days =
    grade === 'hard'
      ? Math.max(srs.interval + 1, Math.round(srs.interval * SRS_RULES.hardIntervalMultiplier))
      : grade === 'good'
        ? good
        : Math.max(good + 1, Math.round(srs.interval * ease * SRS_RULES.easyBonus))

  return {
    state: 'review',
    step: 0,
    interval: cappedInterval(days),
    due: afterDays(now, cappedInterval(days)),
    ease,
    lapses: srs.lapses,
  }
}

/**
 * The next schedule for a card graded at `now`.
 *
 * Takes `{ srs }` structurally rather than a card type, so the same call works
 * on a Mongo document, on a parsed DTO, and on a bare fixture in a test —
 * none of which agree on what else a card carries.
 *
 * Pure: it reads nothing but its three arguments, so the client's optimistic
 * answer and the server's authoritative one are the same value.
 */
export function schedule(card: { srs: EchoSrs }, grade: EchoGrade, now: Date): EchoSrs {
  const next =
    card.srs.state === 'learning'
      ? fromLearning(card.srs, grade, now)
      : fromReview(card.srs, grade, now)
  return {
    ...next,
    reps: card.srs.reps + 1,
    lastReviewedAt: new Date(now.getTime()),
  }
}

/**
 * How long until a card graded this way comes back, in whole minutes.
 *
 * The session draws the answer on each grade button, and `interval` cannot
 * carry it: a card still in its learning steps has an interval of 0 days and
 * comes back in one minute. This is the one number that is true in both
 * states.
 */
export function scheduledDelayMinutes(card: { srs: EchoSrs }, grade: EchoGrade, now: Date): number {
  return Math.round((schedule(card, grade, now).due.getTime() - now.getTime()) / MS_PER_MINUTE)
}
