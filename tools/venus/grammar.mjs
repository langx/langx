// What happens in the streak story for one (day, locale): a pure, deterministic plan.
//
//   import { planDay } from './grammar.mjs';
//   planDay(22, 'tr') -> { day, lang, milestone, quip, entrance, reveal, reaction, move, look, camera, payoff, music, extras }
//
// One video per (day, locale), shared by everyone, so nothing here can depend on the viewer.
//
// Variation. Every axis picks idx = (n·a + b) mod N with gcd(a, N) = 1, so the pick changes every
// day and walks through every option before repeating (the acting plan, §6). Milestone days
// replace the grammar with a set piece. The repair rule then keeps neighbours apart: if a pick equals
// the previous day's final pick on that axis, step idx + 1. Because of the repair, a day depends on
// the day before it, so plans are computed in order from day 1 and memoised per locale.
//
// Quips follow quips.json's schedule: a 6-day pool pattern [praise, regular, roast, praise, regular,
// roast] (2:1 warm to sting, never two roasts in a row). Within a pool the lines are a deck: one pass
// through it before any line plays twice, so days 1-100 never repeat a line (the pools hold at least
// as many lines as their days; schedule.reserve plays last). The deck order is a hash of the id, and
// a day takes the first line it has not played that keeps the limits (one blep line per 7 days, the
// dog joke once a month, no two food lines on neighbouring days).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHARACTER } from './lib/character.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const QUIPS = JSON.parse(fs.readFileSync(path.join(HERE, 'data/quips.json'), 'utf8'))
export const LOCALES = ['tr', 'en', 'es', 'fr', 'de', 'ru', 'ar', 'pt-BR']
// character rules (moods, moves, limits, milestones, sign-off) come from data/character.json
export const MILESTONES = CHARACTER.milestones.days
export const isMilestone = (n) => MILESTONES.includes(n)

// ------------------------------------------------------------------ axes
// Each option id is implemented in lib/score.mjs (Venus's acting) or lib/layers.mjs (the looks).
export const AXES = {
  // how she arrives; every entrance ends sitting, centred, facing the lens by ~1.7 s
  entrance: {
    a: 3,
    b: 1,
    options: ['walk-in', 'strut', 'peek', 'drop-in', 'bag-hop', 'wake-up', 'stretch-up', 'zoomies'],
  },
  // the ground she plays on
  look: {
    a: 3,
    b: 2,
    options: ['sunburst', 'stripes', 'stage', 'lilac-dots', 'mint-halftone', 'sky-clouds', 'night'],
  },
  camera: { a: 5, b: 0, options: ['push-in', 'snap', 'dutch', 'shake', 'dolly-out', 'drift'] },
  // how the number arrives
  reveal: { a: 2, b: 0, options: ['pop', 'slam', 'count'] },
  // the last beat before the end card; every one of them contains the slow blink (her sign-off)
  payoff: { a: 3, b: 1, options: CHARACTER.signOff.payoffs },
}
// her reaction to the number, by quip mood: [usual, alternate when yesterday had the usual]
export const REACTION_BY_MOOD = CHARACTER.acting.reactionByMood
// the signature move under the line comes from the quip (`move`); this is its stand-in when
// yesterday played the same move
export const MOVES = CHARACTER.acting.moves
const ALT_MOVE = CHARACTER.acting.altMove
// music moods (lib/synth/music-synth.mjs + "playful", added in lib/audio.mjs), by quip mood
const MUSIC_BY_MOOD = CHARACTER.acting.musicByMood
// lines that mention an outfit put it on her for the line
const OUTFIT_BY_QUIP = CHARACTER.lines.outfits

