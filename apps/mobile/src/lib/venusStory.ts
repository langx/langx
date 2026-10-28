import { shiftDayKey } from '@langx/shared'
import { dismissDirection } from './pinch'

/*
 * Venus's daily streak story (`flags.venusStories`), as pure rules: which
 * file is today's, whether it opens by itself, where it may open, and which
 * days of her archive are open to watch again. The
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

/**
 * One file in the bucket and what the player needs to play it: any day's
 * video, today's or one from the archive (`venusArchive`).
 */
export interface VenusClip {
  /** The streak count the video is for. */
  day: number
  locale: string
  cut: VenusCut
  fileName: string
  url: string
  /**
   * The day's still, `venus-day007-tr.jpg` beside the video, or `null` when
   * the manifest lists none. Shown before the first frame plays and again
   * when the video ends; without one, the player holds the last frame.
   */
  coverUrl: string | null
  /**
   * What the player opens instead when this file will not load — the
   * introduction film's day 1 (`venusIntroFilm`). Without one, a file that
   * will not load closes the player.
   */
  fallback?: VenusClip
}

/** Today's video: a clip tied to the day that counted. */
export interface VenusVideo extends VenusClip {
  /** The profile's day that counted, `YYYY-MM-DD` — what "once a day" is keyed by. */
  dayKey: string
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

  const clip = venusClipFor({
    day: streak.current,
    cut: venusCutFor(streak),
    locale,
    manifest,
    baseUrl,
  })
  return clip ? { ...clip, dayKey } : null
}

/** One day's cut in `locale`, or `null` when the bucket does not hold it. */
export function venusClipFor(input: {
  day: number
  cut: VenusCut
  locale: string
  manifest: VenusManifest
  baseUrl: string
}): VenusClip | null {
  const { day, cut, locale, manifest, baseUrl } = input
  const fileName = venusFileName(day, locale, cut)
  const key = `${locale}/${fileName}`
  if (!manifest.has(key)) return null
  const folder = `${baseUrl.replace(/\/+$/, '')}/${locale}`
  const cover = manifest.get(key) ?? null
  return {
    day,
    locale,
    cut,
    fileName,
    url: `${folder}/${fileName}`,
    coverUrl: cover ? `${folder}/${cover}` : null,
  }
}

/**
 * The introduction film ("Venus: Starring Herself", `tools/venus/film.mjs`)
 * in each locale it has a cut in: the file's name without `.mp4`, beside that
 * locale's days, with its `.jpg` cover under the same name. en, tr, de and es
 * are voiced; fr, pt-BR, ru and ar are the silent cut — music, sound effects
 * and her lines as subtitles in the picture. The bucket's `v1` is immutable
 * and cached for a year, so a cut that changes — voicing one of the four —
 * goes up under a new name, and the change here is that locale's line
 * (`fr: 'venus-intro-fr-r2'`).
 */
const VENUS_INTRO_FILES = {
  en: 'venus-intro-en',
  tr: 'venus-intro-tr',
  de: 'venus-intro-de',
  es: 'venus-intro-es',
  fr: 'venus-intro-fr',
  'pt-BR': 'venus-intro-pt-BR',
  ru: 'venus-intro-ru',
  ar: 'venus-intro-ar',
} as const

function hasIntroCut(locale: string): locale is keyof typeof VENUS_INTRO_FILES {
  return Object.prototype.hasOwnProperty.call(VENUS_INTRO_FILES, locale)
}

/**
 * The introduction film behind the Venus page's "Watch the introduction", in
 * the locale of `dayOne` — the archive's day 1, which says the bucket holds
 * Venus in the app's language — or in English when the film has no cut in
 * it. The film is not in the manifest, which lists days, so nothing here can
 * tell that its file is there: `dayOne` comes along as the fallback, and a
 * film that will not load plays day 1 instead, the page's introduction
 * before the film existed.
 *
 * Day 1 as far as the player is concerned — "Day 1 with Venus" on the end
 * panel, the share file's name — because the film is her introduction, and
 * that is what day 1 is too.
 */
export function venusIntroFilm(dayOne: VenusClip, baseUrl: string): VenusClip {
  const locale = hasIntroCut(dayOne.locale) ? dayOne.locale : 'en'
  const name = VENUS_INTRO_FILES[locale]
  const folder = `${baseUrl.replace(/\/+$/, '')}/${locale}`
  return {
    day: 1,
    locale,
    cut: 'intro',
    fileName: `${name}.mp4`,
    url: `${folder}/${name}.mp4`,
    coverUrl: `${folder}/${name}.jpg`,
    fallback: dayOne,
  }
}

/**
 * How many of Venus's days are open to watch again: day 1 through this one.
 *
 * Up to the **longest** streak, not the current one, so a streak that ends
 * takes back nothing already reached — somebody back on day 2 after a run of
 * forty keeps the forty. `current` is in the maximum only as a guard against
 * an answer whose `longest` has not caught up with today yet.
 *
 * Day 1 is open to everybody, with no streak at all: it is the introduction,
 * Venus saying who she is, and the Venus page offers it to anyone who opens it.
 * Leaving it locked in the archive under a button that plays it would be the
 * page contradicting itself.
 */
export function venusUnlockedDays(
  streak: Pick<VenusStreak, 'current' | 'longest'> | undefined,
): number {
  const reached = Math.max(streak?.current ?? 0, streak?.longest ?? 0)
  return Number.isFinite(reached) ? Math.max(1, Math.floor(reached)) : 1
}

