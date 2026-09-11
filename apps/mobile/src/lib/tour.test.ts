import { afterEach, describe, expect, it } from 'vitest'
import {
  TOUR_STEPS,
  TOUR_TARGETS,
  advance,
  currentStep,
  hasTourTarget,
  isLastStep,
  measureTourTarget,
  progress,
  registerTourTarget,
  resetTourForTest,
  resolveFrom,
  startTour,
  stepsFor,
  subscribeToTour,
  setTourState,
  type TourState,
} from './tour'

afterEach(() => {
  resetTourForTest()
})

const rect = { x: 0, y: 0, width: 10, height: 10 }

describe('the step list', () => {
  it('points at every target exactly once, in order', () => {
    expect(TOUR_STEPS.map((step) => step.target)).toEqual([...TOUR_TARGETS])
  })

  it('gives a guest the same run as an account, for now', () => {
    expect(stepsFor({ guest: true })).toEqual(stepsFor({ guest: false }))
  })

  it('carries the guest flag on the state, not just on the call', () => {
    expect(startTour({ guest: true }).guest).toBe(true)
  })
})

describe('walking the run', () => {
  const all = (): boolean => true

  it('starts on the first step and ends after the last', () => {
    let state = startTour({ guest: false })
    expect(currentStep(state)?.target).toBe('discoverPair')
    expect(isLastStep(state)).toBe(false)

    for (let i = 1; i < TOUR_STEPS.length; i++) {
      const next = resolveFrom(advance(state), all)
      expect(next).not.toBeNull()
      state = next!
    }

    expect(isLastStep(state)).toBe(true)
    expect(resolveFrom(advance(state), all)).toBeNull()
  })

  it('skips a step whose target is not on screen', () => {
    const state = startTour({ guest: false })
    const resolved = resolveFrom(state, (target) => target === 'discoverCard')
    expect(resolved?.index).toBe(TOUR_STEPS.length - 1)
    expect(currentStep(resolved!)?.target).toBe('discoverCard')
  })

  /** Nothing to point at anywhere means no tour at all, not an empty overlay. */
  it('ends the run when no target is available', () => {
    expect(resolveFrom(startTour({ guest: false }), () => false)).toBeNull()
  })

  it('counts from one, over the whole list', () => {
    const state = startTour({ guest: false })
    expect(progress(state)).toEqual({ current: 1, total: TOUR_STEPS.length })
    expect(progress(advance(state)).current).toBe(2)
  })
})

describe('the target registry', () => {
  it('measures whatever registered under the id', async () => {
    registerTourTarget('discoverPair', () => Promise.resolve(rect))
    expect(hasTourTarget('discoverPair')).toBe(true)
    await expect(measureTourTarget('discoverPair')).resolves.toEqual(rect)
  })

  it('answers null for an id nobody has claimed', async () => {
    await expect(measureTourTarget('discoverSorts')).resolves.toBeNull()
  })

  /**
   * React mounts the replacement before unmounting the original, so the
   * cleanup that runs second must not delete the entry the first one wrote.
   */
  it('lets a re-registered target survive the old one unregistering', () => {
    const first = (): Promise<null> => Promise.resolve(null)
    const unregisterFirst = registerTourTarget('discoverCard', first)
    registerTourTarget('discoverCard', () => Promise.resolve(rect))
    unregisterFirst()
    expect(hasTourTarget('discoverCard')).toBe(true)
  })
})

describe('the store', () => {
  it('gives a new subscriber whatever is open', () => {
    const state = startTour({ guest: false })
    setTourState(state)
    const seen: (TourState | null)[] = []
    const unsubscribe = subscribeToTour((next) => seen.push(next))
    expect(seen).toEqual([state])
    setTourState(null)
    expect(seen[1]).toBeNull()
    unsubscribe()
    setTourState(state)
    expect(seen).toHaveLength(2)
  })
})