// ------------------------------------------------------------------ milestone set pieces
// Each lists preferences per axis: the first one that differs from the day before is used.
export const SET_PIECES = {
  1: {
    title: 'First day',
    entrance: ['walk-in', 'peek'],
    reveal: ['pop'],
    reaction: 'tilt',
    move: 'slow-blink',
    look: ['stage', 'sky-clouds'],
    camera: ['push-in', 'snap'],
    payoff: ['blink'],
    music: 'cozy',
    extras: { sparkles: true },
  },
  3: {
    title: 'A habit',
    entrance: ['peek', 'walk-in'],
    reveal: ['count'],
    reaction: 'ear-perk',
    move: 'ear-swivel',
    look: ['mint-halftone', 'lilac-dots'],
    camera: ['snap', 'push-in'],
    payoff: ['blep-blink', 'blink'],
    music: 'playful',
    extras: {},
  },
  7: {
    title: 'A whole week',
    entrance: ['strut', 'zoomies'],
    reveal: ['pop'],
    reaction: 'diva-flick',
    move: 'bag-throne',
    look: ['sunburst', 'lilac-dots'],
    camera: ['push-in', 'snap'],
    payoff: ['blep-blink', 'blink'],
    music: 'playful',
    extras: { flashes: true },
  },
  10: {
    title: 'Double digits',
    entrance: ['strut', 'walk-in'],
    reveal: ['slam'],
    reaction: 'chin-up',
    move: 'model-turn',
    look: ['lilac-dots', 'sunburst'],
    camera: ['shake', 'snap'],
    payoff: ['look-away', 'blink'],
    music: 'celebrate',
    extras: { flashes: true, outfitPoof: true },
  },
  14: {
    title: 'Two weeks of naps',
    entrance: ['wake-up', 'stretch-up'],
    reveal: ['pop'],
    reaction: 'glance-unmoved',
    move: 'loaf',
    look: ['night', 'stage'],
    camera: ['drift', 'push-in'],
    payoff: ['purr-blink', 'blink'],
    music: 'cozy',
    extras: { zzz: true },
  },
  21: {
    title: 'The verdict',
    entrance: ['peek', 'walk-in'],
    reveal: ['slam'],
    reaction: 'squint-at',
    move: 'squint',
    look: ['stripes', 'mint-halftone'],
    camera: ['snap', 'shake'],
    payoff: ['look-away', 'blink'],
    music: 'chill',
    extras: {},
  },
  30: {
    title: 'A whole month',
    entrance: ['bag-hop', 'walk-in'],
    reveal: ['count'],
    reaction: 'soft-look',
    move: 'slow-blink',
    look: ['sky-clouds', 'lilac-dots'],
    camera: ['push-in', 'drift'],
    payoff: ['blink'],
    music: 'celebrate',
    extras: { confetti: true },
  },
  50: {
    title: 'The counter pose',
    entrance: ['peek', 'drop-in'],
    reveal: ['count'],
    reaction: 'chin-up',
    move: 'counter-pose',
    look: ['stripes', 'sunburst'],
    camera: ['dolly-out', 'push-in'],
    payoff: ['look-away', 'blink'],
    music: 'celebrate',
    extras: { confetti: true },
  },
  100: {
    title: 'One hundred',
    entrance: ['walk-in', 'strut'],
    reveal: ['count'],
    reaction: 'double-take',
    move: 'innocent-stare',
    look: ['stage', 'night'],
    camera: ['shake', 'snap'],
    payoff: ['blep-blink', 'blink'],
    music: 'celebrate',
    extras: { confetti: true, whisperLast: true },
  },
  200: {
    title: 'Out of verdicts',
    entrance: ['drop-in', 'zoomies'],
    reveal: ['count'],
    reaction: 'double-take',
    move: 'ear-swivel',
    look: ['night', 'stage'],
    camera: ['dutch', 'shake'],
    payoff: ['look-away', 'blink'],
    music: 'epic',
    extras: { confetti: true },
  },
  365: {
    title: 'A whole year',
    entrance: ['strut', 'walk-in'],
    reveal: ['count'],
    reaction: 'double-take',
    move: 'model-turn',
    look: ['stage', 'sunburst'],
    camera: ['dolly-out', 'push-in'],
    payoff: ['blink'],
    music: 'epic',
    extras: { confetti: true, flashes: true, bow: true },
  },
}

