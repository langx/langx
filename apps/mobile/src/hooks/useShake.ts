/**
 * Shake to open.
 *
 * Not wired yet, on purpose: the accelerometer is a native module
 * (`expo-sensors`), and a bundle that imports one only reaches a binary that
 * ships it — see `docs/architecture.md` → *How it updates*. This is the shape
 * the gift screen builds against so that the sensor can arrive with the next
 * store build without the screen changing. Until then `available` is false
 * and the screen says "tap", which is also the accessibility path and the web
 * path, so the shake never becomes load-bearing.
 */
export function useShake(_onShake: () => void, _enabled: boolean): { available: boolean } {
  return { available: false }
}
