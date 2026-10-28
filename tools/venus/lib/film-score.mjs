// The introduction film's score: one piece of music from the first frame to the last, in G major at
// 120 bpm, one chord a bar (Gadd9 - D - Em7 - Cmaj7). Bar 0 is the title slam (anchor A), and the
// clock (lib/film-clock.mjs) puts anchors B and C on downbeats too, so every locale's film sits on
// the same grid.
//
// The first cut laid a different loop under each scene (four moods, three tempos, hard stops and
// room tone between them), and the music changed level every few seconds: it read as separate
// sketches glued together. Here the sections only change which instruments play, every change sits
// on a bar line and ramps over at least a bar, each section is brought to one loudness, and nothing
// ever stops.
//
//   planScore(clock, { endAt, duration })  pure: the bars, the sections, the gain envelope of each
//                                          layer, and every note (time, pitch, level)
//   renderScore(plan, out)                 the stereo stem (wav), cached by the plan's hash
//
// The instruments are the day videos' own (lib/synth/music-synth.mjs). The bell hook and the music
// box only play in her pauses: a note sounds when it starts more than 0.25 s after a sentence ends
// and more than 0.15 s before the next one starts, in every locale (silent ones by their subtitle
// timing), so the melody answers her lines instead of being ducked under them. The one exception is
// the motif's two quiet statements in the cold open, which has no pause long enough to hold it.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { SR, rng, stereo, addTo, mtof, reverb, writeWav } from './synth/dsp.mjs'
import { INSTRUMENTS as I, voiceChord } from './synth/music-synth.mjs'
import { SCORE_CUES } from './film-shots.mjs'
import { CACHE } from './paths.mjs'

export const BPM = 120
export const BEAT = 60 / BPM
export const BAR = 4 * BEAT
export const KEY = 7 // G
export const SCALE = [0, 2, 4, 5, 7, 9, 11].map((x) => (x + KEY) % 12)
// I - V - vi - IV, as [degree above the key, quality]
export const PROG = [
  [0, 'add9'],
  [7, 'maj'],
  [9, 'min7'],
  [5, 'maj7'],
]
// the house sound logo (lib/sting.mjs, G5 - D6 - B5) slowed to quarter notes an octave down, and
// answered: [beat, MIDI]. Its last G falls on beat 5.
export const MOTIF = [
  [0, 67],
  [1, 74],
  [2, 71],
  [4, 69],
  [5, 67],
]
// the bell hook, one bar per chord of PROG: [16th step, MIDI]. Over the G it opens on the motif's
// three notes, an octave up.
const HOOK = [
  [
    [0, 79],
    [3, 86],
    [6, 83],
    [10, 81],
    [12, 79],
  ],
  [
    [0, 81],
    [3, 78],
    [6, 74],
    [10, 78],
    [12, 81],
  ],
  [
    [0, 79],
    [3, 83],
    [6, 88],
    [10, 86],
    [12, 83],
  ],
  [
    [0, 76],
    [3, 79],
    [6, 84],
    [10, 83],
    [12, 79],
  ],
]
// where the outgoing section's level gives way to the next one's: S0 to S1 in the bar before the
// slam (the riser's bar, so the slam lands at the act's level), the rest in the first bar of the
// new section, where the old layers fade
export const SECTION_OFFSET = { S0: -6, S5: -1 } // LU against the others; the opening rises from S0
const OPEN_FADE = 1.2 // s: the pad comes up from silence on the first frame
const GATE = { after: 0.25, before: 0.15 }
// each layer's share sent to the reverb
const SEND = {
  pad: 0.7,
  stabs: 0.38,
  rhodes: 0.35,
  arp: 0.6,
  bell: 0.6,
  musicbox: 0.6,
  crash: 0.5,
  riser: 1.2,
}
// the house groove pumps the bass and the stabs off its kick (the day videos' celebrate mood does
// 0.55; the film keeps it gentle)
const PUMP = 0.3

