// Venus's acting for one video, built from the day's plan (grammar.mjs) and the measured voice.
//
//   buildScore(plan, T, { pad }) -> { endAt, base, expr, keys, add, blinks, cam, num, fx, sfx, ... }
//
// T is the timing measured from whatever voice file is in use, so a new recording re-times the film:
//   T.v       when the line starts           T.e     when the last voiced sound ends
//   T.words   [{ t0, t1 }] per caption word  T.sents [{ t0, t1 }] per sentence
//   T.purr    [t0, t1] of a leading "Mrrr", or null
//
// Beats (the acting plan §6, re-cut for Venus):
//   hook 0-0.5 s     she is already moving on frame 0 (and on count days the counter is racing)
//   entrance         ENTRANCES[plan.entrance], ends sitting, centred, facing the lens
//   reveal  R        the number lands (pop | slam | count), label 0.2 s later
//   reaction         REACTIONS[plan.reaction], her face at the number
//   line   v..e      MOVE_IMPL[plan.move], the signature move under the quip, lip sync on top
//   payoff           PAYOFFS[plan.payoff]; every one ends on the slow blink (her sign-off)
//   end card         at endAt, END_LEN (lib/endcard.mjs: the card, its length and its sounds)
//
// Keys are absolute values written in time order per parameter (Tr.to / Tr.seq). Additive layers
// (head roll, pitch, eye darts, ear swivels) may overlap, so they are summed and resampled at the end.
import { createRequire } from 'node:module'
import path from 'node:path'
import { RIG } from './paths.mjs'
import { CHARACTER } from './character.mjs'
import { END_LEN, endSfx, styleOf } from './endcard.mjs'
const req = createRequire(import.meta.url)
const VA = req(path.join(RIG, 'venus-anim.js'))
const EASE = VA.EASE

// ------------------------------------------------------------------ faces
// Partial poses added to the rig's Venus.EXPR at load. Built from the personality study's table.
export const EXTRA_EXPR = {
  purr: {
    head: { pitch: 6, roll: 8 },
    eyes: { L: { lid: 0.7, low: 0.32, pupil: 0.3 }, R: { lid: 0.7, low: 0.32, pupil: 0.3 } },
    mouth: { smile: 0.4 },
    ears: { L: { rot: 14 }, R: { rot: 14 } },
    whisk: { ang: 4 },
  },
  diva: {
    head: { pitch: -13, roll: -9 },
    eyes: {
      L: { lid: 0.44, low: 0.16, tilt: 0.08, pupil: 0.14, px: 0.45 },
      R: { lid: 0.44, low: 0.16, tilt: 0.08, pupil: 0.14, px: 0.45 },
    },
    mouth: { smile: 0.4, smirk: 0.9 },
    ears: { L: { rot: -6 }, R: { rot: -6 } },
    whisk: { ang: 8 },
  },
  bored: {
    eyes: {
      L: { lid: 0.55, low: 0.1, pupil: 0.22, py: -0.15 },
      R: { lid: 0.55, low: 0.1, pupil: 0.22, py: -0.15 },
    },
    mouth: { smile: 0 },
    ears: { L: { rot: 18 }, R: { rot: 4, swivel: 0.4 } },
    whisk: { droop: 0.4 },
  },
  impressed: {
    head: { pitch: -4 },
    eyes: {
      L: { lid: 0.12, low: 0.05, pupil: 0.55, round: 0.7 },
      R: { lid: 0.12, low: 0.05, pupil: 0.55, round: 0.7 },
    },
    mouth: { smile: 0.1, wide: 0.55 },
    ears: { L: { rot: -10 }, R: { rot: -10 } },
    whisk: { ang: 12 },
  },
  whisper: {
    head: { pitch: 8, roll: 4 },
    eyes: {
      L: { lid: 0.2, low: 0.1, pupil: 0.78, round: 1 },
      R: { lid: 0.2, low: 0.1, pupil: 0.78, round: 1 },
    },
    mouth: { smile: 0.05, wide: 0.6 },
    ears: { L: { rot: -14 }, R: { rot: -14 } },
    whisk: { ang: 14 },
  },
  sceptical: {
    head: { roll: 8 },
    eyes: { L: { lid: 0.5, low: 0.1, pupil: 0.2 }, R: { lid: 0.2, low: 0.05, pupil: 0.3 } },
    mouth: { smile: 0.05, smirk: 0.6 },
    ears: { L: { rot: 16 }, R: { rot: -4, swivel: 0.3 } },
    whisk: { ang: -4 },
  },
  embarrassed: {
    head: { roll: -8, pitch: 6 },
    eyes: {
      L: { lid: 0.32, pupil: 0.4, px: -0.7, py: 0.2 },
      R: { lid: 0.32, pupil: 0.4, px: -0.7, py: 0.2 },
    },
    mouth: { smile: 0.25 },
    ears: { L: { rot: 22 }, R: { rot: 6 } },
    whisk: { ang: -6 },
  },
  flustered: {
    head: { roll: 6 },
    eyes: {
      L: { lid: 0, low: 0.05, pupil: 0.5, round: 0.5 },
      R: { lid: 0, low: 0.05, pupil: 0.5, round: 0.5 },
    },
    mouth: { smile: 0.3 },
    ears: { L: { rot: 12, swivel: 0.4 }, R: { rot: 12, swivel: 0.4 } },
    whisk: { ang: -8 },
  },
  plotting: {
    head: { pitch: 4, roll: -5 },
    eyes: {
      L: { lid: 0.5, low: 0.15, pupil: 0.14, px: 0.7 },
      R: { lid: 0.5, low: 0.15, pupil: 0.14, px: 0.7 },
    },
    mouth: { smile: 0.3, smirk: 0.5 },
    ears: { L: { rot: 20 }, R: { rot: 20 } },
    whisk: { ang: 6 },
  },
  // mock-offended: airplane ears always with a closed mouth (the personality study)
  mock: {
    head: { pitch: -6 },
    eyes: { L: { lid: 0.32, pupil: 0.16 }, R: { lid: 0.32, pupil: 0.16 } },
    mouth: { smile: -0.1 },
    ears: { L: { rot: 26 }, R: { rot: 26 } },
    whisk: { ang: -10 },
  },
  asleep: {
    head: { pitch: 10, roll: 6 },
    eyes: { L: { lid: 1, low: 0.15 }, R: { lid: 1, low: 0.15 } },
    mouth: { smile: 0.2 },
    ears: { L: { rot: 22, fold: 0.15 }, R: { rot: 18, fold: 0.15 } },
    whisk: { droop: 0.8 },
  },
  yawn: {
    head: { pitch: -10 },
    eyes: { L: { lid: 0.9, low: 0.2 }, R: { lid: 0.9, low: 0.2 } },
    mouth: { open: 0.75, wide: 0.7, smile: 0 },
    ears: { L: { rot: 24 }, R: { rot: 24 } },
    whisk: { ang: 10 },
  },
  regal: {
    head: { pitch: -5 },
    eyes: { L: { lid: 0.28, low: 0.08 }, R: { lid: 0.28, low: 0.08 } },
    mouth: { smile: 0.2 },
  },
  delighted: {
    eyes: { L: { happy: 1 }, R: { happy: 1 } },
    mouth: { smile: 0.9, open: 0.15 },
    ears: { L: { rot: -8 }, R: { rot: -8 } },
    whisk: { ang: 12 },
  },
  // ---- v2 faces (the character bible, §15). The ones in acting.bannedFacesAtViewer (flehmen, sulk,
  // sob) are only played by moves and reactions, at a thing, never as a line's face.
  // wide-eyed shock: the opposite of `shocked` (tiny pupils); here the pupils flood the eye
  saucer: {
    head: { pitch: -3 },
    eyes: {
      L: { lid: 0, low: 0, pupil: 0.93, round: 1, s: 1.2 },
      R: { lid: 0, low: 0, pupil: 0.93, round: 1, s: 1.2 },
    },
    mouth: { smile: 0, open: 0.1, wide: 0.45 },
    ears: { L: { rot: -16 }, R: { rot: -16 } },
    whisk: { ang: 16 },
  },
  // deeply pleased with herself: heavy lids, chin up, a small closed smile
  'smug-lids': {
    head: { pitch: -12, roll: -6 },
    eyes: {
      L: { lid: 0.64, low: 0.24, tilt: 0.06, pupil: 0.22, px: 0.25 },
      R: { lid: 0.64, low: 0.24, tilt: 0.06, pupil: 0.22, px: 0.25 },
    },
    mouth: { smile: 0.55, smirk: 0.75 },
    ears: { L: { rot: -2 }, R: { rot: 2 } },
    whisk: { ang: 4 },
  },
  // the flehmen sniff: mouth hangs open, lip curled, eyes screwed half shut (a smell, never a person)
  flehmen: {
    head: { pitch: -14, roll: 5 },
    eyes: {
      L: { lid: 0.62, low: 0.3, tilt: 0.22, pupil: 0.3 },
      R: { lid: 0.62, low: 0.3, tilt: 0.22, pupil: 0.3 },
    },
    mouth: { open: 0.5, wide: 0.62, smile: -0.85, smirk: 0.8 },
    ears: { L: { rot: 6 }, R: { rot: 12 } },
    whisk: { ang: 18 },
  },
  // caught: the whole head turns away, eyes go further still
  // (to screen-left, the same way as the look-away payoff)
  averted: {
    head: { yaw: -30, roll: -7, pitch: 6 },
    eyes: {
      L: { lid: 0.4, low: 0.16, pupil: 0.45, px: -0.95, py: 0.2 },
      R: { lid: 0.4, low: 0.16, pupil: 0.45, px: -0.95, py: 0.2 },
    },
    mouth: { smile: 0.2, wide: 0.8 },
    ears: { L: { rot: 8 }, R: { rot: 16 } },
    whisk: { ang: 4 },
  },
  // head turned away, eyes slid back to the lens: "did you see that?"
  guilty: {
    head: { yaw: -22, pitch: 8, roll: -5 },
    eyes: {
      L: { lid: 0.3, low: 0.12, pupil: 0.62, round: 0.6, px: 0.95, py: 0.2 },
      R: { lid: 0.3, low: 0.12, pupil: 0.62, round: 0.6, px: 0.95, py: 0.2 },
    },
    mouth: { smile: -0.05, wide: 0.7 },
    ears: { L: { rot: 20, fold: 0.2 }, R: { rot: 20, fold: 0.2 } },
    whisk: { droop: 0.4 },
  },
  // falling asleep mid-sentence: lopsided lids, the head going
  drowsy: {
    head: { pitch: 15, roll: 11 },
    eyes: { L: { lid: 0.86, low: 0.1 }, R: { lid: 0.76, low: 0.1 } },
    mouth: { smile: 0, open: 0.06 },
    ears: { L: { rot: 26, fold: 0.2 }, R: { rot: 22, fold: 0.2 } },
    whisk: { droop: 0.9 },
  },
  // chattering at a bird: eyes locked up and to the side, jaw a little open (the chatter itself is a
  // fast mouth.open wave laid on by the move); no teeth exist in the rig
  chatter: {
    head: { pitch: -10 },
    eyes: {
      L: { lid: 0, low: 0, pupil: 0.86, round: 1, px: 0.55, py: -0.65 },
      R: { lid: 0, low: 0, pupil: 0.86, round: 1, px: 0.55, py: -0.65 },
    },
    mouth: { open: 0.22, wide: 0.55, smile: 0 },
    ears: { L: { rot: -16 }, R: { rot: -16 } },
    whisk: { ang: 20 },
  },
  // the hungry stare: pupils huge, locked on something below the lens
  fixated: {
    head: { pitch: 7 },
    eyes: {
      L: { lid: 0.04, low: 0.04, pupil: 0.9, round: 1, py: 0.6 },
      R: { lid: 0.04, low: 0.04, pupil: 0.9, round: 1, py: 0.6 },
    },
    mouth: { smile: 0 },
    ears: { L: { rot: -14 }, R: { rot: -14 } },
    whisk: { ang: 20 },
  },
  // offended (mock): ears back but not airplane, whiskers forward, chin up, mouth shut
  offended: {
    head: { pitch: -11, roll: -4 },
    eyes: {
      L: { lid: 0.5, low: 0.2, tilt: 0.16, pupil: 0.2 },
      R: { lid: 0.5, low: 0.2, tilt: 0.16, pupil: 0.2 },
    },
    mouth: { smile: -0.25, wide: 0.75 },
    ears: { L: { rot: 32, fold: 0.4 }, R: { rot: 32, fold: 0.4 } },
    whisk: { ang: 20 },
  },
  // delight squeezed shut: > <
  squeeze: {
    head: { pitch: -6, roll: 7 },
    eyes: { L: { squeeze: 1 }, R: { squeeze: 1 } },
    mouth: { smile: 1, open: 0.2 },
    ears: { L: { rot: -12 }, R: { rot: -12 } },
    whisk: { ang: 12 },
  },
  // sulking at a thing: chin down, eyes up from under the lids, a pout
  sulk: {
    head: { pitch: 14, roll: -6 },
    eyes: {
      L: { lid: 0.44, low: 0.05, tilt: -0.15, pupil: 0.5, round: 0.4, py: -0.6 },
      R: { lid: 0.44, low: 0.05, tilt: -0.15, pupil: 0.5, round: 0.4, py: -0.6 },
    },
    mouth: { smile: -0.45, wide: 0.6 },
    ears: { L: { rot: 28, fold: 0.3 }, R: { rot: 28, fold: 0.3 } },
    whisk: { droop: 0.6 },
  },
  // the dramatic tear-free sob: > < and a wail, head thrown back (an act; it never lasts)
  sob: {
    head: { pitch: -15 },
    eyes: { L: { squeeze: 1 }, R: { squeeze: 1 } },
    mouth: { open: 0.85, wide: 0.48, smile: -0.7 },
    ears: { L: { rot: 4, fold: 0.12 }, R: { rot: 4, fold: 0.12 } },
    whisk: { droop: 1 },
  }, // ears up, never airplane: her mouth is open
  // "I meant to do that": eyes closed, chin up, the dignity save
  'meant-it': {
    head: { pitch: -12, roll: 5 },
    eyes: { L: { lid: 0.86, low: 0.25 }, R: { lid: 0.86, low: 0.25 } },
    mouth: { smile: 0.25, smirk: 0.4 },
    ears: { L: { rot: 2 }, R: { rot: 2 } },
    whisk: { ang: 4 },
  },
  // sniffing something right under her nose: cross-eyed
  'cross-eyed': {
    head: { pitch: 10 },
    eyes: {
      L: { lid: 0.08, low: 0.05, pupil: 0.36, round: 1, px: 1, py: 0.7 },
      R: { lid: 0.08, low: 0.05, pupil: 0.36, round: 1, px: -1, py: 0.7 },
    },
    mouth: { smile: 0 },
    ears: { L: { rot: -8 }, R: { rot: -8 } },
    whisk: { ang: 20 },
  },
}
// quips.json expression names -> rig faces (data/character.json, acting.faceByExpression)
const FACE = CHARACTER.acting.faceByExpression
// the face the last sentence lands on: dry first, warm last. A tease closes on the face its target
// calls for (character.json teases.closingFace: a self-own ends embarrassed, a poke at the viewer
// ends loving), never smug: the hug rule in the character bible, section 7.3.
const WARM = CHARACTER.acting.warmFaceByPool
const TEASE_CLOSE = CHARACTER.teases.closingFace
// faces that are never aimed at the viewer fall back to neutral
const NOT_AT_VIEWER = new Set(CHARACTER.acting.bannedFacesAtViewer)