/** One day of the archive: its clip, and whether it is open yet. */
export interface VenusArchiveDay {
  day: number
  open: boolean
  clip: VenusClip
}

/**
 * Every day the bucket holds in `locale`, in order, each as its plain cut —
 * day 1 is the introduction, never the comeback, which belongs to the day it
 * was made for. Days are read off the manifest rather than counted up to a
 * number, so the archive is exactly what the bucket holds: a day with no file
 * is not listed, and nothing promises a day that would not play.
 */
export function venusArchive(input: {
  manifest: VenusManifest
  locale: string
  baseUrl: string
  unlocked: number
}): VenusArchiveDay[] {
  const { manifest, locale, baseUrl, unlocked } = input
  const prefix = `${locale}/`
  const days = new Set<number>()
  for (const key of manifest.keys()) {
    if (!key.startsWith(prefix)) continue
    const match = /^venus-day(\d+)-/.exec(key.slice(prefix.length))
    const day = match ? Number(match[1]) : 0
    if (day > 0) days.add(day)
  }
  return [...days]
    .sort((a, b) => a - b)
    .flatMap((day) => {
      const clip = venusClipFor({
        day,
        cut: day === 1 ? 'intro' : 'day',
        locale,
        manifest,
        baseUrl,
      })
      return clip ? [{ day, open: day <= unlocked, clip }] : []
    })
}

/**
 * How much of the archive the streak page's strip and the Venus page's grid
 * show before "See all": `size` days at most, of which up to `locked` are the
 * next ones still shut. A preview, so it never sends a person through a
 * hundred blurred covers, nor downloads them — each is a full-size still.
 */
export const VENUS_SHELF = { size: 12, locked: 3 } as const

/**
 * The days to draw, in order: the open days nearest the edge of what has been
 * reached, then the next few still locked, so the newest days and the ones
 * coming up are side by side rather than a scroll apart. `size` may be
 * `Infinity` for every open day.
 */
export function venusShelf(
  days: readonly VenusArchiveDay[],
  { size, locked }: { size: number; locked: number } = VENUS_SHELF,
): VenusArchiveDay[] {
  const shut = days.filter((day) => !day.open).slice(0, Math.max(0, locked))
  const room = Math.max(0, size - shut.length)
  const open = days.filter((day) => day.open)
  return [...(room > 0 ? open.slice(-room) : []), ...shut]
}

/**
 * The streak page's strip: today's video first, when there is one, then the
 * shelf without today's day — today's cover already stands for it, and day 1
 * twice (the comeback today, the introduction beside it) would read as a
 * mistake.
 */
export function venusStrip(
  days: readonly VenusArchiveDay[],
  todayDay: number | null,
): VenusArchiveDay[] {
  if (todayDay === null) return venusShelf(days)
  return venusShelf(
    days.filter((day) => day.day !== todayDay),
    { size: VENUS_SHELF.size - 1, locked: VENUS_SHELF.locked },
  )
}

/**
 * The Venus page's grid before "Show all": the shelf, with today's day always
 * on it. The shelf's open days are the newest reached, which on an unbroken
 * run ends on today; after a break it ends on the longest run instead — days
 * 32 to 40 for somebody back on day 2 — and today's video, the one thing the
 * reader came for, waited behind "Show all". Then today's day takes the
 * oldest of those places and stands in its own, by day, so the grid stays the
 * shelf's size.
 */
export function venusGrid(
  days: readonly VenusArchiveDay[],
  todayDay: number | null,
): VenusArchiveDay[] {
  const shelf = venusShelf(days)
  const today = days.find((day) => day.day === todayDay)
  if (!today || shelf.includes(today)) return shelf
  const rest = venusShelf(
    days.filter((day) => day !== today),
    { size: VENUS_SHELF.size - 1, locked: VENUS_SHELF.locked },
  )
  return [...rest, today].sort((a, b) => a.day - b.day)
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
 * Whether a released drag closes the story: the photo viewer's own line
 * (`dismissDirection` — far enough, or flicked fast enough), so the app's two
 * full-screen viewers let go at the same point, but downwards only. A story
 * is closed by pulling it down; a drag that ends up above where it began is
 * somebody changing their mind.
 *
 * `'worklet'`: the player's pan calls it on the UI thread — see `lib/pinch.ts`
 * for why that is not optional.
 */
export function closesVenusStory(dy: number, vy: number): boolean {
  'worklet'
  return dismissDirection(dy, vy) === 1
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
let requestedClip: VenusClip | null = null
const replayListeners = new Set<Listener>()

function emitReplay(): void {
  replayRequests += 1
  for (const listener of replayListeners) listener()
}

/**
 * Today's video, again. Takes no argument on purpose: it is handed straight
 * to `onPress`, which would pass its event as one.
 */
export function requestVenusReplay(): void {
  requestedClip = null
  emitReplay()
}

/**
 * Any other day's video — one from the archive, or the introduction. The
 * player plays it as it plays today's, but records nothing against today:
 * watching day 5 again must not mark today's video watched.
 */
export function requestVenusClip(clip: VenusClip): void {
  requestedClip = clip
  emitReplay()
}

/** The clip the latest request asked for, or `null` when it asked for today's. */
export function venusRequestedClip(): VenusClip | null {
  return requestedClip
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
