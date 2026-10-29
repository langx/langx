import { describe, expect, it } from 'vitest'
import { DISMISS_DRAG_PX } from './pinch'
import { SHEET } from './theme/motionValues'
import {
  closesVenusStory,
  hasWatchedVenus,
  isVenusAutoOpenPath,
  isVenusStoryOpen,
  markVenusSeen,
  parseVenusManifest,
  requestVenusClip,
  requestVenusReplay,
  shouldAutoOpenVenus,
  subscribeToVenusReplay,
  VENUS_SHELF,
  venusArchive,
  venusClipFor,
  venusCutFor,
  venusFileName,
  setVenusStoryOpen,
  VENUS_ASPECT,
  VENUS_MAX_SIDE_CROP,
  venusFrameFor,
  venusGrid,
  venusIntroFilm,
  isVenusIntroFilm,
  venusReplayRequests,
  venusRequestedClip,
  venusShareFileName,
  venusShelf,
  venusStoryClosed,
  venusStrip,
  venusUnlockedDays,
  venusVideoFor,
  type VenusArchiveDay,
  type VenusStreak,
} from './venusStory'

const BASE = 'https://media.example/venus/v1'
const TODAY = '2026-10-23'

const manifest = parseVenusManifest({
  videos: [
    { day: 1, lang: 'tr', file: 'out/tr/venus-day001-tr.mp4' },
    { day: 1, lang: 'tr', file: 'out/tr/venus-day001-return-tr.mp4' },
    { day: 7, lang: 'tr', file: 'out/tr/venus-day007-tr.mp4', cover: 'out/tr/venus-day007-tr.jpg' },
    { day: 1, lang: 'en', file: 'out/en/venus-day001-en.mp4' },
    { day: 2, lang: 'pt-BR' },
  ],
})

function streak(over: Partial<VenusStreak> = {}): VenusStreak {
  return { current: 7, longest: 7, lastQualifiedDay: TODAY, qualifiedToday: true, ...over }
}

function video(over: Partial<VenusStreak> = {}, locale = 'tr', deviceToday = TODAY) {
  return venusVideoFor({ streak: streak(over), locale, manifest, baseUrl: BASE, deviceToday })
}

describe('parseVenusManifest', () => {
  it('keys entries by locale and the file name in the bucket', () => {
    expect(manifest.has('tr/venus-day007-tr.mp4')).toBe(true)
    expect(manifest.has('tr/venus-day001-return-tr.mp4')).toBe(true)
    // No `file`: the plain cut of its day.
    expect(manifest.has('pt-BR/venus-day002-pt-BR.mp4')).toBe(true)
  })

  it('keeps each video’s cover by its name in the bucket, or null', () => {
    expect(manifest.get('tr/venus-day007-tr.mp4')).toBe('venus-day007-tr.jpg')
    expect(manifest.get('tr/venus-day001-tr.mp4')).toBeNull()
    expect(manifest.get('pt-BR/venus-day002-pt-BR.mp4')).toBeNull()
  })

  it('costs a malformed cover only the cover', () => {
    const parsed = parseVenusManifest({
      videos: [
        { day: 3, lang: 'tr', cover: 42 },
        { day: 4, lang: 'tr', cover: 'out/tr/' },
        { day: 5, lang: 'tr', cover: '' },
      ],
    })
    expect([...parsed]).toEqual([
      ['tr/venus-day003-tr.mp4', null],
      ['tr/venus-day004-tr.mp4', null],
      ['tr/venus-day005-tr.mp4', null],
    ])
  })

  it('reads anything malformed as nothing rather than throwing', () => {
    expect(parseVenusManifest(null).size).toBe(0)
    expect(parseVenusManifest({ videos: 'no' }).size).toBe(0)
    expect(parseVenusManifest({ videos: [null, { day: 3 }, { lang: 'tr', day: 0 }] }).size).toBe(0)
  })
})

describe('venusFileName', () => {
  it('pads the day to three digits and marks the comeback cut', () => {
    expect(venusFileName(7, 'tr', 'day')).toBe('venus-day007-tr.mp4')
    expect(venusFileName(1, 'tr', 'intro')).toBe('venus-day001-tr.mp4')
    expect(venusFileName(1, 'ar', 'return')).toBe('venus-day001-return-ar.mp4')
    expect(venusFileName(365, 'pt-BR', 'day')).toBe('venus-day365-pt-BR.mp4')
  })
})

