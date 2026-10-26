// Small DSP kit for the offline fallback (no API key): oscillators, filters,
// envelopes, a Freeverb-style reverb and a 16-bit WAV writer. Everything works
// on Float32Array buffers at SR. Nothing here is clever; it only has to sound
// clean enough that a fallback render is not mistaken for a broken one.
import fs from 'node:fs'

export const SR = 44100

export function rng(seed) {
  // mulberry32: deterministic per seed so a day's track is reproducible.
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(str) {
  let h = 2166136261
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

export function stereo(n) {
  return [new Float32Array(n), new Float32Array(n)]
}

// Add a mono signal into a stereo bus at sample offset, with equal-power pan.
// `wrap` makes the tail fold back to the start: that is what keeps loops seamless.
export function addTo(bus, sig, at, gain = 1, pan = 0, wrap = false) {
  const [L, R] = bus
  const n = L.length
  const a = Math.cos(((pan + 1) * Math.PI) / 4) * gain
  const b = Math.sin(((pan + 1) * Math.PI) / 4) * gain
  for (let i = 0; i < sig.length; i++) {
    let j = at + i
    if (j >= n) {
      if (!wrap) break
      j %= n
    }
    if (j < 0) continue
    L[j] += sig[i] * a
    R[j] += sig[i] * b
  }
}

// PolyBLEP saw: plain saws alias badly at these pitches and sound like a fax.
function blep(t, dt) {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

export function osc(type, freq, n, phase0 = 0, vib = null) {
  const out = new Float32Array(n)
  let ph = phase0
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'function' ? freq(i / SR) : freq
    const fv = vib ? f * (1 + vib.depth * Math.sin((2 * Math.PI * vib.rate * i) / SR)) : f
    const dt = fv / SR
    let v
    if (type === 'sine') v = Math.sin(2 * Math.PI * ph)
    else if (type === 'tri') v = 1 - 4 * Math.abs(ph - 0.5)
    else if (type === 'saw') v = 2 * ph - 1 - blep(ph, dt)
    else if (type === 'square') {
      v = ph < 0.5 ? 1 : -1
      v += blep(ph, dt) - blep((ph + 0.5) % 1, dt)
    }
    out[i] = v
    ph += dt
    if (ph >= 1) ph -= 1
  }
  return out
}

export function noise(n, r = Math.random) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1
  return out
}

// ADSR in seconds; `len` is the gate length, release runs after it.
export function adsr(n, a, d, s, r, len) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let v
    if (t < a) v = t / a
    else if (t < a + d) v = 1 - (1 - s) * ((t - a) / d)
    else if (t < len) v = s
    else v = s * Math.exp(-(t - len) / Math.max(r / 4, 1e-4))
    out[i] = v
  }
  return out
}

export function expDecay(n, tau, attack = 0.002) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = Math.min(1, t / attack) * Math.exp(-t / tau)
  }
  return out
}

export function mul(a, b) {
  for (let i = 0; i < a.length; i++) a[i] *= typeof b === 'number' ? b : b[i]
  return a
}

export function mix(...sigs) {
  const n = Math.max(...sigs.map((s) => s.length))
  const out = new Float32Array(n)
  for (const s of sigs) for (let i = 0; i < s.length; i++) out[i] += s[i]
  return out
}

// Chamberlin state-variable filter; cutoff may be a function of time (s).
export function svf(sig, mode, cutoff, q = 0.7) {
  const out = new Float32Array(sig.length)
  let low = 0,
    band = 0
  const damp = 1 / q
  for (let i = 0; i < sig.length; i++) {
    const fc = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR)
    low += f * band
    const high = sig[i] - low - damp * band
    band += f * high
    out[i] = mode === 'lp' ? low : mode === 'hp' ? high : band
  }
  return out
}

export function onePoleLP(sig, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR)
  let y = 0
  for (let i = 0; i < sig.length; i++) {
    y = (1 - a) * sig[i] + a * y
    sig[i] = y
  }
  return sig
}

// Freeverb-lite. Run over the buffer twice and keep the second pass so the
// reverb tail of the last bar is already ringing at the start: seamless loop.
export function reverb(bus, { room = 0.82, damp = 0.35, wet = 1, loop = true } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const aps = [556, 441, 341, 225]
  const out = stereo(bus[0].length)
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch ? 23 : 0
    const cb = combs.map((l) => ({ buf: new Float32Array(l + spread), i: 0, f: 0 }))
    const ab = aps.map((l) => ({ buf: new Float32Array(l + spread), i: 0 }))
    const src = bus[ch]
    const n = src.length
    const passes = loop ? 2 : 1
    for (let p = 0; p < passes; p++) {
      for (let k = 0; k < n; k++) {
        const x = src[k] * 0.015
        let y = 0
        for (const c of cb) {
          const o = c.buf[c.i]
          c.f = o * (1 - damp) + c.f * damp
          c.buf[c.i] = x + c.f * room
          c.i = (c.i + 1) % c.buf.length
          y += o
        }
        for (const a of ab) {
          const o = a.buf[a.i]
          a.buf[a.i] = y + o * 0.5
          a.i = (a.i + 1) % a.buf.length
          y = o - y
        }
        if (p === passes - 1) out[ch][k] = y * wet
      }
    }
  }
  return out
}

export function busAdd(dst, src, gain = 1) {
  for (let ch = 0; ch < 2; ch++)
    for (let i = 0; i < dst[ch].length; i++) dst[ch][i] += src[ch][i] * gain
  return dst
}

// DC block, normalise to unity peak, gentle tanh glue (a few dB of peak
// control, not a crush), then scale to peak `ceilDb`. Loudness is the mixer's job.
export function master(bus, ceilDb = -1, drive = 1.6) {
  const peakOf = () =>
    Math.max(...bus.map((ch) => ch.reduce((m, v) => Math.max(m, Math.abs(v)), 0)))
  const r = Math.exp((-2 * Math.PI * 25) / SR)
  for (const ch of bus) {
    let x1 = 0,
      y1 = 0
    for (let i = 0; i < ch.length; i++) {
      const y = ch[i] - x1 + r * y1
      x1 = ch[i]
      y1 = y
      ch[i] = y
    }
  }
  let p = peakOf()
  for (const ch of bus)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh((ch[i] / p) * drive) / Math.tanh(drive)
  p = peakOf()
  const g = p > 0 ? Math.pow(10, ceilDb / 20) / p : 1
  for (const ch of bus) for (let i = 0; i < ch.length; i++) ch[i] *= g
  return bus
}

export function writeWav(path, bus) {
  const chans = bus.length
  const n = bus[0].length
  const buf = Buffer.alloc(44 + n * chans * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * chans * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(chans, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * chans * 2, 28)
  buf.writeUInt16LE(chans * 2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * chans * 2, 40)
  let o = 44
  for (let i = 0; i < n; i++)
    for (let c = 0; c < chans; c++) {
      const v = Math.max(-1, Math.min(1, bus[c][i]))
      buf.writeInt16LE(Math.round(v * 32767), o)
      o += 2
    }
  fs.writeFileSync(path, buf)
  return path
}
