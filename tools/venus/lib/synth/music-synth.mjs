// Procedural loop generator: the stand-in for Eleven Music until a key exists.
// Four moods, each a 4-chord progression with drums, bass, chords and a hook
// whose rhythm and contour come from a seed, so every day gets a new variation
// of the same musical identity. Output is a seamless loop of whole bars: tails
// of the last bar (reverb, decays) are folded into the first.
import {
  SR,
  rng,
  mtof,
  stereo,
  addTo,
  osc,
  noise,
  adsr,
  expDecay,
  mul,
  mix,
  svf,
  onePoleLP,
  reverb,
  busAdd,
  master,
  writeWav,
} from './dsp.mjs'

const CHORD = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  six: [0, 4, 7, 9],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
}

export const MOODS = {
  // Bright Afro-house-ish pop: four on the floor, offbeat bass, chord stabs, bell hook.
  celebrate: {
    bpm: [112, 124],
    key: 65,
    prog: [
      [0, 'add9'],
      [7, 'maj'],
      [9, 'min7'],
      [5, 'maj7'],
    ],
    drums: 'house',
    chords: 'stab',
    lead: 'bell',
    bass: 'offbeat',
    swing: 0,
    pump: 0.55,
  },
  // Lo-fi: lazy boom-bap, swung hats, Rhodes 7ths, round sub, a little vinyl.
  chill: {
    bpm: [84, 96],
    key: 62,
    prog: [
      [5, 'maj7'],
      [4, 'min7'],
      [2, 'min7'],
      [0, 'maj7'],
    ],
    drums: 'boombap',
    chords: 'rhodes',
    lead: 'rhodesLead',
    bass: 'sub',
    swing: 0.6,
    pump: 0.15,
    lofi: true,
  },
  // Anthem: minor-feel vi-IV-I-V, supersaw pad, 16th arp, crash on the one, tom fill + riser into the loop point.
  epic: {
    bpm: [118, 128],
    key: 60,
    prog: [
      [9, 'min'],
      [5, 'maj'],
      [0, 'maj'],
      [7, 'sus2'],
    ],
    drums: 'anthem',
    chords: 'supersaw',
    lead: 'arp',
    bass: 'eighths',
    swing: 0,
    pump: 0.5,
  },
  // Late-night: soft pad, music-box melody, brushed shaker, warm sub.
  cozy: {
    bpm: [76, 86],
    key: 63,
    prog: [
      [0, 'maj7'],
      [9, 'min7'],
      [5, 'maj7'],
      [7, 'six'],
    ],
    drums: 'soft',
    chords: 'pad',
    lead: 'musicbox',
    bass: 'sub',
    swing: 0.58,
    pump: 0.1,
  },
}

export function moodFromPrompt(prompt = '') {
  const p = prompt.toLowerCase()
  if (/cozy|night|sleep|calm|lullab|soft|gece/.test(p)) return 'cozy'
  if (/epic|milestone|anthem|record|100|365|big|legend/.test(p)) return 'epic'
  if (/chill|lo-?fi|relax|study|mellow/.test(p)) return 'chill'
  return 'celebrate'
}

// Pick bar count (4/6/8) and BPM so the loop lands close to `seconds`.
function fitTempo(range, seconds) {
  let best = null
  for (const bars of [4, 6, 8]) {
    const bpm = Math.min(range[1], Math.max(range[0], (bars * 4 * 60) / seconds))
    const dur = (bars * 4 * 60) / bpm
    const err = Math.abs(dur - seconds)
    if (!best || err < best.err - 0.05) best = { bars, bpm, dur, err }
  }
  return best
}

// ---------- instruments (each returns a mono Float32Array) ----------
const S = (sec) => Math.max(1, Math.round(sec * SR))

