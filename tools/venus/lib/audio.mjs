// Audio for one video: voice analysis (loudness envelope, voiced spans, alignment), the SFX bus,
// the purr, the music bed, and the final mix through lib/synth/mix.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { SR, rng, stereo, addTo, noise, svf, expDecay, mul, writeWav } from './synth/dsp.mjs'
import { renderSfx } from './synth/sfx-synth.mjs'
import { renderMusic, MOODS } from './synth/music-synth.mjs'
import { estimateAlignment } from './synth/say.mjs'
import { mix, measure } from './synth/mix.mjs'
import { sting } from './sting.mjs'

export { mix, measure }

// The generator has celebrate / chill / epic / cozy. Smug and goofy days want "playful": a bouncy, swung
// variant built from the same parts (boom-bap swing, chord stabs, music-box hook, offbeat bass).
MOODS.playful = MOODS.playful || {
  bpm: [104, 112],
  key: 67,
  prog: [
    [0, 'six'],
    [9, 'min7'],
    [5, 'add9'],
    [7, 'maj'],
  ],
  drums: 'boombap',
  chords: 'stab',
  lead: 'musicbox',
  bass: 'offbeat',
  swing: 0.56,
  pump: 0.3,
}

// ------------------------------------------------------------------ decode
function decode(file, { rate = SR, ch = 1 } = {}) {
  const buf = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      file,
      '-f',
      'f32le',
      '-ac',
      String(ch),
      '-ar',
      String(rate),
      '-',
    ],
    { maxBuffer: 1 << 30 },
  )
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
  if (ch === 1) return [Float32Array.from(all)]
  const n = all.length / ch,
    out = Array.from({ length: ch }, () => new Float32Array(n))
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = all[i * ch + c]
  return out
}

// ------------------------------------------------------------------ voice analysis
// Loudness envelope per video frame (0..1), a brightness value per frame (zero-crossing rate:
// high on s/ş/z/i/e, low on a/o/u), voiced spans, and a character alignment. If the voice comes
// with an ElevenLabs alignment (voice/dayN.json, the API's `alignment` object) it is used as is;
// otherwise the text is spread over the voiced spans, as estimateAlignment in lib/synth/say.mjs does.
export function analyseVoice(file, text, fps = 30) {
  const [x] = decode(file, { rate: 48000 })
  const sr = 48000,
    dur = x.length / sr,
    nF = Math.ceil(dur * fps) + 1,
    win = Math.round(sr / fps)
  const rmsDb = [],
    zcr = []
  for (let f = 0; f < nF; f++) {
    const c = Math.round((f / fps) * sr),
      a = Math.max(0, c - win),
      b = Math.min(x.length, c + win)
    let s = 0,
      z = 0
    for (let i = a; i < b; i++) {
      s += x[i] * x[i]
      if (i > a && x[i] >= 0 !== x[i - 1] >= 0) z++
    }
    const n = Math.max(1, b - a)
    rmsDb.push(10 * Math.log10(s / n + 1e-12))
    zcr.push(z / n)
  }
  const peak = [...rmsDb].sort((p, q) => q - p)[Math.floor(nF * 0.05)] ?? -20
  const floor = peak - 28
  let env = rmsDb.map((d) => Math.min(1, Math.max(0, (d - floor) / (peak - floor))))
  // fast attack, ~70 ms release: a mouth snaps open and eases shut
  for (let f = 1; f < nF; f++) env[f] = Math.max(env[f], env[f - 1] * 0.62)
  const voiced = rmsDb.map((d) => d > peak - 24)
  const spansAt = (gapMerge) => {
    const sp = []
    for (let f = 0; f < nF; f++)
      if (voiced[f]) {
        const t = f / fps,
          last = sp[sp.length - 1]
        if (last && t - last[1] <= gapMerge) last[1] = t + 1 / fps
        else sp.push([t, t + 1 / fps])
      }
    return sp.filter(([a, b]) => b - a > 0.07)
  }
  const spans = spansAt(0.22)
  const json = file.replace(/\.wav$/, '.json')
  const alignment = fs.existsSync(json)
    ? JSON.parse(fs.readFileSync(json, 'utf8')).alignment ||
      JSON.parse(fs.readFileSync(json, 'utf8'))
    : estimateAlignment(text, spans)
  const zMax = Math.max(...zcr.filter((_, f) => voiced[f]), 1e-3)
  return {
    dur,
    env,
    bright: zcr.map((z) => Math.min(1, z / zMax)),
    spans,
    alignment,
    voiceStart: spans[0]?.[0] ?? 0,
    voiceEnd: spans[spans.length - 1]?.[1] ?? dur,
  }
}

// words with times from a character alignment
export function wordsOf(al) {
  const c = al.characters,
    s = al.character_start_times_seconds,
    e = al.character_end_times_seconds
  const words = []
  let cur = null
  for (let i = 0; i < c.length; i++) {
    if (/\s/.test(c[i])) {
      cur = null
      continue
    }
    if (!cur) {
      cur = { text: '', t0: s[i], t1: e[i], i0: i }
      words.push(cur)
    }
    cur.text += c[i]
    cur.t1 = e[i]
  }
  return words
}

