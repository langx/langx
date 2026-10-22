import { describe, expect, it } from 'vitest'
import { isBigEmoji } from '@langx/shared'
import {
  BURST_BUDGET,
  BURST_MS,
  BURST_SIZE,
  LIVE_WINDOW_MS,
  burstCounts,
  burstEmoji,
  burstEndsAt,
  burstKind,
  burstParticles,
  burstPlan,
  burstRandom,
  drawsAsHero,
  shouldPlayBurst,
  type BurstKind,
  type BurstMoment,
} from './emojiBurst'

const always = (value: number) => () => value

describe('burstKind', () => {
  it('floats hearts up, with or without the emoji presentation selector', () => {
    expect(burstKind('❤️')).toBe('float')
    expect(burstKind('❤')).toBe('float')
    expect(burstKind('🥰')).toBe('float')
  })

  it('bursts party poppers, raises fire, drifts snow', () => {
    expect(burstKind('🎉')).toBe('burst')
    expect(burstKind('🔥')).toBe('rise')
    expect(burstKind('❄️')).toBe('drift')
  })

  it('ignores a skin tone when it looks up the kind', () => {
    expect(burstKind('😻')).toBe('float')
    expect(burstKind('👍🏽')).toBe(burstKind('👍'))
  })

  it('falls for everything else', () => {
    expect(burstKind('😂')).toBe('fall')
    expect(burstKind('👍🏽')).toBe('fall')
    expect(burstKind('🇹🇷')).toBe('fall')
  })
})

describe('burstEmoji', () => {
  it('is the emoji of a message that is one to three emoji and nothing else', () => {
    expect(burstEmoji('🎉')).toEqual(['🎉'])
    expect(burstEmoji('  ❤️ ')).toEqual(['❤️'])
    expect(burstEmoji('👨‍👩‍👧‍👦')).toEqual(['👨‍👩‍👧‍👦'])
    expect(burstEmoji('❤️🔥')).toEqual(['❤️', '🔥'])
    expect(burstEmoji('❤️ 🔥 🎉')).toEqual(['❤️', '🔥', '🎉'])
  })

  it('names a repeated emoji once', () => {
    expect(burstEmoji('😂😂')).toEqual(['😂'])
    expect(burstEmoji('🎉🔥🎉')).toEqual(['🎉', '🔥'])
  })

  it('is empty for four emoji, text, or text with an emoji', () => {
    expect(burstEmoji('🎉🎉🎉🎉')).toEqual([])
    expect(burstEmoji('hi')).toEqual([])
    expect(burstEmoji('hi 🎉')).toEqual([])
    expect(burstEmoji('7')).toEqual([])
    expect(burstEmoji('')).toEqual([])
  })

  it('bursts exactly what the hero draws big', () => {
    for (const body of ['🎉', '😂😂', '❤️🔥🎉', '🎉🎉🎉🎉', '🇹🇷', '7️⃣', '7', 'hi 🎉', '', ' ']) {
      expect(burstEmoji(body).length > 0).toBe(isBigEmoji(body))
    }
  })
})

const base: BurstMoment = {
  trigger: 'live',
  body: '🎉',
  v3: true,
  reduceMotion: false,
  focused: true,
  playing: false,
  played: false,
  ageMs: 200,
  hero: true,
}

describe('drawsAsHero', () => {
  it('is a plain text message that has not been withdrawn', () => {
    expect(drawsAsHero({ type: 'text' })).toBe(true)
    expect(drawsAsHero({ type: 'text', deleted: false })).toBe(true)
    expect(drawsAsHero({ type: 'text', deleted: true })).toBe(false)
  })

  it('is not a photo, a video or a voice note, whatever its caption', () => {
    for (const type of ['image', 'video', 'audio', 'sticker']) {
      expect(drawsAsHero({ type })).toBe(false)
    }
  })
})

