/*
 * The score. Everything is synthesized in WebAudio from two lists: the music
 * bed below (the storyboard's arrangement, written out beat by beat) and
 * `REEL.cues`, the sound effects the scene builders register with `ctx.cue`.
 *
 * One function, `schedule`, turns both lists into nodes, and the live player
 * and the offline render both go through it — same graph, same events — so the
 * MP4 sounds exactly like the page. It works in reel seconds and maps them to
 * the context's clock; a note already sounding at the reel time playback
 * starts from is joined in the middle of its envelope rather than dropped or
 * restarted, which is what makes a seek sound like a seek.
 *
 * Cue vocabulary, for `ctx.cue(t, name, { note, gain, pan, dur })`:
 *
 *   tick     dry 15 ms sine burst; 2.4 kHz (the caret tick) unless `note`
 *   pop      short round sine with a small upward blip, at `note` (D5)
 *   pluck    FM kalimba, at `note` (A5); `dur` is the ring
 *   bell     the pluck with a long decay and bell partials, at `note` (D6)
 *   chime    two bell notes a 16th apart, D6 → F#6 (or `note` and a third up)
 *   whoosh   band-passed noise sweeping up and down over `dur` (0.6 s); with a
 *            `note`, it turns pitched: from A5 up it rises into light, below it
 *            falls into the dark
 *   swish    shorter, brighter whoosh (0.28 s), pitched the same way
 *   riser    noise and a tone sweeping up a fifth over `dur` (2 s), hard stop
 *   reverse  a swell that grows into its end, like a tape run backwards (1 s)
 *   impact   low boom, mid thump and a transient; the boom rings at `note`
 *   boom     a low downward sweep that lands at the end of `dur` (0.5 s)
 *   blade    metallic shing: ringing resonators, a ping and a stutter
 *   glitch   granular digital stutter over `dur` (0.14 s)
 *   shimmer  high sparkle over `dur` (1.2 s), rooted on `note` (D6)
 *   clack    a slot-reel clack
 *   zip      fast upward chirp over `dur` (0.14 s)
 *   thunk    low wooden hit, settling on `note` when given
 *   stamp    short thud with a click on top
 *   flick    a tiny flick of noise
 *
 * `pan` places a sound; an optional `panTo` moves it there over its length
 * (a whoosh that crosses the frame). An optional `to` note sets where a riser
 * ends instead of a fifth up. An unknown name plays a quiet tick. The bed's
 * own instruments (kick, snare, clap, hat, sub, chord, silence) belong to the
 * score: cueing one of those does nothing, so a scene cannot double the kit.
 */