function kick(soft = false) {
  const n = S(0.45)
  const body = osc('sine', (t) => 48 + 120 * Math.exp(-t / 0.035), n)
  mul(body, expDecay(n, soft ? 0.09 : 0.14, 0.001))
  const click = mul(svf(noise(S(0.006)), 'hp', 3000), 0.35)
  return mix(body, click)
}
function snare() {
  const n = S(0.3)
  const tone = mul(
    osc('sine', (t) => 185 + 40 * Math.exp(-t / 0.01), n),
    expDecay(n, 0.05),
  )
  const sn = mul(svf(noise(n), 'bp', 2400, 0.8), expDecay(n, 0.11))
  return mix(mul(tone, 1.0), mul(sn, 2.4))
}
function clap() {
  const n = S(0.35)
  const env = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let e = Math.exp(-t / 0.13)
    for (const b of [0, 0.011, 0.022])
      if (t >= b && t < b + 0.01) e = Math.max(e, Math.exp(-(t - b) / 0.004))
    env[i] = e
  }
  return mul(svf(noise(n), 'bp', 1300, 1.3), mul(env, 1.8))
}
function hat(open = false) {
  const n = S(open ? 0.35 : 0.06)
  return mul(svf(noise(n), 'hp', 7500), expDecay(n, open ? 0.16 : 0.022, 0.0005))
}
function shaker() {
  const n = S(0.09)
  return mul(svf(noise(n), 'bp', 6500, 1), adsr(n, 0.012, 0.05, 0, 0.01, 0.02))
}
function rim() {
  const n = S(0.08)
  return mul(
    mix(osc('sine', 1700, n), mul(osc('sine', 820, n), 0.6), mul(svf(noise(n), 'bp', 4000), 0.4)),
    expDecay(n, 0.012),
  )
}
function tom(f) {
  const n = S(0.5)
  return mul(
    osc('sine', (t) => f * (1 + 0.6 * Math.exp(-t / 0.04)), n),
    expDecay(n, 0.2),
  )
}
function crash() {
  const n = S(2.2)
  const metal = mix(...[1, 1.47, 1.93, 2.61, 3.27].map((r) => mul(osc('square', 420 * r, n), 0.15)))
  return mul(svf(mix(noise(n), metal), 'hp', 5200), expDecay(n, 0.7, 0.001))
}
function riser(sec) {
  const n = S(sec)
  const s = svf(noise(n), 'bp', (t) => 400 + 7000 * Math.pow(t / sec, 2), 1.4)
  for (let i = 0; i < n; i++) s[i] *= Math.pow(i / n, 2.2) * 0.9
  return s
}
function bassNote(f, len, style) {
  const n = S(len + 0.15)
  if (style === 'sub') {
    const s = mix(osc('sine', f, n), mul(osc('tri', f * 2, n), 0.12))
    return mul(s, adsr(n, 0.01, 0.25, 0.5, 0.12, len))
  }
  const s = mix(mul(osc('saw', f, n), 0.7), osc('sine', f, n))
  const f2 = svf(s, 'lp', (t) => 180 + 1400 * Math.exp(-t / 0.07), 0.9)
  return mul(f2, adsr(n, 0.004, 0.15, 0.7, 0.06, len))
}
function sawStack(f, len, voices, detuneCents, cutoff, env) {
  const n = S(len + env[3] + 0.05)
  const parts = []
  for (let v = 0; v < voices; v++) {
    const d = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2 * detuneCents
    parts.push(osc('saw', f * Math.pow(2, d / 1200), n, Math.random()))
  }
  const s = svf(mul(mix(...parts), 1 / voices), 'lp', cutoff, 0.8)
  return mul(s, adsr(n, env[0], env[1], env[2], env[3], len))
}
function fm(f, len, ratio, index, tauIdx, tauAmp, attack = 0.002) {
  const n = S(len)
  const out = new Float32Array(n)
  let pc = Math.random(),
    pm = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const m = Math.sin(2 * Math.PI * pm) * index * Math.exp(-t / tauIdx)
    out[i] = Math.sin(2 * Math.PI * pc + m) * Math.min(1, t / attack) * Math.exp(-t / tauAmp)
    pc += f / SR
    pm += (f * ratio) / SR
  }
  return out
}
const rhodes = (f, len) =>
  mix(fm(f, len + 1.2, 1, 2.2, 0.3, 1.1, 0.004), mul(fm(f, 0.3, 14, 0.8, 0.03, 0.06), 0.14))