describe('shouldPlayBurst', () => {
  it('plays a big emoji sent from here, or arriving live while the thread is open', () => {
    expect(shouldPlayBurst({ ...base, trigger: 'sent' })).toBe(true)
    expect(shouldPlayBurst(base)).toBe(true)
  })

  it('never plays for history, however it arrives', () => {
    expect(shouldPlayBurst({ ...base, trigger: 'history' })).toBe(false)
    expect(shouldPlayBurst({ ...base, trigger: 'history', played: false, ageMs: 0 })).toBe(false)
  })

  it('does not replay a message that has already burst, unless it is tapped', () => {
    expect(shouldPlayBurst({ ...base, played: true })).toBe(false)
    expect(shouldPlayBurst({ ...base, trigger: 'sent', played: true })).toBe(false)
    expect(shouldPlayBurst({ ...base, trigger: 'tap', played: true })).toBe(true)
  })

  it('treats a stale socket delivery as history', () => {
    expect(shouldPlayBurst({ ...base, ageMs: LIVE_WINDOW_MS })).toBe(true)
    expect(shouldPlayBurst({ ...base, ageMs: LIVE_WINDOW_MS + 1 })).toBe(false)
    expect(shouldPlayBurst({ ...base, ageMs: 5 * 60_000 })).toBe(false)
    const { ageMs: _, ...undated } = base
    expect(shouldPlayBurst(undated)).toBe(false)
  })

  it('still plays when the device clock runs a little slow, but not a lot', () => {
    expect(shouldPlayBurst({ ...base, ageMs: -3_000 })).toBe(true)
    expect(shouldPlayBurst({ ...base, ageMs: -LIVE_WINDOW_MS })).toBe(true)
    expect(shouldPlayBurst({ ...base, ageMs: -LIVE_WINDOW_MS - 1 })).toBe(false)
  })

  it('never plays for a lone emoji that is not drawn as the big emoji', () => {
    // A photo, a video or a voice note captioned with one emoji, or a
    // withdrawn message: no hero bubble, so no burst and nothing to replay.
    for (const trigger of ['sent', 'live', 'tap'] as const) {
      expect(shouldPlayBurst({ ...base, trigger, hero: false })).toBe(false)
    }
  })

  it('does not play live into a thread that is not in front', () => {
    expect(shouldPlayBurst({ ...base, focused: false })).toBe(false)
  })

  it('never stacks: a burst already playing wins', () => {
    for (const trigger of ['sent', 'live', 'tap'] as const) {
      expect(shouldPlayBurst({ ...base, trigger, playing: true })).toBe(false)
    }
  })

  it('stays out of the current look and of reduced motion', () => {
    for (const trigger of ['sent', 'live', 'tap'] as const) {
      expect(shouldPlayBurst({ ...base, trigger, v3: false })).toBe(false)
      expect(shouldPlayBurst({ ...base, trigger, reduceMotion: true })).toBe(false)
    }
  })

  it('plays for two or three emoji, the same or mixed', () => {
    for (const body of ['🎉🎉', '❤️🔥', '❤️🔥🎉']) {
      expect(shouldPlayBurst({ ...base, trigger: 'sent', body })).toBe(true)
      expect(shouldPlayBurst({ ...base, trigger: 'tap', body })).toBe(true)
    }
  })

  it('plays only for what is drawn as the big emoji', () => {
    for (const body of ['🎉🎉🎉🎉', 'yay 🎉', 'yay']) {
      expect(shouldPlayBurst({ ...base, trigger: 'sent', body })).toBe(false)
      expect(shouldPlayBurst({ ...base, trigger: 'tap', body })).toBe(false)
    }
  })
})

