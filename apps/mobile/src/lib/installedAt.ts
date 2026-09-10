import { FLAG_KEYS, readFlag, writeFlag } from './localFlags'

/**
 * When this installation first ran, and how long ago that was.
 *
 * `onboarding_completed` wants to say how long the first minute actually took,
 * and the funnel's own step 0 cannot answer it: `Application Installed` is
 * captured server-side by PostHog and its timestamp is not readable here. So
 * the device keeps its own, minted on the first launch that runs this code —
 * the `deviceId` pattern, in the same store, degrading the same way.
 *
 * On a phone that was already running the app the stamp is minted by an
 * update rather than by an install, which is harmless: that account finished
 * onboarding long ago and never sends the event again. `null` is what a
 * device with no stamp yields, so an unreadable store reports nothing rather
 * than a number.
 */
let cached: number | null = null

/** Records the first launch, if this device has not already recorded one. */
export async function markInstalled(): Promise<void> {
  const stored = await readFlag(FLAG_KEYS.installedAt)
  if (stored) return
  const now = Date.now()
  cached = now
  await writeFlag(FLAG_KEYS.installedAt, String(now))
}

/** Whole seconds since the first launch, or `null` when nothing was recorded. */
export async function secondsSinceInstall(): Promise<number | null> {
  if (cached === null) {
    const stored = Number(await readFlag(FLAG_KEYS.installedAt))
    if (!Number.isFinite(stored) || stored <= 0) return null
    cached = stored
  }
  return Math.max(0, Math.round((Date.now() - cached) / 1000))
}

/** Test seam: forget the in-memory copy so the next call reads storage again. */
export function forgetInstalledAtCache(): void {
  cached = null
}