const bell = (f) =>
  mix(fm(f, 1.2, 3.5, 2.2, 0.15, 0.45), mul(fm(f * 2, 0.6, 1, 0.5, 0.1, 0.2), 0.25))
function musicbox(f) {
  const n = S(1.4)
  const s = mix(
    osc('sine', f, n),
    mul(osc('sine', f * 3, n), 0.22),
    mul(osc('sine', f * 6.2, n), 0.06),
  )
  return mul(s, expDecay(n, 0.55, 0.002))
}
function softPad(f, len) {
  const n = S(len + 0.9)
  const s = mix(osc('tri', f, n), osc('tri', f * 1.004, n), mul(osc('saw', f * 0.998, n), 0.25))
  return mul(svf(s, 'lp', 1300, 0.7), adsr(n, 0.35, 0.4, 0.75, 0.9, len))
}

// ---------- arrangement ----------
function voiceChord(rootPc, quality) {
  const iv = CHORD[quality]
  // Keep every tone within G3..G4 so consecutive chords move by small steps.
  const notes = iv
    .map((x) => {
      let m = 60 + ((rootPc + x) % 12)
      while (m > 67) m -= 12
      while (m < 55) m += 12
      return m
    })
    .sort((a, b) => a - b)
  return notes
}

function makeMotif(r, mood) {
  // Onsets on a 16-step grid; strong steps weighted so the hook feels like one.
  const weights = mood === 'arp' ? null : [5, 1, 2, 1, 3, 1, 3, 2, 4, 1, 2, 1, 3, 2, 3, 1]
  const onsets = []
  if (!weights) for (let s = 0; s < 16; s++) onsets.push(s)
  else {
    const count = 4 + Math.floor(r() * 3)
    const pool = weights.map((w, i) => ({ i, w: w * (0.5 + r()) }))
    pool.sort((a, b) => b.w - a.w)
    for (const p of pool.slice(0, count)) onsets.push(p.i)
    onsets.sort((a, b) => a - b)
  }
  // Contour: indices into the chord tones (+ octave), stepwise with one leap.
  let idx = Math.floor(r() * 3)
  const degrees = onsets.map(() => {
    const step = r() < 0.2 ? (r() < 0.5 ? -2 : 2) : r() < 0.5 ? -1 : 1
    idx = Math.max(0, Math.min(5, idx + step))
    return idx
  })
  return { onsets, degrees }
}

