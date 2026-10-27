import { hasWatchedVenus, type VenusSeen, type VenusVideo } from './venusStory'

/**
 * What Home makes of today's Venus video — her card in the "LangX" section
 * (`homeVenusCard`), and the streak page's strip, whose dot comes and goes
 * with the card's (`useVenusArchive`). Named for the streak row, which
 * carried the video first.
 *
 * - `none` — no video (flag off, today not counted, no file): nothing to play.
 * - `ready` — a video this account has not watched to its end today: a play
 *   button, the unwatched dot, and a line saying her video is ready.
 * - `watched` — the play button stays, for a replay; the dot goes.
 * - `unknown` — a video, but the device has not yet said what was watched (or
 *   there is no account to ask about). Its own state rather than an answer:
 *   `ready` would announce a video and withdraw it a moment later, and
 *   `watched` would be a guess passed off as a record. A caller draws it with
 *   nothing that claims either.
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
