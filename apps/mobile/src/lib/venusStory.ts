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
  /**
   * The day's still, `venus-day007-tr.jpg` beside the video, or `null` when
   * the manifest lists none. Shown before the first frame plays and again
   * when the video ends; without one, the player holds the last frame.
   */
  coverUrl: string | null
}

/** The streak as `GET /me/tokens` sends it. */
export interface VenusStreak {
  current: number
  longest: number
  lastQualifiedDay: string | null
  qualifiedToday: boolean
}

/**
 * The videos the bucket holds, keyed `<locale>/<file name>`, each with the
 * file name of its cover, or `null` when it has none.
 *
 * Read from `manifest.json`, which `venus/gen/batch.mjs` writes as
 * `{ videos: [{ day, lang, file, cover }] }` with `file` — and `cover`, the
 * day's still — paths on the machine that rendered them: only the last
 * segment is the name in the bucket, and the cover sits in the same folder as
 * its video. An entry without `file` stands for the plain cut of its day.
 * Anything unreadable is skipped rather than thrown: a half-broken manifest
 * should cost the days it spoils, not every day — and an unreadable `cover`
 * costs only the cover.
 */
export type VenusManifest = ReadonlyMap<string, string | null>

function lastSegment(path: unknown): string | null {
  if (typeof path !== 'string') return null
  const name = path.slice(path.lastIndexOf('/') + 1)
  return name.length > 0 ? name : null
}

export function parseVenusManifest(json: unknown): VenusManifest {
  const found = new Map<string, string | null>()
  const videos = (json as { videos?: unknown } | null)?.videos
  if (!Array.isArray(videos)) return found
  for (const entry of videos as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue
    const { day, lang, file, cover } = entry as {
      day?: unknown
      lang?: unknown
      file?: unknown
      cover?: unknown
    }
    if (typeof lang !== 'string' || lang.length === 0) continue
    const name =
      lastSegment(file) ??
      (typeof day === 'number' && Number.isInteger(day) && day > 0
        ? venusFileName(day, lang, 'day')
        : null)
    if (name) found.set(`${lang}/${name}`, lastSegment(cover))
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
  const key = `${locale}/${fileName}`
  if (!manifest.has(key)) return null
  const folder = `${baseUrl.replace(/\/+$/, '')}/${locale}`
  const cover = manifest.get(key) ?? null
  return {
    day: streak.current,
    locale,
    cut,
    dayKey,
    fileName,
    url: `${folder}/${fileName}`,
    coverUrl: cover ? `${folder}/${cover}` : null,
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
 * Whether this account has already watched `video` to its end on this device
 * (`FLAG_KEYS.venusStoryWatched`, the same per-account map as the seen one,
 * written with `markVenusSeen`). A replay from the flame then keeps Share on
 * screen from its first frame: the person has seen the video through, and
 * what they are back for is as likely the button as the picture.
 */
export function hasWatchedVenus(
  watched: VenusSeen | null,
  accountId: string | undefined,
  dayKey: string,
): boolean {
  return !!accountId && watched?.[accountId] === dayKey
}

/** The videos' shape: rendered 1080 × 1920. */
export const VENUS_ASPECT = 9 / 16

/**
 * How much of the picture's width the player may cut off, per side, to fill a
 * phone taller than 9:16. The captions are burned in, and their bubble — a
 * fixed width, set a little left of centre — comes to about 6% of the left
 * edge, so a deeper cut would run it into the screen's edge. A 19.5:9 phone
 * would need about 9% to fill completely; what the cap leaves over is a strip
 * at the top a little taller than the status bar, which sits there anyway.
 */
export const VENUS_MAX_SIDE_CROP = 0.05

export interface VenusFrame {
  width: number
  height: number
  left: number
  top: number
}

/**
 * Where the video is drawn on a screen of `width` × `height`.
 *
 * On a screen as wide as 9:16 or wider — a tablet, a desktop browser — the
 * whole picture, as tall as the screen and centred. On a taller phone, as
 * tall as it can be without cutting more than `VENUS_MAX_SIDE_CROP` off each
 * side, and pinned to the bottom: what is left over goes to the top, under
 * the status bar, rather than splitting into two bars, and the picture's foot
 * — where Venus stands — meets the screen's.
 */
export function venusFrameFor(width: number, height: number): VenusFrame {
  if (width <= 0 || height <= 0) return { width: 0, height: 0, left: 0, top: 0 }
  if (width / height >= VENUS_ASPECT) {
    const frameWidth = height * VENUS_ASPECT
    return { width: frameWidth, height, left: (width - frameWidth) / 2, top: 0 }
  }
  const frameWidth = Math.min(height * VENUS_ASPECT, width / (1 - 2 * VENUS_MAX_SIDE_CROP))
  const frameHeight = frameWidth / VENUS_ASPECT
  return {
    width: frameWidth,
    height: frameHeight,
    left: (width - frameWidth) / 2,
    top: height - frameHeight,
  }
}

/**
 * The name the shared file goes out under. iOS titles its share sheet with
 * the file's name, so the bucket's `venus-day007-tr` was the first thing a
 * person read there; this is the localised title instead, with the characters
 * a file system refuses taken out.
 */
export function venusShareFileName(title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${safe || 'Venus'}.mp4`
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

/*
 * Whether the player is on screen — a latch like `proWelcome.ts`, read by the
 * store-review prompt. A milestone day both opens the story and asks for a
 * review, from the same check-in, and the store's sheet landed on top of
 * Venus mid-sentence. The review waits for the story to close instead.
 */
let storyOpen = false
const openListeners = new Set<Listener>()

export function setVenusStoryOpen(open: boolean): void {
  if (storyOpen === open) return
  storyOpen = open
  for (const listener of openListeners) listener()
}

export function isVenusStoryOpen(): boolean {
  return storyOpen
}

export function subscribeToVenusStoryOpen(listener: Listener): () => void {
  openListeners.add(listener)
  return () => {
    openListeners.delete(listener)
  }
}

/** Resolves at once when the story is not open, and when it closes otherwise. */
export function venusStoryClosed(): Promise<void> {
  if (!storyOpen) return Promise.resolve()
  return new Promise((resolve) => {
    const unsubscribe = subscribeToVenusStoryOpen(() => {
      if (storyOpen) return
      unsubscribe()
      resolve()
    })
  })
}
