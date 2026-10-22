import { bigEmojiClusters, isBigEmoji } from '@langx/shared'

/**
 * The v3 thread's emoji burst: a message that is one to three emoji and
 * nothing else — the big-emoji hero — spills over the screen as a shower of
 * copies of them, once. "❤️🔥" rains hearts and flames together, each moving
 * its own way.
 *
 * Kept apart from `EmojiBurstV3` so the two decisions that matter — how a
 * given emoji moves, and whether a given moment deserves the motion at all —
 * can be tested without a renderer. The component only draws what this says.
 */

/**
 * How the copies move.
 *
 *   - `fall`:  the default. Down from above the top edge, with a little sway.
 *   - `float`: hearts and balloons. Up from below, slowly, swaying wide.
 *   - `rise`:  fire and rockets. Up, accelerating, shrinking as they go.
 *   - `burst`: party poppers. Out of one point low on the screen, then down
 *              under gravity, like a thrown handful.
 *   - `drift`: snow and leaves. Down, slower than a fall, swaying widest.
 */
export type BurstKind = 'fall' | 'float' | 'rise' | 'burst' | 'drift'

/**
 * Written without variation selectors or skin tones: `burstKind` strips both
 * before it looks, so ❤️ and ❤ and 👍🏽 and 👍 are the same entry.
 */
const KINDS: Readonly<Record<string, BurstKind>> = {
  ...Object.fromEntries(
    [
      '❤',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '🩷',
      '🩵',
      '🩶',
      '💕',
      '💖',
      '💗',
      '💓',
      '💞',
      '💘',
      '💝',
      '❣',
      '😍',
      '🥰',
      '😘',
      '😻',
      '🎈',
      '🫧',
    ].map((emoji) => [emoji, 'float' as const]),
  ),
  ...Object.fromEntries(
    ['🔥', '🚀', '⬆', '📈', '☄', '🛸'].map((emoji) => [emoji, 'rise' as const]),
  ),
  ...Object.fromEntries(
    ['🎉', '🎊', '🥳', '✨', '🎆', '🎇', '💥', '🍾', '🪅', '🌟'].map((emoji) => [
      emoji,
      'burst' as const,
    ]),
  ),
  ...Object.fromEntries(
    ['❄', '☃', '⛄', '🌨', '🍂', '🍁', '🌸', '🪶', '🍃'].map((emoji) => [emoji, 'drift' as const]),
  ),
}

/** U+FE0F (emoji presentation) and the five Fitzpatrick modifiers. */
const DECORATIONS = /\uFE0F|[\u{1F3FB}-\u{1F3FF}]/gu

export function burstKind(emoji: string): BurstKind {
  return KINDS[emoji.replace(DECORATIONS, '')] ?? 'fall'
}

/**
 * The emoji a message bursts with, each once, in the order written — or none
 * when it is not drawn as the big emoji. The same 1–3 rule as the hero
 * (`isBigEmoji`), so whatever is drawn big bursts and nothing else does.
 * "😂😂" is one emoji's shower, not two of the same.
 */
export function burstEmoji(body: string): string[] {
  if (!isBigEmoji(body)) return []
  return [...new Set(bigEmojiClusters(body))]
}

/**
 * How far from now, either way, a message pushed over the socket can be
 * dated and still count as arriving now. A reconnect, or a server
 * redelivering, can hand over a message minutes old, and a burst for that is
 * history replaying. The window is two-sided because the age is measured
 * against the device clock: one running a little slow dates a fresh message
 * slightly in the future, while one far off is no evidence of anything.
 */
/**
 * Whether a message is drawn as the big emoji at all, for a lone emoji: the
 * condition `MessageBubble` gives its hero, a plain text and not withdrawn.
 * The caption on a photo, a video or a voice note is not.
 */
export function drawsAsHero(message: { type: string; deleted?: boolean | undefined }): boolean {
  return message.type === 'text' && message.deleted !== true
}

export const LIVE_WINDOW_MS = 15_000

export type BurstTrigger =
  /** This screen just sent it. */
  | 'sent'
  /** The partner's message, pushed over the socket while the thread is open. */
  | 'live'
  /** The big emoji was tapped. */
  | 'tap'
  /** It came with a page of the thread, on open, on scroll or on refetch. */
  | 'history'

export interface BurstMoment {
  trigger: BurstTrigger
  body: string
  /** The v3 look. The current look never bursts. */
  v3: boolean
  reduceMotion: boolean
  /** This thread is the screen in front. */
  focused: boolean
  /** A burst is on screen right now. */
  playing: boolean
  /** This message has already burst on this screen. */
  played: boolean
  /** For `live`: how long ago the message was written. */
  ageMs?: number
  /**
   * The message is drawn as the big emoji: plain text, not withdrawn. A
   * photo or a voice note captioned with one emoji is not, and has no bubble
   * a tap could replay the burst from.
   */
  hero: boolean
}

