import { FEED_RANK, type PostAsk } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import {
  compareTimelineKeys,
  rankTimeline,
  scorePost,
  type TimelineCandidate,
  type TimelineViewer,
} from './timelineRank'

const NOW = new Date('2026-09-27T12:00:00Z')
const HOUR = 60 * 60 * 1000

/** A Turkish speaker learning English, who follows `friend`. */
function viewer(overrides: Partial<TimelineViewer> = {}): TimelineViewer {
  return {
    id: 'me',
    native: new Set(['tr']),
    learning: new Set(['en']),
    audience: new Set(['friend']),
    canAnswer: true,
    ...overrides,
  }
}

let seq = 0
function post(
  fields: Partial<Omit<TimelineCandidate, 'createdAt'>> & { hoursAgo?: number } = {},
): TimelineCandidate {
  const { hoursAgo = 0, ...rest } = fields
  seq++
  return {
    _id: new ObjectId(seq.toString(16).padStart(24, '0')),
    authorId: 'stranger',
    createdAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    language: 'fr',
    asks: [],
    correctionCount: 0,
    answerCount: 0,
    ...rest,
  }
}

const score = (p: TimelineCandidate, v = viewer(), repeats = 0) => scorePost(p, v, NOW, repeats)
const ask = (asks: PostAsk[], rest: Parameters<typeof post>[0] = {}) =>
  post({ asks, language: 'tr', ...rest })

describe('the timeline score, term by term', () => {
  it('gives every post the base weight, so nothing ranks at zero', () => {
    expect(score(post())).toBeCloseTo(FEED_RANK.base)
  })

  it('weighs the people you follow or talk to', () => {
    expect(score(post({ authorId: 'friend' }))).toBeCloseTo(FEED_RANK.base + FEED_RANK.audience)
  })

  it('weighs a post in a language you learn', () => {
    expect(score(post({ language: 'en' }))).toBeCloseTo(FEED_RANK.base + FEED_RANK.peer)
  })

  it('weighs an open ask in your native language', () => {
    expect(score(ask(['correction']))).toBeCloseTo(FEED_RANK.base + FEED_RANK.needsYou)
    expect(score(ask(['pronunciation']))).toBeCloseTo(FEED_RANK.base + FEED_RANK.needsYou)
  })

  // Familiarity is not exchange: a moment in the reader's own language asks
  // nothing of them and teaches them nothing.
  it('gives a moment in your own native language no language bonus', () => {
    expect(score(post({ language: 'tr' }))).toBeCloseTo(FEED_RANK.base)
  })

  it('never boosts an ask for a guest or an unverified reader', () => {
    expect(score(ask(['correction']), viewer({ canAnswer: false }))).toBeCloseTo(FEED_RANK.base)
  })

  it('treats a reader with no profile as speaking and learning nothing', () => {
    const nobody = viewer({ native: new Set(), learning: new Set(), audience: new Set() })
    expect(score(ask(['correction']), nobody)).toBeCloseTo(FEED_RANK.base)
    expect(score(post({ language: 'en' }), nobody)).toBeCloseTo(FEED_RANK.base)
  })

  it('reads a row with no asks, kind or answerCount as an open correction ask', () => {
    const legacy: TimelineCandidate = {
      _id: new ObjectId(),
      authorId: 'stranger',
      createdAt: NOW,
      language: 'tr',
      correctionCount: 0,
    }
    expect(score(legacy)).toBeCloseTo(FEED_RANK.base + FEED_RANK.needsYou)
  })
})

describe('draining', () => {
  it('drops the ask bonus once the ask has an answer', () => {
    expect(score(ask(['correction'], { correctionCount: 1 }))).toBeCloseTo(FEED_RANK.base)
    expect(score(ask(['pronunciation'], { answerCount: 1 }))).toBeCloseTo(FEED_RANK.base)
  })

  // Somebody who corrected it can still record it, so it still needs natives.
  it('keeps a post asking for both while either half is open', () => {
    const half = ask(['correction', 'pronunciation'], { correctionCount: 1, answerCount: 0 })
    expect(score(half)).toBeCloseTo(FEED_RANK.base + FEED_RANK.needsYou)
    const done = ask(['correction', 'pronunciation'], { correctionCount: 1, answerCount: 1 })
    expect(score(done)).toBeCloseTo(FEED_RANK.base)
  })
})

