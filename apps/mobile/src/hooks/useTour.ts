import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { FLAG_KEYS, readBoolFlag, setBoolFlag } from '../lib/localFlags'
import {
  hasTourTarget,
  resolveFrom,
  setTourState,
  startTour,
  subscribeToTour,
  tourState,
} from '../lib/tour'

/**
 * Guards against two screens — or two renders of one — starting the run at the
 * same moment. The flag read is a storage round-trip, and everything that
 * happens in it happens twice without this.
 */
let starting = false

/**
 * Opens the run, at most once per install.
 *
 * The flag is written **when the tour starts**, not when it ends: somebody who
 * closes the app halfway through has seen it, and replaying it at the next
 * launch would be the app failing to take a hint. Settings has the replay.
 *
 * Nothing is written when no target is mounted yet — that is a screen still
 * drawing skeletons, not a reader who has had their tour.
 */
export async function startTourOnce(options: { guest: boolean }): Promise<void> {
  if (starting || tourState()) return
  starting = true
  try {
    if (await readBoolFlag(FLAG_KEYS.discoverTourSeen)) return
    const first = resolveFrom(startTour(options), hasTourTarget)
    if (!first) return
    await setBoolFlag(FLAG_KEYS.discoverTourSeen, true)
    track({ name: 'tour_started', properties: { is_guest: options.guest } })
    setTourState(first)
  } finally {
    starting = false
  }
}

/** Clears the record of having seen it, so the next visit plays it again. */
export async function forgetTour(): Promise<void> {
  await setBoolFlag(FLAG_KEYS.discoverTourSeen, false)
}

/** Whether a run is on screen right now. */
export function useTourOpen(): boolean {
  const [open, setOpen] = useState(() => tourState() !== null)
  useEffect(() => subscribeToTour((state) => setOpen(state !== null)), [])
  return open
}

interface DiscoveryTourOptions {
  /**
   * Whether the screen is in a state worth touring: it has rendered at least
   * one real card, and nothing is covering it. A tour over skeletons points at
   * rectangles that are about to move.
   */
  ready: boolean
  guest: boolean
  /** Called once, when a run that was open has ended — however it ended. */
  onFinished?: () => void
}

/**
 * Starts the tour from the Discovery screen, and reports when it is over.
 *
 * `useFocusEffect` rather than `useEffect`, and that is what makes the Settings
 * replay work: the tab stays mounted, so a flag cleared elsewhere is only ever
 * noticed by something that re-runs when the screen is looked at again.
 */
export function useDiscoveryTour({ ready, guest, onFinished }: DiscoveryTourOptions): boolean {
  const open = useTourOpen()
  const wasOpen = useRef(false)
  const finished = useRef(onFinished)
  finished.current = onFinished

  useFocusEffect(
    useCallback(() => {
      if (ready) void startTourOnce({ guest })
    }, [guest, ready]),
  )

  useEffect(() => {
    if (open) wasOpen.current = true
    else if (wasOpen.current) {
      wasOpen.current = false
      finished.current?.()
    }
  }, [open])

  return open
}
