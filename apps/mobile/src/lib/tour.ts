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
  'tabChats',
  'tabFeed',
  'tabMe',
  'discoverCard',
] as const

export type TourTargetId = (typeof TOUR_TARGETS)[number]

/**
 * Targets whose sentence is different for a guest.
 *
 * Only Chats today, and it has to be: a guest cannot have a conversation, so
 * the account's wording describes a list that can only be empty.
 */
export const TOUR_GUEST_BODIES: readonly TourTargetId[] = ['tabChats']

export interface TourStep {
  target: TourTargetId
}

/**
 * The run, in order.
 *
 * The screen's own chrome first, in the order a reader's eye takes it; then
 * the three tabs they have not opened yet; then the card, last, because it is
 * the only step that leads anywhere and the tour should end on the thing to
 * actually do.
 *
 * The tab steps light the **tab-bar icons** rather than navigating to each
 * tab. Navigating mid-run means unmounting the current target, waiting for the
 * next screen to lay out and measuring again — a race with no good failure
 * mode — and the bar says everything these three steps have to say.
 */
export const TOUR_STEPS: readonly TourStep[] = TOUR_TARGETS.map((target) => ({ target }))

/**
 * Which message words a step, given who is reading.
 *
 * A function rather than a template at the call site so that the guest variant
 * is a fact with a test, and so `catalogs.test.ts` can walk every key the host
 * can possibly ask for.
 */
export function tourBodyKey(target: TourTargetId, options: { guest: boolean }): string {
  return options.guest && TOUR_GUEST_BODIES.includes(target)
    ? `tour.${target}GuestBody`
    : `tour.${target}Body`
}

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

/**
 * The action the last step offers, when the screen has one to offer.
 *
 * Registered by whoever owns the target — Discovery hands over its first card —
 * because only that screen knows whose profile it is. A run with nothing
 * registered simply has no button, which is what a list that emptied while the
 * tour was playing leaves behind.
 */
export interface TourCta {
  /** Shown in the button, so the offer names a person rather than a noun. */
  name: string
  run: () => void
}

let cta: TourCta | null = null

export function registerTourCta(next: TourCta): () => void {
  cta = next
  return () => {
    if (cta === next) cta = null
  }
}

export function tourCta(): TourCta | null {
  return cta
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
  cta = null
  listeners.clear()
  targets.clear()
}