export function renderMusic({ mood = 'celebrate', seconds = 12, seed = 1, outPath }) {
  const M = MOODS[mood] || MOODS.celebrate
  const r = rng(seed)
  const { bars, bpm, dur } = fitTempo(M.bpm, seconds)
  const beat = 60 / bpm
  const N = Math.round(dur * SR)
  const drums = stereo(N),
    music = stereo(N),
    lead = stereo(N),
    send = stereo(N)
  const at = (sec) => Math.round(sec * SR)
  const swingT = (step16) => {
    // swing the off 8ths (and off 16ths proportionally)
    const base = step16 * (beat / 4)
    if (!M.swing) return base
    const pos8 = step16 / 2
    if (step16 % 2 === 0 && Math.floor(pos8) % 2 === 1) return base + (M.swing - 0.5) * beat
    return base
  }
  const motif = makeMotif(r, M.lead === 'arp' ? 'arp' : 'hook')
  const motifB = makeMotif(r, M.lead === 'arp' ? 'arp' : 'hook')
  const kicks = []

  for (let b = 0; b < bars; b++) {
    const t0 = b * 4 * beat
    const [deg, q] = M.prog[b % M.prog.length]
    const rootPc = (M.key + deg) % 12
    const chord = voiceChord(rootPc, q)
    const bassF = mtof(36 + rootPc)
    const lastOfPhrase = b === bars - 1

    // Drums
    for (let s = 0; s < 16; s++) {
      const t = t0 + swingT(s)
      const beatStep = s % 4 === 0
      if (M.drums === 'house' || M.drums === 'anthem') {
        if (beatStep) {
          addTo(drums, kick(), at(t), 1.2, 0, true)
          kicks.push(t)
        }
        if (s === 4 || s === 12)
          addTo(drums, M.drums === 'house' ? clap() : mix(clap(), snare()), at(t), 0.55, 0, true)
        if (s % 4 === 2) addTo(drums, hat(true), at(t), 0.06, 0.25, true)
        if (s % 2 === 1 || M.drums === 'anthem')
          addTo(drums, hat(), at(t), (M.drums === 'anthem' ? 0.035 : 0.05) + 0.02 * r(), -0.3, true)
        if (M.drums === 'house' && lastOfPhrase && s >= 12)
          addTo(drums, snare(), at(t), 0.25 + 0.08 * (s - 12), 0, true)
        if (M.drums === 'anthem' && lastOfPhrase && s >= 8 && s % 2 === 0)
          addTo(drums, tom(s < 12 ? 140 : 95), at(t), 0.6, s < 12 ? 0.4 : -0.4, true)
      } else if (M.drums === 'boombap') {
        if (s === 0 || s === 10 || (s === 7 && b % 2)) {
          addTo(drums, kick(true), at(t), 1.4, 0, true)
          kicks.push(t)
        }
        if (s === 4 || s === 12) addTo(drums, snare(), at(t), 0.75, 0.05, true)
        if (s % 2 === 0) addTo(drums, hat(), at(t), 0.04 + 0.02 * r(), -0.25, true)
      } else if (M.drums === 'soft') {
        if (s === 0 || s === 10) {
          addTo(drums, kick(true), at(t), 1.0, 0, true)
          kicks.push(t)
        }
        if (s === 8) addTo(drums, rim(), at(t), 0.18, 0.2, true)
        if (s % 2 === 0) addTo(drums, shaker(), at(t), 0.14 + 0.05 * r(), -0.35, true)
      }
    }
    if (M.drums === 'anthem' && b === 0) addTo(drums, crash(), 0, 0.1, 0.2, true)
    if (M.drums === 'anthem' && lastOfPhrase) addTo(send, riser(4 * beat), at(t0), 0.35, 0, true)

    // Bass
    if (M.bass === 'offbeat') {
      for (let k = 0; k < 4; k++)
        addTo(
          music,
          bassNote(bassF * (k === 3 ? 2 : 1), beat * 0.42, 'pluck'),
          at(t0 + k * beat + beat / 2),
          0.85,
          0,
          true,
        )
    } else if (M.bass === 'eighths') {
      for (let k = 0; k < 8; k++)
        addTo(
          music,
          bassNote(bassF * (k % 2 ? 2 : 1), beat * 0.4, 'pluck'),
          at(t0 + (k * beat) / 2),
          0.7,
          0,
          true,
        )
    } else {
      addTo(
        music,
        bassNote(bassF, beat * 2.6, 'sub'),
        at(t0),
        M.chords === 'pad' ? 0.4 : 0.55,
        0,
        true,
      )
      addTo(
        music,
        bassNote(bassF * (M.chords === 'pad' ? 1.5 : 1), beat * 1.1, 'sub'),
        at(t0 + swingT(10)),
        M.chords === 'pad' ? 0.28 : 0.4,
        0,
        true,
      )
    }

    // Chords
    chord.forEach((m, i) => {
      const f = mtof(m)
      const pan = (i / Math.max(1, chord.length - 1) - 0.5) * 0.7
      if (M.chords === 'stab') {
        for (const s of [0, 3, 6, 10, 12]) {
          const sig = sawStack(
            f,
            beat * 0.22,
            3,
            12,
            (t) => 900 + 4500 * Math.exp(-t / 0.09),
            [0.003, 0.1, 0.4, 0.08],
          )
          addTo(music, sig, at(t0 + swingT(s)), 0.16, pan, true)
          addTo(send, sig, at(t0 + swingT(s)), 0.06, pan, true)
        }
      } else if (M.chords === 'supersaw') {
        const sig = sawStack(f, 4 * beat, 5, 18, 3200, [0.05, 0.3, 0.8, 0.4])
        addTo(music, sig, at(t0), 0.11, pan, true)
        addTo(send, sig, at(t0), 0.08, pan, true)
      } else if (M.chords === 'rhodes') {
        for (const s of [0, 7]) {
          const sig = rhodes(f, beat * (s ? 1.5 : 2))
          addTo(music, sig, at(t0 + swingT(s) + i * 0.012), 0.2, pan, true)
          addTo(send, sig, at(t0 + swingT(s)), 0.07, pan, true)
        }
      } else {
        const sig = softPad(f, 4 * beat)
        addTo(music, sig, at(t0), 0.14, pan, true)
        addTo(send, sig, at(t0), 0.1, pan, true)
      }
    })

    // Lead / hook (follows this bar's chord tones). Odd bars answer with motif B.
    const mt = M.lead === 'arp' ? motif : b % 2 ? motifB : motif
    const tones = [...chord.map((m) => m + 12), ...chord.map((m) => m + 24)].sort((a, c) => a - c)
    mt.onsets.forEach((s, k) => {
      const m =
        tones[Math.min(tones.length - 1, M.lead === 'arp' ? k % (chord.length + 1) : mt.degrees[k])]
      const f = mtof(m)
      const t = t0 + swingT(s)
      let sig, g
      if (M.lead === 'bell') {
        sig = bell(f)
        g = 0.26
      } else if (M.lead === 'arp') {
        sig = sawStack(
          f,
          beat * 0.2,
          2,
          8,
          (tt) => 1200 + 3000 * Math.exp(-tt / 0.05),
          [0.002, 0.08, 0.3, 0.05],
        )
        g = b < 1 ? 0.07 : 0.14
      } else if (M.lead === 'musicbox') {
        sig = musicbox(f)
        g = 0.22
      } else {
        sig = rhodes(f, beat * 0.8)
        g = 0.2
      }
      const pan = Math.sin(k * 1.7) * 0.35
      addTo(lead, sig, at(t), g, pan, true)
      addTo(send, sig, at(t), g * 0.6, pan, true)
    })
  }

  // Sidechain pump on chords/bass from the kick times (analytic, so it loops).
  if (M.pump && kicks.length) {
    for (let i = 0; i < N; i++) {
      const t = i / SR
      let since = Infinity
      for (const k of kicks) {
        const d = (t - k + dur) % dur
        if (d < since) since = d
      }
      const g = 1 - M.pump * Math.exp(-since / 0.11)
      music[0][i] *= g
      music[1][i] *= g
    }
  }

  const out = stereo(N)
  busAdd(out, drums, 1)
  busAdd(out, music, 1)
  busAdd(out, lead, 1)
  busAdd(out, reverb(send, { room: M.lofi ? 0.78 : 0.84, damp: 0.4 }), 1)
  if (M.lofi) {
    // Vinyl: soft hiss and sparse crackles, plus a gentle top-end roll-off.
    const cr = rng(seed ^ 0x5eed)
    for (let i = 0; i < N; i++) {
      const c = cr() < 0.0004 ? (cr() - 0.5) * 0.25 : 0
      const h = (cr() - 0.5) * 0.004
      out[0][i] += c + h
      out[1][i] += c * 0.8 + h
    }
    onePoleLP(out[0], 7000)
    onePoleLP(out[1], 7000)
  }
  if (process.env.SYNTH_DEBUG)
    for (const [k, b] of Object.entries({ drums, music, lead, send, out })) {
      let p = 0,
        s = 0
      for (const v of b[0]) {
        p = Math.max(p, Math.abs(v))
        s += v * v
      }
      console.error(mood, k, 'peak', p.toFixed(2), 'rms', Math.sqrt(s / N).toFixed(3))
    }
  master(out, -1)
  writeWav(outPath, out)
  return { path: outPath, mood, bpm: +bpm.toFixed(2), bars, seconds: +dur.toFixed(3) }
}