// ------------------------------------------------------------------ SFX
const cache = new Map()
function kindBuf(kind, dir) {
  if (cache.has(kind)) return cache.get(kind)
  const f = path.join(dir, `sfx-${kind}.wav`)
  if (!fs.existsSync(f)) renderSfx({ kind, seed: 3, outPath: f })
  const b = decode(f, { ch: 2 })
  cache.set(kind, b)
  return b
}
const S = (sec) => Math.round(sec * SR)
// camera shutter: a sharp click, a short mechanical rattle, a second click
function shutter(r) {
  const n = S(0.16),
    out = new Float32Array(n)
  const click = (at, f, g) => {
    const nz = svf(noise(S(0.03), r), 'band', f, 2.2)
    const env = expDecay(nz.length, 0.006, 0.0005)
    for (let i = 0; i < nz.length && at + i < n; i++) out[at + i] += nz[i] * env[i] * g
  }
  click(0, 4200, 1)
  click(S(0.012), 1800, 0.5)
  click(S(0.085), 3200, 0.7)
  return out
}
// plastic bag crinkle: a cluster of tiny bright noise grains
function crinkle(r) {
  const n = S(0.45),
    out = new Float32Array(n)
  for (let k = 0; k < 26; k++) {
    const at = Math.floor(Math.pow(r(), 1.6) * S(0.38)),
      g = 0.3 + 0.7 * r()
    const nz = svf(noise(S(0.02), r), 'band', 2500 + 5000 * r(), 1.5),
      env = expDecay(nz.length, 0.003, 0.0003)
    for (let i = 0; i < nz.length && at + i < n; i++) out[at + i] += nz[i] * env[i] * g
  }
  return out
}
// A purr: low, filtered noise pulsed at ~26 Hz, in breaths (out-breath louder, in-breath
// softer and a touch slower), so it reads as a cat and not as an engine.
export function purr(seconds, seed = 5) {
  const r = rng(seed),
    n = S(seconds)
  const base = svf(noise(n, r), 'lp', 380, 0.9)
  const body = svf(noise(n, r), 'band', 140, 1.4)
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR,
      breath = (t % 1.05) / 1.05,
      out_ = breath < 0.58
    const f = out_ ? 26 : 23
    ph += f / SR
    if (ph >= 1) ph -= 1
    const pulse = Math.pow(Math.max(0, Math.sin(Math.PI * ph)), 6)
    const bEnv = out_
      ? Math.sin((Math.PI * breath) / 0.58)
      : 0.55 * Math.sin((Math.PI * (breath - 0.58)) / 0.42)
    const fade = Math.min(1, t / 0.08, (seconds - t) / 0.25)
    out[i] =
      (base[i] * 1.6 + body[i] * 1.2) *
      pulse *
      (0.35 + 0.65 * Math.max(0, bEnv)) *
      Math.max(0, fade)
  }
  return out
}

// Build one stereo SFX bus for the whole video. Returns the wav path.
export function sfxBus(list, duration, out, dir) {
  const bus = stereo(S(duration + 0.5)),
    r = rng(11)
  for (const s of list) {
    const g = Math.pow(10, (s.gainDb ?? 0) / 20)
    if (s.kind === 'shutter') {
      addTo(bus, shutter(r), S(s.at), g * 0.9, (r() - 0.5) * 0.8)
      continue
    }
    if (s.kind === 'crinkle') {
      addTo(bus, crinkle(r), S(s.at), g * 0.8, 0.1)
      continue
    }
    // the end card's sound logo (lib/sting.mjs), already stereo
    if (s.kind === 'sting') {
      const [L, R] = sting()
      for (let i = 0; i < L.length; i++) {
        const j = S(s.at) + i
        if (j >= bus[0].length) break
        bus[0][j] += L[i] * g
        bus[1][j] += R[i] * g
      }
      continue
    }
    if (s.kind === 'purr') {
      addTo(bus, purr(s.seconds), S(s.at), g, 0)
      continue
    }
    if (s.kind === 'counter') {
      // one tick per displayed number, never closer than 45 ms (a buzz, not a count)
      const [L] = kindBuf('tick', dir)
      let last = -1
      for (const [t, k] of s.ticks)
        if (t - last >= 0.045) {
          addTo(bus, L, S(t), g * (0.6 + 0.4 * k), 0.15 * Math.sin(t * 9))
          last = t
        }
      continue
    }
    const [L, R] = kindBuf(s.kind, dir)
    for (let i = 0; i < L.length; i++) {
      const j = S(s.at) + i
      if (j >= bus[0].length) break
      bus[0][j] += L[i] * g
      bus[1][j] += R[i] * g
    }
  }
  // headroom only (no normalising: relative levels are set in the score)
  let p = 0
  for (const ch of bus) for (const v of ch) p = Math.max(p, Math.abs(v))
  if (p > 0.89) for (const ch of bus) mul(ch, 0.89 / p)
  writeWav(out, bus)
  return out
}

export function musicBed(mood, seed, seconds, out) {
  if (!fs.existsSync(out)) renderMusic({ mood, seconds, seed, outPath: out })
  return out
}