// ------------------------------------------------------------------ helpers
const gcd = (a, b) => (b ? gcd(b, a % b) : a)
for (const [k, ax] of Object.entries(AXES))
  if (gcd(ax.a, ax.options.length) !== 1) throw new Error(`axis ${k}: a must be coprime with N`)
function fnv(s) {
  let h = 0x811c9dc5
  for (const c of s) {
    h ^= c.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}
function axisPick(name, n, prev, ok = () => true) {
  const ax = AXES[name],
    N = ax.options.length
  let i = (((n * ax.a + ax.b) % N) + N) % N
  for (let k = 0; k < N && (ax.options[i] === prev || !ok(ax.options[i])); k++) i = (i + 1) % N
  return ax.options[i]
}
// the dolly-out starts close on her face, which only works when she arrives on the spot
const WALKING = new Set(['walk-in', 'strut', 'bag-hop', 'zoomies', 'stretch-up'])
const cameraOk = (entrance) => (cam) => !(cam === 'dolly-out' && WALKING.has(entrance))
// a set piece's preference list; if every preference equals yesterday's pick, the axis' own next option
const firstNot = (list, prev, axis, n, ok = () => true) =>
  list.find((x) => x !== prev && ok(x)) ?? (axis ? axisPick(axis, n, prev, ok) : list[0])

const POOL_OF = {}
for (const [pool, list] of Object.entries(QUIPS.pools)) for (const q of list) POOL_OF[q.id] = pool
export const quipById = (id) => QUIPS.pools[POOL_OF[id]].find((q) => q.id === id)
const LIM = CHARACTER.lines.limits
// each limit: { ids, minGapDays, soft? }; a soft limit gives way before a line would repeat
const LIMITS = Object.values(LIM)
  .filter((l) => Array.isArray(l?.ids))
  .map((l) => ({ ids: new Set(l.ids), gap: l.minGapDays, soft: !!l.soft }))
const ROAST = (id) => CHARACTER.schedule.stingPools.includes(POOL_OF[id])

// the slot in the 6-day pattern
export const poolFor = (n) =>
  CHARACTER.schedule.pattern[(n - 1) % CHARACTER.schedule.pattern.length]

// a pool's deck: hash order, the reserve lines last
const RESERVE = new Set(CHARACTER.schedule.reserve ?? [])
const DECK = Object.fromEntries(
  Object.entries(QUIPS.pools).map(([pool, list]) => [
    pool,
    [...list].sort(
      (p, q) =>
        RESERVE.has(p.id) - RESERVE.has(q.id) ||
        fnv(`deck:${p.id}`) - fnv(`deck:${q.id}`) ||
        (p.id < q.id ? -1 : 1),
    ),
  ]),
)

// ------------------------------------------------------------------ the plan
const memo = new Map() // lang -> [plan for day 1, 2, ...]

function quipFor(n, lang, state) {
  if (isMilestone(n)) {
    const id = CHARACTER.milestones.lineId.replace('<day>', n)
    const q = quipById(id)
    if (!q.text[lang]) throw new Error(`${id} has no ${lang} text`)
    return q
  }
  const deck = DECK[poolFor(n)].filter((q) => q.text[lang])
  const keeps = (q, soft) =>
    LIMITS.every((L, i) => !L.ids.has(q.id) || (L.soft && !soft) || n - state.lastHit[i] >= L.gap)
  // the first unplayed line that keeps every limit, then one that keeps the hard ones
  const fresh = deck.filter((q) => !state.lastUsed.has(q.id))
  const pick = fresh.find((q) => keeps(q, true)) ?? fresh.find((q) => keeps(q, false))
  if (pick) return pick
  // the deck is spent (past day 100): the least recently played line that keeps the limits
  const old = [...deck].sort((p, q) => state.lastUsed.get(p.id) - state.lastUsed.get(q.id))
  return old.find((q) => keeps(q, true)) ?? old.find((q) => keeps(q, false)) ?? old[0]
}

function build(n, lang, prev, state) {
  const q = quipFor(n, lang, state)
  state.lastUsed.set(q.id, n)
  LIMITS.forEach((L, i) => {
    if (L.ids.has(q.id)) state.lastHit[i] = n
  })
  const sp = SET_PIECES[n]
  const P = prev || {}
  const plan = { day: n, lang, milestone: !!sp, title: sp?.title ?? null }
  plan.quip = {
    id: q.id,
    pool: POOL_OF[q.id],
    mood: q.mood,
    expression: q.expression,
    move: q.move,
    target: q.target ?? null,
    text: q.text[lang],
  }
  if (sp) {
    plan.entrance = firstNot(sp.entrance, P.entrance, 'entrance', n)
    plan.look = firstNot(sp.look, P.look, 'look', n)
    plan.camera = firstNot(sp.camera, P.camera, 'camera', n, cameraOk(plan.entrance))
    plan.reveal = firstNot(sp.reveal, P.reveal, 'reveal', n)
    plan.payoff = firstNot(sp.payoff, P.payoff, 'payoff', n)
    plan.reaction = sp.reaction
    plan.move = sp.move
    plan.music = sp.music
    plan.extras = { ...sp.extras }
  } else {
    plan.entrance = axisPick('entrance', n, P.entrance)
    plan.look = axisPick('look', n, P.look)
    plan.camera = axisPick('camera', n, P.camera, cameraOk(plan.entrance))
    plan.reveal = axisPick('reveal', n, P.reveal)
    plan.payoff = axisPick('payoff', n, P.payoff)
    const rx = REACTION_BY_MOOD[q.mood] || REACTION_BY_MOOD.smug
    plan.reaction = firstNot(rx, P.reaction)
    plan.move = q.move === P.move ? ALT_MOVE[q.move] : q.move
    const mus = MUSIC_BY_MOOD[q.mood] || ['playful']
    plan.music = firstNot([...mus.slice(n % mus.length), ...mus.slice(0, n % mus.length)], P.music)
    plan.extras = {}
  }
  // a bag-hop entrance already builds the throne; the move then plays as the counter pose
  if (plan.entrance === 'bag-hop' && plan.move === 'bag-throne') plan.move = 'counter-pose'
  if (!sp && plan.move === P.move) plan.move = ALT_MOVE[plan.move]
  plan.outfit = OUTFIT_BY_QUIP[q.id] ?? null
  // a seed for everything random in the picture (twinkles, confetti); the music is cached per (mood, seed)
  plan.seed = fnv(`venus:${n}`) % 100000
  plan.musicSeed = n % 4
  return plan
}

export function planDay(n, lang) {
  if (!Number.isInteger(n) || n < 1) throw new Error('day must be a positive integer')
  if (!LOCALES.includes(lang)) throw new Error(`unknown locale ${lang}`)
  let arr = memo.get(lang)
  if (!arr) {
    arr = []
    arr.state = { lastUsed: new Map(), lastHit: LIMITS.map(() => -1e9) }
    memo.set(lang, arr)
  }
  while (arr.length < n) arr.push(build(arr.length + 1, lang, arr[arr.length - 1], arr.state))
  return arr[n - 1]
}

// the library Behic decided on: days 1-100 plus the milestones after it, up to 365
export const LIBRARY_DAYS = [
  ...Array.from({ length: 100 }, (_, i) => i + 1),
  ...MILESTONES.filter((m) => m > 100),
]
export const isRoast = (plan) => ROAST(plan.quip.id)

if (import.meta.main) {
  const [from = 1, to = 14] = process.argv
    .slice(2)
    .filter((a) => /^\d+$/.test(a))
    .map(Number)
  const lang = process.argv.find((a) => LOCALES.includes(a)) || 'tr'
  for (let n = from; n <= to; n++) {
    const p = planDay(n, lang)
    console.log(
      [
        String(n).padStart(3),
        p.milestone ? '*' : ' ',
        p.quip.id.padEnd(8),
        p.entrance.padEnd(10),
        p.reveal.padEnd(5),
        p.reaction.padEnd(14),
        p.move.padEnd(14),
        p.look.padEnd(13),
        p.camera.padEnd(9),
        p.payoff.padEnd(10),
        p.music.padEnd(9),
        p.quip.text,
      ].join(' '),
    )
  }
}