/**
 * Whether this moment plays a burst.
 *
 * Driven by events, not by what the list draws: a row mounting, recycling or
 * re-rendering never asks. History is listed only so the rule is written
 * down — it never plays.
 *
 * A second burst while one is on screen is ignored rather than stacked or
 * swapped in: two showers at once is noise, and cutting one off half-way
 * looks like a glitch.
 */
export function shouldPlayBurst(moment: BurstMoment): boolean {
  if (!moment.v3 || moment.reduceMotion || moment.playing || !moment.hero) return false
  if (burstEmoji(moment.body).length === 0) return false
  switch (moment.trigger) {
    case 'history':
      return false
    case 'tap':
      // Asked for, so it plays however many times it has before.
      return true
    case 'sent':
      return !moment.played
    case 'live':
      return (
        moment.focused &&
        !moment.played &&
        moment.ageMs !== undefined &&
        Math.abs(moment.ageMs) <= LIVE_WINDOW_MS
      )
  }
}

/**
 * One copy's path, as numbers the UI thread turns into a position.
 *
 * At local progress `p` (0 → 1 over `duration`, after `delay`):
 *
 *   x = x0 + dx·p + sway·sin(2π·waves·p + phase)
 *   y = y0 + dy·ease(p) + gravity·p²
 *
 * which is one formula for every kind: a fall is `dy` down with no gravity,
 * a burst is `dy` up with gravity pulling it back.
 */
export interface BurstParticle {
  x0: number
  y0: number
  dx: number
  dy: number
  gravity: number
  sway: number
  waves: number
  phase: number
  /** Degrees turned over the whole path, either way. */
  spin: number
  /** Font size. */
  size: number
  /** Scale at the end of the path; 1 keeps its size. */
  endScale: number
  delay: number
  duration: number
}

export type BurstEase = 'linear' | 'in' | 'out'

interface KindStyle {
  count: number
  delay: readonly [number, number]
  duration: readonly [number, number]
  sway: readonly [number, number]
  spin: number
  /** Along the path's main direction. */
  ease: BurstEase
  /** Across it: only a burst spreads, and it spreads fastest at first. */
  xEase: BurstEase
  endScale: number
}

/**
 * Counts are modest on purpose: each copy is one text view with a transform,
 * and twenty or so is what a mid-range Android phone keeps at sixty frames
 * alongside a scrolling list. Every path ends by `BURST_MS`.
 */
const STYLES: Readonly<Record<BurstKind, KindStyle>> = {
  /*
   * Starts staggered over most of a second, so the copies come as a stream
   * rather than one band crossing the screen like a curtain.
   */
  fall: {
    count: 18,
    delay: [0, 900],
    duration: [1300, 1900],
    sway: [6, 18],
    spin: 70,
    ease: 'linear',
    xEase: 'linear',
    endScale: 1,
  },
  float: {
    count: 14,
    delay: [0, 900],
    duration: [1500, 1900],
    sway: [12, 26],
    spin: 30,
    ease: 'out',
    xEase: 'linear',
    endScale: 1.1,
  },
  rise: {
    count: 16,
    delay: [0, 900],
    duration: [1300, 1800],
    sway: [3, 10],
    spin: 20,
    ease: 'in',
    xEase: 'linear',
    endScale: 0.6,
  },
  // Out sideways fast and then slowing, as a thrown handful does; a linear
  // spread started it as a tower in the middle of the screen.
  burst: {
    count: 22,
    delay: [0, 180],
    duration: [1700, 2300],
    sway: [0, 6],
    spin: 540,
    ease: 'linear',
    xEase: 'out',
    endScale: 0.9,
  },
  // Slow enough to read as snow: about twice a fall's crossing.
  drift: {
    count: 14,
    delay: [0, 300],
    duration: [2200, 2500],
    sway: [28, 42],
    spin: 220,
    ease: 'linear',
    xEase: 'linear',
    endScale: 1,
  },
}

/**
 * Copies across every emoji in one burst. A lone emoji keeps its kind's own
 * count; two or three share this, so "❤️🔥🎉" costs no more frames than "🎉".
 */
export const BURST_BUDGET = 22

/**
 * How many copies each of a burst's emoji gets: an even share of the budget,
 * the remainder to the first ones written, and never more than its kind
 * would have alone.
 */