describe('venusCutFor', () => {
  it('introduces Venus only on a first-ever day 1', () => {
    expect(venusCutFor({ current: 1, longest: 1 })).toBe('intro')
    expect(venusCutFor({ current: 1, longest: 0 })).toBe('intro')
  })

  it('uses the comeback cut for a day 1 after a longer run ended', () => {
    expect(venusCutFor({ current: 1, longest: 12 })).toBe('return')
  })

  it('has one cut for every other day', () => {
    expect(venusCutFor({ current: 2, longest: 40 })).toBe('day')
    expect(venusCutFor({ current: 30, longest: 30 })).toBe('day')
  })
})

describe('venusVideoFor', () => {
  it('builds the URL from the base, the locale and the file name', () => {
    expect(video()).toEqual({
      day: 7,
      locale: 'tr',
      cut: 'day',
      dayKey: TODAY,
      fileName: 'venus-day007-tr.mp4',
      url: `${BASE}/tr/venus-day007-tr.mp4`,
      coverUrl: `${BASE}/tr/venus-day007-tr.jpg`,
    })
    const trailing = venusVideoFor({
      streak: streak(),
      locale: 'tr',
      manifest,
      baseUrl: `${BASE}/`,
      deviceToday: TODAY,
    })
    expect(trailing?.url).toBe(`${BASE}/tr/venus-day007-tr.mp4`)
  })

  it('has no cover URL for a day the manifest lists none for', () => {
    expect(video({ current: 1, longest: 1 })?.coverUrl).toBeNull()
  })

  it('picks the intro or the comeback file for day 1', () => {
    expect(video({ current: 1, longest: 1 })?.fileName).toBe('venus-day001-tr.mp4')
    expect(video({ current: 1, longest: 9 })?.fileName).toBe('venus-day001-return-tr.mp4')
  })

  it('never falls back from the comeback cut to the introduction', () => {
    // English has the intro but no comeback file.
    expect(video({ current: 1, longest: 1 }, 'en')?.cut).toBe('intro')
    expect(video({ current: 1, longest: 9 }, 'en')).toBeNull()
  })

  it('has nothing for a day, or a locale, the bucket does not hold', () => {
    expect(video({ current: 8, longest: 8 })).toBeNull()
    expect(video({}, 'de')).toBeNull()
    const noManifest = venusVideoFor({
      streak: streak(),
      locale: 'tr',
      manifest: undefined,
      baseUrl: BASE,
      deviceToday: TODAY,
    })
    expect(noManifest).toBeNull()
  })

  it('has nothing until today counts, so after midnight it waits for the new day', () => {
    expect(video({ qualifiedToday: false, lastQualifiedDay: '2026-10-22' })).toBeNull()
    expect(video({ current: 0, longest: 7, lastQualifiedDay: null })).toBeNull()
    const noStreak = venusVideoFor({
      streak: undefined,
      locale: 'tr',
      manifest,
      baseUrl: BASE,
      deviceToday: TODAY,
    })
    expect(noStreak).toBeNull()
  })

  it('allows the profile day to sit a day either side of the device day', () => {
    expect(video({ lastQualifiedDay: '2026-10-22' })?.dayKey).toBe('2026-10-22')
    expect(video({ lastQualifiedDay: '2026-10-24' })?.dayKey).toBe('2026-10-24')
  })

  it('ignores an answer from a cache that outlived its day', () => {
    expect(video({ lastQualifiedDay: '2026-10-21' })).toBeNull()
    expect(video({ lastQualifiedDay: '2026-10-25' })).toBeNull()
  })
})

describe('venusClipFor', () => {
  it('is the same file venusVideoFor plays, without the day key', () => {
    const today = video()
    const clip = venusClipFor({ day: 7, cut: 'day', locale: 'tr', manifest, baseUrl: BASE })
    expect(clip).toEqual({ ...today, dayKey: undefined })
    expect(clip && 'dayKey' in clip).toBe(false)
  })

  it('has nothing for a cut the bucket does not hold', () => {
    expect(
      venusClipFor({ day: 1, cut: 'return', locale: 'en', manifest, baseUrl: BASE }),
    ).toBeNull()
  })
})