export const SPRINGS = {
  'head.roll': { k: 170, z: 0.42 },
  'head.pitch': { k: 170, z: 0.5 },
  'head.yaw': { k: 260, z: 0.42 },
  'ears.L.rot': { k: 120, z: 0.48 },
  'ears.R.rot': { k: 120, z: 0.48 },
  'ears.R.swivel': { k: 180, z: 0.5 },
  'ears.L.swivel': { k: 180, z: 0.5 },
  'tail.pitch': { k: 55, z: 0.45 },
  'tail.hook': { k: 45, z: 0.42 },
  'tail.side': { k: 60, z: 0.55 },
  'tail.yaw': { k: 60, z: 0.55 },
  'tail.curl': { k: 50, z: 0.5 },
  'whisk.ang': { k: 140, z: 0.3 },
  'mouth.tongue': { k: 520, z: 0.3 },
  bag: { k: 260, z: 0.35 },
}
export const COUPLE = [
  { from: 'head.roll', to: 'ears.L.rot', gain: 0.35 },
  { from: 'head.roll', to: 'ears.R.rot', gain: -0.35 },
  { from: 'rise', to: 'ears.L.rot', gain: 0.12 },
  { from: 'rise', to: 'ears.R.rot', gain: 0.12 },
  { from: 'head.yaw', to: 'whisk.ang', gain: -0.3 },
  { from: 'y', to: 'ears.L.rot', gain: 0.05 },
  { from: 'y', to: 'ears.R.rot', gain: 0.05 },
]

// tail shapes: [pitch, yaw, side, curl, hook, len]
export const TAIL = {
  question: [70, 95, -20, 100, 120, 1.15],
  walkQ: [80, 0, 0, 10, 150, 1.0],
  wrap: [0, 80, 230, 0, 0, 1.2],
  straight: [88, 90, -10, 0, 10, 1.15],
  loaf: [0, 90, 120, 0, 0, 0.9],
  sprawl: [0, -95, -30, 0, 0, 1.2],
  stretch: [80, 0, 0, 10, 40, 1.0],
  hang: [-20, 95, 0, 10, 140, 1.15],
  // v2: low and straight behind the hunt crouch; flat on the floor from the belly-up; up and over to
  // screen-left (the honest tail that she notices); streaming behind a leap
  hunt: [6, 0, 0, 0, 40, 1.1],
  belly: [0, 90, 40, 0, 30, 1.0],
  notice: [62, -95, 30, 70, 130, 1.15],
  streak: [12, 0, 0, 0, 20, 1.1],
}
export const TP = ['pitch', 'yaw', 'side', 'curl', 'hook', 'len']

// ------------------------------------------------------------------ track builders
const DEF = {
  mode: 'sit',
  x: 0,
  y: 0,
  yaw: 0,
  flip: 1,
  crouch: 0,
  rise: 0,
  sx: 1,
  sy: 1,
  lean: 0,
  'walk.phase': 0,
  'walk.amt': 0,
  'paw.lift': 0,
  'paw.reach': 0,
  'paw.left': 0,
  'paw.side': 0,
  'paw.groom': 0,
  'paw.knead': 0,
  'paw.kamt': 0,
  wiggle: 0,
  'head.yaw': 0,
  'ears.L.fold': 0,
  'ears.R.fold': 0,
  'mouth.tongue': 0,
  bag: 0,
  persp: 0,
  pcy: -120,
  elev: 10,
  outfit: null,
  'tail.wave': 3,
  'tail.phase': 0,
}
TP.forEach((p, i) => {
  DEF['tail.' + p] = TAIL.wrap[i]
})
function trk(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++)
    if (t < keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i]
      if (typeof a[1] !== 'number') return a[1]
      return (
        a[1] + (b[1] - a[1]) * (EASE[b[2]] || EASE.inOut)((t - a[0]) / Math.max(1e-6, b[0] - a[0]))
      )
    }
  return keys[keys.length - 1][1]
}
// absolute keys, written in time order per parameter
export class Keys {
  constructor() {
    this.k = {}
  }
  val(p, t) {
    const ks = this.k[p]
    return ks ? trk(ks, t) : DEF[p]
  }
  key(p, t, v, e) {
    const ks = (this.k[p] = this.k[p] || [[0, DEF[p]]])
    const last = ks[ks.length - 1][0]
    if (t < last) t = last + 1e-4 // a later beat never rewrites an earlier one
    if (t === 0 && ks.length === 1) ks[0] = [0, v]
    else ks.push(e ? [t, v, e] : [t, v])
  }
  // hold the current value at t0, then ease to v by t1
  to(p, t0, t1, v, e = 'inOut') {
    const a = this.val(p, t0)
    this.key(p, t0, a)
    this.key(p, t1, v, e)
  }
  // [[t] | [t, v, ease], ...]: a bare time holds the current value
  seq(p, list) {
    for (const [t, v, e] of list) this.key(p, t, v === undefined ? this.val(p, t) : v, e)
  }
  // a cut: hold until just before t, then jump (numbers would otherwise ease from the last key)
  set(p, t, v) {
    if (typeof v === 'number' && t > 0.002) this.key(p, t - 0.001, this.val(p, t - 0.001))
    this.key(p, t, v, 'linear')
  }
  tail(t0, t1, shape, e = 'inOut') {
    TP.forEach((q, i) => this.to('tail.' + q, t0, t1, TAIL[shape][i], e))
  }
  tailAt0(shape) {
    TP.forEach((q, i) => this.key('tail.' + q, 0, TAIL[shape][i]))
  }
}
// additive layers: any number may overlap; summed and resampled at 60 Hz at the end
export class Adds {
  constructor() {
    this.L = {}
  }
  layer(p, keys) {
    ;(this.L[p] = this.L[p] || []).push(keys)
  }
  // 0 -> v -> 0: [t0 start, t1 peak reached, t2 release starts, t3 back to 0]
  pulse(p, t0, t1, t2, t3, v, e1 = 'out', e2 = 'inOut') {
    this.layer(p, [
      [t0, 0],
      [t1, v, e1],
      [t2, v],
      [t3, 0, e2],
    ])
  }
  wave(p, t0, t1, amp, period, phase = 0) {
    const k = []
    for (let t = t0; t <= t1 + 1e-6; t += period / 8)
      k.push([
        +t.toFixed(3),
        amp *
          Math.sin(phase + ((t - t0) / period) * Math.PI * 2) *
          Math.min(1, (t - t0) / 0.3, (t1 - t) / 0.3),
        'inOut',
      ])
    this.layer(p, k)
  }
  bake(end) {
    const out = {}
    for (const [p, layers] of Object.entries(this.L)) {
      const ks = []
      for (let t = 0; t <= end + 1e-6; t += 1 / 60) {
        let v = 0
        for (const l of layers) if (t >= l[0][0] && t <= l[l.length - 1][0]) v += trk(l, t)
        ks.push([+t.toFixed(4), +v.toFixed(4), 'linear'])
      }
      out[p] = ks
    }
    return out
  }
}

// a hop that turns into a sitting pose at x 0: anticipation, lift, mode switch at the top, landing squash
export function hopToSit(c, t0, { rise = 86, fromYaw = 90 } = {}) {
  const k = c.k
  k.seq('crouch', [
    [t0 - 0.02],
    [t0 + 0.12, 0.9, 'in'],
    [t0 + 0.18, 0, 'out'],
    [t0 + 0.46],
    [t0 + 0.5, 0.7, 'out'],
    [t0 + 0.78, 0, 'inOut'],
  ])
  k.seq('rise', [[t0 + 0.14], [t0 + 0.31, rise, 'out'], [t0 + 0.48, 0, 'in']])
  k.set('mode', t0 + 0.32, 'sit')
  k.seq('yaw', [[t0 + 0.02], [t0 + 0.26, fromYaw > 0 ? 22 : -22, 'inOut'], [t0 + 0.46, 0, 'out']])
  k.seq('x', [[t0 + 0.12], [t0 + 0.46, 0, 'inOut']])
  k.seq('sy', [
    [t0 - 0.02],
    [t0 + 0.12, 0.9, 'in'],
    [t0 + 0.2, 1.12, 'out'],
    [t0 + 0.31, 1.0, 'inOut'],
    [t0 + 0.46, 1.06],
    [t0 + 0.52, 0.86, 'out'],
    [t0 + 0.64, 1.04, 'inOut'],
    [t0 + 0.78, 1, 'inOut'],
  ])
  k.seq('sx', [
    [t0 - 0.02],
    [t0 + 0.12, 1.06, 'in'],
    [t0 + 0.2, 0.93, 'out'],
    [t0 + 0.31, 1.0, 'inOut'],
    [t0 + 0.52, 1.1, 'out'],
    [t0 + 0.64, 0.98, 'inOut'],
    [t0 + 0.78, 1, 'inOut'],
  ])
  c.sfx.push(
    { kind: 'whoosh', at: t0 + 0.14, gainDb: -7 },
    { kind: 'thud', at: t0 + 0.5, gainDb: -5 },
  )
  return t0 + 0.78
}
// a quick squash on the spot (landing, settling, a flop)
export function squash(c, t, amt = 0.14, len = 0.36) {
  c.k.seq('sy', [
    [t],
    [t + len * 0.2, 1 - amt, 'out'],
    [t + len * 0.5, 1 + amt * 0.35, 'inOut'],
    [t + len, 1, 'inOut'],
  ])
  c.k.seq('sx', [
    [t],
    [t + len * 0.2, 1 + amt * 0.8, 'out'],
    [t + len * 0.5, 1 - amt * 0.25, 'inOut'],
    [t + len, 1, 'inOut'],
  ])
}
export const walkKeys = (c, t0, t1, x0, x1, steps, amt = 1.2) => {
  c.k.seq('x', [
    [t0, x0],
    [t1, x1, 'linear'],
    [t1 + 0.12, x1 + Math.sign(x1 - x0) * 10, 'out'],
  ])
  c.k.seq('walk.phase', [
    [t0, c.k.val('walk.phase', t0)],
    [t1, c.k.val('walk.phase', t0) + steps, 'linear'],
    [t1 + 0.1, c.k.val('walk.phase', t0) + steps + 0.15, 'out'],
  ])
  c.k.seq('walk.amt', [
    [t0, amt],
    [t1 - 0.15, amt],
    [t1 + 0.1, 0, 'out'],
  ])
}

