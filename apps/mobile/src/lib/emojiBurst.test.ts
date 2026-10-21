import { describe, expect, it } from 'vitest'
import {
  BURST_MS,
  LIVE_WINDOW_MS,
  burstEndsAt,
  burstKind,
  burstParticles,
  loneEmoji,
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

describe('loneEmoji', () => {
  it('is the emoji when the message is one emoji and nothing else', () => {
    expect(loneEmoji('🎉')).toBe('🎉')
    expect(loneEmoji('  ❤️ ')).toBe('❤️')
    expect(loneEmoji('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦')
  })

  it('is null for two emoji, text, or text with an emoji', () => {
    expect(loneEmoji('🎉🔥')).toBeNull()
    expect(loneEmoji('hi')).toBeNull()
    expect(loneEmoji('hi 🎉')).toBeNull()
    expect(loneEmoji('')).toBeNull()
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
}

describe('shouldPlayBurst', () => {
  it('plays a lone emoji sent from here, or arriving live while the thread is open', () => {
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

  it('still plays when the device clock runs a little slow', () => {
    expect(shouldPlayBurst({ ...base, ageMs: -3_000 })).toBe(true)
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

  it('plays only for a lone emoji', () => {
    for (const body of ['🎉🎉', 'yay 🎉', 'yay']) {
      expect(shouldPlayBurst({ ...base, trigger: 'sent', body })).toBe(false)
      expect(shouldPlayBurst({ ...base, trigger: 'tap', body })).toBe(false)
    }
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
