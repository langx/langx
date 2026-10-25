import { hasWatchedVenus, type VenusSeen, type VenusVideo } from './venusStory'

/**
 * What Home's streak row makes of today's Venus video:
 *
 * - `none` — no video (flag off, today not counted, no file): the plain row,
 *   flame, next reward and chevron.
 * - `ready` — a video this account has not watched to its end today: Venus's
 *   face and a play button, and the subtitle says her video is ready.
 * - `watched` — the face and the button stay, for a replay, and the subtitle
 *   goes back to the next reward. Also the answer while the device has not
 *   yet said what was watched, so the row never announces a video and then
 *   takes it back a moment later.
 *
 * "Watched" is the player's own record (`FLAG_KEYS.venusStoryWatched`, read
 * with `hasWatchedVenus`): per account and per counted day, so the next day's
 * video is `ready` again.
 */
export type StreakRowVenus = 'none' | 'ready' | 'watched'

export function streakRowVenus(
  video: VenusVideo | null,
  watched: VenusSeen | null | undefined,
  accountId: string | undefined,
): StreakRowVenus {
  if (!video) return 'none'
  if (watched === undefined || !accountId) return 'watched'
  return hasWatchedVenus(watched, accountId, video.dayKey) ? 'watched' : 'ready'
}