// ------------------------------------------------------------------ entrances
// each returns the time she is settled (sitting, centred, facing the lens)
export const ENTRANCES = {
  // walks in from screen-left in profile, glancing at the lens, hop-turns and sits (day 100's)
  'walk-in': (c) => {
    c.base = { mode: 'stand', yaw: 90 }
    c.k.set('mode', 0, 'stand')
    c.k.set('yaw', 0, 90)
    walkKeys(c, 0, 1.1, -440, -80, 3.3)
    c.k.seq('head.yaw', [
      [0, -55],
      [0.85, -55],
      [1.15, 0, 'inOut'],
    ])
    c.k.tailAt0('walkQ')
    c.k.tail(1.3, 1.75, 'wrap')
    c.ex.push({ t: 0, name: 'curious', ms: 1 }, { t: 1.15, name: 'neutral', ms: 200 })
    c.add.pulse('head.pitch', 0.4, 0.55, 0.65, 0.8, -6) // a little nod at the lens, mid-stride
    c.sfx.push({ kind: 'whoosh', at: 0.02, gainDb: -10 })
    return hopToSit(c, 1.08)
  },
  // the catwalk from screen-right, paparazzi flashes on the hook (day 7's)
  strut: (c) => {
    c.base = { mode: 'stand', yaw: 90, flip: -1 }
    c.k.set('mode', 0, 'stand')
    c.k.set('yaw', 0, 90)
    c.k.set('flip', 0, -1)
    walkKeys(c, 0, 1.2, 440, 90, 3.0)
    c.k.seq('head.yaw', [
      [0, -50],
      [1.1, -50],
      [1.42, 0, 'inOut'],
    ])
    c.k.tailAt0('walkQ')
    c.k.tail(1.5, 1.9, 'wrap')
    c.k.seq('flip', [
      [1.5, -1],
      [1.51, 1, 'linear'],
    ])
    c.ex.push({ t: 0, name: 'diva', ms: 1 }, { t: 1.2, name: 'curious', ms: 160 })
    c.fx.flashes.push(0.03, 0.2, 0.38)
    ;[0.03, 0.2, 0.38].forEach((t) => c.sfx.push({ kind: 'shutter', at: t, gainDb: -3 }))
    return hopToSit(c, 1.18)
  },
  // ears first over a ledge, then eyes, a suspicious look both ways, a hop up (day 22's)
  peek: (c) => {
    c.fx.ledge = true
    c.k.seq('y', [
      [0, 560],
      [0.05, 560],
      [0.25, 440, 'outBack'],
      [0.62, 440],
      [0.95, 395, 'inOut'],
      [1.3, 395],
      [1.44, 450, 'in'],
      [1.74, 0, 'out'],
    ])
    c.k.seq('rise', [
      [1.46, 0],
      [1.66, 70, 'out'],
      [1.8, 0, 'in'],
    ])
    c.k.seq('crouch', [
      [1.3, 0],
      [1.44, 0.6, 'in'],
      [1.5, 0, 'out'],
      [1.8, 0],
      [1.84, 0.6, 'out'],
      [2.1, 0, 'inOut'],
    ])
    c.k.seq('sy', [
      [1.3, 1],
      [1.44, 0.92, 'in'],
      [1.52, 1.1, 'out'],
      [1.7, 1, 'inOut'],
      [1.84, 0.88, 'out'],
      [1.96, 1.04, 'inOut'],
      [2.1, 1, 'inOut'],
    ])
    c.k.seq('sx', [
      [1.3, 1],
      [1.44, 1.05, 'in'],
      [1.52, 0.94, 'out'],
      [1.7, 1, 'inOut'],
      [1.84, 1.08, 'out'],
      [1.96, 0.98, 'inOut'],
      [2.1, 1, 'inOut'],
    ])
    c.k.tailAt0('straight')
    c.k.tail(1.6, 2.05, 'wrap')
    c.add.pulse('ears.R.swivel', 0.3, 0.4, 0.45, 0.55, 0.9)
    c.add.pulse('ears.R.swivel', 0.55, 0.62, 0.66, 0.8, 0.9)
    c.add.pulse('ears.L.swivel', 0.48, 0.56, 0.6, 0.72, 0.8)
    for (const s of ['L', 'R'])
      c.add.layer(`eyes.${s}.px`, [
        [0.95, 0],
        [1.02, -0.8, 'out'],
        [1.12, -0.8],
        [1.18, 0.8, 'out'],
        [1.26, 0.8],
        [1.3, 0, 'out'],
      ])
    c.ex.push(
      { t: 0, name: 'curious', ms: 1 },
      { t: 0.62, name: 'squint', ms: 260 },
      { t: 1.3, name: 'neutral', ms: 150 },
    )
    c.sfx.push(
      { kind: 'blip', at: 0.1, gainDb: -6 },
      { kind: 'tick', at: 0.42, gainDb: -6 },
      { kind: 'tick', at: 0.6, gainDb: -8 },
      { kind: 'whoosh', at: 1.46, gainDb: -6 },
      { kind: 'thud', at: 1.8, gainDb: -4 },
    )
    return 2.1
  },
  // falls in from the top, stretched; lands with a squash, impact stars and a shake
  'drop-in': (c) => {
    c.k.seq('rise', [
      [0, 640],
      [0.32, 0, 'in'],
    ])
    c.k.seq('sy', [
      [0, 1.16],
      [0.3, 1.16],
      [0.35, 0.78, 'out'],
      [0.5, 1.07, 'inOut'],
      [0.64, 0.97, 'inOut'],
      [0.76, 1, 'inOut'],
    ])
    c.k.seq('sx', [
      [0, 0.9],
      [0.3, 0.9],
      [0.35, 1.18, 'out'],
      [0.5, 0.96, 'inOut'],
      [0.64, 1.02, 'inOut'],
      [0.76, 1, 'inOut'],
    ])
    c.k.seq('crouch', [
      [0.32, 0],
      [0.36, 0.8, 'out'],
      [0.62, 0, 'inOut'],
    ])
    c.k.tailAt0('straight')
    c.k.tail(0.6, 1.2, 'wrap')
    c.fx.impacts.push(0.33)
    c.cam.shakes.push(0.33)
    c.add.wave('head.roll', 0.75, 1.15, 7, 0.2) // shakes it off
    for (const s of ['L', 'R'])
      c.add.layer(`eyes.${s}.px`, [
        [1.2, 0],
        [1.28, 0.7, 'out'],
        [1.42, 0.7],
        [1.5, -0.6, 'out'],
        [1.62, -0.6],
        [1.7, 0, 'out'],
      ])
    c.ex.push(
      { t: 0, name: 'shocked', ms: 1 },
      { t: 0.7, name: 'neutral', ms: 160 },
      { t: 1.2, name: 'curious', ms: 160 },
      { t: 1.72, name: 'neutral', ms: 160 },
    )
    c.sfx.push(
      { kind: 'whoosh', at: 0.0, gainDb: -6 },
      { kind: 'thud', at: 0.33, gainDb: -2 },
      { kind: 'boing', at: 0.36, gainDb: -8 },
    )
    return 1.75
  },
  // trots in from screen-right; the bag throne puffs up under her as she lands in it
  'bag-hop': (c) => {
    c.base = { mode: 'stand', yaw: 90, flip: -1 }
    c.k.set('mode', 0, 'stand')
    c.k.set('yaw', 0, 90)
    c.k.set('flip', 0, -1)
    walkKeys(c, 0, 0.95, 420, 110, 2.8, 1.3)
    c.k.seq('head.yaw', [
      [0, -40],
      [0.9, -40],
      [1.2, 0, 'inOut'],
    ])
    c.k.seq('flip', [
      [1.27, -1],
      [1.28, 1, 'linear'],
    ])
    c.k.tailAt0('walkQ')
    c.k.tail(1.3, 1.7, 'question')
    c.ex.push(
      { t: 0, name: 'plotting', ms: 1 },
      { t: 1.0, name: 'curious', ms: 160 },
      { t: 1.62, name: 'proud', ms: 260 },
    )
    const end = hopToSit(c, 0.95, { rise: 120 })
    c.k.seq('bag', [
      [1.44, 0],
      [1.45, 0.05, 'linear'],
      [1.6, 1, 'out'],
    ])
    c.sfx.push({ kind: 'crinkle', at: 1.44, gainDb: -5 }, { kind: 'whoosh', at: 0.02, gainDb: -10 })
    c.hasBag = true
    return end
  },
  // already asleep in a loaf on frame 0 (zzz rising); a ding, an ear flick, eyes open, up she hops
  'wake-up': (c) => {
    c.base = { mode: 'loaf' }
    c.k.set('mode', 0, 'loaf')
    c.k.tailAt0('loaf')
    c.fx.zzz.push([0, 0.6])
    c.add.pulse('ears.R.swivel', 0.42, 0.5, 0.55, 0.68, 0.95)
    c.add.pulse('head.pitch', 0.6, 0.7, 0.8, 0.95, -8)
    c.ex.push(
      { t: 0, name: 'asleep', ms: 1 },
      { t: 0.62, name: 'shocked', ms: 80, ease: 'out' },
      { t: 1.0, name: 'curious', ms: 200 },
    )
    c.k.seq('crouch', [
      [0.9, 0],
      [1.0, 0.6, 'in'],
      [1.06, 0, 'out'],
    ])
    c.k.seq('rise', [
      [1.02, 0],
      [1.18, 90, 'out'],
      [1.34, 0, 'in'],
    ])
    c.k.set('mode', 1.12, 'sit')
    c.k.tail(1.12, 1.5, 'wrap')
    squash(c, 1.34, 0.14, 0.4)
    c.sfx.push(
      { kind: 'ding', at: 0.4, gainDb: -6 },
      { kind: 'whoosh', at: 1.02, gainDb: -7 },
      { kind: 'thud', at: 1.34, gainDb: -5 },
    )
    c.add.wave('head.roll', 1.45, 1.75, 5, 0.25)
    return 1.8
  },
  // mid-stretch and mid-yawn on frame 0, shakes it off, hop-turns to sit
  'stretch-up': (c) => {
    c.base = { mode: 'stretch', yaw: 90 }
    c.k.set('mode', 0, 'stretch')
    c.k.set('yaw', 0, 90)
    c.k.seq('head.yaw', [
      [0, -60],
      [0.9, -60],
      [1.2, 0, 'inOut'],
    ])
    c.k.tailAt0('stretch')
    c.k.tail(1.2, 1.7, 'wrap')
    c.ex.push(
      { t: 0, name: 'yawn', ms: 1 },
      { t: 0.62, name: 'sleepy', ms: 160 },
      { t: 0.95, name: 'curious', ms: 160 },
    )
    c.add.wave('head.roll', 0.65, 0.95, 8, 0.15)
    c.k.set('mode', 0.9, 'stand')
    squash(c, 0.86, 0.1, 0.2)
    c.sfx.push({ kind: 'boing', at: 0.66, gainDb: -12 }, { kind: 'whoosh', at: 0.02, gainDb: -12 })
    return hopToSit(c, 1.0)
  },
  // runs in too fast, overshoots, skids, turns, trots back and sits as if she meant it
  zoomies: (c) => {
    c.base = { mode: 'stand', yaw: 90, flip: -1 }
    c.k.set('mode', 0, 'stand')
    c.k.set('yaw', 0, 90)
    c.k.set('flip', 0, -1)
    c.k.seq('x', [
      [0, 470],
      [0.52, -230, 'linear'],
      [0.7, -290, 'out'],
    ])
    c.k.seq('walk.phase', [
      [0, 0],
      [0.52, 3.6, 'linear'],
      [0.62, 3.75, 'out'],
    ])
    c.k.seq('walk.amt', [
      [0, 1.25],
      [0.45, 1.25],
      [0.62, 0, 'out'],
    ])
    c.k.seq('lean', [
      [0.45, 0],
      [0.56, 9, 'out'],
      [0.74, 0, 'inOut'],
    ])
    c.k.seq('flip', [
      [0.78, -1],
      [0.79, 1, 'linear'],
    ])
    squash(c, 0.74, 0.12, 0.24)
    c.k.seq('x', [[0.82], [1.12, -70, 'linear']])
    c.k.seq('walk.phase', [[0.82], [1.12, 5.2, 'linear']])
    c.k.seq('walk.amt', [
      [0.82, 1.1],
      [1.0, 1.1],
      [1.16, 0, 'out'],
    ])
    c.k.seq('head.yaw', [
      [0, -30],
      [0.5, -30],
      [0.75, 0],
      [0.85, -50, 'inOut'],
      [1.1, 0, 'inOut'],
    ])
    c.k.tailAt0('walkQ')
    c.k.tail(1.3, 1.75, 'wrap')
    c.ex.push(
      { t: 0, name: 'delighted', ms: 1 },
      { t: 0.6, name: 'shocked', ms: 70 },
      { t: 0.9, name: 'plotting', ms: 160 },
      { t: 1.6, name: 'neutral', ms: 180 },
    )
    c.sfx.push({ kind: 'whoosh', at: 0.02, gainDb: -4 }, { kind: 'boing', at: 0.6, gainDb: -9 })
    return hopToSit(c, 1.08)
  },
}

