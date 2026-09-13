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
  TOUR_GUEST_BODIES,
  TOUR_TABS,
  tourBodyKey,
  tourCta,
  registerTourCta,
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

describe('where a step stands', () => {
  it('sends the three tab steps to their own tab', () => {
    const tabs = TOUR_STEPS.filter((step) => step.target.startsWith('tab'))
    expect(tabs.map((step) => step.tab)).toEqual([TOUR_TABS.chats, TOUR_TABS.feed, TOUR_TABS.me])
  })

  /** Otherwise the run ends pointing at a card on a screen nobody is on. */
  it('comes back to Discovery for the last step', () => {
    expect(TOUR_STEPS.at(-1)).toEqual({ target: 'discoverCard', tab: TOUR_TABS.discover })
  })

  it('leaves the Discovery chrome steps where they already are', () => {
    for (const step of TOUR_STEPS.slice(0, 3)) expect(step.tab).toBeUndefined()
  })
})

describe('wording a step', () => {
  it('gives an account the plain body for every target', () => {
    for (const target of TOUR_TARGETS) {
      expect(tourBodyKey(target, { guest: false })).toBe(`tour.${target}Body`)
    }
  })

  /** Only the targets that say so — a guest reads the same sentence elsewhere. */
  it('gives a guest its own body only where one is declared', () => {
    for (const target of TOUR_TARGETS) {
      const expected = TOUR_GUEST_BODIES.includes(target)
        ? `tour.${target}GuestBody`
        : `tour.${target}Body`
      expect(tourBodyKey(target, { guest: true })).toBe(expected)
    }
  })
})

describe('the offer on the last step', () => {
  it('is whatever registered last, and is gone once unregistered', () => {
    const run = (): void => undefined
    const unregister = registerTourCta({ name: 'Anna', run })
    expect(tourCta()?.name).toBe('Anna')
    unregister()
    expect(tourCta()).toBeNull()
  })

  it('does not let a stale unregister drop the current offer', () => {
    const unregisterFirst = registerTourCta({ name: 'Anna', run: () => undefined })
    registerTourCta({ name: 'Olga', run: () => undefined })
    unregisterFirst()
    expect(tourCta()?.name).toBe('Olga')
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
    // The first step that is neither available nor on a tab of its own.
    const resolved = resolveFrom(state, (target) => target === 'discoverFilters')
    expect(currentStep(resolved!)?.target).toBe('discoverFilters')
  })

  /**
   * A step waiting for a mount is reachable by definition: the host opens the
   * screen its target lives on before measuring. Asking first is what made the
   * run skip its whole tail the moment it left Discovery.
   */
  it('lets a step through when it is waiting for a mount', () => {
    const resolved = resolveFrom(startTour({ guest: false }), () => false)
    expect(resolved?.index).toBe(TOUR_STEPS.findIndex((step) => step.awaitsMount))
  })

  /**
   * Only the Feed's two steps wait. Everything else the run points at is
   * mounted — the tab-bar icons whatever tab is showing, Discovery throughout
   * — so "not registered" there means genuinely absent.
   */
  it('waits only for the screen the run itself opens', () => {
    expect(TOUR_STEPS.filter((step) => step.awaitsMount).map((step) => step.target)).toEqual([
      'feedAsk',
      'feedKinds',
    ])
  })

  /**
   * The ending is an offer, and an empty list has nobody to offer. Left to the
   * old rule — every step that names a tab gets through — it dimmed the screen
   * for a second while the host asked eight times for a card that was never
   * coming, then closed on nothing.
   */
  it('ends rather than waiting for a card that is not there', () => {
    const beforeTheCard = {
      steps: TOUR_STEPS,
      index: TOUR_STEPS.findIndex((step) => step.target === 'discoverCard'),
      guest: false,
    }
    expect(resolveFrom(beforeTheCard, (target) => target !== 'discoverCard')).toBeNull()
    expect(resolveFrom(beforeTheCard, all)?.index).toBe(beforeTheCard.index)
  })

  /** With nothing mounted and nothing to wait for there is no tour at all. */
  it('ends the run when nothing is available and nothing navigates', () => {
    const only = { steps: [{ target: 'discoverPair' as const }], index: 0, guest: false }
    expect(resolveFrom(only, () => false)).toBeNull()
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
