/**
 * When the Me screen asks a photoless account to add a photo.
 *
 * Only the owner ever sees it; viewers see the drawn face like any other,
 * with no note that a photo is missing. Closing it puts it away for a week
 * on this device, for this account. No counts, no pressure, and it never
 * blocks anything — a drawn face is a fine way to use LangX.
 *
 * Pure: the stored map comes in, the answer or the new map goes out.
 */

/** How long a closed card stays away. */
export const PHOTO_NUDGE_QUIET_MS = 7 * 24 * 60 * 60 * 1000

/** Accounts remembered per device; the oldest closes are forgotten first. */
const MAX_REMEMBERED = 10

type Stored = Record<string, string>

function asMap(stored: unknown): Stored {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
  const out: Stored = {}
  for (const [id, at] of Object.entries(stored)) {
    if (typeof at === 'string' && !Number.isNaN(Date.parse(at))) out[id] = at
  }
  return out
}

/** Whether to show the card to `accountId` at `now`. */
export function photoNudgeDue(stored: unknown, accountId: string, now: Date): boolean {
  const closedAt = asMap(stored)[accountId]
  if (closedAt === undefined) return true
  return now.getTime() - Date.parse(closedAt) >= PHOTO_NUDGE_QUIET_MS
}

/** The map with `accountId` closed at `now`, bounded. */
export function withPhotoNudgeClosed(stored: unknown, accountId: string, now: Date): Stored {
  const map = asMap(stored)
  delete map[accountId]
  map[accountId] = now.toISOString()
  const ids = Object.keys(map).sort((a, b) => Date.parse(map[a] ?? '') - Date.parse(map[b] ?? ''))
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX_REMEMBERED))) delete map[id]
  return map
}
