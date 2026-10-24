import { shiftDayKey } from '@langx/shared'

/*
 * Venus's daily streak story (`flags.venusStories`), as pure rules: which
 * file is today's, whether it opens by itself, and where it may open. The
 * player and the share sheet are `VenusStoryHost`; everything a test can
 * check is here, because none of it is visible in a screenshot — "is this the
 * comeback cut or the introduction", "did it already open today".
 */

/**
 * Which cut of a day it is. Day 1 has two: the **intro**, where Venus says
 * who she is, for somebody's first day ever; and the **return**, for a day 1
 * after a streak ended, which must not introduce her to somebody who has
 * already met her. Every other day has one.
 */
export type VenusCut = 'intro' | 'return' | 'day'

export interface VenusVideo {
  /** The streak count the video is for. */
  day: number
  locale: string
  cut: VenusCut
  /** The profile's day that counted, `YYYY-MM-DD` — what "once a day" is keyed by. */
  dayKey: string
  fileName: string
  url: string
}

/** The streak as `GET /me/tokens` sends it. */
export interface VenusStreak {
  current: number
  longest: number
  lastQualifiedDay: string | null
  qualifiedToday: boolean
}

/**
 * The (locale, file) pairs the bucket holds, as `<locale>/<file name>`.
 *
 * Read from `manifest.json`, which `venus/gen/batch.mjs` writes as
 * `{ videos: [{ day, lang, file }] }` with `file` a path on the machine that
 * rendered it — only its last segment is the name in the bucket. An entry
 * without `file` stands for the plain cut of its day. Anything unreadable is
 * skipped rather than thrown: a half-broken manifest should cost the days it
 * spoils, not every day.
 */
export type VenusManifest = ReadonlySet<string>

export function parseVenusManifest(json: unknown): VenusManifest {
  const found = new Set<string>()
  const videos = (json as { videos?: unknown } | null)?.videos
  if (!Array.isArray(videos)) return found
  for (const entry of videos as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue
    const { day, lang, file } = entry as { day?: unknown; lang?: unknown; file?: unknown }
    if (typeof lang !== 'string' || lang.length === 0) continue
    const name =
      typeof file === 'string' && file.length > 0
        ? file.slice(file.lastIndexOf('/') + 1)
        : typeof day === 'number' && Number.isInteger(day) && day > 0
          ? venusFileName(day, lang, 'day')
          : null
    if (name) found.add(`${lang}/${name}`)
  }
  return found
}

/** `venus-day007-tr.mp4`; the comeback day 1 is `venus-day001-return-tr.mp4`. */
export function venusFileName(day: number, locale: string, cut: VenusCut): string {
  const padded = String(day).padStart(3, '0')
  return `venus-day${padded}-${cut === 'return' ? 'return-' : ''}${locale}.mp4`
}

/**
 * Which cut today's count calls for.
 *
 * A day 1 is a comeback when a longer run is on record — the same reading
 * `streakEventsFor` makes of `streak_broken`, and from the same two numbers,
 * so no field was added to the DTO for it. Its blind spot is the same too: a
 * run that ended after a single day leaves `longest` at 1, so that person's
 * next day 1 is the introduction again. Rare, and the gentler mistake.
 */
export function venusCutFor(streak: Pick<VenusStreak, 'current' | 'longest'>): VenusCut {
  if (streak.current !== 1) return 'day'
  return streak.longest > 1 ? 'return' : 'intro'
}

/**
 * Today's video, or `null` when there is none to show — which is also the
 * answer whenever the streak has not counted today, so after midnight in the
 * profile's timezone the flame plays nothing until the new day counts, and
 * then plays the new day's.
 *
 * `deviceToday` is a sanity check, not the authority: the server says which
 * day counted, in the profile's timezone, and the device's day may differ
 * from it by one either way. A `lastQualifiedDay` further off than that is an
 * answer from a cache that outlived its day — a persisted query from last
 * week — and playing that week's video would be wrong.
 *
 * `null` too when the bucket does not hold the file. The return cut does
 * **not** fall back to the introduction: somebody coming back should see no
 * video rather than be introduced to Venus a second time.
 */
