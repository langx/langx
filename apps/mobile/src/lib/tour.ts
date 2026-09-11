/**
 * The first-run tour: which elements it points at, in what order, and where it
 * currently is.
 *
 * Pure except for the small store at the bottom, so `vitest.config.ts` reaches
 * it — the same split `tips.ts` and `messageMenu.ts` already make. Nothing here
 * imports React or react-native; the drawing is `TourHost`, the anchoring is
 * `TourTarget`, and the rules are here.
 *
 * Deliberately **not** part of `tips.ts`. A tip is one sentence a screen offers
 * whenever it has one to spare; the tour is an ordered run that happens once,
 * covers the screen, and ends on an action. Sharing a store would mean one
 * dismissal deciding both.
 */

/** Where on screen a target was when it was measured. Window coordinates. */
export interface TourRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Every element the tour can point at.
 *
 * The id is also the analytics step name and the stem of the two message keys,
 * so a step cannot be added without a name, a sentence and a number to count.
 */
export const TOUR_TARGETS = [
  'discoverPair',
  'discoverSorts',
  'discoverFilters',
  'discoverCard',
] as const

export type TourTargetId = (typeof TOUR_TARGETS)[number]

export interface TourStep {
  target: TourTargetId
}

/**
 * The run, in order.
 *
 * Three pieces of chrome and then a card, which is the order a reader's eye
 * takes the screen in — and it ends on the card because the card is the only
 * one of the four that leads anywhere.
 */
export const TOUR_STEPS: readonly TourStep[] = TOUR_TARGETS.map((target) => ({ target }))

export interface TourState {
  steps: readonly TourStep[]
  index: number
  /** Carried so the host can word a step for a guest, and the funnel can split on it. */
  guest: boolean
}

/**
 * The steps this reader gets.
 *
 * Guests see the same four today — everything the Discovery screen does, a
 * guest can do. The seam exists because the tab steps that follow this one are
 * not all true for a guest, and that difference belongs in a pure function
 * with a test rather than in a condition inside the host.
 */
export function stepsFor(_options: { guest: boolean }): readonly TourStep[] {
  return TOUR_STEPS
}

export function startTour(options: { guest: boolean }): TourState {
  return { steps: stepsFor(options), index: 0, guest: options.guest }
}

export function currentStep(state: TourState): TourStep | undefined {
  return state.steps[state.index]
}

export function isLastStep(state: TourState): boolean {
  return state.index >= state.steps.length - 1
}

/**
 * The next state that has something to point at, or `null` when the run is
 * over.
 *
 * `isAvailable` is asked rather than assumed because a target can be missing
 * for ordinary reasons — the filters button is not rendered while search is
 * open, a card that was there when the tour opened can be gone by the third
 * step. A step with nothing to highlight is skipped; it must never be able to
 * hold the overlay open on an empty rectangle.
 */
export function resolveFrom(
  state: TourState,
  isAvailable: (target: TourTargetId) => boolean,
): TourState | null {
  for (let index = state.index; index < state.steps.length; index++) {
    const step = state.steps[index]
    if (step && isAvailable(step.target)) return { ...state, index }
  }
  return null
}

/** Moves on by one. The caller passes the result through `resolveFrom`. */
export function advance(state: TourState): TourState {
  return { ...state, index: state.index + 1 }
}

/** What the counter in the bubble says. One-based, because it is read aloud. */
export function progress(state: TourState): { current: number; total: number } {
  return { current: state.index + 1, total: state.steps.length }
}

/* ------------------------------------------------------------------ store */

type Listener = (state: TourState | null) => void

let open: TourState | null = null
/**
 * A set rather than the single slot `messageMenu.ts` keeps, because this one
 * has two readers: the host that draws the run, and the Discovery screen,
 * which hides its tip while a run is on.
 */
const listeners = new Set<Listener>()

/** Measured on demand, so a target that has moved is never drawn where it was. */
const targets = new Map<TourTargetId, () => Promise<TourRect | null>>()

function publish(): void {
  for (const listener of listeners) listener(open)
}

/** Subscribers are told the current run immediately; the return unsubscribes. */
export function subscribeToTour(next: Listener): () => void {
  listeners.add(next)
  next(open)
  return () => {
    listeners.delete(next)
  }
}

/**
 * A mounted element offering itself as an anchor.
 *
 * Keyed by id rather than collected as a list: the tour asks for one target by
 * name, and two screens can never render the same id at once — `discoverCard`
 * is the *first* row of the one list that has rows.
 */
export function registerTourTarget(
  id: TourTargetId,
  measure: () => Promise<TourRect | null>,
): () => void {
  targets.set(id, measure)
  return () => {
    // Only if it is still ours: React mounts the next element before
    // unmounting the last one during a re-render, and the loser of that race
    // would otherwise delete the winner's entry.
    if (targets.get(id) === measure) targets.delete(id)
  }
}

export function hasTourTarget(id: TourTargetId): boolean {
  return targets.has(id)
}

export function measureTourTarget(id: TourTargetId): Promise<TourRect | null> {
  const measure = targets.get(id)
  return measure ? measure() : Promise.resolve(null)
}

export function setTourState(next: TourState | null): void {
  open = next
  publish()
}

export function tourState(): TourState | null {
  return open
}

/** Test seam: drops the run and every registration. */
export function resetTourForTest(): void {
  open = null
  listeners.clear()
  targets.clear()
}
