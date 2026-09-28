import { isOnlineAt } from '@langx/shared'

/** The part of a cached public profile that says whether its owner is here. */
export interface PresenceFields {
  _id: string
  isOnline: boolean
  lastActiveAt?: string
}

/**
 * A cached profile brought up to date by something its owner just did.
 *
 * A message is proof of presence the server has already written — sending
 * stamps `stats.lastActiveAt` — but the profile the chat header reads is
 * cached for five minutes and nothing told it. The header went on saying
 * "Last seen 27 minutes ago" under the message that person had just sent.
 *
 * Returns `old` itself whenever there is nothing to change, so a
 * `setQueriesData` over every profile leaves the other caches untouched:
 *
 * - someone else's profile;
 * - a profile with no `lastActiveAt`, which is a profile whose owner hides
 *   their online status. The server omits the field for that, and adding it
 *   here would publish exactly what they asked it not to;
 * - a stamp at least as new as this one — a replayed or late event must not
 *   move somebody's presence backwards.
 */
export function applyPresence<T extends PresenceFields>(
  old: T | undefined,
  userId: string,
  at: string,
): T | undefined {
  if (!old || old._id !== userId || old.lastActiveAt === undefined) return old
  const next = Date.parse(at)
  if (Number.isNaN(next) || Date.parse(old.lastActiveAt) >= next) return old
  return { ...old, lastActiveAt: at, isOnline: isOnlineAt(at) }
}