;(function () {
  'use strict'

  const REEL = window.REEL
  const B = REEL.BEAT
  const RATE = 44100
  /*
   * The master's two compressors each look 6 ms ahead, so everything leaves
   * the bus 12 ms after it went in; the schedule runs that much early to land
   * on the picture. The offline render also starts the bus a quarter second
   * before the reel, in silence, because a compressor's first 100 ms swallow
   * whatever arrives — and the reel's first sound is a tick on frame 0.
   */
  const LATENCY = 0.012
  const PREROLL = 0.25

  /* -------------------------------------------------------------- pitch */

  const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  function midi(note) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(note))
    if (!m) return null
    return 12 * (Number(m[3]) + 1) + STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  }
  /* A note name ('F#5') or a frequency in Hz, else the fallback (either kind), else A4. */
  function hz(note, fallback) {
    for (const n of [note, fallback]) {
      if (typeof n === 'number' && n > 0) return n
      const m = midi(n)
      if (m !== null) return 440 * Math.pow(2, (m - 69) / 12)
    }
    return 440
  }
  const up = (f, semis) => f * Math.pow(2, semis / 12)

  /* A seeded source (mulberry32): the score must render the same every time. */
  function prng(seed) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const noiseCache = new WeakMap()
  function noiseBuffer(ac) {
    let buf = noiseCache.get(ac)
    if (!buf) {
      buf = ac.createBuffer(1, Math.round(ac.sampleRate * 3), ac.sampleRate)
      const d = buf.getChannelData(0)
      const r = prng(0x5eed)
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
      noiseCache.set(ac, buf)
    }
    return buf
  }

  /* ----------------------------------------------------- the scheduler */

  /*
   * A session is one pass of `schedule`: a context, the reel second playback
   * starts from and the context time that second lands on. Every time below is
   * in reel seconds; `at` converts.
   */
  function session(ac, dest, from, when) {
    const S = { ac, from, when, sources: [], noise: noiseBuffer(ac) }
    S.at = (t) => when + (t - from)
    // A round sub with a little second and third harmonic, so the bass line
    // still reads on speakers that cannot reproduce its fundamental.
    S.subWave = ac.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, 0.34, 0.1]))
    S.bus = gain(S, 1, dest)
    return S
  }

  /*
   * An envelope as points [t, value, kind]: kind 'e' ramps exponentially, 's'
   * steps, anything else ramps linearly. Points before the session's start are
   * collapsed into the value the envelope has at that moment.
   */
  function env(S, param, pts) {
    let i = 0
    while (i < pts.length && pts[i][0] < S.from) i++
    if (i === pts.length) {
      param.value = pts[i - 1][1]
      return
    }
    if (i > 0) {
      const [t0, v0] = pts[i - 1]
      const [t1, v1, kind] = pts[i]
      const x = (S.from - t0) / (t1 - t0)
      let v = v0 + (v1 - v0) * x
      if (kind === 's') v = v0
      else if (kind === 'e' && v0 > 0 && v1 > 0) v = v0 * Math.pow(v1 / v0, x)
      param.value = v
      param.setValueAtTime(v, S.when)
    } else {
      param.value = pts[0][1]
    }
    for (; i < pts.length; i++) {
      const [t, v, kind] = pts[i]
      const a = S.at(t)
      if (i === 0 || kind === 's') param.setValueAtTime(v, a)
      // An exponential ramp to zero throws, and one bad cue would take the
      // whole schedule with it: a cue at gain 0 lands a hair above silence.
      else if (kind === 'e') param.exponentialRampToValueAtTime(Math.max(v, 1e-6), a)
      else param.linearRampToValueAtTime(v, a)
    }
  }

  function play(S, node, t0, t1, seed) {
    const a0 = S.at(t0)
    const start = Math.max(a0, S.when)
    if (node.buffer) {
      const len = node.buffer.duration
      node.start(start, ((seed || 0) * 0.618034 * len + (start - a0)) % len)
    } else node.start(start)
    node.stop(Math.max(S.at(t1), start + 0.001))
    S.sources.push(node)
  }

  function gain(S, v, dest) {
    const g = S.ac.createGain()
    g.gain.value = v
    g.connect(dest)
    return g
  }
  function amp(S, pts, dest) {
    const g = S.ac.createGain()
    env(S, g.gain, pts)
    g.connect(dest)
    return g
  }
  function pan(S, p, dest, t0, t1, p1) {
    if (!p && p1 === undefined) return dest
    const n = S.ac.createStereoPanner()
    const clamp = (v) => Math.max(-1, Math.min(1, v || 0))
    if (p1 === undefined) n.pan.value = clamp(p)
    else
      env(S, n.pan, [
        [t0, clamp(p)],
        [t1, clamp(p1)],
      ])
    n.connect(dest)
    return n
  }
  function filter(S, type, f, q, dest) {
    const n = S.ac.createBiquadFilter()
    n.type = type
    if (Array.isArray(f)) env(S, n.frequency, f)
    else n.frequency.value = f
    n.Q.value = q
    n.connect(dest)
    return n
  }
  function osc(S, type, f, t0, t1, dest, detune) {
    const o = S.ac.createOscillator()
    if (type === 'sub') o.setPeriodicWave(S.subWave)
    else o.type = type
    if (Array.isArray(f)) env(S, o.frequency, f)
    else o.frequency.value = f
    if (detune) o.detune.value = detune
    o.connect(dest)
    play(S, o, t0, t1)
    return o
  }
  function noise(S, t0, t1, dest, seed) {
    const n = S.ac.createBufferSource()
    n.buffer = S.noise
    n.loop = true
    n.connect(dest)
    play(S, n, t0, t1, seed)
    return n
  }
  /* A plain decay: attack `a`, then exponentially down to silence at `t + len`. */
  function hit(S, t, g, len, dest, a) {
    return amp(
      S,
      [
        [t, 0],
        [t + (a || 0.002), g],
        [t + len, 0.0001 * g, 'e'],
      ],
      dest,
    )
  }
  /* Samples of x^p, 0..1, as envelope points: a swell that grows into its end. */
  function swell(t, len, g, p, stops) {
    const pts = []
    const n = stops || 8
    for (let i = 0; i <= n; i++) pts.push([t + (len * i) / n, g * Math.pow(i / n, p)])
    return pts
  }

  /* ------------------------------------------------------ instruments */

  function kick(S, t, g, big, dest) {
    const len = big ? 1.5 : 0.42
    const a = amp(
      S,
      [
        [t, 0],
        [t + 0.002, g],
        [t + (big ? 0.18 : 0.09), g * 0.55, 'e'],
        [t + len, 0.0005, 'e'],
      ],
      dest,
    )
    const f = big
      ? [
          [t, 200],
          [t + 0.06, 56, 'e'],
          [t + 0.5, 40, 'e'],
          [t + len, 36, 'e'],
        ]
      : [
          [t, 165],
          [t + 0.045, 57, 'e'],
          [t + len, 45, 'e'],
        ]
    osc(S, 'sine', f, t, t + len, a)
    noise(S, t, t + 0.012, filter(S, 'highpass', 2600, 0.7, hit(S, t, g * 0.2, 0.008, dest)), 1)
  }

  function clap(S, t, g, dest) {
    const a = amp(
      S,
      [
        [t, 0],
        [t + 0.001, g],
        [t + 0.009, g * 0.2],
        [t + 0.0105, g * 0.85],
        [t + 0.019, g * 0.2],
        [t + 0.0205, g * 0.75],
        [t + 0.03, g * 0.45],
        [t + 0.2, g * 0.0005, 'e'],
      ],
      dest,
    )
    noise(S, t, t + 0.21, filter(S, 'bandpass', 1250, 0.9, filter(S, 'highpass', 650, 0.7, a)), 2)
  }

  function snare(S, t, g, dest) {
    noise(S, t, t + 0.18, filter(S, 'highpass', 1400, 0.7, hit(S, t, g * 0.8, 0.17, dest)), 3)
    const body = [
      [t, 205],
      [t + 0.05, 172, 'e'],
    ]
    osc(S, 'triangle', body, t, t + 0.1, hit(S, t, g * 0.7, 0.09, dest))
  }

  function rim(S, t, g, dest) {
    osc(S, 'triangle', 1650, t, t + 0.03, hit(S, t, g * 0.5, 0.025, dest))
    noise(S, t, t + 0.02, filter(S, 'bandpass', 2600, 2, hit(S, t, g, 0.015, dest)), 4)
  }

  function hat(S, t, g, open, dest) {
    const len = open ? 0.2 : 0.045
    const a = hit(S, t, g, len, dest, 0.001)
    noise(S, t, t + len, filter(S, 'highpass', 7200, 0.7, filter(S, 'bandpass', 10500, 0.6, a)), 5)
  }

  function crash(S, t, g, len, dest) {
    // Two decorrelated noises, one each side: width from placement, not effects.
    for (const side of [-0.6, 0.6]) {
      const a = amp(
        S,
        [
          [t, 0],
          [t + 0.002, g],
          [t + 0.1, g * 0.45, 'e'],
          [t + len, g * 0.0003, 'e'],
        ],
        pan(S, side, dest),
      )
      noise(S, t, t + len, filter(S, 'highpass', 4200, 0.6, a), side > 0 ? 6 : 7)
    }
  }

  function bass(S, t, len, f, g, dest) {
    const r = Math.min(0.04, len / 3)
    const a = amp(
      S,
      [
        [t, 0],
        [t + 0.008, g],
        [t + len - r, g * 0.8],
        [t + len, 0],
      ],
      dest,
    )
    osc(S, 'sub', f, t, t + len, a)
  }

  /* FM: a sine carrier whose frequency a second sine pushes around, `index` deep. */
  function fm(S, t, f, len, ratio, index, bright, dest) {
    const car = osc(S, 'sine', f, t, t + len, dest)
    const depth = f * ratio
    const md = amp(
      S,
      [
        [t, 0],
        [t + 0.002, depth * index],
        [t + bright, depth * index * 0.12, 'e'],
        [t + len, depth * index * 0.01, 'e'],
      ],
      car.frequency,
    )
    osc(S, 'sine', f * ratio, t, t + len, md)
  }

  /* The soft mallet the chord stabs and the arp are played on. */
  function mallet(S, t, f, len, g, p, dest, ratio, index) {
    const out = hit(S, t, g, len, pan(S, p, dest), 0.003)
    fm(S, t, f, len, ratio || 4, index || 1.1, 0.08, out)
  }

  function stab(S, t, notes, len, g, dest) {
    notes.forEach((n, i) => {
      const p = notes.length > 1 ? -0.35 + (0.7 * i) / (notes.length - 1) : 0
      // A 5 ms strum, low to high, so the chord speaks as one hand, not a machine.
      mallet(S, t + i * 0.005, hz(n), len, g / Math.sqrt(notes.length), p, dest)
    })
  }

  function kalimba(S, t, f, len, g, dest) {
    const out = hit(S, t, g, len, dest, 0.002)
    fm(S, t, f, len, 1, 2.2, 0.12, out)
    osc(S, 'sine', f * 5.93, t, t + 0.12, hit(S, t, g * 0.16, 0.08, dest, 0.001))
  }

  /* The warm detuned pad: three saws a note, spread left, centre, right, one filter. */
  function pad(S, t0, t1, notes, g, cutoff, fadeIn, fadeOut, dest) {
    const out = amp(
      S,
      [
        [t0, 0],
        [t0 + fadeIn, g],
        [t1 - fadeOut, g],
        [t1, 0],
      ],
      dest,
    )
    const lp = filter(S, 'lowpass', cutoff, 0.5, out)
    const sides = [-0.55, 0, 0.55].map((p) => pan(S, p, lp))
    const per = 1 / Math.sqrt(notes.length * 3)
    for (const n of notes) {
      ;[-9, 0, 9].forEach((cents, i) =>
        osc(S, 'sawtooth', hz(n), t0, t1, gain(S, per, sides[i]), cents),
      )
    }
  }

  /* The only voice in the film: a saw through two formant band-passes, never words. */
  const VOWELS = [
    [730, 1090],
    [530, 1840],
    [570, 840],
    [440, 1020],
    [660, 1700],
  ]
  function formant(S, t, f, g, len, vowel, dest) {
    const out = amp(
      S,
      [
        [t, 0],
        [t + 0.012, g],
        [t + len * 0.6, g * 0.6],
        [t + len, 0],
      ],
      dest,
    )
    const [f1, f2] = VOWELS[vowel % VOWELS.length]
    const pitch = [
      [t, f * 0.97],
      [t + 0.04, f, 'e'],
    ]
    const o = osc(S, 'sawtooth', pitch, t, t + len, filter(S, 'bandpass', f1, 6, out))
    o.connect(filter(S, 'bandpass', f2, 9, gain(S, 0.6, out)))
  }

  /* ---------------------------------------------------------- the bed */

  /* Voicings. Every D before the lock is add9 or first inversion (the storyboard's rule). */
  const CH = {
    Dadd9: { n: ['A3', 'D4', 'E4', 'F#4'], b: 'D2' },
    Bm7: { n: ['F#3', 'A3', 'B3', 'D4'], b: 'B1' },
    Gadd9: { n: ['G3', 'B3', 'D4', 'A4'], b: 'G1' },
    A: { n: ['E3', 'A3', 'C#4', 'E4'], b: 'A1' },
    Asus4: { n: ['E3', 'A3', 'D4', 'E4'], b: 'A1' },
    DF: { n: ['F#3', 'A3', 'D4', 'E4'], b: 'F#1' },
    DA: { n: ['A3', 'D4', 'F#4', 'A4'], b: 'A1' },
    Dmaj9: { n: ['D3', 'F#3', 'A3', 'C#4', 'E4'], b: 'D1' },
    Bm9: { n: ['B2', 'D3', 'F#3', 'A3', 'C#4'], b: 'B1' },
    // The first root-position D major of the film, on the lock and nowhere else.
    D: { n: ['D3', 'F#3', 'A3', 'D4', 'F#4'], b: 'D2' },
  }

  /* Bass figures, [beat offset in the bar, semitones over the root, length in beats]. */
  const DRIVE = [
    [0, 0, 0.35],
    [0.5, 0, 0.25],
    [0.75, 12, 0.2],
    [1.5, 0, 0.4],
    [2, 0, 0.3],
    [2.5, 7, 0.25],
    [3, 0, 0.35],
    [3.5, 12, 0.3],
  ]
  const BOUNCE = [
    [0, 0, 0.45],
    [0.75, 12, 0.2],
    [1, 0, 0.4],
    [2, 0, 0.45],
    [2.75, 7, 0.2],
    [3.25, 12, 0.2],
    [3.5, 0, 0.4],
  ]
  const SURGE = []
  for (let k = 0; k < 4; k++) SURGE.push([k, 0, 0.3], [k + 0.5, 12, 0.2], [k + 0.75, 0, 0.2])

  /*
   * The arrangement's dynamics: every bed hit is scaled by the section it
   * falls in, so the intro whispers, drop 2 is the fullest groove and the lock
   * is the loudest moment of the film.
   */
  const LEVEL = [
    [0, 0.75],
    [8, 0.75],
    [12, 0.7],
    [16, 0.9],
    [24, 0.7],
    [32, 0.78],
    [44, 0.8],
    [48, 0.75],
    [56, 0.86],
    [60, 0.84],
    [66, 0.88],
    [68, 1.05],
    [74, 0.85],
    [80, 1.4],
  ]
  function level(beat) {
    let v = LEVEL[0][1]
    for (const [b, l] of LEVEL) if (beat >= b - 1e-6) v = l
    return v
  }

  const FX_RIDE = [
    [0, 0.72],
    [8, 0.9],
    [12, 0.68],
    [16, 1],
    [48, 0.85],
    [56, 1],
  ]

  /*
   * The planned silences, in beats: everything stops, tails included, from
   * each of these to the downbeat that follows it.
   */
  const SILENCES = [15.75, 31.75, 47.75, 55.75, 67.75, 79.75]

  /*
   * The arrangement, beat by beat. Returns the events (reel seconds, a length
   * so a seek can skip what has already finished, and the function that plays
   * one) and the kick times the sidechain ducks against.
   */
  function bed() {
    const ev = []
    const kicks = []
    const at = (beat, len, fn) => ev.push({ t: beat * B, len, fn })
    const K = (b, g, big) => {
      // The lock's kick is not a pump: its sub drop is the kick, so nothing ducks.
      if (!big) kicks.push(b * B)
      at(b, big ? 1.5 : 0.45, (S, t) => kick(S, t, g * level(b), big, S.drums))
    }
    const CL = (b, g) => at(b, 0.22, (S, t) => clap(S, t, g * level(b), S.drums))
    const SN = (b, g) => at(b, 0.2, (S, t) => snare(S, t, g * level(b), S.drums))
    const RIM = (b, g) => at(b, 0.04, (S, t) => rim(S, t, g * level(b), S.drums))
    const HAT = (b, g, open) => at(b, 0.22, (S, t) => hat(S, t, g * level(b), open, S.hats))
    const CRASH = (b, g, len) => at(b, len, (S, t) => crash(S, t, g * level(b), len, S.drums))
    const BASS = (b, beats, note, g, semis) =>
      at(b, beats * B, (S, t) =>
        bass(S, t, beats * B, up(hz(note), semis || 0), g * level(b), S.sub),
      )
    const STAB = (b, chord, len, g) =>
      at(b, len + 0.05, (S, t) => stab(S, t, CH[chord].n, len, g * level(b), S.music))
    const figure = (bar, pattern, chord, g, until) => {
      for (const [o, s, l] of pattern) {
        if (bar + o < (until ?? bar + 4)) BASS(bar + o, l, CH[chord].b, g, s)
      }
    }
    const hats16 = (b0, b1, g) => {
      for (let b = b0; b < b1 - 1e-6; b += 0.25) {
        const off = b % 1 === 0.5
        HAT(b, off ? g * 1.25 : b % 1 === 0 ? g * 0.75 : g * 0.55, off)
      }
    }
    const hats8 = (b0, b1, g) => {
      for (let b = b0; b < b1 - 1e-6; b += 0.5) HAT(b, b % 1 === 0.5 ? g : g * 0.6, false)
    }
    const roll = (b0, b1, g0, g1) => {
      // 16ths for the first half, 32nds for the second, crescendo throughout.
      const hits = []
      const mid = b0 + (b1 - b0) / 2
      for (let b = b0; b < mid - 1e-6; b += 0.25) hits.push(b)
      for (let b = mid; b < b1 - 1e-6; b += 0.125) hits.push(b)
      hits.forEach((b, i) => SN(b, g0 + ((g1 - g0) * i) / Math.max(1, hits.length - 1)))
    }

    /* Bars 1-2, intro: no drums. A D1 drone breathes in from b2. */
    at(2, 3.05, (S, t) => {
      const a = amp(
        S,
        [
          [t, 0.001],
          [t + 3, 0.7, 'e'],
          [t + 3.0, 0.7],
          [t + 3.03, 0],
        ],
        S.sub,
      )
      osc(S, 'sub', hz('D1'), t, t + 3.03, a)
      osc(S, 'sine', hz('D2'), t, t + 3.03, gain(S, 0.35, a))
    })

    /* Bars 3-4, build. Half-time in bar 3, four on the floor in bar 4. */
    K(8, 1)
    CRASH(8, 0.12, 1.2)
    STAB(8.25, 'Bm7', 1.4, 0.5)
    BASS(8, 1.5, 'B1', 0.8)
    BASS(10.5, 0.5, 'B1', 0.6)
    CL(10, 0.8)
    K(11, 0.8)
    for (const b of [12, 13, 14, 15]) K(b, 1)
    CL(13, 0.8)
    hats8(12, 15, 0.35)
    HAT(14.5, 0.3, true)
    STAB(12, 'Gadd9', 1, 0.36)
    STAB(14, 'A', 1, 0.36)
    BASS(12, 0.75, 'G1', 0.8)
    BASS(12.75, 0.25, 'G1', 0.6, 12)
    BASS(13.5, 0.5, 'G1', 0.8)
    BASS(14, 0.75, 'A1', 0.8)
    BASS(14.75, 0.25, 'A1', 0.6, 12)
    BASS(15, 0.75, 'A1', 0.7)
    roll(15, 15.75, 0.4, 0.8)

    /* Bars 5-6, drop 1. */
    CRASH(16, 0.3, 1.8)
    for (let b = 16; b < 24; b++) K(b, 1)
    for (const b of [17, 19, 21, 23]) CL(b, 0.85)
    hats16(16, 24, 0.3)
    figure(16, DRIVE, 'DF', 0.85)
    figure(20, DRIVE, 'Bm7', 0.85)
    for (const [b, c] of [
      [16, 'DF'],
      [18.5, 'DF'],
      [20, 'Bm7'],
      [22.5, 'Bm7'],
    ])
      STAB(b, c, 0.8, 0.38)

    /* Bars 7-8, verse: kick and a soft rim; the kit is out for the hesitation beat. */
    for (const b of [24, 25, 27, 28, 29, 30, 31]) K(b, 0.9)
    K(31.5, 0.6)
    for (const b of [25, 27, 29, 31]) RIM(b, 0.35)
    for (const b of [28.5, 28.75, 29, 29.25]) HAT(b, 0.28, false)
    BASS(24, 1.75, 'G1', 0.55)
    BASS(27, 1, 'G1', 0.55)
    BASS(28, 1.5, 'A1', 0.55)
    BASS(29.5, 0.5, 'A1', 0.45, 12)
    BASS(30, 1.5, 'A1', 0.6)
    BASS(31.5, 0.25, 'A1', 0.6)
    STAB(24, 'Gadd9', 1.2, 0.34)
    STAB(28, 'Asus4', 1, 0.32)
    STAB(30, 'A', 0.9, 0.3)

    /* Bars 9-12, the correction and the echo. Room tone, the strike, then half-time. */
    at(32, 0.4, (S, t) => {
      const a = amp(
        S,
        [
          [t, 0],
          [t + 0.1, 0.05],
          [t + 0.33, 0.05],
          [t + 0.375, 0],
        ],
        S.fx,
      )
      noise(S, t, t + 0.375, filter(S, 'lowpass', 520, 0.5, a), 8)
    })
    SN(33, 1)
    at(33, 1.6, (S, t) => stab(S, t, CH.Bm7.n, 1.6, 0.26, S.music))
    BASS(33, 0.5, 'B1', 0.5)
    for (const [b, g] of [
      [34, 0.8],
      [36, 1],
      [37.5, 0.5],
      [40, 1],
      [41, 0.9],
      [42, 0.9],
      [44, 1],
      [45.5, 0.5],
    ])
      K(b, g)
    for (const b of [38, 42, 46]) CL(b, 0.8)
    hats8(37, 47.5, 0.34)
    BASS(34, 1.5, 'B1', 0.6)
    BASS(36, 1, 'G1', 0.8)
    figure(36, BOUNCE.slice(2), 'Gadd9', 0.75)
    figure(40, BOUNCE, 'DF', 0.8)
    BASS(44, 1.75, 'A1', 0.65)
    BASS(46, 1.5, 'A1', 0.75)
    STAB(34, 'Bm7', 1, 0.2)
    STAB(36, 'Gadd9', 1.1, 0.34)
    STAB(40, 'DF', 1.1, 0.34)
    STAB(44, 'DA', 1.6, 0.3)
    STAB(46, 'A', 0.9, 0.26)

    /* Bars 13-14, the breath: no drums, the pad and a sub. */
    at(48, 4.4, (S, t) => {
      const cut = [
        [t, 420],
        [t + 1.1, 2100, 'e'],
        [t + 4.3, 1500, 'e'],
      ]
      pad(S, t, t + 4.3, CH.Dmaj9.n, 0.45, cut, 0.35, 0.3, S.pad)
    })
    at(52, 3.9, (S, t) => {
      const cut = [
        [t, 1300],
        [t + 3.86, 700, 'e'],
      ]
      pad(S, t, t + 3.87, CH.Bm9.n, 0.34, cut, 0.2, 0.05, S.pad)
    })
    BASS(48, 8, 'D1', 0.5)
    BASS(52, 3.75, 'B1', 0.3)

    /* Bars 15-17, manifesto hits, then the groove returns. */
    CRASH(56, 0.28, 1.6)
    for (const [b, c, beats] of [
      [56, 'DF', 0.9],
      [57, 'Gadd9', 0.9],
      [58, 'A', 1.8],
    ]) {
      K(b, 0.95)
      CL(b, 0.6)
      BASS(b, beats, CH[c].b, 0.75)
      STAB(b, c, beats * B + 0.5, 0.5)
    }
    for (let b = 60; b < 66; b++) K(b, 1)
    for (const b of [61, 63, 65]) CL(b, 0.85)
    hats16(60, 66, 0.3)
    figure(60, DRIVE, 'Bm7', 0.85)
    figure(64, DRIVE, 'Asus4', 0.85, 66)
    STAB(60, 'Bm7', 0.8, 0.36)
    STAB(62.5, 'Bm7', 0.6, 0.3)
    STAB(64, 'Asus4', 1, 0.36)
    K(66, 1)
    K(67, 1)
    for (let b = 66; b < 67.75; b += 0.5) BASS(b, 0.3, 'A1', 0.5 + (b - 66) * 0.12)
    roll(66, 67.75, 0.3, 0.75)

    /* Bar 18, drop 2: the fullest groove, a 16th arp, the bass on every kick. */
    CRASH(68, 0.34, 2.2)
    for (let b = 68; b < 74; b++) K(b, 1)
    for (const b of [69, 71, 73]) CL(b, 0.85)
    hats16(68, 74, 0.4)
    for (const b of [71.25, 71.5, 71.75]) SN(b, 0.5 + (b - 71) * 0.5)
    figure(68, SURGE, 'DF', 0.9)
    figure(72, DRIVE, 'Bm7', 0.85, 74)
    STAB(68, 'DF', 1, 0.5)
    STAB(72, 'Bm7', 1, 0.44)
    const ARP = {
      DF: ['F#4', 'A4', 'D5', 'E5', 'F#5', 'E5', 'D5', 'A4'],
      Bm7: ['F#4', 'A4', 'B4', 'D5', 'F#5', 'D5', 'B4', 'A4'],
    }
    for (let i = 0; i < 24; i++) {
      const b = 68 + i * 0.25
      const notes = b < 72 ? ARP.DF : ARP.Bm7
      const g = (i % 4 === 0 ? 0.36 : 0.26) * (1 + i / 48)
      at(b, 0.25, (S, t) =>
        mallet(S, t, hz(notes[i % 8]), 0.22, g, i % 2 ? 0.3 : -0.3, S.music, 2, 1.4),
      )
    }

    /* Bars 19-20, the finale: drums out at b74, the chords breathe under the turn. */
    for (const [b, c, g] of [
      [74, 'Bm7', 0.18],
      [75, 'Bm7', 0.2],
      [76, 'Gadd9', 0.22],
      [77, 'Gadd9', 0.24],
      [78, 'Asus4', 0.26],
      [79, 'Asus4', 0.28],
    ])
      STAB(b, c, 1.2, g)
    BASS(74, 2, 'B1', 0.6)
    BASS(76, 2, 'G1', 0.6)
    BASS(78, 1.75, 'A1', 0.65)
    roll(78, 79.75, 0.18, 0.9)

    /* Bar 21, the lock: the biggest hit, and the first root-position D. */
    K(80, 1.1, true)
    CRASH(80, 0.55, 3.2)
    at(80, 4.2, (S, t) => {
      const f = [
        [t, hz('D2')],
        [t + 0.02, hz('D2')],
        [t + 0.5, hz('D1'), 'e'],
      ]
      osc(S, 'sub', f, t, t + 4.2, hit(S, t, 1.2, 4.2, S.sub, 0.004))
    })
    STAB(80, 'D', 3.6, 1.2)
    at(80, 3.7, (S, t) => stab(S, t, ['D4', 'F#4', 'A4', 'D5'], 3.6, 0.8 * level(80), S.music))
    at(80, 7.95, (S, t) => {
      const cut = [
        [t, 2400],
        [t + 7.9, 600, 'e'],
      ]
      pad(S, t, t + 7.94, CH.D.n, 1.1, cut, 0.02, 3.9, S.pad)
    })
    CL(82.5, 0.45)

    return { ev, kicks }
  }

  /* ------------------------------------------------------------ cues */

  const BED_NAMES = new Set([
    'kick',
    'snare',
    'clap',
    'rim',
    'hat',
    'hats',
    'sub',
    'bass',
    'chord',
    'pad',
    'silence',
  ])

  /*
   * Whooshes and swishes: band-passed noise swept low, high, low. Given a
   * note they are pitched and directional — from A5 up the sweep rises into its
   * end (towards light), below it falls away (into the dark) — and a faint
   * sine glides with them so two swishes at different notes read as a pair.
   */
  function sweep(S, t, o, len, g, q, [f0, f1, f2], d) {
    const end = t + len
    let shape = [0.25, 0.45, 0.55]
    let f = [
      [t, f0],
      [t + len * 0.55, f1, 'e'],
      [end, f2, 'e'],
    ]
    let tone = null
    if (o.note) {
      const n = hz(o.note)
      const rising = n >= 870
      const top = Math.min(9000, Math.max(f1 * 0.4, n * 3))
      shape = rising ? [0.4, 0.62, 0.8] : [0.08, 0.2, 0.3]
      f = rising
        ? [
            [t, top / 8],
            [t + len * 0.8, top, 'e'],
            [end, top * 1.1, 'e'],
          ]
        : [
            [t, top],
            [t + len * 0.3, top * 0.8, 'e'],
            [end, top / 10, 'e'],
          ]
      tone = rising
        ? [
            [t, n * 0.75],
            [end, n * 1.25, 'e'],
          ]
        : [
            [t, n * 1.25],
            [end, n * 0.75, 'e'],
          ]
    }
    const a = amp(
      S,
      [
        [t, 0],
        [t + len * shape[0], g * 0.2],
        [t + len * shape[1], g * 0.75],
        [t + len * shape[2], g],
        [end, 0],
      ],
      d,
    )
    noise(S, t, end, filter(S, 'bandpass', f, q, a), t * 13)
    if (tone) osc(S, 'sine', tone, t, end, gain(S, 0.1, a))
  }

  /* Each voice: its length (to skip what a seek has passed) and how to play it into `d`. */
  const VOICES = {
    tick: {
      len: () => 0.03,
      play(S, t, o, d) {
        osc(S, 'sine', hz(o.note, 2400), t, t + 0.02, hit(S, t, 0.3, 0.015, d, 0.0008))
      },
    },
    pop: {
      len: (o) => (hz(o.note, 'D5') < 320 ? 0.4 : 0.2),
      play(S, t, o, d) {
        const f = hz(o.note, 'D5')
        const low = f < 320
        const len = low ? 0.36 : 0.16
        const glide = low
          ? [
              [t, f * 1.5],
              [t + 0.06, f * 0.94, 'e'],
              [t + 0.16, f, 'e'],
            ]
          : [
              [t, f * 0.72],
              [t + 0.018, f, 'e'],
            ]
        osc(S, 'sine', glide, t, t + len, hit(S, t, 0.45, len, d, 0.002))
        osc(S, 'triangle', f * 2, t, t + 0.06, hit(S, t, 0.08, 0.05, d, 0.001))
      },
    },
    pluck: {
      len: (o) => o.dur || 1,
      play(S, t, o, d) {
        kalimba(S, t, hz(o.note, 'A5'), o.dur || 1, 0.3, d)
      },
    },
    bell: {
      len: (o) => o.dur || 4.5,
      play(S, t, o, d) {
        const f = hz(o.note, 'D6')
        const len = o.dur || 4.5
        const out = hit(S, t, 0.15, len, d, 0.003)
        fm(S, t, f, len, 1, 1.3, 0.3, out)
        for (const [ratio, g, k] of [
          [2, 0.1, 0.5],
          [3.01, 0.04, 0.25],
          [4.16, 0.025, 0.14],
        ])
          osc(S, 'sine', f * ratio, t, t + len * k, hit(S, t, g, len * k, d, 0.003))
      },
    },
    chime: {
      len: () => 1.8,
      play(S, t, o, d) {
        const f = hz(o.note, 'D6')
        ;[f, up(f, 4)].forEach((fq, i) => {
          const s = t + i * B * 0.25
          const out = hit(S, s, 0.15 + i * 0.03, 1.6, d, 0.002)
          fm(S, s, fq, 1.6, 1, 1.4, 0.15, out)
          osc(S, 'sine', fq * 2.76, s, s + 0.4, hit(S, s, 0.025, 0.4, d, 0.002))
        })
      },
    },
    whoosh: {
      len: (o) => o.dur || 0.6,
      play(S, t, o, d) {
        sweep(S, t, o, o.dur || 0.6, 0.45, 1.1, [260, 2400, 520], d)
      },
    },
    swish: {
      len: (o) => o.dur || 0.28,
      play(S, t, o, d) {
        sweep(
          S,
          t,
          o,
          o.dur || 0.28,
          0.38,
          1.4,
          [1800, 6500, 3200],
          filter(S, 'highpass', 1100, 0.7, d),
        )
      },
    },
    riser: {
      len: (o) => o.dur || 2,
      play(S, t, o, d) {
        const len = o.dur || 2
        const end = t + len
        const n = amp(S, swell(t, len - 0.004, 0.28, 2).concat([[end, 0]]), d)
        const nf = [
          [t, 320],
          [end, 7500, 'e'],
        ]
        noise(S, t, end, filter(S, 'bandpass', nf, 1.8, n), t * 19)
        const f = hz(o.note, 'A3')
        const f1 = o.to ? hz(o.to, 'A4') : up(f, 7)
        const tone = amp(S, swell(t, len - 0.004, 0.13, 1.6).concat([[end, 0]]), d)
        const lp = filter(
          S,
          'lowpass',
          [
            [t, 500],
            [end, 5200, 'e'],
          ],
          0.7,
          tone,
        )
        for (const cents of [-7, 7]) {
          const g = [
            [t, f],
            [end, f1, 'e'],
          ]
          osc(S, 'sawtooth', g, t, end, lp, cents)
        }
      },
    },
    reverse: {
      len: (o) => o.dur || 1,
      play(S, t, o, d) {
        const len = o.dur || 1
        const end = t + len
        const a = amp(S, swell(t, len - 0.005, 0.38, 3).concat([[end, 0]]), d)
        const lp = filter(
          S,
          'lowpass',
          [
            [t, 300],
            [end, 3600, 'e'],
          ],
          0.6,
          a,
        )
        const f = hz(o.note, 'D4')
        osc(S, 'triangle', f, t, end, gain(S, 0.5, lp))
        osc(S, 'sawtooth', f * 1.5, t, end, gain(S, 0.18, lp), 6)
        osc(S, 'sawtooth', f * 2, t, end, gain(S, 0.12, lp), -6)
        noise(S, t, end, filter(S, 'bandpass', 1600, 0.7, gain(S, 0.5, a)), t * 23)
      },
    },
    impact: {
      len: () => 1.4,
      play(S, t, o, d) {
        // With a note the boom rings on it (the manifesto's three chord roots).
        const f = o.note ? hz(o.note) : 0
        const boom = f
          ? [
              [t, f * 1.6],
              [t + 0.12, f, 'e'],
              [t + 1.3, f * 0.94, 'e'],
            ]
          : [
              [t, 125],
              [t + 0.25, 44, 'e'],
              [t + 1.3, 34, 'e'],
            ]
        osc(S, 'sine', boom, t, t + 1.3, hit(S, t, f ? 0.4 : 0.45, f ? 1 : 1.3, d, 0.003))
        const thump = [
          [t, 230],
          [t + 0.08, 82, 'e'],
        ]
        osc(S, 'triangle', thump, t, t + 0.14, hit(S, t, 0.35, 0.13, d))
        noise(
          S,
          t,
          t + 0.06,
          filter(S, 'highpass', 1600, 0.7, hit(S, t, 0.4, 0.05, d, 0.001)),
          t * 29,
        )
        noise(S, t, t + 0.6, filter(S, 'lowpass', 900, 0.6, hit(S, t, 0.22, 0.55, d)), t * 31)
      },
    },
    boom: {
      len: (o) => (o.dur || 0.5) + 0.35,
      play(S, t, o, d) {
        const len = o.dur || 0.5
        const land = t + len
        const a = amp(
          S,
          [
            [t, 0],
            [t + len * 0.8, 0.21],
            [land, 0.19],
            [land + 0.32, 0.0003, 'e'],
          ],
          d,
        )
        const f = [
          [t, 280],
          [land, 55, 'e'],
          [land + 0.32, 44, 'e'],
        ]
        osc(S, 'sine', f, t, land + 0.33, a)
        const nf = [
          [t, 1600],
          [land, 200, 'e'],
        ]
        noise(S, t, land + 0.1, filter(S, 'lowpass', nf, 0.8, gain(S, 0.4, a)), t * 37)
      },
    },
    blade: {
      len: () => 0.7,
      play(S, t, o, d) {
        // The resonators: noise rung through four inharmonic, very narrow bands.
        const ring = hit(S, t, 0.9, 0.6, d, 0.001)
        for (const [f, g] of [
          [3150, 1],
          [4730, 0.8],
          [6890, 0.65],
          [9240, 0.5],
        ])
          noise(S, t, t + 0.6, filter(S, 'bandpass', f, 38, gain(S, g * 2.2, ring)), f)
        const ping = [
          [t, 7400],
          [t + 0.02, 5200, 'e'],
        ]
        osc(S, 'sine', ping, t, t + 0.4, hit(S, t, 0.14, 0.38, d, 0.001))
        // The stutter: a square LFO gating a bright burst for the first 70 ms.
        const gate = S.ac.createGain()
        gate.gain.value = 0.5
        gate.connect(hit(S, t, 0.5, 0.08, d, 0.001))
        osc(S, 'square', 42, t, t + 0.09, gain(S, 0.5, gate.gain))
        noise(S, t, t + 0.09, filter(S, 'highpass', 3000, 0.7, gate), t * 41)
      },
    },
    glitch: {
      len: (o) => o.dur || 0.14,
      play(S, t, o, d) {
        // Grains as stepped automation on one square and one noise, not a node per grain.
        const len = o.dur || 0.14
        const r = prng(Math.round(t * 1000) + 7)
        const count = Math.max(5, Math.round(len / 0.009))
        const g1 = [[t, 0]]
        const g2 = [[t, 0]]
        const fq = [[t, 900]]
        for (let i = 0; i < count; i++) {
          const s = t + (len * i) / count
          const w = Math.min(len / count, 0.004 + r() * 0.008)
          const tone = r() < 0.55
          fq.push([s, 500 + Math.floor(r() * 8) * 420, 's'])
          g1.push([s, tone ? 0.09 : 0, 's'], [s + w, 0, 's'])
          g2.push([s, tone ? 0.06 : 0.2, 's'], [s + w, 0, 's'])
        }
        g1.push([t + len, 0, 's'])
        g2.push([t + len, 0, 's'])
        osc(S, 'square', fq, t, t + len, filter(S, 'lowpass', 5000, 0.7, amp(S, g1, d)))
        noise(S, t, t + len, filter(S, 'highpass', 1800, 0.7, amp(S, g2, d)), t * 43)
      },
    },
    shimmer: {
      len: (o) => (o.dur || 1.2) + 0.6,
      play(S, t, o, d) {
        const len = o.dur || 1.2
        const root = hz(o.note, 'D6')
        const r = prng(Math.round(t * 1000) + 11)
        const steps = [0, 4, 7, 9, 12, 14, 16, 19]
        for (let i = 0; i < 7; i++) {
          const s = t + len * 0.65 * (i / 7) + r() * 0.03
          const f = up(root, steps[Math.floor(r() * steps.length)])
          osc(S, 'sine', f, s, s + 0.55, hit(S, s, 0.09, 0.55, pan(S, r() * 1.2 - 0.6, d), 0.004))
        }
        const glide = [
          [t, root],
          [t + len, root * 1.5, 'e'],
        ]
        const a = amp(
          S,
          [
            [t, 0],
            [t + len * 0.4, 0.05],
            [t + len, 0],
          ],
          d,
        )
        osc(S, 'sine', glide, t, t + len, a)
        const air = amp(
          S,
          [
            [t, 0],
            [t + len * 0.5, 0.06],
            [t + len, 0],
          ],
          d,
        )
        noise(S, t, t + len, filter(S, 'highpass', 8500, 0.7, air), t * 47)
      },
    },
    clack: {
      len: () => 0.06,
      play(S, t, o, d) {
        noise(
          S,
          t,
          t + 0.04,
          filter(S, 'bandpass', 2300, 3, hit(S, t, 1.4, 0.03, d, 0.0006)),
          t * 53,
        )
        osc(
          S,
          'square',
          380,
          t,
          t + 0.025,
          filter(S, 'lowpass', 2000, 0.7, hit(S, t, 0.12, 0.02, d)),
        )
      },
    },
    zip: {
      len: (o) => o.dur || 0.14,
      play(S, t, o, d) {
        const len = o.dur || 0.14
        const f = [
          [t, 480],
          [t + len, 5200, 'e'],
        ]
        const a = amp(
          S,
          [
            [t, 0],
            [t + 0.004, 0.17],
            [t + len * 0.8, 0.12],
            [t + len, 0],
          ],
          d,
        )
        osc(S, 'sine', f, t, t + len, a)
        noise(S, t, t + len, filter(S, 'bandpass', f, 3, gain(S, 0.9, a)), t * 59)
      },
    },
    thunk: {
      len: () => 0.3,
      play(S, t, o, d) {
        const low = o.note ? hz(o.note) : 86
        const f = [
          [t, low * 1.9],
          [t + 0.12, low, 'e'],
        ]
        osc(S, 'sine', f, t, t + 0.28, hit(S, t, 0.7, 0.26, d))
        const wood = [
          [t, low * 3.8],
          [t + 0.04, low * 2.1, 'e'],
        ]
        osc(S, 'triangle', wood, t, t + 0.07, hit(S, t, 0.3, 0.06, d))
        noise(
          S,
          t,
          t + 0.02,
          filter(S, 'lowpass', 2200, 0.7, hit(S, t, 0.3, 0.015, d, 0.0005)),
          t * 61,
        )
      },
    },
    stamp: {
      len: () => 0.25,
      play(S, t, o, d) {
        const f = [
          [t, 135],
          [t + 0.07, 55, 'e'],
        ]
        osc(S, 'sine', f, t, t + 0.2, hit(S, t, 0.8, 0.18, d))
        noise(
          S,
          t,
          t + 0.01,
          filter(S, 'highpass', 3500, 0.7, hit(S, t, 0.5, 0.006, d, 0.0004)),
          t * 67,
        )
        noise(
          S,
          t,
          t + 0.05,
          filter(S, 'bandpass', 900, 1.5, hit(S, t, 0.5, 0.04, d, 0.001)),
          t * 71,
        )
      },
    },
    flick: {
      len: () => 0.04,
      play(S, t, o, d) {
        const f = [
          [t, 5000],
          [t + 0.03, 8200, 'e'],
        ]
        noise(S, t, t + 0.035, filter(S, 'bandpass', f, 2, hit(S, t, 0.8, 0.03, d, 0.002)), t * 73)
      },
    },
    formant: {
      len: (o) => o.dur || 0.14,
      play(S, t, o, d) {
        // Two octaves under the note it is given: a voice sits lower than a pluck.
        const vowel = Math.round(t / (B / 4))
        formant(S, t, hz(o.note, 'D6') / 4, 0.9, o.dur || 0.14, vowel, d)
      },
    },
  }

  /*
   * The read-aloud in the green-pen scene is written as plucks on 16ths
   * (b38-39.5): those are the film's only 'voice', so they are sung through
   * the formant filter instead, and ride the kick like the rest of the bed.
   */
  function voiceFor(c) {
    if (BED_NAMES.has(c.name)) return null
    if (c.name === 'pluck' && c.scene === '05-echo') {
      const beat = c.t / B
      if (beat >= 37.9 && beat < 39.6) return 'formant'
    }
    if (c.name === 'voice') return 'formant'
    return VOICES[c.name] ? c.name : 'unknown'
  }

  function playCue(S, t, c, v) {
    const o = c.opts || {}
    const quiet = v === 'unknown'
    const voice = quiet ? VOICES.tick : VOICES[v]
    const len = voice.len(o)
    const g = (typeof o.gain === 'number' ? o.gain : 0.8) * (quiet ? 0.35 : 1)
    const dest = v === 'formant' ? S.duckSub : S.fx
    const out = gain(S, g, pan(S, o.pan, dest, t, t + len, o.panTo))
    voice.play(S, t, o, out)
  }

  /* ---------------------------------------------------------- schedule */

  function schedule(S) {
    const { ev, kicks } = bed()
    const beatSec = (b) => b * B

    // Everything, tails included, passes a gate that shuts for the planned silences.
    const gatePts = [[0, 1]]
    for (const s of SILENCES) {
      // The gap runs to the next downbeat and not a sample past it: that
      // downbeat is the drop, and a gate still shut there eats its transient.
      const a = beatSec(s)
      const b = beatSec(Math.ceil(s))
      gatePts.push([a - 0.006, 1], [a, 0], [b - 0.002, 0], [b - 0.0002, 1])
    }
    gatePts.push([REEL.duration - 0.004, 1], [REEL.duration, 0])
    const gate = amp(S, gatePts, S.bus)

    // The sidechain: the pad and the sub dip on every kick and breathe back.
    const duck = (depth, back) => {
      const pts = [[0, 1]]
      for (const k of kicks.sort((x, y) => x - y)) {
        pts.push([k - 0.003, 1], [k + 0.012, depth], [k + back, 1])
      }
      return amp(S, pts, gate)
    }
    S.duckSub = duck(0.3, 0.24)
    S.sub = gain(S, 0.28, S.duckSub)
    S.pad = gain(S, 0.14, duck(0.55, 0.3))
    S.drums = gain(S, 0.36, gate)
    S.hats = gain(S, 0.35, pan(S, 0.18, gate))
    S.music = gain(S, 0.4, gate)
    // The effects are ridden like a fader: under the intro's silence they need
    // less level to read than on top of a drop.
    S.fx = amp(
      S,
      FX_RIDE.map(([b, v], i) => [b * B, v * 0.8, i ? 's' : undefined]),
      gate,
    )

    for (const c of REEL.cues) {
      const v = voiceFor(c)
      if (!v) continue
      const len = (v === 'unknown' ? VOICES.tick : VOICES[v]).len(c.opts || {})
      ev.push({ t: c.t, len, fn: (s, t) => playCue(s, t, c, v) })
    }
    for (const e of ev) {
      if (e.t + e.len > S.from && e.t < REEL.duration) e.fn(S, e.t)
    }
    return S
  }

  /* ------------------------------------------------------------ master */

  /* Linear to -2 dBFS, then a soft knee that never passes -1.1 dBFS: a safety, not a sound. */
  function softClip() {
    const n = 4096
    const curve = new Float32Array(n)
    const knee = 0.794
    const ceil = 0.881
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      const ax = Math.abs(x)
      const y = ax < knee ? ax : knee + (ceil - knee) * Math.tanh((ax - knee) / (ceil - knee))
      curve[i] = Math.sign(x) * y
    }
    return curve
  }

  function masterBus(ac) {
    const input = ac.createGain()
    input.gain.value = 1.5
    const glue = ac.createDynamicsCompressor()
    glue.threshold.value = -10
    glue.knee.value = 6
    glue.ratio.value = 1.5
    glue.attack.value = 0.015
    glue.release.value = 0.2
    const limit = ac.createDynamicsCompressor()
    limit.threshold.value = -6
    limit.knee.value = 0
    limit.ratio.value = 20
    limit.attack.value = 0.001
    limit.release.value = 0.08
    // Chrome adds make-up gain after a compressor; the trim takes it back so the
    // limited peaks sit under the clipper's knee and the clipper never sounds.
    const trim = ac.createGain()
    trim.gain.value = 0.84
    const clip = ac.createWaveShaper()
    clip.curve = softClip()
    input.connect(glue)
    glue.connect(limit)
    limit.connect(trim)
    trim.connect(clip)
    clip.connect(ac.destination)
    return input
  }

  /* --------------------------------------------------------------- wav */

  function encodeWav(buf, skip) {
    const n = buf.length - skip
    const L = buf.getChannelData(0)
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
    const bytes = new Uint8Array(44 + n * 4)
    const v = new DataView(bytes.buffer)
    const str = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
    }
    str(0, 'RIFF')
    v.setUint32(4, 36 + n * 4, true)
    str(8, 'WAVE')
    str(12, 'fmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 2, true)
    v.setUint32(24, buf.sampleRate, true)
    v.setUint32(28, buf.sampleRate * 4, true)
    v.setUint16(32, 4, true)
    v.setUint16(34, 16, true)
    str(36, 'data')
    v.setUint32(40, n * 4, true)
    // TPDF dither, seeded, so the quiet tail fades out instead of stepping.
    const r = prng(16)
    let o = 44
    for (let i = 0; i < n; i++) {
      for (const ch of [L, R]) {
        const s = Math.round(ch[i + skip] * 32767 + r() - r())
        v.setInt16(o, Math.max(-32768, Math.min(32767, s)), true)
        o += 2
      }
    }
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    }
    return btoa(bin)
  }

  /* ---------------------------------------------------------- contract */

  let ctx = null
  let out = null
  let live = null

  function stop() {
    const s = live
    live = null
    if (!s) return
    const now = ctx.currentTime
    s.bus.gain.cancelScheduledValues(now)
    s.bus.gain.setValueAtTime(1, now)
    s.bus.gain.linearRampToValueAtTime(0, now + 0.02)
    for (const node of s.sources) {
      try {
        node.stop(now + 0.03)
      } catch {
        /* already stopped */
      }
    }
    setTimeout(() => s.bus.disconnect(), 80)
  }

  REEL.audio = {
    attach(ac) {
      ctx = ac
      out = masterBus(ac)
    },
    start(fromSec, when) {
      if (!ctx) return
      stop()
      const from = Math.max(0, Math.min(fromSec, REEL.duration))
      live = schedule(session(ctx, out, from, Math.max(when - LATENCY, ctx.currentTime)))
    },
    stop,
    async renderWav() {
      const skip = Math.round(PREROLL * RATE)
      const oac = new OfflineAudioContext(2, skip + Math.ceil(REEL.duration * RATE), RATE)
      schedule(session(oac, masterBus(oac), 0, PREROLL - LATENCY))
      return encodeWav(await oac.startRendering(), skip)
    },
  }
})()