const mod = (a, n) => ((a % n) + n) % n
const r4 = (x) => Math.round(x * 1e4) / 1e4

// a section join on the bar line nearest the cue, or on a 4-bar cycle line when one is within a bar
function joinBar(bar0, t) {
  const c = (t - bar0) / BAR
  const near = [Math.floor(c) - 1, Math.floor(c), Math.ceil(c), Math.ceil(c) + 1].filter(
    (b) => Math.abs(b - c) <= 1 + 1e-9,
  )
  const cycle = near.filter((b) => mod(b, 4) === 0)
  const pick = (bs) => bs.reduce((a, b) => (Math.abs(b - c) < Math.abs(a - c) ? b : a))
  return cycle.length ? pick(cycle) : Math.round(c)
}

// the chord of bar b: the progression, except that the bar before the end card's first bar line is
// the IV (Cmaj7) and from that line on the I (G) is held to the end
export function chordOf(plan, b) {
  if (b >= plan.end) return [KEY, 'maj']
  if (b === plan.end - 1) return [(KEY + 5) % 12, 'maj7']
  const [deg, q] = PROG[mod(b, 4)]
  return [(KEY + deg) % 12, q]
}

// Gain envelopes are keys [bar position, linear gain]; between two keys the gain follows a raised
// cosine, and two keys at one position are a step (drums coming in on a downbeat).
export function envAt(keys, u) {
  let i = -1
  for (let k = 0; k < keys.length; k++) if (keys[k][0] <= u + 1e-9) i = k
  if (i < 0) return keys[0][1]
  if (i === keys.length - 1) return keys[i][1]
  const [p0, g0] = keys[i],
    [p1, g1] = keys[i + 1]
  const x = Math.min(1, Math.max(0, (u - p0) / (p1 - p0)))
  return g0 + ((g1 - g0) * (1 - Math.cos(Math.PI * x))) / 2
}