// ------------------------------------------------------------------ reactions to the number
// (c, r0, r1): from just after the reveal to just before the line
const eyesUp = (c, t0, t1, py = -0.72) => {
  for (const s of ['L', 'R']) c.add.pulse(`eyes.${s}.py`, t0, t0 + 0.1, t1 - 0.15, t1, py)
}
export const REACTIONS = {
  'squint-at': (c, r0, r1) => {
    eyesUp(c, r0 - 0.05, r0 + 0.45)
    c.add.pulse('head.pitch', r0 - 0.05, r0 + 0.08, r0 + 0.3, r0 + 0.45, -8)
    c.ex.push({ t: r0 + 0.45, name: 'squint', ms: 260 })
    c.add.pulse('ears.R.swivel', r0 + 0.6, r0 + 0.72, r1 - 0.2, r1, 0.5)
    c.k.seq('tail.wave', [[r0], [r0 + 0.3, 7]])
  },
  'glance-unmoved': (c, r0, r1) => {
    c.ex.push({ t: r0, name: 'bored', ms: 240 })
    eyesUp(c, r0, r0 + 0.5)
    c.add.pulse('head.pitch', r0, r0 + 0.12, r0 + 0.35, r0 + 0.5, -7)
    c.add.pulse('ears.R.swivel', r0 + 0.55, r0 + 0.65, r0 + 0.8, r0 + 0.95, 0.8)
    c.ex.push({ t: r1 - 0.25, name: 'neutral', ms: 200 })
  },
  tilt: (c, r0, r1) => {
    c.ex.push({ t: r0, name: 'curious', ms: 220 })
    eyesUp(c, r0, r0 + 0.5)
    c.add.pulse('head.roll', r0 + 0.5, r0 + 0.7, r1 - 0.15, r1 + 0.1, 24) // the second tilt, to the other side
    c.k.tail(r0, r0 + 0.4, 'question')
    c.sfx.push({ kind: 'blip', at: r0 + 0.5, gainDb: -10 })
  },
  'ear-perk': (c, r0, r1) => {
    c.ex.push({ t: r0, name: 'impressed', ms: 160 })
    eyesUp(c, r0, r0 + 0.45)
    c.add.pulse('ears.L.swivel', r0 + 0.2, r0 + 0.3, r0 + 0.4, r0 + 0.52, 0.85)
    c.add.pulse('ears.R.swivel', r0 + 0.45, r0 + 0.55, r0 + 0.65, r0 + 0.78, 0.85)
    c.add.pulse('head.pitch', r0, r0 + 0.15, r1 - 0.2, r1, -5)
    c.sfx.push(
      { kind: 'tick', at: r0 + 0.22, gainDb: -10 },
      { kind: 'tick', at: r0 + 0.47, gainDb: -10 },
    )
  },
  'diva-flick': (c, r0, r1) => {
    c.ex.push({ t: r0, name: 'innocent', ms: 100 }, { t: r0 + 0.4, name: 'diva', ms: 220 })
    eyesUp(c, r0 - 0.05, r0 + 0.4)
    c.k.seq('head.yaw', [[r0 + 0.4], [r0 + 0.6, -12, 'inOut'], [r1, -12], [r1 + 0.3, 0, 'inOut']])
    c.k.seq('paw.lift', [
      [r0 + 0.42, 0],
      [r0 + 0.6, 0.85, 'outBack'],
      [r0 + 0.82, 0.85],
      [r0 + 1.0, 0, 'inOut'],
    ])
    c.fx.flashes.push(r0 + 0.5, r0 + 0.66)
    c.sfx.push(
      { kind: 'shutter', at: r0 + 0.5, gainDb: -3 },
      { kind: 'shutter', at: r0 + 0.66, gainDb: -4 },
    )
  },
  'chin-up': (c, r0, r1) => {
    eyesUp(c, r0 - 0.05, r0 + 0.35)
    c.ex.push({ t: r0 + 0.3, name: 'proud', ms: 260 })
    c.k.seq('sy', [[r0 + 0.3], [r0 + 0.55, 1.04, 'inOut']])
    c.k.tail(r0 + 0.25, r0 + 0.6, 'straight')
    c.k.tail(r1 - 0.2, r1 + 0.3, 'wrap')
    c.k.seq('sy', [[r1], [r1 + 0.3, 1, 'inOut']])
    c.sfx.push({ kind: 'sparkle', at: r0 + 0.35, gainDb: -12 })
  },
  innocent: (c, r0) => {
    c.ex.push({ t: r0, name: 'innocent', ms: 90, ease: 'out' })
    for (const s of ['L', 'R'])
      c.add.layer(`eyes.${s}.px`, [
        [r0 + 0.55, 0],
        [r0 + 0.6, 0.75, 'out'],
        [r0 + 0.78, 0.75],
        [r0 + 0.83, 0, 'out'],
      ])
  },
  'soft-look': (c, r0, r1) => {
    eyesUp(c, r0 - 0.05, r0 + 0.4)
    c.ex.push({ t: r0 + 0.35, name: 'loving', ms: 380, ease: 'out' })
    c.add.pulse('head.roll', r0 + 0.35, r0 + 0.8, r1 - 0.1, r1 + 0.2, 6)
    for (const s of ['L', 'R'])
      c.k.seq(`ears.${s}.fold`, [
        [r0 + 0.35],
        [r0 + 0.7, 0.15, 'inOut'],
        [r1],
        [r1 + 0.25, 0, 'inOut'],
      ])
  },
  'double-take': (c, r0) => {
    c.ex.push({ t: r0, name: 'bored', ms: 200 })
    c.k.seq('head.yaw', [[r0], [r0 + 0.16, -40, 'inOut'], [r0 + 0.36, -40], [r0 + 0.43, 0, 'out']])
    c.ex.push({ t: r0 + 0.43, name: 'shocked', ms: 70, ease: 'out' })
    c.k.seq('crouch', [
      [r0 + 0.43],
      [r0 + 0.49, 0.5, 'out'],
      [r0 + 0.55, 0, 'out'],
      [r0 + 0.87],
      [r0 + 0.91, 0.5, 'out'],
      [r0 + 1.05, 0, 'inOut'],
    ])
    c.k.seq('rise', [[r0 + 0.53], [r0 + 0.69, 60, 'out'], [r0 + 0.87, 0, 'in']])
    c.k.tail(r0 + 0.43, r0 + 0.55, 'straight', 'out')
    c.add.pulse('head.roll', r0 + 0.43, r0 + 0.49, r0 + 0.5, r0 + 0.68, -8)
    c.cam.bumps.push(r0 + 0.43)
    c.sfx.push(
      { kind: 'boing', at: r0 + 0.48, gainDb: -6 },
      { kind: 'thud', at: r0 + 0.88, gainDb: -6 },
    )
  },
}

// ------------------------------------------------------------------ signature moves under the line
// (c, T, m0) where m0 is just before the line; T.sents gives the sentence starts to hit
const lastSent = (T) => T.sents[T.sents.length - 1]
export const MOVE_IMPL = {
  squint: (c, T, m0) => {
    c.ex.push({ t: m0 + 0.1, name: 'squint', ms: 240 })
    c.add.pulse('head.dy', m0 + 0.1, m0 + 0.35, T.e - 0.3, T.e, 10)
    c.add.pulse('ears.R.swivel', m0 + 0.25, m0 + 0.4, T.e - 0.2, T.e + 0.1, 0.5)
    c.k.seq('tail.wave', [[m0], [m0 + 0.3, 8]])
  },
  'counter-pose': (c, T, m0) => {
    c.k.seq('sy', [[m0], [m0 + 0.3, 1.05, 'inOut'], [T.e], [T.e + 0.3, 1, 'inOut']])
    c.add.pulse('head.pitch', m0, m0 + 0.3, T.e - 0.2, T.e + 0.2, -6)
    c.k.tail(m0, m0 + 0.4, 'hang')
    c.k.seq('tail.wave', [[m0], [m0 + 0.4, 9]])
  },
  'bag-throne': (c, T, m0) => {
    if (c.hasBag) {
      squash(c, m0, 0.08, 0.3)
      c.sfx.push({ kind: 'crinkle', at: m0, gainDb: -8 })
      return
    }
    c.k.seq('crouch', [[m0 - 0.1], [m0, 0.5, 'in'], [m0 + 0.06, 0, 'out']])
    c.k.seq('rise', [[m0 + 0.02], [m0 + 0.16, 60, 'out'], [m0 + 0.3, 0, 'in']])
    c.k.seq('bag', [
      [m0 + 0.28, 0],
      [m0 + 0.29, 0.05, 'linear'],
      [m0 + 0.44, 1, 'out'],
    ])
    squash(c, m0 + 0.3, 0.12, 0.34)
    c.k.tail(m0 + 0.3, m0 + 0.7, 'question')
    c.sfx.push(
      { kind: 'whoosh', at: m0, gainDb: -9 },
      { kind: 'crinkle', at: m0 + 0.28, gainDb: -5 },
    )
    c.hasBag = true
  },
  'model-turn': (c, T, m0) => {
    if (c.plan.outfit || c.hasBag) {
      // seated 3/4 turn: the outfit only reads on the sitting body, and the bag keeps her seated
      c.k.seq('yaw', [[m0], [m0 + 0.35, 28, 'inOut']])
      c.k.seq('head.yaw', [[m0], [m0 + 0.35, -12, 'inOut']])
      c.add.pulse('head.pitch', m0, m0 + 0.35, T.e, T.e + 0.4, -10)
    } else {
      // stands up into the catwalk 3/4, chin up, face to the lens
      c.k.seq('crouch', [[m0 - 0.12], [m0, 0.5, 'in'], [m0 + 0.06, 0, 'out']])
      c.k.seq('rise', [[m0 + 0.02], [m0 + 0.16, 40, 'out'], [m0 + 0.32, 0, 'in']])
      c.k.set('mode', m0 + 0.15, 'stand')
      c.k.seq('yaw', [[m0 + 0.1], [m0 + 0.4, 32, 'out']])
      c.k.seq('head.yaw', [[m0 + 0.1], [m0 + 0.4, -26, 'out']])
      c.add.pulse('head.pitch', m0 + 0.3, m0 + 0.55, T.e, T.e + 0.4, -8)
      squash(c, m0 + 0.32, 0.08, 0.3)
      c.sfx.push({ kind: 'whoosh', at: m0, gainDb: -9 })
    }
    c.k.tail(m0 + 0.2, m0 + 0.6, 'question')
  },
  'ear-swivel': (c, T, m0) => {
    let last = -1,
      side = 0
    for (const w of T.words)
      if (w.t0 - last > 0.42) {
        const s = side++ % 2 ? 'L' : 'R'
        c.add.pulse(`ears.${s}.swivel`, w.t0 - 0.05, w.t0 + 0.07, w.t0 + 0.18, w.t0 + 0.32, 0.85)
        last = w.t0
      }
    c.add.pulse('head.roll', m0, m0 + 0.4, T.e - 0.3, T.e, -5)
  },
  blep: (c, T) => {
    const ls = lastSent(T)
    // tongue out as she speaks; it slurps back on the last sentence (or near the end of a one-liner)
    const back = T.sents.length > 1 ? ls.t0 - 0.12 : T.v + (T.e - T.v) * 0.7
    c.k.seq('mouth.tongue', [[T.v + 0.05], [T.v + 0.13, 1, 'out'], [back], [back + 0.08, 0, 'in']])
    c.ex.push(
      { t: T.v + 0.05, name: 'blep', ms: 90, ease: 'out' },
      { t: back + 0.1, name: 'embarrassed', ms: 200 },
    )
    c.sfx.push({ kind: 'blip', at: T.v + 0.06, gainDb: -8 })
  },
  'slow-blink': (c, T) => {
    const ls = lastSent(T)
    const at = T.sents.length > 1 ? ls.t0 - 0.05 : T.v + (T.e - T.v) * 0.5
    c.ex.push(
      { t: at, name: 'slowblink', ms: 380, ease: 'in' },
      { t: at + 0.75, name: 'loving', ms: 380, ease: 'out' },
    )
    c.add.pulse('head.pitch', at, at + 0.4, at + 0.6, at + 1.0, 5)
  },
  'tail-question': (c, T, m0) => {
    c.k.tail(m0, m0 + 0.4, 'question')
    c.k.seq('tail.wave', [[m0], [m0 + 0.3, 8]])
    c.add.pulse('head.roll', m0, m0 + 0.35, T.e - 0.2, T.e + 0.2, -10)
    for (const s of ['L', 'R'])
      c.add.pulse(`ears.${s}.swivel`, m0, m0 + 0.2, m0 + 0.4, m0 + 0.6, -0.2)
  },
  'innocent-stare': (c, T, m0) => {
    c.ex.push({ t: m0 + 0.1, name: 'innocent', ms: 120 })
    const at = lastSent(T).t0 + 0.1
    for (const s of ['L', 'R'])
      c.add.layer(`eyes.${s}.px`, [
        [at, 0],
        [at + 0.05, -0.75, 'out'],
        [at + 0.3, -0.75],
        [at + 0.36, 0, 'out'],
      ])
  },
  'sprawl-paw': (c, T, m0) => {
    c.k.seq('crouch', [[m0 - 0.1], [m0 + 0.04, 0.7, 'in']])
    c.k.set('mode', m0 + 0.08, 'sprawl')
    c.k.seq('crouch', [[m0 + 0.08, 0]])
    c.k.set('persp', m0 + 0.08, 640)
    c.k.set('pcy', m0 + 0.08, -40)
    c.k.set('elev', m0 + 0.08, 4)
    c.k.seq('paw.reach', [[m0 + 0.08, 0.1]])
    TP.forEach((q, i) => c.k.set('tail.' + q, m0 + 0.08, TAIL.sprawl[i]))
    squash(c, m0 + 0.08, 0.12, 0.3)
    const at = T.sents.length > 1 ? lastSent(T).t0 - 0.05 : T.e - 0.3
    c.k.seq('paw.reach', [[at], [at + 0.22, 1, 'outBack']])
    // she lies low: the camera tilts down so the sprawl and the paw sit above the caption bubble
    c.cam.lift = [
      [m0, 0],
      [m0 + 0.3, 250, 'inOut'],
    ]
    c.sfx.push(
      { kind: 'whoosh', at: m0, gainDb: -8 },
      { kind: 'thud', at: m0 + 0.1, gainDb: -8 },
      { kind: 'pop', at: at + 0.15, gainDb: -8 },
    )
  },
  loaf: (c, T, m0) => {
    c.k.seq('crouch', [[m0 - 0.1], [m0 + 0.05, 0.6, 'in']])
    c.k.set('mode', m0 + 0.08, 'loaf')
    c.k.seq('crouch', [[m0 + 0.08, 0]])
    TP.forEach((q, i) => c.k.set('tail.' + q, m0 + 0.08, TAIL.loaf[i]))
    squash(c, m0 + 0.08, 0.1, 0.34)
    for (const s of ['L', 'R']) c.k.seq(`ears.${s}.fold`, [[m0 + 0.1], [m0 + 0.4, 0.15, 'inOut']])
    c.cam.lift = [
      [m0, 0],
      [m0 + 0.3, 140, 'inOut'],
    ]
    c.sfx.push({ kind: 'thud', at: m0 + 0.1, gainDb: -10 })
  },
  'airplane-ears': (c, T, m0) => {
    // airplane ears only while the mouth is shut: before the line and after it
    c.ex.push({ t: m0 - 0.15, name: 'mock', ms: 160 })
    for (const s of ['L', 'R'])
      c.k.seq(`ears.${s}.fold`, [
        [m0 - 0.15],
        [m0, 0.95, 'out'],
        [T.v - 0.02],
        [T.v + 0.2, 0.3, 'inOut'],
        [T.e],
        [T.e + 0.1, 0.95, 'out'],
        [T.e + 0.45],
        [T.e + 0.65, 0, 'inOut'],
      ])
    c.sfx.push({ kind: 'blip', at: m0, gainDb: -10 })
  },
}

// ------------------------------------------------------------------ v2 vocabulary (the character bible, §15)
// More signature moves and reactions. A quip picks a move with its `move` field and a reaction with
// its `mood`, as before; nothing here changes what an existing day picks. Every move hands her back
// sitting, centred and facing the lens by the payoff (pay = T.e + 0.2), so all four payoffs work.
// Props a move needs go to c.fx.props (drawn by lib/layers.mjs moveProps).
const prop = (c, o) => (c.fx.props = c.fx.props || []).push(o)
export const setTail = (c, t, shape) =>
  TP.forEach((q, i) => c.k.set('tail.' + q, t, TAIL[shape][i]))
