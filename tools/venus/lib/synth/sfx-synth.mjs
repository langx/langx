// Synthesised cartoon foley, the stand-in for the Sound Effects API. Each kind
// is short, stereo and peak-normalised; the mixer sets its level in context.
import {
  SR,
  rng,
  hashSeed,
  stereo,
  addTo,
  osc,
  noise,
  adsr,
  expDecay,
  mul,
  mix,
  svf,
  reverb,
  busAdd,
  master,
  writeWav,
} from './dsp.mjs'

const S = (sec) => Math.max(1, Math.round(sec * SR))

export const SFX_KINDS = [
  'pop',
  'boing',
  'whoosh',
  'ding',
  'confetti',
  'tick',
  'riser',
  'thud',
  'sparkle',
  'blip',
]

export function kindFromPrompt(prompt = '') {
  const p = prompt.toLowerCase()
  const table = [
    ['confetti', /confetti|party|celebrat|cannon/],
    ['whoosh', /whoosh|swoosh|swish|swipe|fly/],
    ['boing', /boing|spring|bounce|jump/],
    ['ding', /ding|bell|chime|success/],
    ['riser', /riser|rise|build|uplift/],
    ['thud', /thud|land|plop|squash|drop/],
    ['sparkle', /sparkle|twinkle|glitter|shimmer|magic/],
    ['tick', /tick|count|clock/],
    ['blip', /blip|ui|type|bubble/],
    ['pop', /pop|cork|bloop/],
  ]
  for (const [k, re] of table) if (re.test(p)) return k
  return 'pop'
}

function pop(r, dur) {
  // Mouth-pop: a fast downward sine sweep, a hint of noise for the lip.
  const n = S(Math.min(dur, 0.25))
  const f0 = 700 + r() * 300
  const body = mul(
    osc('sine', (t) => 180 + f0 * Math.exp(-t / 0.018), n),
    expDecay(n, 0.045, 0.001),
  )
  const lip = mul(svf(noise(S(0.01), r), 'bp', 3000, 1), 0.25)
  return mix(body, lip)
}
function boing(r, dur) {
  // Spring: pitch wobbles around a falling centre, wobble rate speeds up.
  const n = S(dur)
  const base = 220 + r() * 60
  const s = osc(
    'tri',
    (t) =>
      base *
      (1 + 0.6 * Math.exp(-t * 3)) *
      (1 + 0.18 * Math.sin(2 * Math.PI * (9 + 12 * t) * t) * Math.exp(-t * 2)),
    n,
  )
  const s2 = osc('sine', (t) => 2 * base * (1 + 0.6 * Math.exp(-t * 3)), n)
  return mul(svf(mix(s, mul(s2, 0.3)), 'lp', 2500), expDecay(n, dur * 0.35, 0.003))
}
function whoosh(r, dur) {
  const n = S(dur)
  const s = svf(noise(n, r), 'bp', (t) => 300 + 3500 * Math.sin((Math.PI * t) / dur) ** 2, 1.8)
  for (let i = 0; i < n; i++) s[i] *= Math.sin((Math.PI * i) / n) ** 1.5
  return s
}
function ding(r, dur) {
  // Two-partial bell, a major-third above for the "you did it" sparkle.
  const n = S(Math.max(dur, 1.2))
  const f = 1318.5 // E6
  const parts = [
    [1, 1, 0.9],
    [2.76, 0.35, 0.4],
    [5.4, 0.15, 0.2],
    [1.26, 0.5, 0.7],
  ]
  return mix(
    ...parts.map(([ratio, g, tau]) =>
      mul(osc('sine', f * ratio, n), mul(expDecay(n, (tau * n) / SR / 4, 0.001), g)),
    ),
  )
}
function sparkle(r, dur) {
  const n = S(dur)
  const out = new Float32Array(n)
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19]
  const count = Math.round(dur * 14)
  for (let k = 0; k < count; k++) {
    const f = 1568 * Math.pow(2, scale[Math.floor(r() * scale.length)] / 12)
    const len = S(0.25)
    const tone = mul(osc('sine', f, len), expDecay(len, 0.06, 0.001))
    // Jittered, front-loaded onsets: evenly spaced pings read as a machine.
    const at = Math.floor(Math.pow((k + r() * 0.9) / count, 1.4) * (n - len))
    for (let i = 0; i < len && at + i < n; i++) out[at + i] += tone[i] * (0.5 + 0.5 * r()) * 0.4
  }
  return out
}
function confetti(r, dur) {
  // Cannon pop + paper rustle tail + sparkle on top.
  const n = S(dur)
  const out = new Float32Array(n)
  const boom = mul(
    svf(noise(S(0.25), r), 'lp', (t) => 200 + 3000 * Math.exp(-t / 0.02)),
    expDecay(S(0.25), 0.05, 0.001),
  )
  for (let i = 0; i < boom.length; i++) out[i] += boom[i] * 4
  const rustle = svf(noise(n, r), 'bp', 5000, 0.9)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const crackle = r() < 0.02 ? 1 : 0.25
    out[i] += rustle[i] * crackle * Math.exp(-t / (dur * 0.4)) * Math.min(1, t / 0.03) * 0.8
  }
  const sp = sparkle(r, dur)
  for (let i = 0; i < n; i++) out[i] += sp[i] * 0.8
  return out
}
function tick(r, dur) {
  const n = S(Math.min(dur, 0.08))
  return mul(
    mix(osc('sine', 2200, n), mul(svf(noise(n, r), 'hp', 4000), 0.4)),
    expDecay(n, 0.008, 0.0005),
  )
}
function blip(r, dur) {
  // Chat-bubble blip: a soft square that slides up a fourth.
  const n = S(Math.min(dur, 0.15))
  const f = 880 * (1 + Math.floor(r() * 3) * 0.25)
  const s = svf(
    osc('square', (t) => f * (1 + 0.33 * Math.min(1, t / 0.03)), n),
    'lp',
    2400,
  )
  return mul(s, adsr(n, 0.002, 0.05, 0.4, 0.03, n / SR - 0.04))
}
function riser(r, dur) {
  const n = S(dur)
  const nz = svf(noise(n, r), 'bp', (t) => 300 + 8000 * (t / dur) ** 2, 1.5)
  const tone = osc('saw', (t) => 110 * Math.pow(2, (3 * t) / dur), n)
  const s = mix(nz, mul(svf(tone, 'lp', 2500), 0.3))
  for (let i = 0; i < n; i++) s[i] *= (i / n) ** 2
  return s
}
function thud(r, dur) {
  const n = S(Math.min(dur, 0.4))
  const body = mul(
    osc('sine', (t) => 60 + 90 * Math.exp(-t / 0.03), n),
    expDecay(n, 0.08, 0.001),
  )
  const squish = mul(svf(noise(n, r), 'lp', 900), expDecay(n, 0.03, 0.002))
  return mix(body, mul(squish, 0.5))
}