export function planScore(clock, { endAt, duration }) {
  const W = clock.W
  const bar0 = clock.bar0
  const tOf = (b) => bar0 + b * BAR
  const uOf = (t) => (t - bar0) / BAR
  const u0 = uOf(0)
  const bMin = Math.floor(u0)
  const bMax = Math.ceil(uOf(duration + 0.5))
  const end = Math.ceil(uOf(endAt) - 1e-6)
  const J2 = joinBar(bar0, W(SCORE_CUES.show)),
    J3 = joinBar(bar0, W(SCORE_CUES.wall)),
    J4 = joinBar(bar0, W(SCORE_CUES.hello)),
    J5 = joinBar(bar0, W(SCORE_CUES.crack))
  if (!(J2 >= 2 && J3 >= J2 + 2 && J4 >= J3 + 2 && J5 >= J4 + 2 && end >= J5 + 2))
    throw new Error(`${clock.lang}: score joins out of order: ${[J2, J3, J4, J5, end]}`)
  const sections = [
    { id: 'S0', from: bMin, to: 0 },
    { id: 'S1', from: 0, to: J2 },
    { id: 'S2', from: J2, to: J3 },
    { id: 'S3', from: J3, to: J4 },
    { id: 'S4', from: J4, to: J5 },
    { id: 'S5', from: J5, to: bMax },
  ].map((s) => ({
    ...s,
    t0: r4(tOf(s.from)),
    t1: r4(tOf(s.to)),
    offset: SECTION_OFFSET[s.id] ?? 0,
  }))
  // the bars each section's level is measured over: its first and last bar left out, the film's
  // first moment and the end card too
  const measured = sections.map((s, k) => [
    k === 0 ? u0 + 1 : s.from + 1,
    k === sections.length - 1 ? uOf(endAt) : s.to - 1,
  ])
  // where each section's level ramps in: [from bar, to bar]
  const ramps = sections.slice(1).map((s) => (s.id === 'S1' ? [-1, 0] : [s.from, s.from + 1]))

  // which layer plays where (see the plan's table): pitched layers come in over the bar before
  // their section, drums on its downbeat (at full on the slam, from -6 dB over two bars elsewhere),
  // and whatever leaves fades over the section's first bar
  const env = {
    pad: [
      [u0, 0],
      [u0 + OPEN_FADE / BAR, 1],
    ],
    shaker0: [
      [-2, 0],
      [-2, 0.5],
      [0, 1],
      [0, 0],
    ],
    house: [
      [0, 0],
      [0, 1],
      [J3, 1],
      [J3 + 1, 0],
      [J4, 0],
      [J4, 0.5],
      [J4 + 2, 1],
      [J5, 1],
      [J5 + 1, 0],
    ],
    hats16: [
      [J2, 0],
      [J2, 0.5],
      [J2 + 2, 1],
      [J3, 1],
      [J3 + 1, 0],
    ],
    half: [
      [J3, 0],
      [J3, 0.5],
      [J3 + 2, 1],
      [J4, 1],
      [J4 + 1, 0],
    ],
    pluck: [
      [0, 0],
      [0, 1],
      [J3 - 1, 1],
      [J3, 0],
      [J4 - 1, 0],
      [J4, 1],
      [J5, 1],
      [J5 + 1, 0],
    ],
    sub: [
      [J3 - 1, 0],
      [J3, 1],
      [J4 - 1, 1],
      [J4, 0],
    ],
    arp: [
      [J2 - 1, 0],
      [J2, 1],
      [J3 - 1, 1],
      [J3, 0],
    ],
  }
  // where one pitched layer takes over from another (the stabs and the pluck from the rhodes and
  // the sub, and back) they cross in the same bar, so the join is never both at once
  env.stabs = env.pluck
  env.bell = env.pluck
  env.rhodes = env.sub
  // whether a layer sounds anywhere in bar b
  const on = (layer, b) => [0, 0.25, 0.5, 0.75].some((x) => envAt(env[layer], b + x) > 0)

  // her sentences, which the melody keeps out of
  const sents = []
  for (const Ln of Object.values(clock.lines)) for (const s of Ln.sents) sents.push([s.t0, s.t1])
  sents.sort((a, b) => a[0] - b[0])
  const free = (t) => !sents.some(([a, b]) => t > a - GATE.before && t < b + GATE.after)

  const r = rng(0x5c07e)
  const ev = []
  // times to the microsecond: a bar line lands on its sample
  const note = (layer, t, x) => ev.push({ layer, t: Math.round(t * 1e6) / 1e6, ...x })
  const chords = []
  const held = new Map() // the pad's sounding notes by pitch
  for (let b = bMin; b < bMax; b++) {
    const t0 = tOf(b)
    const [pc, q] = chordOf({ end }, b)
    chords.push([b, pc, q])
    const chord = voiceChord(pc, q)
    const step = (s) => t0 + (s * BEAT) / 4
    // the pad: a chord a bar, and one long G from the end card's bar line. A tone the next chord
    // shares is held, not struck again: two notes of one pitch a few cycles apart beat against each
    // other, and alone the pad swelled 3 LU on bar lines that way.
    const pan = (i) => (i / (chord.length - 1) - 0.5) * 0.7
    if (b <= end) {
      const len = b === end ? duration + 0.5 - t0 : BAR
      for (const m of [...held.keys()]) if (!chord.includes(m)) held.delete(m)
      chord.forEach((m, i) => {
        const h = held.get(m)
        if (h) h.len = r4(h.len + len)
        else {
          note('pad', t0, { m, len: r4(len), p: pan(i) })
          held.set(m, ev[ev.length - 1])
        }
      })
    }
    if (on('shaker0', b) || on('half', b))
      for (let s = 0; s < 16; s += 2)
        note(on('half', b) ? 'half' : 'shaker0', step(s), {
          i: 'shaker',
          g: (on('half', b) ? 0.2 : 0.14) + 0.05 * r(),
        })
    if (on('half', b)) {
      note('half', t0, { i: 'kickSoft', g: 0.8 })
      note('half', step(8), { i: 'rim', g: 0.25, p: 0.2 })
    }
    if (on('house', b))
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 0) note('house', step(s), { i: 'kick', g: 1.2 })
        if (s === 4 || s === 12) note('house', step(s), { i: 'clap', g: 0.55 })
        if (s % 4 === 2) note('house', step(s), { i: 'hatOpen', g: 0.06, p: 0.25 })
        if (s % 2 === 1) note('house', step(s), { i: 'hat', g: 0.05 + 0.02 * r(), p: -0.3 })
      }
    if (on('hats16', b))
      for (let s = 0; s < 16; s += 2)
        note('hats16', step(s), { i: 'hat', g: 0.035 + 0.015 * r(), p: 0.3 })
    const root = 36 + pc
    if (on('pluck', b))
      for (let k = 0; k < 4; k++)
        note('pluck', t0 + k * BEAT + BEAT / 2, { m: root + (k === 3 ? 12 : 0), len: BEAT * 0.42 })
    if (on('sub', b)) {
      // a half note on 1 and on 3, the first ending as the second starts: the same pitch overlapping
      // half a cycle off cancels, and a G bar lost 7 LU that way
      note('sub', t0, { m: root, len: BEAT * 1.9, g: 0.55 })
      note('sub', step(8), { m: root, len: BEAT * 1.9, g: 0.5 })
    }
    chord.forEach((m, i) => {
      const p = pan(i)
      if (on('stabs', b)) for (const s of [0, 3, 6, 10, 12]) note('stabs', step(s), { m, p })
      // the rhodes an octave over the pad: in unison, two held notes of one pitch and unrelated phase
      // cancel or add by chance, and the lock's loudness dipped 5 LU on one bar that way
      if (on('rhodes', b))
        for (const s of [0, 8]) note('rhodes', step(s) + i * 0.012, { m: m + 12, len: BEAT * 2, p })
    })
    if (on('arp', b)) {
      const tones = [...chord.map((m) => m + 12), ...chord.map((m) => m + 24)].sort((a, c) => a - c)
      for (let k = 0; k < 16; k++)
        note('arp', step(k), { m: tones[k % (chord.length + 1)], p: Math.sin(k * 1.7) * 0.35 })
    }
    if (on('bell', b) && b < end - 1)
      HOOK[mod(b, 4)].forEach(([s, m], k) => {
        if (free(step(s))) note('bell', step(s), { m, p: Math.sin(k * 1.7) * 0.35 })
      })
  }
  // the accents: the riser and a one-beat snare fill into the slam, a crash on each anchor
  note('riser', tOf(-1), { len: BAR })
  for (let s = 12; s < 16; s++)
    note('fill', tOf(-1) + (s * BEAT) / 4, { i: 'snare', g: 0.25 + 0.08 * (s - 12) })
  for (const k of ['A', 'B', 'C']) note('crash', clock.anchors[k], { p: 0.2 })
  // the motif on the music box: twice in the cold open, in the lock's pauses, and under the blink,
  // its last G on the end card's first bar line
  const motif = (t, n = MOTIF.length, gated = false) =>
    MOTIF.slice(0, n).forEach(([bt, m]) => {
      const at = t + bt * BEAT
      if (!gated || free(at)) note('musicbox', at, { m })
    })
  motif(tOf(-5))
  motif(tOf(-3))
  // in the lock, in each pause long enough: the whole motif from the pause's first beat, or its head
  const S3 = sections[3]
  let from = S3.t0
  for (const [a, b] of [...sents, [Infinity, Infinity]]) {
    const to = Math.min(a - GATE.before, S3.t1)
    if (to > from) {
      const t1 = bar0 + Math.ceil((from - bar0) / BEAT - 1e-9) * BEAT
      if (t1 + MOTIF[MOTIF.length - 1][0] * BEAT < to) motif(t1)
      else if (t1 + MOTIF[2][0] * BEAT < to) motif(t1, 3)
    }
    from = Math.max(from, b + GATE.after)
    if (from >= S3.t1) break
  }
  motif(tOf(end) - MOTIF[MOTIF.length - 1][0] * BEAT, MOTIF.length, true)
  ev.sort((x, y) => x.t - y.t)
  return {
    lang: clock.lang,
    bpm: BPM,
    bar0: r4(bar0),
    start: r4(tOf(bMin)),
    duration: r4(duration),
    endAt: r4(endAt),
    end,
    joins: { show: J2, wall: J3, hello: J4, crack: J5 },
    anchors: Object.fromEntries(Object.entries(clock.anchors).map(([k, v]) => [k, r4(v)])),
    sections,
    measured,
    ramps,
    env,
    chords,
    events: ev,
    openFade: OPEN_FADE,
  }
}

