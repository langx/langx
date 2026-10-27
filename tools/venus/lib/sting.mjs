// The end card's sound logo: about a second, quiet, and the same in every video.
//
// Two mallet notes a fifth apart, the first panned left and the second right, then the third of the
// chord fills in under the second: one voice, then the other answering, then both. That is the
// exchange the mark draws (two arcs turning round each other), said in sound. A soft low thump
// under the first note is the badge landing. Nothing rises at the end, so it closes rather than
// leads on, and its tail is gone well before the loop point.
import { SR, stereo, addTo, osc, expDecay, mul, mix, svf, reverb, busAdd } from './synth/dsp.mjs'

const S = (sec) => Math.round(sec * SR)
// a soft mallet: a sine with a quiet fourth-harmonic tick that dies in ~40 ms (the strike) and a
// faint inharmonic partial (the bar), so it sits between a marimba and a kalimba
function mallet(f, len, tau) {
  const n = S(len)
  const body = mul(osc('sine', f, n), expDecay(n, tau, 0.003))
  const strike = mul(osc('sine', f * 4, n), expDecay(n, 0.04, 0.001))
  const bar = mul(osc('sine', f * 2.76, n), expDecay(n, tau * 0.3, 0.002))
  return mix(body, mul(strike, 0.22), mul(bar, 0.12))
}
function thump() {
  const n = S(0.3)
  const s = mul(
    osc('sine', (t) => 55 + 95 * Math.exp(-t * 28), n),
    expDecay(n, 0.09, 0.004),
  )
  return svf(s, 'lp', 400)
}

let cached = null
export function sting() {
  if (cached) return cached
  const bus = stereo(S(1.3))
  addTo(bus, thump(), 0, 0.55, 0)
  addTo(bus, mallet(783.99, 0.9, 0.22), 0, 0.5, -0.35) // G5, left
  addTo(bus, mallet(1174.66, 1.1, 0.34), S(0.13), 0.55, 0.35) // D6, right
  addTo(bus, mallet(987.77, 1.0, 0.3), S(0.15), 0.28, 0) // B5, the two together
  busAdd(bus, reverb(bus, { room: 0.78, damp: 0.4, loop: false }), 0.35)
  // fade the last 150 ms so the tail can never click
  const n = bus[0].length,
    f = S(0.15)
  for (let i = 0; i < f; i++) {
    const g = i / f
    bus[0][n - 1 - i] *= g
    bus[1][n - 1 - i] *= g
  }
  cached = bus
  return bus
}