// a cut back to the plain sitting pose, landed with a squash
export function settle(c, t, amt = 0.12) {
  c.k.set('mode', t, 'sit')
  c.k.set('yaw', t, 0)
  c.k.set('flip', t, 1)
  c.k.set('head.yaw', t, 0)
  setTail(c, t, 'wrap')
  squash(c, t, amt, 0.34)
}
const eyes = (c, keys) => {
  for (const s of ['L', 'R']) c.add.layer(`eyes.${s}.px`, keys)
}
// the joke beat of a move: the last sentence, or the back half of a one-liner
const beat = (T, lead = 0.1) =>
  T.sents.length > 1 ? lastSent(T).t0 - lead : T.v + (T.e - T.v) * 0.55
// a burst of n quick pulses on an additive path
function pulses(c, p, t0, n, gap, v, len = gap * 0.7) {
  for (let i = 0; i < n; i++) {
    const a = t0 + i * gap
    c.add.pulse(p, a, a + len * 0.35, a + len * 0.45, a + len, v)
  }
}

Object.assign(MOVE_IMPL, {
  // making biscuits: both fore paws press in turns, eyes soft; she will call it exercise
  knead: (c, T, m0) => {
    const end = T.e + 0.1
    c.k.seq('paw.kamt', [[m0], [m0 + 0.25, 1, 'out'], [end - 0.15], [end + 0.1, 0, 'inOut']])
    c.k.seq('paw.knead', [
      [m0, 0],
      [end + 0.1, (end + 0.1 - m0) * 1.7, 'linear'],
    ])
    c.add.wave('head.roll', m0, end, 3, 1.2)
    c.k.seq('tail.wave', [[m0], [m0 + 0.3, 6]])
    c.ex.push({ t: end - 0.05, name: 'purr', ms: 240 })
    c.sfx.push({ kind: 'purr', at: m0 + 0.1, seconds: Math.min(2.4, end - m0), gainDb: -12 })
  },
  // the butt wiggle, the pounce, the miss: the red dot flits off, she lands, it was the plan
  'hunt-wiggle': (c, T, m0) => {
    const p0 = Math.max(m0 + 0.9, beat(T, 0.3)),
      land = p0 + 0.42
    c.k.seq('crouch', [[m0 - 0.12], [m0 - 0.02, 0.6, 'in']])
    c.k.set('mode', m0, 'crouch')
    c.k.seq('crouch', [[m0 + 0.01, 0]])
    c.k.set('yaw', m0, 55)
    c.k.set('head.yaw', m0, -28)
    setTail(c, m0, 'hunt')
    const wk = []
    for (let t = m0 + 0.15, i = 0; t < p0 - 0.05; t += 0.17, i++)
      wk.push([t, (i % 2 ? -1 : 1) * Math.min(1, 0.4 + i * 0.12)])
    c.k.seq('wiggle', [[m0], ...wk, [p0 - 0.02, 0]])
    c.ex.push({ t: m0 + 0.05, name: 'fixated', ms: 160 })
    c.k.seq('tail.wave', [[m0], [m0 + 0.2, 12]])
    // the pounce
    c.k.set('mode', p0, 'leap')
    c.k.set('yaw', p0, 90)
    c.k.set('head.yaw', p0, -30)
    setTail(c, p0, 'streak')
    c.k.seq('rise', [[p0], [p0 + 0.2, 150, 'out'], [land, 0, 'in']])
    c.k.seq('x', [[p0], [land, 170, 'linear']])
    c.ex.push({ t: p0, name: 'saucer', ms: 80 })
    settle(c, land, 0.16)
    c.k.seq('x', [[land + 0.15], [land + 0.5, 0, 'inOut']])
    c.ex.push({ t: land + 0.15, name: 'meant-it', ms: 220 })
    prop(c, {
      kind: 'dot',
      layer: 'back',
      t0: m0 - 0.1,
      t1: land + 0.2,
      x: [
        [m0, 210],
        [p0, 260, 'inOut'],
        [p0 + 0.12, 420, 'out'],
        [land, 900, 'in'],
      ],
      y: [
        [m0, -14],
        [p0, -20],
      ],
    })
    eyes(c, [
      [m0, 0],
      [m0 + 0.1, 0.6, 'out'],
      [land, 0.6],
      [land + 0.1, 0, 'out'],
    ])
    c.sfx.push(
      { kind: 'whoosh', at: p0, gainDb: -6 },
      { kind: 'thud', at: land, gainDb: -5 },
      { kind: 'boing', at: land + 0.02, gainDb: -12 },
    )
  },
  // eye contact, then one slow paw push: the cork goes over the edge "in your honour"
  'knock-off': (c, T, m0) => {
    const tap = beat(T, 0.25),
      up = tap - 0.4
    eyes(c, [
      [m0, 0],
      [m0 + 0.12, -0.8, 'out'],
      [m0 + 0.6, -0.8],
      [m0 + 0.75, 0, 'out'],
    ]) // looks at it, then at you
    c.k.seq('paw.lift', [[up], [up + 0.3, 0.5, 'inOut'], [tap + 0.25], [tap + 0.55, 0, 'inOut']])
    c.k.seq('paw.side', [
      [up + 0.15],
      [tap, 0.55, 'inOut'],
      [tap + 0.12, 1, 'out'],
      [tap + 0.3],
      [tap + 0.55, 0, 'inOut'],
    ])
    c.ex.push({ t: tap + 0.25, name: 'innocent', ms: 120 })
    prop(c, {
      kind: 'cork',
      layer: 'front',
      t0: 0,
      t1: tap + 1.2,
      x: [
        [tap + 0.08, -190],
        [tap + 0.5, -620, 'out'],
      ],
      y: [
        [tap + 0.08, 0],
        [tap + 0.22, -60, 'out'],
        [tap + 0.7, 700, 'in'],
      ],
      rot: [
        [tap + 0.08, 0],
        [tap + 0.7, -400, 'linear'],
      ],
    })
    c.sfx.push(
      { kind: 'tick', at: tap + 0.08, gainDb: -4 },
      { kind: 'whoosh', at: tap + 0.12, gainDb: -12 },
      { kind: 'thud', at: tap + 0.9, gainDb: -16 },
    )
  },
  // a sound: all four legs straight out, a sideways hop, ears flat for a blink; she lands calm
  'startle-hop': (c, T, m0) => {
    const t0 = m0 - 0.15,
      land = t0 + 0.44
    c.k.set('mode', t0, 'startle')
    setTail(c, t0, 'straight')
    c.k.seq('rise', [[t0], [t0 + 0.18, 170, 'out'], [land, 0, 'in']])
    c.k.seq('x', [[t0], [land, 130, 'out'], [T.e - 0.3], [T.e + 0.1, 0, 'inOut']])
    c.ex.push(
      { t: t0, name: 'saucer', ms: 60, ease: 'out' },
      { t: land + 0.1, name: 'meant-it', ms: 200 },
    )
    for (const s of ['L', 'R'])
      c.k.seq(`ears.${s}.fold`, [
        [t0],
        [t0 + 0.05, 0.9, 'out'],
        [t0 + 0.16],
        [t0 + 0.3, 0, 'inOut'],
      ])
    settle(c, land, 0.18)
    c.sfx.push(
      { kind: 'thud', at: t0 - 0.12, gainDb: -8 },
      { kind: 'boing', at: t0 + 0.02, gainDb: -6 },
      { kind: 'thud', at: land, gainDb: -6 },
    )
  },
  // the fridge: crouch, wiggle, leap out of the top of the frame... slide back down scrabbling,
  // land, groom a paw very hard. "Meant that."
  // opt (the introduction film's bonk): top, a height she hits something at instead of leaving the
  // frame, then slides down it for `slide` s; licks: false keeps her tongue in after the landing.
  // With top, the leap's profile reaches `top` on the frame before `back` (the hit); from `back` she
  // is crumpled against it (the scrabble pose, still in profile and leaning) and turns to the lens
  // over 0.2 s; pin: [[t, rise], ...] holds her against it meanwhile (film.mjs measures it). She
  // stays there, scrabbling, until the last 0.3 s, and falls.
  'jump-fail': (c, T, m0, { top = null, slide = 0.5, licks = true, pin = null } = {}) => {
    const j = m0 + 0.45,
      back = top === null ? Math.max(j + 0.75, beat(T, 0.55)) : j + 0.3,
      land = back + (top === null ? 0.5 : slide)
    c.k.seq('crouch', [[m0 - 0.12], [m0 - 0.02, 0.6, 'in']])
    c.k.set('mode', m0, 'crouch')
    c.k.seq('crouch', [[m0 + 0.01, 0]])
    c.k.set('yaw', m0, 55)
    c.k.set('head.yaw', m0, -28)
    setTail(c, m0, 'hunt')
    c.k.seq('wiggle', [[m0], [m0 + 0.12, 1], [m0 + 0.24, -1], [m0 + 0.36, 1], [j - 0.02, 0]])
    c.ex.push({ t: m0, name: 'plotting', ms: 140 })
    c.k.set('mode', j, 'leap')
    c.k.set('yaw', j, 90)
    c.k.set('head.yaw', j, -20)
    setTail(c, j, 'streak')
    c.k.seq('lean', [[j], [j + 0.1, -50, 'out']])
    if (top === null) {
      c.k.seq('rise', [[j], [j + 0.3, 1300, 'in']])
      // back down the "fridge door", fore paws scrabbling
      c.k.set('mode', back, 'startle')
      c.k.set('yaw', back, 0)
      c.k.set('head.yaw', back, 0)
      c.k.set('lean', back, 0)
      setTail(c, back, 'straight')
      c.k.seq('rise', [
        [back, 900],
        [land, 0, 'in'],
      ])
    } else {
      const turn = 0.2
      c.k.seq('rise', [[j], [back - 1 / 30, top, 'out']])
      c.k.set('mode', back, 'startle')
      c.k.set('lean', back, -35)
      c.k.seq('lean', [[back + turn, 0, 'inOut']])
      c.k.seq('yaw', [[back], [back + turn, 0, 'inOut']])
      c.k.seq('head.yaw', [[back], [back + turn, 0, 'inOut']])
      setTail(c, back, 'straight')
      const held = pin || [[back, top]]
      c.k.set('rise', held[0][0], held[0][1])
      for (const [t, v] of held.slice(1)) c.k.key('rise', t, v, 'linear')
      // she hangs on the edge, scrabbling, then drops: a fall, not a float down past nothing
      const hang = held[held.length - 1][0] + 0.04
      c.k.seq('rise', [[Math.max(hang, land - 0.3)], [land, 0, 'in']])
    }
    c.k.seq('paw.kamt', [
      [back, 1],
      [land - 0.05, 1],
      [land, 0],
    ])
    c.k.seq('paw.knead', [
      [back, 0],
      [land, 4.5, 'linear'],
    ])
    c.ex.push({ t: back, name: 'saucer', ms: 60 })
    settle(c, land, 0.2)
    c.k.seq('paw.groom', [
      [land + 0.15],
      [land + 0.35, 1, 'out'],
      [T.e + 0.05],
      [T.e + 0.3, 0, 'inOut'],
    ])
    if (licks)
      c.k.seq('mouth.tongue', [
        [land + 0.3],
        ...[0, 1, 2].flatMap((i) => [
          [land + 0.36 + i * 0.22, 1, 'out'],
          [land + 0.46 + i * 0.22, 0, 'in'],
        ]),
      ])
    c.add.pulse('head.pitch', land + 0.2, land + 0.4, T.e, T.e + 0.3, 10)
    c.ex.push({ t: land + 0.2, name: 'meant-it', ms: 200 })
    c.sfx.push(
      { kind: 'whoosh', at: j, gainDb: -5 },
      { kind: 'thud', at: j + 0.42, gainDb: -10 },
      { kind: 'tick', at: back + 0.1, gainDb: -8 },
      { kind: 'tick', at: back + 0.22, gainDb: -8 },
      { kind: 'tick', at: back + 0.34, gainDb: -8 },
      { kind: 'thud', at: land, gainDb: -4 },
    )
  },
  // she leans too far, topples off the edge, the line comes from below; ears, then eyes, peek back
  // over the edge; she hops up as if she had gone down there on purpose
  'fall-off': (c, T, m0) => {
    const tip = m0 + 0.35,
      gone = tip + 0.3,
      peek = Math.max(gone + 0.4, beat(T, 0.5)),
      up = Math.max(peek + 0.6, T.e - 0.35)
    c.fx.ledge = true
    c.k.seq('lean', [
      [m0 - 0.1],
      [m0 + 0.15, -12, 'inOut'],
      [m0 + 0.25, -8, 'inOut'],
      [tip, -34, 'in'],
    ])
    c.k.seq('paw.lift', [[m0 + 0.1], [m0 + 0.2, 0.7, 'out'], [m0 + 0.3, 0.2], [tip, 0.8]])
    c.ex.push({ t: m0 + 0.1, name: 'saucer', ms: 80 })
    c.k.set('mode', tip, 'startle')
    setTail(c, tip, 'straight')
    c.k.seq('y', [
      [tip],
      [gone, 640, 'in'],
      [peek],
      [peek + 0.2, 445, 'outBack'],
      [peek + 0.45],
      [peek + 0.65, 290, 'inOut'],
      [up],
      [up + 0.12, 450, 'in'],
      [up + 0.4, 0, 'out'],
    ])
    c.k.seq('lean', [[tip], [gone, -70, 'in'], [gone + 0.02, 0, 'linear']])
    settle(c, gone + 0.05, 0)
    c.k.seq('rise', [[up + 0.1], [up + 0.28, 70, 'out'], [up + 0.42, 0, 'in']])
    c.k.set('paw.lift', gone + 0.05, 0)
    c.ex.push({ t: peek, name: 'innocent', ms: 120 }, { t: up + 0.3, name: 'meant-it', ms: 220 })
    c.sfx.push(
      { kind: 'whoosh', at: tip, gainDb: -6 },
      { kind: 'thud', at: gone + 0.12, gainDb: -3 },
      { kind: 'blip', at: peek + 0.05, gainDb: -10 },
      { kind: 'whoosh', at: up, gainDb: -9 },
      { kind: 'thud', at: up + 0.42, gainDb: -6 },
    )
  },
  // flops on her back, paws folded in the air, upside-down eyes: "pet the belly"... it is a trap
  'belly-up': (c, T, m0) => {
    const trap = beat(T, 0.05),
      up = T.e - 0.05
    c.k.seq('crouch', [[m0 - 0.12], [m0, 0.6, 'in']])
    c.k.set('mode', m0 + 0.04, 'belly')
    c.k.seq('crouch', [[m0 + 0.05, 0]])
    setTail(c, m0 + 0.04, 'belly')
    c.k.seq('x', [
      [m0 + 0.04, 0],
      [m0 + 0.06, 110, 'linear'],
      [up - 0.02, 110],
      [up, 0, 'linear'],
    ]) // her head end clears the frame edge
    c.add.pulse('head.roll', m0 + 0.03, m0 + 0.06, up - 0.02, up + 0.02, -100, 'linear', 'linear')
    squash(c, m0 + 0.05, 0.14, 0.34)
    c.cam.lift = [
      [m0, 0],
      [m0 + 0.3, 200, 'inOut'],
      [up, 200],
      [up + 0.3, 0, 'inOut'],
    ] // the camera track has no hold keys
    c.ex.push(
      { t: m0 + 0.1, name: 'innocent', ms: 160 },
      { t: trap + 0.06, name: 'plotting', ms: 100 },
    )
    c.k.seq('paw.kamt', [[trap], [trap + 0.1, 1, 'out'], [up - 0.05], [up, 0]])
    c.k.seq('tail.wave', [[m0], [m0 + 0.3, 10]])
    settle(c, up, 0.12)
    c.k.seq('rise', [[up], [up + 0.12, 60, 'out'], [up + 0.28, 0, 'in']])
    c.sfx.push(
      { kind: 'thud', at: m0 + 0.06, gainDb: -8 },
      { kind: 'pop', at: trap + 0.05, gainDb: -6 },
      { kind: 'whoosh', at: up, gainDb: -10 },
    )
  },
  // the downward-cat stretch, through the whole line, with a drowsy face; she pops back to sitting
  'big-stretch': (c, T, m0) => {
    c.k.seq('crouch', [[m0 - 0.1], [m0, 0.4, 'in']])
    c.k.set('mode', m0 + 0.02, 'stretch')
    c.k.set('yaw', m0 + 0.02, 90)
    c.k.set('head.yaw', m0 + 0.02, -60)
    c.k.seq('crouch', [[m0 + 0.03, 0]])
    setTail(c, m0 + 0.02, 'stretch')
    c.ex.push({ t: m0 + 0.05, name: 'drowsy', ms: 200 }, { t: T.v + 0.2, name: 'sleepy', ms: 300 })
    // out of the stretch the way stretch-up does it: up onto all fours, then hop round to sit. A plain
    // settle() swapped the stretch pose for the sitting one in a single frame, which read as a pop.
    const h = Math.max(m0 + 0.6, T.e - 0.55)
    c.add.wave('head.roll', m0 + 0.1, h - 0.15, 5, 0.9)
    c.k.seq('head.yaw', [[h - 0.3], [h + 0.1, 0, 'inOut']])
    c.k.set('mode', h - 0.1, 'stand')
    squash(c, h - 0.12, 0.1, 0.2)
    hopToSit(c, h)
    c.k.set('flip', h + 0.32, 1)
    setTail(c, h + 0.32, 'wrap')
    c.sfx.push({ kind: 'boing', at: m0 + 0.05, gainDb: -14 })
  },
  // the Egyptian statue: sits tall, chin up, ears high, a glint
  egyptian: (c, T, m0) => {
    c.k.seq('sy', [[m0], [m0 + 0.35, 1.08, 'inOut'], [T.e], [T.e + 0.3, 1, 'inOut']])
    c.k.seq('sx', [[m0], [m0 + 0.35, 0.95, 'inOut'], [T.e], [T.e + 0.3, 1, 'inOut']])
    c.add.pulse('head.pitch', m0, m0 + 0.35, T.e, T.e + 0.3, -9)
    for (const s of ['L', 'R']) c.add.pulse(`ears.${s}.rot`, m0, m0 + 0.35, T.e, T.e + 0.3, -12)
    c.k.tail(m0, m0 + 0.4, 'wrap')
    c.k.seq('tail.wave', [[m0], [m0 + 0.3, 0]])
    c.fx.sparkles.push([m0 + 0.35, 540, 760])
    c.sfx.push({ kind: 'sparkle', at: m0 + 0.35, gainDb: -9 })
  },
  // she hops into a box and sinks till only her ears and eyes clear the rim; up again for the end
  'box-hide': (c, T, m0) => {
    const sink = m0 + 0.45,
      rise = Math.max(sink + 0.5, T.e - 0.25)
    prop(c, {
      kind: 'box',
      layer: 'back',
      t0: m0 - 0.1,
      t1: 1e9,
      s: [
        [m0 - 0.1, 0],
        [m0 + 0.1, 1, 'outBack'],
      ],
    })
    prop(c, {
      kind: 'box',
      layer: 'front',
      t0: m0 - 0.1,
      t1: 1e9,
      s: [
        [m0 - 0.1, 0],
        [m0 + 0.1, 1, 'outBack'],
      ],
    })
    c.k.seq('crouch', [[m0 - 0.1], [m0, 0.5, 'in'], [m0 + 0.06, 0, 'out']])
    c.k.seq('rise', [[m0 + 0.02], [m0 + 0.18, 90, 'out'], [m0 + 0.34, 0, 'in']])
    c.k.seq('y', [
      [m0 + 0.05],
      [m0 + 0.3, -110, 'inOut'],
      [sink],
      [sink + 0.25, 196, 'in'],
      [rise],
      [rise + 0.22, -110, 'outBack'],
    ])
    c.ex.push(
      { t: sink, name: 'averted', ms: 160 },
      { t: sink + 0.4, name: 'saucer', ms: 200 },
      { t: rise + 0.1, name: 'meant-it', ms: 200 },
    )
    c.sfx.push(
      { kind: 'crinkle', at: m0 + 0.32, gainDb: -6 },
      { kind: 'whoosh', at: sink, gainDb: -10 },
      { kind: 'pop', at: rise + 0.1, gainDb: -8 },
    )
  },
  // 3 a.m. energy (never said aloud): gone in a streak, the line plays to an empty set, she screeches
  // back in from the other side and sits as if nothing happened, ears askew
  // opt (the introduction film): sit: false skids to a stop on her feet and turns to the lens
  // standing (a 3/4 turn over 0.2 s) instead of cutting to the sitting pose
  'zoomies-dash': (c, T, m0, { sit = true } = {}) => {
    const ret = Math.max(m0 + 1.0, T.e - 0.65),
      stop = ret + 0.42
    c.k.set('mode', m0, 'stand')
    c.k.set('yaw', m0, 90)
    c.k.set('flip', m0, 1)
    c.k.set('head.yaw', m0, -20)
    setTail(c, m0, 'streak')
    c.k.seq('x', [
      [m0, 0],
      [m0 + 0.35, 1100, 'in'],
      [ret - 0.01, 1100],
      [ret, -1100, 'linear'],
      [stop, 30, 'out'],
    ])
    c.k.seq('walk.phase', [
      [m0, 0],
      [m0 + 0.35, 2.4, 'linear'],
      [ret, 2.4],
      [stop, 5.6, 'out'],
    ])
    c.k.seq('walk.amt', [
      [m0, 1.5],
      [stop - 0.15, 1.5],
      [stop, 0, 'out'],
    ])
    c.k.seq('lean', [[stop - 0.18], [stop - 0.05, 14, 'out'], [stop + 0.15, 0, 'inOut']])
    prop(c, {
      kind: 'streaks',
      layer: 'back',
      t0: m0,
      t1: stop + 0.2,
      v: [
        [m0, 0],
        [m0 + 0.3, 3000, 'in'],
        [m0 + 0.36, 0, 'linear'],
        [ret, 3000, 'linear'],
        [stop, 0, 'out'],
      ],
    })
    if (sit) settle(c, stop + 0.02, 0.16)
    else {
      c.k.seq('yaw', [[stop + 0.04], [stop + 0.24, 32, 'inOut']])
      c.k.seq('head.yaw', [[stop + 0.02], [stop + 0.2, 0, 'inOut']])
    }
    c.k.seq('x', [[stop + 0.05], [stop + 0.3, 0, 'out']])
    c.add.pulse('ears.L.rot', stop, stop + 0.06, T.e + 0.5, T.e + 0.9, 26)
    c.add.pulse('ears.R.rot', stop, stop + 0.06, T.e + 0.5, T.e + 0.9, -12)
    c.ex.push(
      { t: m0, name: 'delighted', ms: 80 },
      { t: stop, name: 'saucer', ms: 70 },
      { t: stop + 0.25, name: 'meant-it', ms: 200 },
    )
    c.sfx.push(
      { kind: 'whoosh', at: m0 + 0.05, gainDb: -4 },
      { kind: 'whoosh', at: ret, gainDb: -4 },
      { kind: 'boing', at: stop, gainDb: -9 },
    )
  },
  // grooming a paw: licks before the line, paw hovering under her chin while she talks (busy), more
  // licks after; the embarrassed-grooming recovery when it follows a fail
  groom: (c, T, m0) => {
    c.k.seq('paw.groom', [
      [m0 - 0.2],
      [m0 + 0.05, 1, 'out'],
      [T.v + 0.05],
      [T.v + 0.25, 0.6, 'inOut'],
      [T.e - 0.2],
      [T.e, 1, 'out'],
      [T.e + 0.4],
      [T.e + 0.65, 0, 'inOut'],
    ])
    const lick = (a) => [
      [a, 1, 'out'],
      [a + 0.1, 0, 'in'],
    ]
    c.k.seq('mouth.tongue', [
      [m0],
      ...lick(m0 + 0.06),
      ...lick(m0 + 0.24),
      [T.e],
      ...lick(T.e + 0.02),
      ...lick(T.e + 0.2),
    ])
    c.add.pulse('head.pitch', m0 - 0.2, m0 + 0.05, T.v, T.v + 0.2, 10)
    c.add.pulse('head.pitch', T.e - 0.2, T.e, T.e + 0.35, T.e + 0.6, 10)
    c.add.pulse('head.roll', m0 - 0.2, m0 + 0.05, T.e + 0.35, T.e + 0.6, -7)
    c.ex.push(
      { t: m0 - 0.15, name: 'meant-it', ms: 160 },
      { t: T.v + 0.1, name: 'smug-lids', ms: 200 },
    )
  },
  // she sits on your open notebook, the most comfortable thing in the room, and looks very pleased
  'sit-on-notes': (c, T, m0) => {
    prop(c, {
      kind: 'notebook',
      layer: 'back',
      t0: m0 - 0.2,
      t1: 1e9,
      s: [
        [m0 - 0.2, 0],
        [m0 - 0.05, 1, 'outBack'],
      ],
    })
    c.k.seq('crouch', [[m0 - 0.05], [m0 + 0.05, 0.5, 'in'], [m0 + 0.1, 0, 'out']])
    c.k.seq('rise', [[m0 + 0.06], [m0 + 0.2, 70, 'out'], [m0 + 0.34, 0, 'in']])
    c.k.seq('y', [[m0 + 0.2], [m0 + 0.34, -16, 'out']])
    squash(c, m0 + 0.34, 0.14, 0.34)
    c.ex.push({ t: m0 + 0.4, name: 'smug-lids', ms: 240 })
    c.sfx.push(
      { kind: 'whoosh', at: m0 + 0.06, gainDb: -10 },
      { kind: 'crinkle', at: m0 + 0.34, gainDb: -10 },
    )
  },
  // tail-up hello: a trot across with the tail hooked like a "?", one chirp, and back
  'question-walk': (c, T, m0) => {
    const half = Math.max(0.6, (T.e - 0.2 - m0) / 2),
      mid = m0 + half,
      end = mid + half
    c.k.set('mode', m0, 'stand')
    c.k.set('yaw', m0, 90)
    c.k.set('flip', m0, 1)
    c.k.set('head.yaw', m0, -55)
    setTail(c, m0, 'walkQ')
    walkKeys(c, m0, mid - 0.1, 0, 230, half * 2.6, 1.1)
    c.k.set('flip', mid, -1)
    walkKeys(c, mid + 0.05, end - 0.05, 230, 0, half * 2.6, 1.1)
    c.k.seq('x', [[end + 0.1], [end + 0.3, 0, 'inOut']]) // walkKeys overshoots by a step
    settle(c, end + 0.02, 0.1)
    c.sfx.push({ kind: 'blip', at: m0 + 0.2, gainDb: -6 })
  },
  // the airplane-ear hunker: flattened into a low loaf, eyes like saucers (ears up while she talks:
  // airplane ears only with a closed mouth)
  hunker: (c, T, m0) => {
    c.k.seq('crouch', [[m0 - 0.12], [m0, 0.6, 'in']])
    c.k.set('mode', m0 + 0.02, 'loaf')
    c.k.seq('crouch', [[m0 + 0.03, 0]])
    setTail(c, m0 + 0.02, 'loaf')
    c.k.seq('sy', [[m0 + 0.02], [m0 + 0.2, 0.86, 'out']])
    c.ex.push({ t: m0 - 0.1, name: 'saucer', ms: 100 })
    for (const s of ['L', 'R'])
      c.k.seq(`ears.${s}.fold`, [
        [m0 - 0.15],
        [m0, 0.95, 'out'],
        [T.v - 0.02],
        [T.v + 0.2, 0.3, 'inOut'],
        [T.e - 0.1],
        [T.e + 0.15, 0, 'inOut'],
      ])
    c.cam.lift = [
      [m0, 0],
      [m0 + 0.3, 140, 'inOut'],
      [T.e - 0.1, 140],
      [T.e + 0.2, 0, 'inOut'],
    ]
    // up again with the ears, so the payoff blink is from a sitting cat
    c.k.seq('sy', [[T.e - 0.15], [T.e + 0.05, 1, 'inOut']])
    settle(c, T.e + 0.05, 0.08)
    c.sfx.push({ kind: 'thud', at: m0 + 0.05, gainDb: -10 })
  },
  // a moth beyond the window: eyes locked on it, jaw trembling ("ekekek"); she turns it into a yawn
  chatter: (c, T, m0) => {
    prop(c, {
      kind: 'moth',
      layer: 'front',
      t0: m0 - 0.3,
      t1: T.e + 0.6,
      x: [
        [m0 - 0.3, 620],
        [m0 + 0.2, 300, 'out'],
        [T.e + 0.6, 420],
      ],
      y: [
        [m0 - 0.3, -720],
        [m0 + 0.2, -640, 'out'],
        [T.e + 0.6, -760],
      ],
    })
    c.ex.push({ t: m0 - 0.1, name: 'chatter', ms: 120 })
    c.add.wave('mouth.open', m0 - 0.1, T.v + 0.02, 0.2, 0.08)
    c.add.wave('mouth.open', T.e - 0.05, T.e + 0.3, 0.2, 0.08)
    c.k.seq('tail.wave', [[m0], [m0 + 0.2, 12]])
    c.ex.push({ t: T.e + 0.3, name: 'yawn', ms: 160 })
    for (let t = m0 - 0.05; t < T.v; t += 0.07) c.sfx.push({ kind: 'tick', at: t, gainDb: -12 })
    for (let t = T.e; t < T.e + 0.3; t += 0.07) c.sfx.push({ kind: 'tick', at: t, gainDb: -12 })
  },
  // the honest tail: it sneaks up into view, her eyes follow it, one swat, it is gone, nothing happened
  'tail-notice': (c, T, m0) => {
    const t1 = Math.max(m0 + 0.4, beat(T, 0.7)),
      sw = t1 + 0.45
    c.k.tail(t1 - 0.3, t1 + 0.1, 'notice')
    c.k.seq('tail.wave', [[t1 - 0.3], [t1, 14]])
    eyes(c, [
      [t1, 0],
      [t1 + 0.12, -0.9, 'out'],
      [sw + 0.2, -0.9],
      [sw + 0.3, 0, 'out'],
    ])
    for (const s of ['L', 'R'])
      c.add.layer(`eyes.${s}.py`, [
        [t1, 0],
        [t1 + 0.12, -0.3, 'out'],
        [sw + 0.2, -0.3],
        [sw + 0.3, 0, 'out'],
      ])
    c.k.seq('paw.lift', [[sw - 0.12], [sw, 0.75, 'out'], [sw + 0.12], [sw + 0.3, 0, 'inOut']])
    c.k.seq('paw.side', [[sw - 0.12], [sw, 0.35, 'out'], [sw + 0.12], [sw + 0.3, 0, 'inOut']])
    c.k.tail(sw + 0.02, sw + 0.25, 'wrap', 'out')
    c.ex.push({ t: t1, name: 'fixated', ms: 100 }, { t: sw + 0.3, name: 'innocent', ms: 100 })
    c.sfx.push({ kind: 'tick', at: sw, gainDb: -6 })
  },
  // the gift: she dips for the toy mouse, talks round it, and drops it for you on the last word
  carry: (c, T, m0) => {
    const drop = Math.max(T.v + 0.4, beat(T, 0.05))
    c.add.pulse('head.dy', m0 - 0.25, m0 - 0.05, m0 + 0.02, m0 + 0.22, 70)
    c.add.pulse('head.pitch', m0 - 0.25, m0 - 0.05, m0 + 0.02, m0 + 0.22, 24)
    prop(c, { kind: 'mouse', layer: 'front', t0: 0, t1: m0 - 0.02, x: 30, y: 0 })
    prop(c, {
      kind: 'mouse',
      layer: 'front',
      attach: 'mouth',
      t0: m0 - 0.02,
      t1: drop,
      x: 0,
      y: 10,
      rot: [
        [m0, -10],
        [drop, 6],
      ],
    })
    prop(c, {
      kind: 'mouse',
      layer: 'front',
      t0: drop,
      t1: 1e9,
      x: [
        [drop, 0],
        [drop + 0.3, 40, 'out'],
      ],
      y: [
        [drop, -230],
        [drop + 0.3, 0, 'in'],
      ],
      rot: [
        [drop, 0],
        [drop + 0.3, 20],
      ],
    })
    c.ex.push({ t: drop + 0.1, name: 'proud', ms: 200 })
    c.sfx.push(
      { kind: 'blip', at: m0 - 0.05, gainDb: -10 },
      { kind: 'thud', at: drop + 0.3, gainDb: -12 },
    )
  },
  // ---- food (the inventory's food items stand on the floor beside her)
  // sniff-sniff, cross-eyed, before and after the line, her nose bowed to the floor in front
  sniff: (c, T, m0) => {
    const down = (a, b) => {
      c.add.pulse('head.dy', a, a + 0.18, b - 0.1, b + 0.1, 100)
      c.add.pulse('head.pitch', a, a + 0.18, b - 0.1, b + 0.1, 28)
      c.add.pulse('crouch', a, a + 0.18, b - 0.1, b + 0.1, 0.3)
      pulses(c, 'head.dy', a + 0.15, Math.max(2, Math.round((b - a) / 0.13)), 0.13, -6)
    }
    down(m0 - 0.25, T.v + 0.05)
    down(T.e - 0.05, T.e + 0.4)
    c.ex.push(
      { t: m0 - 0.2, name: 'cross-eyed', ms: 120 },
      { t: T.v + 0.05, name: 'fixated', ms: 200 },
      { t: T.e - 0.05, name: 'cross-eyed', ms: 120 },
    )
    c.add.wave('whisk.ang', m0 - 0.2, T.e + 0.4, 6, 0.13)
    for (const a of [m0 - 0.15, m0 - 0.02, m0 + 0.11, T.e + 0.05, T.e + 0.18])
      c.sfx.push({ kind: 'tick', at: a, gainDb: -14 })
  },
  // head down in the bowl, chomping, > < eyes; she talks with her mouth full, then dives back in
  eat: (c, T, m0) => {
    c.add.pulse('head.dy', m0 - 0.25, m0, T.v - 0.05, T.v + 0.15, 115)
    c.add.pulse('head.pitch', m0 - 0.25, m0, T.v - 0.05, T.v + 0.15, 30)
    c.add.pulse('crouch', m0 - 0.25, m0, T.v - 0.05, T.v + 0.15, 0.35)
    c.add.pulse('head.dy', T.e - 0.1, T.e + 0.1, T.e + 0.5, T.e + 0.7, 115)
    c.add.pulse('head.pitch', T.e - 0.1, T.e + 0.1, T.e + 0.5, T.e + 0.7, 30)
    c.add.pulse('crouch', T.e - 0.1, T.e + 0.1, T.e + 0.5, T.e + 0.7, 0.35)
    c.add.wave('mouth.open', m0 - 0.15, T.e + 0.6, 0.16, 0.18)
    c.add.wave('head.roll', m0 - 0.15, T.e + 0.6, 3, 0.36)
    c.ex.push(
      { t: m0 - 0.2, name: 'squeeze', ms: 140 },
      { t: T.v, name: 'delighted', ms: 160 },
      { t: T.e - 0.1, name: 'squeeze', ms: 140 },
    )
    c.k.seq('tail.wave', [[m0], [m0 + 0.3, 8]])
    for (let a = m0 - 0.1; a < T.v; a += 0.18) c.sfx.push({ kind: 'tick', at: a, gainDb: -14 })
  },
  // the treat tube held out from screen-left: tongue flicking at it, paw clutching, eyes > <
  'lick-treat': (c, T, m0) => {
    prop(c, {
      kind: 'tube',
      layer: 'front',
      t0: m0 - 0.4,
      t1: T.e + 0.75,
      x: [[m0 - 0.4, -700], [m0 - 0.15, -215, 'out'], [T.e + 0.5], [T.e + 0.75, -700, 'in']],
      y: -235,
      rot: 72,
    })
    c.k.seq('paw.groom', [[m0 - 0.2], [m0, 0.5, 'out'], [T.e + 0.45], [T.e + 0.65, 0, 'inOut']])
    const flick = (a, b) => {
      const k = []
      for (let t = a; t < b - 0.08; t += 0.14) k.push([t, 1, 'out'], [t + 0.07, 0.2, 'in'])
      return k
    }
    c.k.seq('mouth.tongue', [
      [m0 - 0.15],
      ...flick(m0 - 0.12, T.v),
      [T.v, 0],
      [T.e],
      ...flick(T.e + 0.02, T.e + 0.5),
      [T.e + 0.5, 0],
    ])
    c.add.pulse('head.roll', m0 - 0.3, m0, T.e + 0.4, T.e + 0.6, -8)
    c.add.pulse('head.dx', m0 - 0.3, m0, T.e + 0.4, T.e + 0.6, -12)
    c.ex.push(
      { t: m0 - 0.15, name: 'squeeze', ms: 120 },
      { t: T.v, name: 'fixated', ms: 160 },
      { t: T.e, name: 'squeeze', ms: 120 },
    )
  },
  // a sniff, then the flehmen recoil: mouth open, lip curled, head pulled back from the smell
  flehmen: (c, T, m0) => {
    c.add.pulse('head.dy', m0 - 0.3, m0 - 0.12, m0 - 0.05, m0 + 0.05, 40)
    c.add.pulse('head.pitch', m0 - 0.3, m0 - 0.12, m0 - 0.05, m0 + 0.05, 16)
    c.add.pulse('head.dy', m0 + 0.05, m0 + 0.15, T.v + 0.35, T.v + 0.6, -22)
    c.ex.push(
      { t: m0 - 0.3, name: 'cross-eyed', ms: 100 },
      { t: m0 + 0.04, name: 'flehmen', ms: 90 },
      { t: T.v + 0.3, name: 'offended', ms: 220 },
    )
    c.sfx.push(
      { kind: 'tick', at: m0 - 0.25, gainDb: -14 },
      { kind: 'tick', at: m0 - 0.13, gainDb: -14 },
      { kind: 'boing', at: m0 + 0.06, gainDb: -14 },
    )
  },
})