// ------------------------------------------------------------------ the bed in the mix
// One gain for the whole film, never a ride. Voiced, the music's loudness from two seconds after the
// slam to the end card sits BED.lu under the voice's integrated loudness (about -24.8 against
// -13.8 LUFS in the finished mix); silent, the music keeps the level the film always had against
// its SFX. mix() first brings the stem to -16 LUFS over its whole length (wholeLufs) and the voice
// goes in at -16, so the gain is relative to that.
export const BED = { lu: 11, silentDb: -4, minVoiceOver: 8, maxLower: 2 }
export const bedGain = ({ voiced, wholeLufs, spanLufs }) =>
  voiced ? -BED.lu - (spanLufs - wholeLufs) : BED.silentDb
// the safety check: when a sentence clears the bed by less than BED.minVoiceOver dB, the whole bed
// (never one part of it) goes down by the shortfall and half a decibel, at most BED.maxLower
export const bedLower = (worstVoiceOver) =>
  worstVoiceOver < BED.minVoiceOver
    ? Math.min(BED.maxLower, BED.minVoiceOver - worstVoiceOver + 0.5)
    : 0

// ------------------------------------------------------------------ rendering
const S = (sec) => Math.max(1, Math.round(sec * SR))
// the pad's chords rise over 0.3 s and ring 0.6 s (time constant) under the next one: alone (the cold
// open, the outro) it changes chord within about a decibel of its level
const PAD_ENV = [0.3, 0.01, 1, 2.4]
const stabCut = (t) => 900 + 4500 * Math.exp(-t / 0.09)
const arpCut = (t) => 1200 + 3000 * Math.exp(-t / 0.05)
function voice(e) {
  const f = e.m === undefined ? 0 : mtof(e.m)
  switch (e.layer) {
    case 'pad':
      return I.softPad(f, e.len, PAD_ENV, 1)
    case 'pluck':
      return I.bassNote(f, e.len, 'pluck')
    case 'sub':
      return I.bassNote(f, e.len, 'sub')
    case 'stabs':
      return I.sawStack(f, BEAT * 0.22, 3, 12, stabCut, [0.003, 0.1, 0.4, 0.08])
    case 'rhodes':
      return I.rhodes(f, e.len)
    case 'arp':
      return I.sawStack(f, BEAT * 0.2, 2, 8, arpCut, [0.002, 0.08, 0.3, 0.05])
    case 'bell':
      return I.bell(f)
    case 'musicbox':
      return I.musicbox(f)
    case 'crash':
      return I.crash()
    case 'riser':
      return I.riser(e.len)
  }
  switch (e.i) {
    case 'kick':
      return I.kick()
    case 'kickSoft':
      return I.kick(true)
    case 'clap':
      return I.clap()
    case 'hat':
      return I.hat()
    case 'hatOpen':
      return I.hat(true)
    case 'shaker':
      return I.shaker()
    case 'rim':
      return I.rim()
    case 'snare':
      return I.snare()
  }
  throw new Error(`no instrument for ${JSON.stringify(e)}`)
}
// each layer's level against the others, as the day videos' mixes have them
const GAIN = {
  pad: 0.14,
  pluck: 0.85,
  stabs: 0.16,
  rhodes: 0.26,
  arp: 0.14,
  bell: 0.2,
  musicbox: 0.1,
  crash: 0.1,
  riser: 0.2,
}
// K-weighting (BS.1770) at SR: the high shelf, then the high-pass, as [b0, b1, b2, a1, a2]
function kCoefs() {
  let K = Math.tan((Math.PI * 1681.974450955533) / SR)
  const Vh = Math.pow(10, 3.999843853973347 / 20),
    Vb = Math.pow(Vh, 0.4996667741545416),
    Q1 = 0.7071752369554196
  let a0 = 1 + K / Q1 + K * K
  const shelf = [
    (Vh + (Vb * K) / Q1 + K * K) / a0,
    (2 * (K * K - Vh)) / a0,
    (Vh - (Vb * K) / Q1 + K * K) / a0,
    (2 * (K * K - 1)) / a0,
    (1 - K / Q1 + K * K) / a0,
  ]
  K = Math.tan((Math.PI * 38.13547087602444) / SR)
  const Q2 = 0.5003270373238773
  a0 = 1 + K / Q2 + K * K
  return [shelf, [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0]]
}
// the K-weighted level (LUFS, ungated) of a stereo buffer over samples [a, b)
function kLevel(bus, a, b) {
  let e = 0
  for (const ch of bus) {
    let y = ch.subarray(a, b)
    for (const [b0, b1, b2, a1, a2] of kCoefs()) {
      const o = new Float32Array(y.length)
      let x1 = 0,
        x2 = 0,
        y1 = 0,
        y2 = 0
      for (let i = 0; i < y.length; i++) {
        o[i] = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1
        x1 = y[i]
        y2 = y1
        y1 = o[i]
      }
      y = o
    }
    let s = 0
    for (let i = 0; i < y.length; i++) s += y[i] * y[i]
    e += s / Math.max(1, y.length)
  }
  return -0.691 + 10 * Math.log10(e + 1e-12)
}
// A 15 kHz low-pass (two-pole, Butterworth): the music box's attacks jump almost full scale from
// one sample to the next, and AAC rings on that, a one-sample spike up to 5 dB over the limiter.
// Nothing of the score lives up there.
function lowPass(bus) {
  const w0 = (2 * Math.PI * 15000) / SR,
    al = Math.sin(w0) / (2 * Math.SQRT1_2),
    cw = Math.cos(w0),
    a0 = 1 + al
  const b0 = (1 - cw) / 2 / a0,
    b1 = (1 - cw) / a0,
    a1 = (-2 * cw) / a0,
    a2 = (1 - al) / a0
  for (const X of bus) {
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0
    for (let i = 0; i < X.length; i++) {
      const x = X[i]
      const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      X[i] = y
    }
  }
}

