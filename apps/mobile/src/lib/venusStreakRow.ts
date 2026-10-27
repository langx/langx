import { hasWatchedVenus, type VenusSeen, type VenusVideo } from './venusStory'

/**
 * What Home's streak row makes of today's Venus video:
 *
 * - `none` — no video (flag off, today not counted, no file): the plain row,
 *   flame, next reward and chevron.
 * - `ready` — a video this account has not watched to its end today: Venus's
 *   face and a play button, and the subtitle says her video is ready.
 * - `watched` — the face and the button stay, for a replay, and the subtitle
 *   says today's video was seen.
 * - `unknown` — a video, but the device has not yet said what was watched (or
 *   there is no account to ask about). Its own state rather than `watched`,
 *   because Home's card prints `watched` as "You've seen today's video":
 *   answering it here would tell a person they had seen a video they may not
 *   have, then take it back a moment later. Nor `ready`, which would announce
 *   a video and withdraw it the same way. A caller draws it with a line that
 *   claims neither.
 *
 * "Watched" is the player's own record (`FLAG_KEYS.venusStoryWatched`, read
 * with `hasWatchedVenus`): per account and per counted day, so the next day's
 * video is `ready` again.
 */
export type StreakRowVenus = 'none' | 'ready' | 'watched' | 'unknown'

export function streakRowVenus(
  video: VenusVideo | null,
  watched: VenusSeen | null | undefined,
  accountId: string | undefined,
): StreakRowVenus {
  if (!video) return 'none'
  if (watched === undefined || !accountId) return 'unknown'
  return hasWatchedVenus(watched, accountId, video.dayKey) ? 'watched' : 'ready'
}