describe('burstCounts', () => {
  it('keeps a lone emoji at its own kind count', () => {
    expect(burstCounts(['burst'])).toEqual([22])
    expect(burstCounts(['float'])).toEqual([14])
  })

  it('splits the budget across two or three emoji, first written first', () => {
    expect(burstCounts(['float', 'rise'])).toEqual([11, 11])
    expect(burstCounts(['float', 'rise', 'burst'])).toEqual([8, 7, 7])
  })

  it('never goes over the budget, whatever the mix', () => {
    const kinds: BurstKind[] = ['fall', 'float', 'rise', 'burst', 'drift']
    for (const a of kinds)
      for (const b of kinds)
        for (const c of kinds) {
          for (const mix of [[a], [a, b], [a, b, c]]) {
            const counts = burstCounts(mix)
            expect(counts.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(BURST_BUDGET)
            expect(counts.every((n) => n > 0)).toBe(true)
          }
        }
  })
})

describe('burstPlan', () => {
  it('gives each emoji its own kind of motion in a mixed burst', () => {
    const plan = burstPlan(['❤️', '🔥', '🎉'], 390, 844, burstRandom('m1'))
    expect(plan.length).toBeLessThanOrEqual(BURST_BUDGET)
    const heart = plan.filter((copy) => copy.emoji === '❤️')
    const fire = plan.filter((copy) => copy.emoji === '🔥')
    const popper = plan.filter((copy) => copy.emoji === '🎉')
    expect([heart.length, fire.length, popper.length]).toEqual(
      burstCounts(['float', 'rise', 'burst']),
    )
    // Hearts and flames go up from low on the screen; a popper is thrown and
    // pulled back down by gravity, the only one that has any.
    for (const copy of [...heart, ...fire]) {
      expect(copy.particle.dy).toBeLessThan(0)
      expect(copy.particle.gravity).toBe(0)
    }
    expect(heart[0]!.eases.y).toBe('out')
    expect(fire[0]!.eases.y).toBe('in')
    for (const copy of popper) expect(copy.particle.gravity).toBeGreaterThan(0)
  })

  it('draws the same shower for the same seed, and another for another', () => {
    const one = burstPlan(['😂'], 390, 844, burstRandom('abc'))
    expect(burstPlan(['😂'], 390, 844, burstRandom('abc'))).toEqual(one)
    expect(burstPlan(['😂'], 390, 844, burstRandom('abd'))).not.toEqual(one)
  })

  it('mixes sizes: mostly small, a few large accents, within the spread', () => {
    for (const seed of ['a', 'b', 'c', 'client-123']) {
      for (const emoji of [['😂'], ['❤️', '🔥'], ['❤️', '🔥', '🎉']]) {
        const sizes = burstPlan(emoji, 390, 844, burstRandom(seed)).map((c) => c.particle.size)
        for (const size of sizes) {
          expect(size).toBeGreaterThanOrEqual(BURST_SIZE.min)
          expect(size).toBeLessThanOrEqual(BURST_SIZE.max)
        }
        const large = sizes.filter((size) => size >= 44).length
        expect(large).toBeGreaterThanOrEqual(1)
        expect(large).toBeLessThanOrEqual(Math.ceil(sizes.length / 4))
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThanOrEqual(16)
      }
    }
  })

  it('ends a mixed burst within the burst, at its slowest', () => {
    const plan = burstPlan(['❄️', '🎉', '😂'], 390, 844, always(0.999999))
    expect(burstEndsAt(plan.map((copy) => copy.particle))).toBeLessThanOrEqual(BURST_MS)
  })
})

describe('burstParticles', () => {
  const kinds: BurstKind[] = ['fall', 'float', 'rise', 'burst', 'drift']

  it('ends every kind within the burst, at its slowest', () => {
    for (const kind of kinds) {
      const slowest = burstParticles(kind, 390, 844, always(0.999999))
      expect(burstEndsAt(slowest)).toBeLessThanOrEqual(BURST_MS)
    }
  })

  it('keeps the count modest', () => {
    for (const kind of kinds) {
      expect(burstParticles(kind, 390, 844).length).toBeLessThanOrEqual(24)
    }
  })

  it('moves each kind the way it says', () => {
    const [fall] = burstParticles('fall', 390, 844, always(0.5))
    expect(fall!.y0).toBeLessThan(0)
    expect(fall!.y0 + fall!.dy).toBeGreaterThan(844)

    const [float] = burstParticles('float', 390, 844, always(0.5))
    expect(float!.y0).toBeLessThan(844)
    expect(float!.y0 + float!.dy + float!.size).toBeLessThan(0)
  })

  it('throws a burst up from low centre and lets it fall off the bottom', () => {
    const height = 844
    for (const r of [0, 0.5, 0.999999]) {
      const [piece] = burstParticles('burst', 390, height, always(r))
      const { y0, dy, gravity, size } = piece!
      expect(dy).toBeLessThan(0)
      // The top of the arc stays on screen…
      expect(y0 - (dy * dy) / (4 * gravity)).toBeGreaterThan(0)
      // …and the end of the path is below the bottom edge.
      expect(y0 + dy + gravity).toBeGreaterThan(height + size)
    }
  })

  it('starts every falling copy inside the width', () => {
    for (const r of [0, 0.999999]) {
      for (const p of burstParticles('fall', 390, 844, always(r))) {
        expect(p.x0).toBeGreaterThanOrEqual(0)
        expect(p.x0 + p.size).toBeLessThanOrEqual(390)
      }
    }
  })
})