// an envelope as one gain per sample (evaluated every 32 samples, 0.7 ms, and held between)
function curveOf(keys, N, u) {
  const g = new Float32Array(N)
  for (let i = 0; i < N; i += 32) g.fill(envAt(keys, u(i)), i, Math.min(N, i + 32))
  return g
}

// the cache key: the plan and the code that renders it (this file and the synth it plays)
const SOURCES = ['film-score.mjs', 'synth/music-synth.mjs', 'synth/dsp.mjs'].map((f) =>
  fs.readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'),
)
export const planHash = (plan) =>
  crypto
    .createHash('sha1')
    .update(JSON.stringify(plan) + SOURCES.join(''))
    .digest('hex')
    .slice(0, 16)

// The stem: every layer rendered on its own, shaped by its envelope (and the pump), summed with
// the reverb; then each section brought to one level (its offset aside) with the gain ramping over
// a bar at each join, the low-pass, and a peak guard. Returns the measured section levels.
export function renderScore(plan, out) {
  const cached = path.join(CACHE, `intro-score-${planHash(plan)}.wav`)
  const meta = cached.replace(/\.wav$/, '.json')
  if (fs.existsSync(cached) && fs.existsSync(meta)) {
    fs.copyFileSync(cached, out)
    return { out, ...JSON.parse(fs.readFileSync(meta, 'utf8')) }
  }
  const t0 = plan.start
  const N = S(plan.duration + 0.5 - t0)
  const at = (t) => Math.round((t - t0) * SR)
  const u = (i) => (i / SR + t0 - plan.bar0) / BAR
  const mixBus = stereo(N),
    send = stereo(N)
  // the house kick's times, for the pump
  const kicks = plan.events.filter((e) => e.layer === 'house' && e.i === 'kick').map((e) => e.t)
  const layers = [...new Set(plan.events.map((e) => e.layer))]
  for (const layer of layers) {
    const bus = stereo(N)
    for (const e of plan.events)
      if (e.layer === layer)
        addTo(bus, voice(e), at(e.t), (e.g ?? 1) * (GAIN[layer] ?? 1), e.p ?? 0)
    const g = plan.env[layer] ? curveOf(plan.env[layer], N, u) : new Float32Array(N).fill(1)
    if (layer === 'pluck' || layer === 'stabs') {
      const house = curveOf(plan.env.house, N, u)
      let k = 0
      for (let i = 0; i < N; i++) {
        const t = i / SR + t0
        while (k + 1 < kicks.length && kicks[k + 1] <= t) k++
        if (kicks.length && kicks[k] <= t)
          g[i] *= 1 - PUMP * house[i] * Math.exp(-(t - kicks[k]) / 0.11)
      }
    }
    const sg = (SEND[layer] ?? 0) * 0.45
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < N; i++) {
        const x = bus[c][i] * g[i]
        mixBus[c][i] += x
        send[c][i] += x * sg
      }
  }
  const wet = reverb(send, { room: 0.84, damp: 0.4, loop: false })
  for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) mixBus[c][i] += wet[c][i]
  // the low-pass first: the hats' noise above 15 kHz is 0.6 dB of a groove section's K-weighted level
  lowPass(mixBus)
  // each section to one level: S1 sets it, the others follow with their offsets
  const span = ([a, b]) => [
    Math.max(0, at(plan.bar0 + a * BAR)),
    Math.min(N, at(plan.bar0 + b * BAR)),
  ]
  const before = plan.measured.map((m) => kLevel(mixBus, ...span(m)))
  const target = before[1]
  const gains = plan.sections.map((s, k) => Math.pow(10, (target + s.offset - before[k]) / 20))
  const curve = plan.ramps.flatMap(([a, b], k) => [
    [a, gains[k]],
    [b, gains[k + 1]],
  ])
  const g = curveOf(curve, N, u)
  for (const ch of mixBus) for (let i = 0; i < N; i++) ch[i] *= g[i]
  const after = plan.measured.map((m) => kLevel(mixBus, ...span(m)))
  let peak = 0
  for (const ch of mixBus) for (const v of ch) peak = Math.max(peak, Math.abs(v))
  const guard = peak > 0.89 ? 0.89 / peak : 1
  // the film starts at 0: what the bars before it rendered (a pad already sounding) is cut there
  const o = at(0),
    n = S(plan.duration + 0.5)
  const outBus = mixBus.map((ch) => {
    const x = ch.slice(o, o + n)
    if (guard !== 1) for (let i = 0; i < x.length; i++) x[i] *= guard
    return x
  })
  const r2 = (x) => Math.round(x * 100) / 100
  const info = {
    levels: plan.sections.map((s, k) => ({
      id: s.id,
      before: r2(before[k]),
      gainDb: r2(20 * Math.log10(gains[k])),
      after: r2(after[k] + 20 * Math.log10(guard)),
    })),
    peakGuardDb: r2(20 * Math.log10(guard)),
  }
  fs.mkdirSync(CACHE, { recursive: true })
  writeWav(cached, outBus)
  fs.writeFileSync(meta, JSON.stringify(info))
  fs.copyFileSync(cached, out)
  return { out, ...info }
}