export function burstCounts(kinds: readonly BurstKind[]): number[] {
  if (kinds.length === 1) return [STYLES[kinds[0]!].count]
  const share = Math.floor(BURST_BUDGET / kinds.length)
  const spare = BURST_BUDGET - share * kinds.length
  return kinds.map((kind, index) => Math.min(STYLES[kind].count, share + (index < spare ? 1 : 0)))
}

/**
 * Font sizes, the same for every kind. Most copies are small, skewed towards
 * the low end, and every fifth is a large accent: a shower of one size reads
 * as a pattern, not as things thrown.
 */
export const BURST_SIZE = { min: 20, max: 56 } as const
const SMALL: readonly [number, number] = [BURST_SIZE.min, 38]
const ACCENT: readonly [number, number] = [44, BURST_SIZE.max]
const ACCENT_EVERY = 5

/** The whole burst, first frame to last copy gone. */
export const BURST_MS = 2800

export function burstEases(kind: BurstKind): { x: BurstEase; y: BurstEase } {
  return { x: STYLES[kind].xEase, y: STYLES[kind].ease }
}

function between([low, high]: readonly [number, number], random: () => number): number {
  return low + random() * (high - low)
}

/**
 * A repeatable random sequence from a string (mulberry32 over an FNV-1a
 * hash). Seeded by the message, so a tap replays the same shower the send
 * did rather than a new one.
 */
export function burstRandom(seed: string): () => number {
  let state = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The copies of one emoji's kind over a `width` × `height` screen. `random` is
 * seeded per message in the app and a fixed sequence in tests.
 */
export function burstParticles(
  kind: BurstKind,
  width: number,
  height: number,
  random: () => number = Math.random,
  count: number = STYLES[kind].count,
): BurstParticle[] {
  const style = STYLES[kind]
  return Array.from({ length: count }, (_, index) => {
    const accent = index % ACCENT_EVERY === ACCENT_EVERY - 1
    // Squared, so the small ones crowd towards the smallest.
    const size = accent ? between(ACCENT, random) : between(SMALL, () => random() ** 2)
    const delay = between(style.delay, random)
    const duration = between(style.duration, random)
    const sway = between(style.sway, random) * (random() < 0.5 ? -1 : 1)
    const across = random() * Math.max(0, width - size)
    const common = {
      size,
      delay,
      duration,
      sway,
      // A drift sways about once every 1.6 s; the rest a little faster.
      waves: kind === 'drift' ? duration / 1600 : 0.6 + random() * 0.9,
      phase: random() * Math.PI * 2,
      spin: (random() - 0.5) * style.spin,
      endScale: style.endScale,
    }
    switch (kind) {
      case 'fall':
      case 'drift':
        // Half in view at the start, so the first copy shows on the first
        // frames instead of after a lead-in above the edge.
        return { ...common, x0: across, y0: -size * 0.5, dx: 0, dy: height + size, gravity: 0 }
      case 'float':
      case 'rise':
        return {
          ...common,
          x0: across,
          // From just above the composer, where a message lands, rather
          // than from below the screen and through the composer's chips.
          y0: height * 0.8,
          dx: 0,
          dy: -(height * 0.8 + size * 2),
          gravity: 0,
        }
      case 'burst': {
        // Thrown up from low centre, where the message just landed, each to
        // its own height; gravity brings it back down past the bottom edge.
        // With y = y0 + dy·p + g·p², the top of the arc is dy²/4g above y0.
        const gravity = height * 4
        const apex = height * (0.45 + random() * 0.23)
        return {
          ...common,
          x0: width / 2 - size / 2 + (random() - 0.5) * 48,
          y0: height * 0.72,
          dx: (random() - 0.5) * width,
          dy: -2 * Math.sqrt(apex * gravity),
          gravity,
        }
      }
    }
  })
}

export interface BurstCopy {
  emoji: string
  eases: { x: BurstEase; y: BurstEase }
  particle: BurstParticle
}

/**
 * Every copy of a burst of `emoji` (as `burstEmoji` gives them), each with
 * its own kind's path, within the budget between them.
 */
export function burstPlan(
  emoji: readonly string[],
  width: number,
  height: number,
  random: () => number = Math.random,
): BurstCopy[] {
  const kinds = emoji.map(burstKind)
  const counts = burstCounts(kinds)
  return emoji.flatMap((glyph, index) => {
    const kind = kinds[index]!
    const eases = burstEases(kind)
    return burstParticles(kind, width, height, random, counts[index]).map((particle) => ({
      emoji: glyph,
      eases,
      particle,
    }))
  })
}

/** When the last copy of a burst has finished its path. */
export function burstEndsAt(particles: readonly BurstParticle[]): number {
  return particles.reduce((end, p) => Math.max(end, p.delay + p.duration), 0)
}