Object.assign(REACTIONS, {
  // startled: the pupils bloom at the number, a hop on the spot, and she pretends to be calm
  'pupils-bloom': (c, r0, r1) => {
    c.ex.push(
      { t: r0, name: 'saucer', ms: 60, ease: 'out' },
      { t: r1 - 0.3, name: 'meant-it', ms: 200 },
    )
    c.k.seq('rise', [[r0 + 0.02], [r0 + 0.16, 50, 'out'], [r0 + 0.3, 0, 'in']])
    squash(c, r0 + 0.3, 0.1, 0.3)
    c.k.tail(r0, r0 + 0.15, 'straight', 'out')
    c.k.tail(r1 - 0.3, r1, 'wrap')
    c.sfx.push({ kind: 'boing', at: r0 + 0.02, gainDb: -8 })
  },
  // hungry: she leans up to sniff the number, as if it might be food
  'sniff-at': (c, r0, r1) => {
    eyesUp(c, r0, r1 - 0.1, -0.5)
    c.add.pulse('head.pitch', r0, r0 + 0.2, r1 - 0.2, r1, -14)
    c.k.seq('sy', [[r0], [r0 + 0.2, 1.05, 'out'], [r1 - 0.2], [r1, 1, 'inOut']])
    pulses(c, 'head.dy', r0 + 0.2, 4, 0.13, -6)
    c.ex.push({ t: r0, name: 'cross-eyed', ms: 120 }, { t: r1 - 0.25, name: 'smug-lids', ms: 200 })
    for (let i = 0; i < 3; i++) c.sfx.push({ kind: 'tick', at: r0 + 0.25 + i * 0.13, gainDb: -14 })
  },
  // hungry, alternate: the fixated stare and a tail tip that will not stop
  fixate: (c, r0, r1) => {
    c.ex.push({ t: r0, name: 'fixated', ms: 160 })
    eyesUp(c, r0, r1, -0.75)
    c.k.seq('tail.wave', [[r0], [r0 + 0.2, 14], [r1], [r1 + 0.3, 3]])
    c.add.wave('lean', r0 + 0.2, r1, 2, 0.34)
  },
  // picky: a sniff at the number, the flehmen recoil
  'flehmen-recoil': (c, r0, r1) => {
    eyesUp(c, r0, r0 + 0.35, -0.5)
    c.ex.push(
      { t: r0, name: 'cross-eyed', ms: 100 },
      { t: r0 + 0.35, name: 'flehmen', ms: 90 },
      { t: r1 - 0.25, name: 'neutral', ms: 200 },
    )
    c.add.pulse('head.dy', r0 + 0.35, r0 + 0.45, r1 - 0.3, r1, -20)
    c.sfx.push(
      { kind: 'tick', at: r0 + 0.1, gainDb: -14 },
      { kind: 'tick', at: r0 + 0.22, gainDb: -14 },
    )
  },
  // picky, alternate: mock offence, leaning back from it
  'offended-lean': (c, r0, r1) => {
    c.ex.push({ t: r0 + 0.1, name: 'offended', ms: 200 })
    c.k.seq('lean', [[r0 + 0.1], [r0 + 0.35, 5, 'out'], [r1 - 0.15], [r1 + 0.1, 0, 'inOut']])
    c.add.pulse('head.dy', r0 + 0.1, r0 + 0.35, r1 - 0.15, r1 + 0.1, -12)
  },
  // guilty: she looks away from the number, then slides her eyes back to you
  'guilty-glance': (c, r0, r1) => {
    c.ex.push(
      { t: r0, name: 'averted', ms: 200 },
      { t: r0 + 0.55, name: 'guilty', ms: 200 },
      { t: r1 - 0.2, name: 'neutral', ms: 200 },
    )
  },
  // guilty, alternate: "I meant to do that", a slow chin-up nod
  'meant-it-nod': (c, r0, r1) => {
    c.ex.push({ t: r0 + 0.1, name: 'meant-it', ms: 260 })
    c.add.pulse('head.pitch', r0 + 0.1, r0 + 0.35, r1 - 0.2, r1, -8)
  },
})

