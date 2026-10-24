import { describe, expect, it } from 'vitest'
import {
  isVenusAutoOpenPath,
  markVenusSeen,
  parseVenusManifest,
  requestVenusReplay,
  shouldAutoOpenVenus,
  subscribeToVenusReplay,
  venusCutFor,
  venusFileName,
  venusReplayRequests,
  venusVideoFor,
  type VenusStreak,
} from './venusStory'

const BASE = 'https://media.example/venus/v1'
const TODAY = '2026-10-23'

const manifest = parseVenusManifest({
  videos: [
    { day: 1, lang: 'tr', file: 'out/tr/venus-day001-tr.mp4' },
    { day: 1, lang: 'tr', file: 'out/tr/venus-day001-return-tr.mp4' },
    { day: 7, lang: 'tr', file: 'out/tr/venus-day007-tr.mp4' },
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
})