describe('freshness', () => {
  it('decays both halves, never below zero and never upwards', () => {
    let previous = Infinity
    for (const hoursAgo of [0, 1, 12, 36, 72, 168, 336, 1000]) {
      const value = score(ask(['correction'], { hoursAgo, authorId: 'friend' }))
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThan(previous)
      previous = value
    }
  })

  /*
   * The reason the ask decays over a week and the rest over a day and a half:
   * a question nobody has answered in three days still outranks a friend's
   * photo from yesterday.
   */
  it('keeps a three-day-old open question above a friend’s one-day-old photo', () => {
    const question = score(ask(['correction'], { hoursAgo: 72 }))
    const photo = score(post({ authorId: 'friend', language: 'en', hoursAgo: 24 }))
    expect(question).toBeGreaterThan(photo)
  })

  it('lets a two-week-old open question sink to about the base weight', () => {
    expect(score(ask(['correction'], { hoursAgo: 336 }))).toBeCloseTo(1, 0)
  })
})

describe('the order', () => {
  it('pins your own post for its first hour, newest first, then ranks it on base alone', () => {
    const fresh = post({ authorId: 'me', language: 'en', hoursAgo: 0.5 })
    const older = post({ authorId: 'me', language: 'en', hoursAgo: 0.2 })
    const stale = post({ authorId: 'me', language: 'en', hoursAgo: 2 })
    const friend = post({ authorId: 'friend', language: 'en', hoursAgo: 0.1 })
    const ranked = rankTimeline([fresh, older, stale, friend], viewer(), NOW)

    expect(ranked.slice(0, 2).map((key) => key.tier)).toEqual([0, 0])
    expect(ranked[0]?._id).toEqual(older._id)
    expect(ranked[1]?._id).toEqual(fresh._id)
    // After the pin, no audience, peer or ask bonus for your own post.
    const repeatsForStale = 2
    expect(score(stale, viewer(), repeatsForStale)).toBeCloseTo(
      0.5 ** repeatsForStale * 0.5 ** (2 / 36),
    )
    expect(ranked.at(-1)?._id).toEqual(stale._id)
  })

  it('halves each older post by the same author in the window', () => {
    const posts = [0, 0.1, 0.2].map((hoursAgo) => post({ authorId: 'friend', hoursAgo }))
    const ranked = rankTimeline(posts, viewer(), NOW)
    const [first, second, third] = ranked
    expect(first?._id).toEqual(posts[0]?._id)
    expect((second?.score ?? 0) / (first?.score ?? 1)).toBeCloseTo(0.5, 1)
    expect((third?.score ?? 0) / (first?.score ?? 1)).toBeCloseTo(0.25, 1)
  })

  it('breaks an exact tie by id, the `recent` index’s own tie-break', () => {
    const c = post({ hoursAgo: 3, authorId: 'x' })
    const d = post({ hoursAgo: 3, authorId: 'y' })
    const tied = rankTimeline([c, d], viewer(), NOW)
    expect(tied[0]?.score).toBe(tied[1]?.score)
    // Same score, same millisecond: the larger id comes first, as on `recent`.
    expect(tied.map((key) => key._id)).toEqual([d._id, c._id])
  })

  it('is a total order that the cursor can resume from', () => {
    const posts = Array.from({ length: 30 }, (_, i) =>
      post({ authorId: `a${i % 4}`, language: i % 2 ? 'en' : 'tr', hoursAgo: i * 3 }),
    )
    const ranked = rankTimeline(posts, viewer(), NOW)
    for (let i = 1; i < ranked.length; i++) {
      expect(compareTimelineKeys(ranked[i - 1]!, ranked[i]!)).toBeLessThan(0)
    }
    // Deterministic: ranking the same window again is the same order.
    expect(rankTimeline([...posts].reverse(), viewer(), NOW)).toEqual(ranked)
  })
})