// ------------------------------------------------------------------ payoffs (all end on the slow blink)
// (c, pay) -> the time the blink starts
export const PAYOFFS = {
  blink: (c, pay) => {
    const b = pay + 0.45
    c.ex.push(
      { t: pay, name: 'loving', ms: 300, ease: 'out' },
      { t: b, name: 'slowblink', ms: 420, ease: 'in' },
      { t: b + 0.75, name: 'loving', ms: 380, ease: 'out' },
    )
    return b
  },
  'blep-blink': (c, pay) => {
    const b = pay + 0.85
    c.k.seq('mouth.tongue', [[pay], [pay + 0.08, 1, 'out'], [b - 0.12], [b - 0.04, 0, 'in']])
    c.ex.push(
      { t: pay, name: 'blep', ms: 90, ease: 'out' },
      { t: b, name: 'slowblink', ms: 420, ease: 'in' },
      { t: b + 0.75, name: 'loving', ms: 380, ease: 'out' },
    )
    c.sfx.push({ kind: 'blip', at: pay + 0.05, gainDb: -6 })
    return b
  },
  // caught being nice: the slow blink, then she looks away as if it didn't happen
  'look-away': (c, pay) => {
    const b = pay + 0.35
    c.ex.push(
      { t: pay, name: 'loving', ms: 300, ease: 'out' },
      { t: b, name: 'slowblink', ms: 420, ease: 'in' },
      { t: b + 0.8, name: 'proud', ms: 380, ease: 'out' },
    )
    c.k.seq('head.yaw', [[b + 0.8], [b + 1.05, -24, 'inOut']])
    for (const s of ['L', 'R'])
      c.add.layer(`eyes.${s}.px`, [
        [b + 0.8, 0],
        [b + 0.95, -0.8, 'out'],
        [b + 3, -0.8],
      ])
    c.extraHold = 0.25
    return b
  },
  'purr-blink': (c, pay) => {
    const b = pay + 0.6
    c.ex.push(
      { t: pay, name: 'purr', ms: 300 },
      { t: b, name: 'slowblink', ms: 420, ease: 'in' },
      { t: b + 0.75, name: 'loving', ms: 380, ease: 'out' },
    )
    c.add.wave('head.roll', pay, b + 0.8, 4, 1.1)
    c.sfx.push({ kind: 'purr', at: pay, seconds: 1.6, gainDb: -4 })
    return b
  },
}