export function venusVideoFor(input: {
  streak: VenusStreak | undefined
  locale: string
  manifest: VenusManifest | undefined
  baseUrl: string
  deviceToday: string
}): VenusVideo | null {
  const { streak, locale, manifest, baseUrl, deviceToday } = input
  if (!streak || !manifest || !streak.qualifiedToday) return null
  const dayKey = streak.lastQualifiedDay
  if (!dayKey || streak.current < 1) return null
  if (dayKey < shiftDayKey(deviceToday, -1) || dayKey > shiftDayKey(deviceToday, 1)) return null

  const cut = venusCutFor(streak)
  const fileName = venusFileName(streak.current, locale, cut)
  if (!manifest.has(`${locale}/${fileName}`)) return null
  return {
    day: streak.current,
    locale,
    cut,
    dayKey,
    fileName,
    url: `${baseUrl.replace(/\/+$/, '')}/${locale}/${fileName}`,
  }
}

/**
 * Which account opened which day's video by itself on this device, stored as
 * `FLAG_KEYS.venusStorySeen`. Per account, like `firstReplyCardShown`: a
 * second account on the same phone keeps a streak of its own.
 */
export type VenusSeen = Readonly<Record<string, string>>

/** How many accounts the map remembers — a phone is shared by a few people, not dozens. */
export const VENUS_SEEN_ACCOUNTS = 5

/** True when today's video should open by itself: once per account per counted day. */
export function shouldAutoOpenVenus(
  video: VenusVideo | null,
  seen: VenusSeen | null,
  accountId: string | undefined,
): video is VenusVideo {
  if (!video || !accountId) return false
  return seen?.[accountId] !== video.dayKey
}

/**
 * The map with `accountId` marked as having opened `dayKey`. Written the
 * moment the video opens, not when it is closed, so an app killed halfway
 * through does not open it again — the flame is there to replay it.
 */
export function markVenusSeen(
  seen: VenusSeen | null,
  accountId: string,
  dayKey: string,
  limit: number = VENUS_SEEN_ACCOUNTS,
): VenusSeen {
  const rest = Object.entries(seen ?? {}).filter(([id]) => id !== accountId)
  const kept = limit > 1 ? rest.slice(-(limit - 1)) : []
  return Object.fromEntries([...kept, [accountId, dayKey]])
}

/**
 * The screens a video may open over by itself. A whitelist of the tab roots
 * and the streak screen, because the day usually counts at the moment
 * somebody sends a message — and a full-screen video landing on the thread
 * they are typing in would be the worst moment the app could pick. Anywhere
 * else it waits: the next time they come back to a tab the same day, it opens.
 * Echo's tab is left out for the same reason as a thread; a review may be
 * under way there.
 */
const AUTO_OPEN_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/home',
  '/chats',
  '/discover',
  '/feed',
  '/me',
  '/streak',
])

export function isVenusAutoOpenPath(pathname: string): boolean {
  return AUTO_OPEN_PATHS.has(pathname.replace(/\/+$/, '') || '/')
}

/*
 * The "play it again" request — a latch like `proWelcome.ts`, so the flame on
 * Home or on the streak screen can open the player that lives at the root of
 * the signed-in area without either knowing where it is drawn.
 */
type Listener = () => void

let replayRequests = 0
const replayListeners = new Set<Listener>()

export function requestVenusReplay(): void {
  replayRequests += 1
  for (const listener of replayListeners) listener()
}

/** A counter rather than a boolean, so two taps are two requests. */
export function venusReplayRequests(): number {
  return replayRequests
}

export function subscribeToVenusReplay(listener: Listener): () => void {
  replayListeners.add(listener)
  return () => {
    replayListeners.delete(listener)
  }
}