describe('venusIntroFilm', () => {
  function dayOne(locale: string) {
    const clip = venusClipFor({
      day: 1,
      cut: 'intro',
      locale,
      manifest: parseVenusManifest({ videos: [{ day: 1, lang: locale }] }),
      baseUrl: BASE,
    })
    if (!clip) throw new Error(`fixture has day 1 in ${locale}`)
    return clip
  }

  it('is the film in the locale of day 1, beside the days, with its cover', () => {
    const intro = dayOne('tr')
    expect(venusIntroFilm(intro, BASE)).toEqual({
      day: 1,
      locale: 'tr',
      cut: 'intro',
      fileName: 'venus-intro-tr-r4.mp4',
      url: `${BASE}/tr/venus-intro-tr-r4.mp4`,
      coverUrl: `${BASE}/tr/venus-intro-tr-r4.jpg`,
      fallback: intro,
    })
  })

  it('is told apart from day 1, which shares its day and cut', () => {
    const intro = dayOne('en')
    expect(isVenusIntroFilm(venusIntroFilm(intro, BASE))).toBe(true)
    expect(isVenusIntroFilm(intro)).toBe(false)
  })

  it('has a cut in each of the app’s eight locales, pt-BR as the bucket spells it', () => {
    for (const locale of ['en', 'tr', 'de', 'es', 'fr', 'pt-BR', 'ru', 'ar']) {
      expect(venusIntroFilm(dayOne(locale), BASE).url).toBe(
        `${BASE}/${locale}/venus-intro-${locale}-r4.mp4`,
      )
    }
  })

  it('plays in English for a locale the film has no cut in, and falls back to that locale’s day 1', () => {
    const intro = dayOne('ja')
    const film = venusIntroFilm(intro, BASE)
    expect(film.url).toBe(`${BASE}/en/venus-intro-en-r4.mp4`)
    expect(film.coverUrl).toBe(`${BASE}/en/venus-intro-en-r4.jpg`)
    expect(film.locale).toBe('en')
    expect(film.fallback).toBe(intro)
  })

  it('takes a base URL with or without its trailing slash', () => {
    expect(venusIntroFilm(dayOne('de'), `${BASE}/`).url).toBe(`${BASE}/de/venus-intro-de-r4.mp4`)
  })

  it('leaves day 1 itself without a fallback, so a day that will not load closes', () => {
    expect(dayOne('es').fallback).toBeUndefined()
  })
})

describe('venusUnlockedDays', () => {
  it('opens every day up to the longest streak, so a broken one takes nothing back', () => {
    expect(venusUnlockedDays({ current: 2, longest: 40 })).toBe(40)
    expect(venusUnlockedDays({ current: 0, longest: 40 })).toBe(40)
  })

  it('follows the current streak when the longest has not caught up yet', () => {
    expect(venusUnlockedDays({ current: 13, longest: 12 })).toBe(13)
  })

  it('always opens day 1, the introduction', () => {
    expect(venusUnlockedDays(undefined)).toBe(1)
    expect(venusUnlockedDays({ current: 0, longest: 0 })).toBe(1)
  })

  it('reads a malformed answer as day 1 only', () => {
    expect(venusUnlockedDays({ current: Number.NaN, longest: 3 })).toBe(1)
    expect(venusUnlockedDays({ current: -4, longest: 2.7 })).toBe(2)
  })
})