const GEN = { pop, boing, whoosh, ding, confetti, tick, riser, thud, sparkle, blip }
const DEFAULT_DUR = {
  pop: 0.25,
  boing: 0.9,
  whoosh: 0.6,
  ding: 1.5,
  confetti: 1.8,
  tick: 0.08,
  riser: 1.5,
  thud: 0.4,
  sparkle: 1.2,
  blip: 0.15,
}

export function renderSfx({ kind, seconds, seed = 1, outPath }) {
  const r = rng(seed)
  const dur = seconds ?? DEFAULT_DUR[kind]
  const sig = GEN[kind](r, dur)
  // 25 ms fade at the end: a decay cut short at -20 dB is an audible click.
  const fade = Math.min(sig.length, S(0.025))
  for (let i = 0; i < fade; i++) sig[sig.length - 1 - i] *= i / fade
  const bus = stereo(sig.length + S(0.3))
  // Whooshes and sparkles travel across the stereo field; the rest sit centre.
  if (kind === 'whoosh' || kind === 'sparkle') {
    for (let i = 0; i < sig.length; i++) {
      const p = (i / sig.length) * 2 - 1
      bus[0][i] += sig[i] * Math.cos(((p * 0.7 + 1) * Math.PI) / 4)
      bus[1][i] += sig[i] * Math.sin(((p * 0.7 + 1) * Math.PI) / 4)
    }
  } else addTo(bus, sig, 0, 1, 0)
  if (kind === 'ding' || kind === 'sparkle' || kind === 'confetti')
    busAdd(bus, reverb(bus, { room: 0.8, loop: false }), 0.6)
  master(bus, -1, 1.1)
  writeWav(outPath, bus)
  return { path: outPath, kind, seconds: +(bus[0].length / SR).toFixed(3) }
}

export { hashSeed }
