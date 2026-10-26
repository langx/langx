// Venus animator: turns a score (keyframes on named rig parameters) into one pose per frame.
//
//   const A = VenusAnim.create(score);   // score: see README
//   const pose = A.at(frameIndex);        // frames must be asked for in order (springs are stepped)
//   const poses = VenusAnim.bake(score);  // every frame at once
//
// Layers, applied in this order on top of Venus.DEFAULT:
//   base    partial pose for the whole shot
//   expr    [{ t, name, ms, ease }]  expression presets (Venus.EXPR) crossfaded over ms
//   keys    { 'head.roll': [[t, v, ease], ...] }  absolute values; strings step (e.g. 'mode')
//   add     { 'head.dy': [[t, v, ease], ...] }    additive offsets, zero outside their range
//   blinks  [t, ...]                               quick blinks layered over whatever the lids do
//   springs { 'ears.L.rot': { k, z } }             the output lags the target: overlap + follow-through
//   couple  [{ from, to, gain }]                   a change in `from` kicks spring `to` (inertia)
//
// Everything is a pure function of the score except the springs, which are stepped on a fixed grid
// from t = 0 (SUB steps per frame), so any frame can be reproduced by stepping up to it.
;(function (root) {
  'use strict'
  const V = root.Venus || (typeof require !== 'undefined' ? require('./venus-rig.js') : null)
  const EASE = {
    linear: (t) => t,
    step: (t) => (t >= 1 ? 1 : 0),
    hold: () => 0,
    inOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => {
      const c1 = 2.2,
        c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    },
    inBack: (t) => {
      const c1 = 1.9
      return (c1 + 1) * t * t * t - c1 * t * t
    },
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  }
  const ease = (n) => EASE[n] || EASE.inOut
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o)
  function set(o, p, v) {
    const ks = p.split('.')
    let a = o
    for (let i = 0; i < ks.length - 1; i++) {
      if (a[ks[i]] == null) a[ks[i]] = {}
      a = a[ks[i]]
    }
    a[ks[ks.length - 1]] = v
  }
  function trk(keys, t) {
    if (t <= keys[0][0]) return keys[0][1]
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i]
      if (t < b[0]) {
        const a = keys[i - 1]
        if (typeof a[1] !== 'number') return a[1]
        const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0])
        return a[1] + (b[1] - a[1]) * ease(b[2])(k)
      }
    }
    return keys[keys.length - 1][1]
  }
  // numeric leaves of two poses blended; non-numbers switch at w > 0.5
  function blend(a, b, w) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * w
    if (a && b && typeof a === 'object' && !Array.isArray(a)) {
      const o = {}
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
        o[k] = k in b ? (k in a ? blend(a[k], b[k], w) : b[k]) : a[k]
      return o
    }
    return w > 0.5 ? b : a
  }

  function create(score) {
    const FPS = score.fps || 30,
      SUB = 4,
      DT = 1 / (FPS * SUB)
    const base = score.base || {}
    const exprs = (score.expr || []).slice().sort((a, b) => a.t - b.t)
    const exprCache = {}
    const fp = (n) =>
      (exprCache[n] = exprCache[n] || V.merge(V.pose(base), V.clone(V.EXPR[n] || {})))
    function rawAt(t) {
      // expression crossfade
      let P = fp('neutral')
      for (const e of exprs) {
        if (t < e.t) break
        const k = Math.min(1, ((t - e.t) * 1000) / Math.max(1, e.ms ?? 180))
        P = k >= 1 ? fp(e.name) : blend(P, fp(e.name), ease(e.ease || 'inOut')(k))
      }
      P = V.clone(P)
      for (const [p, keys] of Object.entries(score.keys || {})) set(P, p, trk(keys, t))
      for (const [p, keys] of Object.entries(score.add || {})) {
        if (t < keys[0][0] || t > keys[keys.length - 1][0]) continue
        const v = get(P, p)
        if (typeof v === 'number') set(P, p, v + trk(keys, t))
      }
      // blinks: 70 ms down, 110 ms up
      for (const b of score.blinks || []) {
        const d = t - b
        if (d < 0 || d > 0.18) continue
        const c = d < 0.07 ? d / 0.07 : 1 - (d - 0.07) / 0.11
        for (const s of ['L', 'R'])
          P.eyes[s].lid = Math.max(P.eyes[s].lid, Math.min(1 - (P.eyes[s].low || 0) * 0.7, c))
      }
      return P
    }
    const springs = Object.entries(score.springs || {}).map(([path, c]) => ({
      path,
      k: c.k || 120,
      z: c.z ?? 0.5,
      y: null,
      v: 0,
    }))
    const sp = Object.fromEntries(springs.map((s) => [s.path, s]))
    const couples = score.couple || []
    let step = -1,
      last = null,
      prevRaw = null
    function advance() {
      step++
      const t = step * DT,
        R = rawAt(t)
      for (const s of springs) {
        const x = get(R, s.path)
        if (typeof x !== 'number') continue
        if (s.y === null) {
          s.y = x
          s.v = 0
          continue
        }
        const a = s.k * (x - s.y) - 2 * s.z * Math.sqrt(s.k) * s.v
        s.v += a * DT
        s.y += s.v * DT
      }
      if (prevRaw)
        for (const c of couples) {
          const a = get(R, c.from),
            b = get(prevRaw, c.from),
            S = sp[c.to]
          if (S && typeof a === 'number' && typeof b === 'number' && S.y !== null)
            S.v += ((c.gain * (a - b)) / DT) * 0.06
        }
      prevRaw = R
      for (const s of springs) if (s.y !== null) set(R, s.path, s.y)
      last = R
    }
    function at(f) {
      while (step < f * SUB) advance()
      return V.clone(last)
    }
    return { at, rawAt, fps: FPS }
  }
  function bake(score) {
    const A = create(score)
    const n = Math.round(score.duration * (score.fps || 30))
    return Array.from({ length: n }, (_, f) => A.at(f))
  }
  const VenusAnim = { create, bake, EASE }
  if (typeof module !== 'undefined' && module.exports) module.exports = VenusAnim
  else root.VenusAnim = VenusAnim
})(typeof window !== 'undefined' ? window : globalThis)