describe('venusArchive', () => {
  const library = parseVenusManifest({
    videos: [
      { day: 3, lang: 'tr', file: 'tr/venus-day003-tr.mp4', cover: 'tr/venus-day003-tr.jpg' },
      { day: 1, lang: 'tr', file: 'tr/venus-day001-tr.mp4' },
      { day: 1, lang: 'tr', file: 'tr/venus-day001-return-tr.mp4' },
      { day: 2, lang: 'tr', file: 'tr/venus-day002-tr.mp4' },
      { day: 2, lang: 'en', file: 'en/venus-day002-en.mp4' },
      { day: 5, lang: 'pt-BR', file: 'pt-BR/venus-day005-pt-BR.mp4' },
    ],
  })

  it('lists the days the bucket holds in the locale, in order, each once', () => {
    const days = venusArchive({ manifest: library, locale: 'tr', baseUrl: BASE, unlocked: 2 })
    expect(days.map((day) => [day.day, day.open])).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ])
    expect(days[2]?.clip.coverUrl).toBe(`${BASE}/tr/venus-day003-tr.jpg`)
  })

  it('plays the introduction for day 1, never the comeback', () => {
    const [first] = venusArchive({ manifest: library, locale: 'tr', baseUrl: BASE, unlocked: 9 })
    expect(first?.clip.cut).toBe('intro')
    expect(first?.clip.fileName).toBe('venus-day001-tr.mp4')
  })

  it('leaves out a day 1 that only has the comeback cut', () => {
    const only = parseVenusManifest({
      videos: [{ day: 1, lang: 'de', file: 'de/venus-day001-return-de.mp4' }],
    })
    expect(venusArchive({ manifest: only, locale: 'de', baseUrl: BASE, unlocked: 9 })).toEqual([])
  })

  it('keeps a locale with a region apart from the others', () => {
    const days = venusArchive({ manifest: library, locale: 'pt-BR', baseUrl: BASE, unlocked: 9 })
    expect(days.map((day) => day.clip.url)).toEqual([`${BASE}/pt-BR/venus-day005-pt-BR.mp4`])
    expect(venusArchive({ manifest: library, locale: 'de', baseUrl: BASE, unlocked: 9 })).toEqual(
      [],
    )
  })
})

/** Days 1 to `count`, the first `open` of them open. */
function shelfDays(count: number, open: number): VenusArchiveDay[] {
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1
    const clip = { day, locale: 'tr', cut: 'day' as const, fileName: '', url: '', coverUrl: null }
    return { day, open: day <= open, clip }
  })
}

const dayNumbers = (days: readonly VenusArchiveDay[]) => days.map((day) => day.day)

describe('venusShelf', () => {
  it('shows the newest open days, then the next few still locked', () => {
    expect(dayNumbers(venusShelf(shelfDays(100, 40)))).toEqual([
      32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
    ])
    expect(venusShelf(shelfDays(100, 40)).filter((day) => !day.open)).toHaveLength(
      VENUS_SHELF.locked,
    )
  })

  it('shows every open day when there are few, without padding the locked ones', () => {
    expect(dayNumbers(venusShelf(shelfDays(100, 2)))).toEqual([1, 2, 3, 4, 5])
  })

  it('ends on the last day once everything is open', () => {
    expect(dayNumbers(venusShelf(shelfDays(100, 100)))).toEqual([
      89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
    ])
  })

  it('lists every open day when asked for all of them', () => {
    expect(venusShelf(shelfDays(100, 40), { size: Infinity, locked: 3 })).toHaveLength(43)
  })

  it('has nothing to show for an empty archive', () => {
    expect(venusShelf([])).toEqual([])
  })
})

describe('venusGrid', () => {
  it('keeps today among the first tiles when the longest streak ended far ahead of it', () => {
    // Back on day 2 after a run of forty: the shelf alone is days 32 to 43.
    const grid = venusGrid(shelfDays(100, 40), 2)
    expect(dayNumbers(grid)).toEqual([2, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43])
    expect(grid).toHaveLength(VENUS_SHELF.size)
    expect(grid.filter((day) => !day.open)).toHaveLength(VENUS_SHELF.locked)
  })

  it('keeps a comeback day 1 first, in its own place', () => {
    expect(dayNumbers(venusGrid(shelfDays(100, 40), 1))[0]).toBe(1)
  })

  it('is the shelf when today is already on it', () => {
    expect(venusGrid(shelfDays(100, 12), 12)).toEqual(venusShelf(shelfDays(100, 12)))
    expect(venusGrid(shelfDays(100, 40), 35)).toEqual(venusShelf(shelfDays(100, 40)))
  })

  it('is the shelf when there is no video today', () => {
    expect(venusGrid(shelfDays(100, 40), null)).toEqual(venusShelf(shelfDays(100, 40)))
  })
})

