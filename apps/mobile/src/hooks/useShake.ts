import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { createShakeGate } from '../lib/gift'

/** Ten samples a second: enough to see a shake, cheap enough to leave on. */
const SAMPLE_INTERVAL_MS = 100

/**
 * Shake to open.
 *
 * Listens to the accelerometer while `enabled` and calls `onShake` once per
 * shake, as `createShakeGate` in `lib/gift.ts` defines one. `available`
 * turns true only once the sensor is actually subscribed, so the screen's
 * copy can say "shake" only where a shake can be heard — a phone with the
 * sensor, not the web build, not a simulator, not a binary that shipped
 * before `expo-sensors` did.
 *
 * The module is imported lazily: a native module at module scope breaks the
 * web bundle, and an `import()` that rejects is the honest answer on a
 * runtime without the module rather than a crash at launch.
 */
export function useShake(onShake: () => void, enabled: boolean): { available: boolean } {
  const [available, setAvailable] = useState(false)
  // The latest handler, so the subscription need not restart when the screen
  // re-renders with a new closure.
  const handler = useRef(onShake)
  handler.current = onShake

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setAvailable(false)
      return
    }
    let cancelled = false
    let subscription: { remove: () => void } | null = null

    void (async () => {
      try {
        const { Accelerometer } = await import('expo-sensors')
        if (cancelled || !(await Accelerometer.isAvailableAsync())) return
        Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
        const gate = createShakeGate()
        subscription = Accelerometer.addListener((sample) => {
          if (gate(sample, Date.now())) handler.current()
        })
        if (cancelled) subscription.remove()
        else setAvailable(true)
      } catch {
        // No module, or no permission to the sensor: the box is still a button.
      }
    })()

    return () => {
      cancelled = true
      subscription?.remove()
      setAvailable(false)
    }
  }, [enabled])

  return { available }
}
