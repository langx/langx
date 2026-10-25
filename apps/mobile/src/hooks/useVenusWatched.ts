import { useEffect, useSyncExternalStore } from 'react'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import { markVenusSeen, type VenusSeen } from '../lib/venusStory'

/*
 * Which counted day's Venus video each account has watched to its end on
 * this device (`FLAG_KEYS.venusStoryWatched`, which the player writes when a
 * video ends). Held in memory as well as on disk so Home's streak row,
 * mounted under the player, changes the moment the video ends rather than on
 * its next mount — which is why the player writes through `noteVenusWatched`.
 */
let watched: VenusSeen | null | undefined
let reading: Promise<void> | undefined
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function read(): Promise<void> {
  reading ??= readJsonFlag<VenusSeen>(FLAG_KEYS.venusStoryWatched).then((stored) => {
    if (watched === undefined) {
      watched = stored
      emit()
    }
  })
  return reading
}

/** Called when the player reaches the video's end. */
export async function noteVenusWatched(accountId: string, dayKey: string): Promise<void> {
  // Read first, or a video ending before the disk answered would write over
  // the other accounts on the device.
  await read()
  watched = markVenusSeen(watched ?? null, accountId, dayKey)
  emit()
  await writeJsonFlag(FLAG_KEYS.venusStoryWatched, watched)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): VenusSeen | null | undefined {
  return watched
}

/** The watched map, or `undefined` until the device has been read. */
export function useVenusWatched(): VenusSeen | null | undefined {
  useEffect(() => {
    void read()
  }, [])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