describe('venusStrip', () => {
  it('leaves today out of the shelf, since its own cover goes first', () => {
    const strip = venusStrip(shelfDays(100, 12), 12)
    expect(dayNumbers(strip)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15])
    // With today's cover, the strip is the shelf's size.
    expect(strip.length + 1).toBe(VENUS_SHELF.size)
  })

  it('is the shelf when there is no video today', () => {
    expect(venusStrip(shelfDays(100, 12), null)).toEqual(venusShelf(shelfDays(100, 12)))
  })

  it('drops the introduction on a comeback day 1, which today’s cover stands for', () => {
    expect(dayNumbers(venusStrip(shelfDays(100, 30), 1))).not.toContain(1)
  })
})

describe('shouldAutoOpenVenus', () => {
  const today = video()

  it('opens once per account per counted day', () => {
    expect(shouldAutoOpenVenus(today, null, 'a')).toBe(true)
    const seen = markVenusSeen(null, 'a', TODAY)
    // Every later look the same day — the flame is how it plays again.
    expect(shouldAutoOpenVenus(video(), seen, 'a')).toBe(false)
    // The next day that counts opens by itself again.
    const tomorrow = video({ lastQualifiedDay: '2026-10-24' }, 'tr', '2026-10-24')
    expect(shouldAutoOpenVenus(tomorrow, seen, 'a')).toBe(true)
  })

  it('keeps each account on the device apart', () => {
    const seen = markVenusSeen(null, 'a', TODAY)
    expect(shouldAutoOpenVenus(today, seen, 'b')).toBe(true)
  })

  it('never opens with no video or no account', () => {
    expect(shouldAutoOpenVenus(null, null, 'a')).toBe(false)
    expect(shouldAutoOpenVenus(today, null, undefined)).toBe(false)
  })
})

describe('markVenusSeen', () => {
  it('replaces the account’s day and bounds the map to the most recent accounts', () => {
    let seen = markVenusSeen(null, 'a', '2026-10-20')
    seen = markVenusSeen(seen, 'a', TODAY)
    expect(seen).toEqual({ a: TODAY })
    for (const id of ['b', 'c', 'd', 'e', 'f']) seen = markVenusSeen(seen, id, TODAY)
    expect(Object.keys(seen)).toEqual(['b', 'c', 'd', 'e', 'f'])
    expect(markVenusSeen(seen, 'z', TODAY, 1)).toEqual({ z: TODAY })
  })
})

describe('isVenusAutoOpenPath', () => {
  it('opens over the tab roots and the streak screen', () => {
    for (const path of ['/', '/home', '/chats', '/discover', '/feed', '/me', '/streak', '/home/']) {
      expect(isVenusAutoOpenPath(path)).toBe(true)
    }
  })

  it('waits while somebody is in a thread, a review or anything else', () => {
    for (const path of ['/chat/abc', '/chat-camera', '/echo', '/paywall', '/streak/history']) {
      expect(isVenusAutoOpenPath(path)).toBe(false)
    }
  })
})

describe('requestVenusReplay', () => {
  it('counts each request and tells every listener', () => {
    const before = venusReplayRequests()
    let heard = 0
    const stop = subscribeToVenusReplay(() => {
      heard += 1
    })
    requestVenusReplay()
    requestVenusReplay()
    stop()
    requestVenusReplay()
    expect(heard).toBe(2)
    expect(venusReplayRequests()).toBe(before + 3)
  })

  it('carries the day a request asks for, and forgets it on a request for today', () => {
    const clip = venusClipFor({ day: 7, cut: 'day', locale: 'tr', manifest, baseUrl: BASE })
    if (!clip) throw new Error('fixture has day 7')
    const before = venusReplayRequests()
    requestVenusClip(clip)
    expect(venusRequestedClip()).toBe(clip)
    expect(venusReplayRequests()).toBe(before + 1)
    requestVenusReplay()
    expect(venusRequestedClip()).toBeNull()
  })
})