// ------------------------------------------------------------------ camera
// z is a zoom that keeps her face where it is on screen; roll in degrees; dx a horizontal drift
export const CAMERAS = {
  'push-in': (c, R, T, b) => ({
    z: [
      [0, 1],
      [R, 1],
      [T.v + 0.4, 1.1, 'inOut'],
      [b - 0.2, 1.1],
      [b + 0.5, 1.2, 'inOut'],
    ],
  }),
  snap: (c, R, T, b) => ({
    z: [
      [0, 1],
      [R - 0.02, 1],
      [R + 0.16, 1.16, 'out'],
      [T.v - 0.25, 1.16],
      [T.v + 0.15, 1.06, 'inOut'],
      [b - 0.1, 1.06],
      [b + 0.12, 1.24, 'out'],
    ],
  }),
  dutch: (c, R, T, b) => ({
    z: [
      [0, 1.02],
      [T.v + 0.4, 1.1, 'inOut'],
      [b + 0.5, 1.18, 'inOut'],
    ],
    roll: [
      [0, 6],
      [R - 0.12, 6],
      [R + 0.3, 0, 'outBack'],
    ],
  }),
  shake: (c, R, T, b) => {
    c.cam.shakes.push(R + (c.num.mode === 'slam' ? 0.13 : 0), b + 0.1)
    return {
      z: [
        [0, 1],
        [T.v, 1],
        [T.v + 0.4, 1.1, 'inOut'],
        [b + 0.5, 1.16, 'inOut'],
      ],
    }
  },
  'dolly-out': (c, R, T, b) => ({
    z: [
      [0, 1.5],
      [0.3, 1.5],
      [R - 0.1, 1, 'inOut'],
      [T.v + 0.4, 1.08, 'inOut'],
      [b + 0.5, 1.18, 'inOut'],
    ],
  }),
  drift: (c, R, T, b, end) => ({
    z: [
      [0, 1.03],
      [b + 0.5, 1.13, 'inOut'],
    ],
    dx: [
      [0, -36],
      [end, 36, 'linear'],
    ],
  }),
}

// ------------------------------------------------------------------ the whole film
export { END_LEN }
// VT is the voice's own timing (seconds from the start of the voice file); the score decides when
// the line starts (v) and shifts it. tight (0..1) trims the reaction and payoff of a long line;
// pad stretches the payoff hold of a short one.
// The plan names each part; only a function registered in its own table is ever called.
const part = (table, name, what) => {
  if (!Object.hasOwn(table, name) || typeof table[name] !== 'function')
    throw new Error(`no ${what} called "${name}"`)
  return table[name]
}
export function buildScore(plan, VT, { pad = 0, tight = 0, endStyle } = {}) {
  const c = {
    plan,
    base: { mode: 'sit' },
    k: new Keys(),
    add: new Adds(),
    ex: [],
    sfx: [],
    fx: {
      flashes: [],
      impacts: [],
      zzz: [],
      ledge: false,
      confetti: null,
      sparkles: [],
      poof: null,
    },
    cam: { shakes: [], bumps: [] },
  }
  // entrance
  const entEnd = part(ENTRANCES, plan.entrance, 'entrance')(c)
  const R = Math.max(1.9, entEnd + 0.08)
  const v = +Math.max(3.0 - tight * 0.25, R + 1.05 - tight * 0.2).toFixed(3)
  const sh = (x) => x + v
  const T = {
    v,
    e: v + VT.end,
    words: VT.words.map((w) => ({ ...w, t0: sh(w.t0), t1: sh(w.t1) })),
    sents: VT.sents.map((x) => ({ t0: sh(x.t0), t1: sh(x.t1) })),
    purr: VT.purr ? VT.purr.map(sh) : null,
    whisper: VT.whisper == null ? null : sh(VT.whisper),
  }
  // the number
  const n = plan.day
  const mode = plan.reveal === 'count' && n < 3 ? 'pop' : plan.reveal
  c.num = {
    at: R,
    mode,
    value: n,
    from: mode === 'count' ? Math.max(1, n - 40) : n,
    countFrom: 0.1,
  }
  if (mode === 'pop')
    c.sfx.push({ kind: 'pop', at: R, gainDb: 0 }, { kind: 'sparkle', at: R + 0.06, gainDb: -9 })
  if (mode === 'slam') {
    c.sfx.push(
      { kind: 'whoosh', at: R - 0.06, gainDb: -6 },
      { kind: 'thud', at: R + 0.13, gainDb: 0 },
      { kind: 'pop', at: R + 0.14, gainDb: -6 },
    )
    c.cam.shakes.push(R + 0.13)
  }
  if (mode === 'count') {
    const ticks = [],
      a = c.num.from,
      bN = n - 1
    for (let v = a + 1; v <= bN; v++) {
      const u = 1 - Math.pow(1 - (v - a) / Math.max(1, bN - a + 1), 1 / 2.2)
      ticks.push([c.num.countFrom + u * (R - c.num.countFrom), (v - a) / Math.max(1, bN - a)])
    }
    c.sfx.push(
      { kind: 'counter', ticks, gainDb: -7 },
      { kind: 'pop', at: R, gainDb: 0 },
      { kind: 'ding', at: R + 0.05, gainDb: -10 },
    )
  }
  if (plan.extras.confetti) {
    c.fx.confetti = R
    c.sfx.push({ kind: 'confetti', at: R, gainDb: -4 })
  }
  if (plan.extras.sparkles) c.fx.sparkles.push([R + 0.1, 540, 470])
  // reaction: from just after the reveal to just before the line
  const r0 = R + 0.1 + (mode === 'slam' ? 0.1 : 0),
    m0 = T.v - 0.3
  part(REACTIONS, plan.reaction, 'reaction')(c, r0, m0 - 0.05)
  // outfit: a poof hides the change (on the word for the hoodie line, before the line otherwise)
  if (plan.outfit) {
    const at = plan.quip.id === 'ms-10-a' && T.sents.length > 1 ? T.sents[1].t0 - 0.05 : m0 - 0.1
    c.k.set('outfit', at + 0.12, plan.outfit)
    c.fx.poof = at
    c.sfx.push({ kind: 'pop', at, gainDb: -4 }, { kind: 'sparkle', at: at + 0.1, gainDb: -10 })
  }
  // the line: the quip's face, warm on the last sentence, the signature move under it
  const face0 = FACE[plan.quip.expression] || 'neutral'
  const face = NOT_AT_VIEWER.has(face0) ? 'neutral' : face0
  c.ex.push({ t: m0 + 0.05, name: face, ms: 260 })
  part(MOVE_IMPL, plan.move, 'move')(c, T, m0)
  if (T.sents.length > 1 && !['slow-blink', 'blep', 'innocent-stare'].includes(plan.move)) {
    const warm = CHARACTER.schedule.stingPools.includes(plan.quip.pool)
      ? TEASE_CLOSE[plan.quip.target] || 'proud'
      : face === 'loving' || face === 'purr'
        ? face
        : WARM[plan.quip.pool] || 'proud'
    if (warm !== face) c.ex.push({ t: lastSent(T).t0 - 0.05, name: warm, ms: 280 })
  }
  // a leading purr-word: the purr face over it
  if (T.purr)
    c.ex.push(
      { t: T.purr[0] - 0.08, name: 'purr', ms: 220 },
      { t: T.purr[1] + 0.02, name: face === 'purr' ? 'loving' : face, ms: 220 },
    )
  // milestone extras
  if (plan.extras.bow && T.sents.length > 2) {
    const s = T.sents[1].t0
    c.add.pulse('head.pitch', s, s + 0.3, T.sents[2].t0 - 0.1, T.sents[2].t0 + 0.15, 16)
    c.k.seq('crouch', [
      [s],
      [s + 0.3, 0.35, 'inOut'],
      [T.sents[2].t0 - 0.1],
      [T.sents[2].t0 + 0.15, 0, 'out'],
    ])
  }
  let whisperAt = Infinity
  if (T.whisper !== null && T.whisper !== undefined) {
    whisperAt = T.whisper
    c.ex.push({ t: whisperAt - 0.3, name: 'whisper', ms: 280 })
    c.add.pulse('head.dy', whisperAt - 0.35, whisperAt, T.e + 0.3, T.e + 0.7, 16)
    c.add.pulse('head.s', whisperAt - 0.35, whisperAt, T.e + 0.3, T.e + 0.7, 0.06)
  }
  // payoff
  const pay = T.e + 0.2 - tight * 0.1
  const b = part(PAYOFFS, plan.payoff, 'payoff')(c, pay)
  for (const s of ['L', 'R'])
    c.k.seq(`ears.${s}.fold`, [
      [b - 0.05],
      [b + 0.25, 0.25, 'out'],
      [b + 0.7],
      [b + 1.0, 0, 'inOut'],
    ])
  c.sfx.push({ kind: 'sparkle', at: b + 0.2, gainDb: -11 })
  const endAt = b + 1.1 + (c.extraHold || 0) + pad - tight * 0.25
  // idle: a breath under everything, and the tail tip never fully stops
  c.add.wave('head.dy', 0, endAt + 2, 1.6, 2.6)
  c.k.seq('tail.phase', [
    [0, 0],
    [endAt + 2, (endAt + 2) * 1.2, 'linear'],
  ])
  // blinks between the acted ones (none while asleep)
  const blinks = [entEnd - 0.25, m0 - 0.05, T.v + (T.e - T.v) * 0.55].filter(
    (t) => t > (plan.entrance === 'wake-up' ? 0.7 : 0.3),
  )
  // camera
  const cam = part(CAMERAS, plan.camera, 'camera')(c, R, T, b, endAt)
  if (whisperAt < Infinity)
    cam.z = [
      ...cam.z.filter((k) => k[0] < whisperAt - 0.35),
      [whisperAt - 0.35, trk(cam.z, whisperAt - 0.35)],
      [whisperAt + 0.05, 1.38, 'inOut'],
      [pay + 0.3, 1.38],
      [b + 0.5, 1.3, 'inOut'],
    ]
  cam.shakes = c.cam.shakes
  cam.bumps = c.cam.bumps
  cam.lift = c.cam.lift || null
  // end card sounds
  c.sfx.push(...endSfx(styleOf(endStyle), endAt))
  const keys = c.k.k
  return {
    endAt,
    duration: +(endAt + END_LEN).toFixed(3),
    base: c.base,
    expr: c.ex,
    keys,
    add: c.add.bake(endAt + END_LEN + 0.1),
    blinks,
    springs: SPRINGS,
    couple: COUPLE,
    cam,
    num: c.num,
    fx: c.fx,
    sfx: c.sfx,
    whisperAt,
    R,
    entEnd,
    blink: b,
    pay,
    T,
  }
}
