import { FLAG_KEYS, readFlag, writeFlag } from './localFlags'

/**
 * A stable id for this installation.
 *
 * Minted on first read and kept in `localFlags`, which is already the
 * documented home for things that belong to the device rather than the account
 * — the theme, the locale, whether the push dialog has been shown — and
 * already degrades to "nothing stored" rather than throwing on a device whose
 * storage is unavailable.
 *
 * A `crypto.randomUUID` where there is one, and a random string where there is
 * not. Nothing about this needs to be unguessable: it identifies a row that is
 * already scoped to the signed-in account, and the only thing it must be is
 * different from the other phone's.
 *
 * Held in memory as well, so the many callers in one session share a read.
 */
let cached: string | null = null
let inFlight: Promise<string> | null = null

export async function deviceId(): Promise<string> {
  if (cached) return cached
  inFlight ??= mint()
  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

async function mint(): Promise<string> {
  const stored = await readFlag(FLAG_KEYS.deviceId)
  if (stored) {
    cached = stored
    return stored
  }
  const minted = newId()
  cached = minted
  await writeFlag(FLAG_KEYS.deviceId, minted)
  return minted
}

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  if (random) return random
  // No `crypto` — an old Android WebView, or a JS engine without it. Two
  // random runs plus the clock is far more than enough to separate two phones.
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

/** Test seam: forget the in-memory copy so the next call reads storage again. */
export function forgetDeviceIdCache(): void {
  cached = null
  inFlight = null
}