describe('hasWatchedVenus', () => {
  it('is true only for the same account and the same counted day', () => {
    const watched = markVenusSeen(null, 'a', TODAY)
    expect(hasWatchedVenus(watched, 'a', TODAY)).toBe(true)
    expect(hasWatchedVenus(watched, 'a', '2026-10-24')).toBe(false)
    expect(hasWatchedVenus(watched, 'b', TODAY)).toBe(false)
    expect(hasWatchedVenus(null, 'a', TODAY)).toBe(false)
    expect(hasWatchedVenus(watched, undefined, TODAY)).toBe(false)
  })
})

describe('venusFrameFor', () => {
  it('shows the whole picture, centred, on a screen as wide as 9:16 or wider', () => {
    expect(venusFrameFor(1080, 1920)).toEqual({ width: 1080, height: 1920, left: 0, top: 0 })
    const desktop = venusFrameFor(1440, 900)
    expect(desktop.height).toBe(900)
    expect(desktop.width).toBeCloseTo(900 * VENUS_ASPECT)
    expect(desktop.left).toBeCloseTo((1440 - 900 * VENUS_ASPECT) / 2)
  })

  it('fills a tall phone without cutting more than the cap off either side', () => {
    const phone = venusFrameFor(402, 874)
    expect(phone.width / phone.height).toBeCloseTo(VENUS_ASPECT)
    expect(phone.width).toBeGreaterThan(402)
    // Each side loses at most the cap of the picture's width.
    expect(-phone.left / phone.width).toBeCloseTo(VENUS_MAX_SIDE_CROP)
    // Pinned to the foot: what is left over is one strip, at the top.
    expect(phone.top + phone.height).toBeCloseTo(874)
    expect(phone.top).toBeGreaterThan(0)
  })

  it('fills completely when the cap is not reached', () => {
    // A touch taller than 9:16: under the cap, so cover-fit exactly.
    const phone = venusFrameFor(390, 720)
    expect(phone.height).toBeCloseTo(720)
    expect(phone.top).toBeCloseTo(0)
  })

  it('draws nothing before the screen has a size', () => {
    expect(venusFrameFor(0, 0)).toEqual({ width: 0, height: 0, left: 0, top: 0 })
  })
})

describe('closesVenusStory', () => {
  it("closes on a drag down past the photo viewer's line, and not short of it", () => {
    expect(closesVenusStory(DISMISS_DRAG_PX + 1, 0)).toBe(true)
    expect(closesVenusStory(DISMISS_DRAG_PX, 0)).toBe(false)
    expect(closesVenusStory(40, 0)).toBe(false)
  })

  it('closes on a short flick down', () => {
    expect(closesVenusStory(30, SHEET.dismissVelocity + 1)).toBe(true)
    expect(closesVenusStory(30, SHEET.dismissVelocity)).toBe(false)
  })

  it('never closes upwards, however far or fast', () => {
    expect(closesVenusStory(-(DISMISS_DRAG_PX + 200), 0)).toBe(false)
    expect(closesVenusStory(-30, -(SHEET.dismissVelocity + 400))).toBe(false)
  })

  it('stays open when a drag down is pulled back up fast', () => {
    expect(closesVenusStory(60, -(SHEET.dismissVelocity + 400))).toBe(false)
  })
})

describe('venusShareFileName', () => {
  it('names the file by its title, without what a file system refuses', () => {
    expect(venusShareFileName('Day 7 with Venus')).toBe('Day 7 with Venus.mp4')
    expect(venusShareFileName('Venus: 7/10?')).toBe('Venus 7 10.mp4')
    expect(venusShareFileName('Venus ile 7. gün')).toBe('Venus ile 7. gün.mp4')
    expect(venusShareFileName(' / ')).toBe('Venus.mp4')
  })
})

describe('venusStoryClosed', () => {
  it('resolves at once while the story is closed, and on closing otherwise', async () => {
    await venusStoryClosed()
    setVenusStoryOpen(true)
    expect(isVenusStoryOpen()).toBe(true)
    let resolved = false
    const waiting = venusStoryClosed().then(() => {
      resolved = true
    })
    await Promise.resolve()
    expect(resolved).toBe(false)
    setVenusStoryOpen(false)
    await waiting
    expect(resolved).toBe(true)
  })
})
