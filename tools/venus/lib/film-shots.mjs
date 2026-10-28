// The introduction film's shots: what Venus does in each, in the day videos' own vocabulary
// (lib/score.mjs entrances, reactions and moves), timed by the film's clock (lib/film-clock.mjs).
// Pure: no browser, no files. film.mjs draws them; the tests perform them in every locale and check
// the red lines (faces, flashes) without drawing a frame.
//
// A shot is written in board time (English seconds). Each one has from/to on the board, its look, and
//   build(c, S)   her performance; S.at(b) is board time b in the shot's own clock, S.s(id, i) the
//                 i-th sentence of a line there ({ t0, t1, words })
//   cam(S, c)     { z, dx, lift } keyed in the shot's clock (the zoom keeps her face in place)
//   items(S)      [[t, { wear, neck }], ...] what she wears from t on
//   under/over(t, S, F)  what the film draws behind or over her (F: film.mjs's measured text)
// A shot with `day` is a day window (the race), with `wall` the wall; neither has her own animator.
import { createRequire } from 'node:module'
import path from 'node:path'
import { LOCALES } from './film-clock.mjs'
import { SPRINGS, COUPLE, ENTRANCES, REACTIONS, MOVE_IMPL, TAIL, TP, Keys, Adds } from './score.mjs'
import { FLAG } from './intro.mjs'
import { END_LEN } from './endcard.mjs'
import { RIG } from './paths.mjs'
import * as L from './layers.mjs'
import * as FL from './film-layers.mjs'

const req = createRequire(import.meta.url)
const VA = req(path.join(RIG, 'venus-anim.js'))
const r3 = (x) => Math.round(x * 1000) / 1000
export const FPS = 30
// the hello sticker in each language (the app's own, apps/mobile/assets/stickers/venus)
export const HELLO = {
  en: 'hello',
  tr: 'merhaba',
  de: 'hallo',
  es: 'hola',
  fr: 'bonjour',
  'pt-BR': 'ola',
  ru: 'privet',
  ar: 'marhaban',
}
// where the end card starts: after her slow blink (92.0) has had its moment, on the board
export const END_BOARD = 93.4

// A context like buildScore's, for one continuous shot; the vocabulary writes into it
function newCtx(plan = {}) {
  return {
    plan: { outfit: null, ...plan },
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
      props: [],
    },
    cam: { shakes: [], bumps: [] },
    hasBag: false,
  }
}
const shape = (s) => (Array.isArray(s) ? s : TAIL[s])
const tailTo = (c, t0, t1, s, e = 'inOut') =>
  TP.forEach((q, i) => c.k.to('tail.' + q, t0, t1, shape(s)[i], e))
const tailAt0 = (c, s) => TP.forEach((q, i) => c.k.key('tail.' + q, 0, shape(s)[i]))
const face = (c, t, name, ms = 200, ease) => c.ex.push({ t, name, ms, ...(ease ? { ease } : {}) })
// the vocabulary's own flashes and shutters are off in this film (its flashes are capped, and
// placed by the board); a reaction or entrance is run through this to drop them
function noFlashes(c, fn) {
  const nf = c.fx.flashes.length
  fn()
  c.fx.flashes.length = nf
  c.sfx = c.sfx.filter((s) => s.kind !== 'shutter' || s.film)
}
// the poster pose (MOVE_IMPL.egyptian), already held on the shot's first frame, released at `until`
function egyptianFrom0(c, until, name = 'regal') {
  c.k.key('sy', 0, 1.08)
  c.k.key('sx', 0, 0.95)
  if (until !== null) {
    c.k.seq('sy', [[until], [until + 0.3, 1, 'inOut']])
    c.k.seq('sx', [[until], [until + 0.3, 1, 'inOut']])
  }
  const end = until === null ? 1e4 : until
  c.add.layer('head.pitch', [
    [0, -9],
    [end, -9],
    [end + 0.3, 0, 'inOut'],
  ])
  for (const s of ['L', 'R'])
    c.add.layer(`ears.${s}.rot`, [
      [0, -12],
      [end, -12],
      [end + 0.3, 0, 'inOut'],
    ])
  face(c, 0, name, 1)
}
// a flash the board places: capped at a 20% wash (lib/layers.mjs flashes), with its shutter
function flash(c, t) {
  c.fx.flashes.push(t)
  c.sfx.push({ kind: 'shutter', at: t, gainDb: -4, film: true })
}

export const SHOTS = [
  // ---------------------------------------------------------------- B01-B03 cold open, name, setup
  {
    id: 'open',
    from: 0,
    to: 10.6,
    look: 'stage',
    build(c, S) {
      const s1 = S.s('intro-01', 0),
        s2 = S.s('intro-01', 1),
        s3 = S.s('intro-01', 2)
      tailAt0(c, 'wrap')
      flash(c, S.at(0.05))
      flash(c, S.at(0.55))
      // the second flash: a bored glance at it, then the double-take; the pose breaks on "Oh."
      const r0 = S.at(0.6)
      egyptianFrom0(c, r0 + 0.43, 'smug-lids')
      REACTIONS['double-take'](c, r0)
      face(c, s1.t0 - 0.06, 'saucer', 90, 'out')
      face(c, s2.t0 - 0.1, 'innocent', 160)
      tailTo(c, s2.t0 - 0.2, s2.t0 + 0.2, 'question')
      // "I wasn't posing.": straight back into it
      MOVE_IMPL.egyptian(c, { e: S.at(4.1) }, s3.t0 - 0.08)
      face(c, s3.t0, 'smug-lids', 220)
      flash(c, S.at(3.3))
      // B02 the name: chin up, then an ear perk on "LangX's cat."
      const n1 = S.s('intro-02', 0),
        n2 = S.s('intro-02', 1)
      REACTIONS['chin-up'](c, n1.t0 - 0.1, n2.t0 - 0.05)
      REACTIONS['ear-perk'](c, n2.t0, n2.t1 + 0.4)
      tailTo(c, n2.t1 + 0.1, n2.t1 + 0.5, 'question')
      // B03 the setup: unmoved by the brief, then the diva flick on "…I made a film."
      const a1 = S.s('intro-03', 0),
        a2 = S.s('intro-03', 1)
      REACTIONS['glance-unmoved'](c, a1.t0, a1.t1)
      noFlashes(c, () => REACTIONS['diva-flick'](c, a2.t0 - 0.12, a2.t1 + 0.2))
      face(c, a2.t1 - 0.1, 'smug-lids', 220)
      c.sfx.push({ kind: 'riser', at: a2.t0, gainDb: -10 })
    },
    cam: (S) => ({
      z: [
        [0, 1],
        [S.at(4.1), 1.04, 'inOut'],
        [S.at(6.5) - 0.01, 1.15, 'inOut'],
        [S.at(6.5) + 0.14, 1.3, 'out'],
      ],
    }),
  },
  // ---------------------------------------------------------------- B04 the title card (the cover)
  {
    id: 'title',
    from: 10.6,
    to: 13.6,
    look: 'stage',
    numAt: 10.7,
    build(c, S) {
      egyptianFrom0(c, null, 'smug-lids')
      tailAt0(c, FLAG)
      c.k.key('tail.wave', 0, 9) // the flag quivers
      c.cam.shakes.push(S.at(10.7))
      c.fx.impacts.push(S.at(10.7))
      c.sfx.push(
        { kind: 'whoosh', at: S.at(10.7) - 0.1, gainDb: -6 },
        { kind: 'thud', at: S.at(10.7), gainDb: 0 },
        { kind: 'sting', at: S.at(10.7), gainDb: -3 },
        { kind: 'pop', at: S.at(11.2), gainDb: -4 },
        { kind: 'sparkle', at: S.at(11.25), gainDb: -9 },
      )
      c.fx.sparkles.push([S.at(11.2), 540, 640])
    },
    // a two-line tagline (de, es, fr, pt-BR, ru) comes down to her ears: the stage drops with her
    // until they clear it by TITLE_EARS_GAP on the cover
    cam: (S) => ({
      z: [
        [0, 1],
        [S.len, 1.04, 'linear'],
      ],
      lift: [[0, -Math.max(0, Math.round((S.pillBottom ?? 0) + TITLE_EARS_GAP - TITLE_EARS_Y))]],
    }),
    over(t, S, F) {
      return (
        FL.title(t, S.at(10.7) - 0.13, F.titleF) +
        FL.pill(t, S.at(11.2), F.tagline, 540, F.taglineY, { color: L.BLUE, rtl: F.rtl })
      )
    },
  },
  // ---------------------------------------------------------------- B05 entrances
  {
    id: 'clap-entrances',
    from: 13.6,
    to: 14.1,
    look: 'stage',
    empty: true,
    build(c) {
      c.sfx.push({ kind: 'tick', at: 0, gainDb: -6 }, { kind: 'thud', at: 0.06, gainDb: -5 })
    },
    over: (t) => FL.clapper(t, 0),
  },
  {
    id: 'strut',
    from: 14.1,
    to: 15.1,
    look: 'sunburst',
    off: 0.55,
    build(c) {
      noFlashes(c, () => ENTRANCES.strut(c))
    },
  },
  {
    id: 'drop-in',
    from: 15.1,
    to: 16.1,
    look: 'mint-halftone',
    off: 0.08,
    build(c) {
      ENTRANCES['drop-in'](c)
      face(c, 1.0, 'smug-lids', 200)
    },
  },
  {
    id: 'bag-hop',
    from: 16.1,
    to: 17.1,
    look: 'stripes',
    off: 0.8,
    build(c) {
      ENTRANCES['bag-hop'](c)
      face(c, 1.62, 'regal', 260)
    },
    // the race's bag-day framing (BAG_CAM): pulled back and set up, so the hop and the bag it lands
    // in (the film's running gag, planted here) clear the caption bubble, logo and all
    cam: () => ({ z: [[0, BAG_CAM.z]], lift: [[0, BAG_CAM.lift]] }),
  },
  {
    // her ears, then her eyes over the ledge; she says the second sentence from there
    id: 'peek',
    from: 17.1,
    to: 18.6,
    look: 'lilac-dots',
    build(c, S) {
      const s = S.s('intro-04', 1)
      c.fx.ledge = true
      c.k.seq('y', [
        [0, 520],
        [0.03, 520],
        [0.2, 205, 'outBack'],
      ])
      tailAt0(c, 'straight')
      c.add.pulse('ears.R.swivel', 0.18, 0.26, 0.3, 0.4, 0.9)
      c.add.pulse('ears.L.swivel', 0.3, 0.38, 0.42, 0.54, 0.8)
      face(c, 0, 'curious', 1)
      face(c, s.t0 - 0.12, 'plotting', 160)
      face(c, s.t1 + 0.05, 'smug-lids', 220)
      for (const sd of ['L', 'R'])
        c.add.layer(`eyes.${sd}.px`, [
          [s.t1 + 0.1, 0],
          [s.t1 + 0.16, -0.7, 'out'],
          [s.t1 + 0.3, -0.7],
          [s.t1 + 0.36, 0.7, 'out'],
          [s.t1 + 0.5, 0.7],
          [s.t1 + 0.56, 0, 'out'],
        ])
      c.sfx.push(
        { kind: 'blip', at: 0.12, gainDb: -6 },
        { kind: 'tick', at: s.t1 + 0.16, gainDb: -9 },
      )
    },
    cam: () => ({ z: [[0, 1]], lift: [[0, 330]] }),
  },
  // ---------------------------------------------------------------- B06 the zoomies: the empty set
  {
    id: 'zoomies',
    from: 18.6,
    to: 21.4,
    look: 'stage',
    build(c, S) {
      c.base = { mode: 'stand', yaw: 90 }
      c.k.set('mode', 0, 'stand')
      c.k.set('yaw', 0, 90)
      c.k.set('flip', 0, 1)
      c.k.key('head.yaw', 0, -20)
      tailAt0(c, 'streak')
      c.k.seq('x', [
        [0, -1150],
        [0.5, 0, 'linear'],
      ])
      c.k.seq('walk.phase', [
        [0, -2.4],
        [0.5, 0, 'linear'],
      ])
      c.k.key('walk.amt', 0, 1.5)
      c.fx.props.push({
        kind: 'streaks',
        layer: 'back',
        t0: 0,
        t1: 0.55,
        v: [
          [0, 3000],
          [0.45, 3000],
          [0.52, 0, 'linear'],
        ],
      })
      face(c, 0, 'delighted', 1)
      // she is gone at the music's hard stop and back, skidding, on the board's 20.70
      const m0 = S.at(19.1)
      MOVE_IMPL['zoomies-dash'](c, { e: S.at(20.7) + 0.65 }, m0, { sit: false })
      // the skid: a puff of dust at her feet as she brakes
      c.poofs = [{ t: S.at(20.7) + 0.26, at: 'feet' }]
      // saucer-eyed as she streaks back in, "meant that" once she has stopped and turned
      face(c, S.at(20.7) + 0.08, 'saucer', 80, 'out')
      face(c, S.at(20.7) + 0.5, 'meant-it', 200)
      tailTo(c, S.at(21.0), S.at(21.0) + 0.3, 'straight')
      c.sfx.push(
        { kind: 'whoosh', at: 0.02, gainDb: -4 },
        { kind: 'tick', at: S.at(19.6), gainDb: -4 },
      )
    },
  },
  // ---------------------------------------------------------------- B07 looks
  {
    id: 'looks',
    from: 21.4,
    to: 28.4,
    look: 'sunburst',
    // model-turn's seated 3/4 (the outfit rule: what she wears only reads on the sitting body)
    plan: { outfit: 'any' },
    build(c, S) {
      const w = S.s('intro-06', 0),
        a1 = S.s('intro-07', 0),
        a2 = S.s('intro-07', 1)
      c.sfx.push({ kind: 'tick', at: 0, gainDb: -6 }, { kind: 'thud', at: 0.06, gainDb: -5 })
      REACTIONS['chin-up'](c, w.t0, w.t1)
      MOVE_IMPL['model-turn'](c, { e: S.at(28.2) }, S.at(21.9))
      face(c, S.at(21.9) + 0.3, 'smug-lids', 220)
      // a quarter turn on every swap, then square to the lens for the onesie
      const swaps = [22.9, 23.4, 23.9, 24.4, 24.9]
      swaps.forEach((b, i) => {
        const t = S.at(b)
        const yaw = i === 4 ? 0 : i % 2 ? 28 : -28
        c.k.seq('yaw', [[t - 0.04], [t + 0.14, yaw, 'out']])
        c.k.seq('head.yaw', [[t - 0.04], [t + 0.14, i === 4 ? 0 : -yaw * 0.4, 'out']])
      })
      flash(c, S.at(23.4))
      c.k.set('outfit', S.at(24.4) + 0.06, 'hoodie')
      c.k.set('outfit', S.at(24.9) + 0.12, 'onesie')
      // the onesie: affronted, airplane ears, mouth shut; then the ears come back before she talks
      face(c, S.at(24.9) + 0.06, 'offended', 80, 'out')
      face(c, a1.t0 - 0.06, 'embarrassed', 200)
      REACTIONS['chin-up'](c, a2.t0 - 0.05, a2.t1 + 0.3)
      face(c, a2.t0 + 0.3, 'regal', 260)
      const crown = a2.words[a2.words.length - 1].t0
      c.fx.sparkles.push([crown, 540, 780])
      const pops = [0, 2, 4, 5]
      swaps
        .slice(0, 4)
        .forEach((b, i) => c.sfx.push({ kind: 'pop', at: S.at(b), gainDb: -5, pitch: pops[i] }))
      c.sfx.push(
        { kind: 'boing', at: S.at(24.9), gainDb: -4 },
        { kind: 'pop', at: crown - 0.02, gainDb: -6, pitch: 7 },
        { kind: 'ding', at: crown + 0.02, gainDb: -7 },
      )
      c.poofs = [
        ...swaps.slice(0, 3).map((b) => ({ t: S.at(b), at: 'head' })),
        { t: S.at(24.4), at: 'body' },
        { t: S.at(24.9), at: 'body', big: true },
      ]
    },
    // the onesie is the joke of "…Almost everything.": the camera rises with it, so the bubble
    // under that line leaves the onesie in view, not just its collar
    cam: (S) => ({
      z: [
        [0, 1],
        [S.at(21.9), 1, 'linear'],
        [S.len, 1.1, 'inOut'],
      ],
      lift: [
        [0, 0],
        [S.at(24.9), 0],
        [S.at(24.9) + 0.35, 150, 'inOut'],
      ],
    }),
    items: (S) => {
      const a2 = S.s('intro-07', 1)
      const crown = a2.words[a2.words.length - 1].t0
      return [
        [S.at(22.9) + 0.06, { wear: 'beret' }],
        [S.at(23.4) + 0.06, { wear: 'sunglasses' }],
        [S.at(23.9) + 0.06, { wear: null, neck: 'scarf' }],
        [S.at(24.4) + 0.06, { neck: null }],
        [crown, { wear: 'crown' }],
      ]
    },
    over: (t) => FL.clapper(t, 0),
  },
  // ---------------------------------------------------------------- B08-B10 the booth, the sticker
  {
    id: 'booth',
    from: 28.4,
    to: 40.9,
    look: 'mint-halftone',
    defs: ['blep', 'hi', 'diva', 'meantit', 'zoomies', 'boxhide', 'hamsi'],
    build(c, S) {
      c.sfx.push({ kind: 'tick', at: 0, gainDb: -6 }, { kind: 'thud', at: 0.06, gainDb: -5 })
      // six faces on the beat, one flash each, then the blep: the frame freezes on it
      const faces = ['smug-lids', 'saucer', 'sceptical', 'delighted', 'diva', 'plotting']
      const yaws = [-14, 10, -6, 12, -16, 8],
        rolls = [-8, 6, 10, -4, -10, 6]
      faces.forEach((name, i) => {
        const t = S.at(28.9 + i * 0.5)
        face(c, t - 0.02, name, 70, 'out')
        c.k.seq('head.yaw', [[t - 0.05], [t + 0.05, yaws[i], 'out']])
        c.add.pulse('head.roll', t - 0.04, t + 0.06, t + 0.38, t + 0.46, rolls[i])
        flash(c, t)
      })
      const bl = S.at(31.9)
      c.k.seq('head.yaw', [[bl - 0.05], [bl + 0.05, 0, 'out']])
      face(c, bl - 0.02, 'blep', 60, 'out')
      c.k.seq('mouth.tongue', [[bl - 0.02], [bl + 0.06, 1, 'out']])
      flash(c, bl)
      // B09 live again: flustered, a swipe at the print, the tongue back in
      const live = S.at(32.4)
      c.k.seq('mouth.tongue', [[live], [live + 0.08, 0, 'in']])
      face(c, live, 'flustered', 120)
      c.k.seq('paw.lift', [
        [live + 0.04],
        [live + 0.18, 0.85, 'outBack'],
        [live + 0.42],
        [live + 0.62, 0, 'inOut'],
      ])
      c.k.seq('paw.side', [
        [live + 0.04],
        [live + 0.2, 0.5, 'out'],
        [live + 0.42],
        [live + 0.62, 0, 'inOut'],
      ])
      const d2 = S.s('intro-08', 1)
      REACTIONS['glance-unmoved'](c, d2.t0, d2.t1)
      face(c, d2.t0 + 0.05, 'mock', 200)
      tailTo(c, d2.t0, d2.t0 + 0.4, 'question')
      // B10 the slaps: delighted, then proud on "Free"
      REACTIONS['pupils-bloom'](c, S.at(35.9), S.at(37.3))
      face(c, S.at(35.95), 'delighted', 200)
      const f1 = S.s('intro-09', 0),
        f2 = S.s('intro-09', 1)
      REACTIONS['chin-up'](c, f1.t0, f2.t1)
      tailTo(c, f2.t1, f2.t1 + 0.4, 'wrap')
      // the print's whoosh and the sticker landing; the slaps climb in pitch
      c.sfx.push(
        { kind: 'whoosh', at: live, gainDb: -6 },
        { kind: 'pop', at: S.at(33.2), gainDb: -4 },
        { kind: 'sparkle', at: S.at(33.2), gainDb: -9 },
        { kind: 'ding', at: S.at(37.4), gainDb: -8 },
      )
      SLAPS.forEach((s, i) => c.sfx.push({ kind: 'pop', at: S.at(s.b), gainDb: -4, pitch: i * 2 }))
      c.freeze = { at: bl + 0.08, live, flyEnd: S.at(33.2) }
    },
    cam: (S) => ({
      z: [
        [0, 1],
        [S.at(28.9) - 0.01, 1, 'linear'],
        [S.at(28.9) + 0.1, 1.35, 'out'],
        [S.at(32.4) - 0.01, 1.35],
        [S.at(32.4) + 0.14, 1, 'out'],
      ],
    }),
    over(t, S, F) {
      let s = FL.clapper(t, 0)
      const fr = S.c.freeze
      // the blep lands big above her, the punchline of "It's a sticker now.", and only takes its
      // place in the ring as the slaps begin
      if (t >= S.at(33.2) - 0.001) {
        const v = L.EASE.inOut(L.clamp((t - S.at(35.45)) / 0.4))
        const [x, y, size, rot] = BLEP_HERO.map((h, i) => h + (BLEP_AT[i] - h) * v)
        s += FL.sticker(t, S.at(33.2) - 0.2, 'st-blep', x, y, size, rot)
      }
      for (const sl of SLAPS)
        s += FL.sticker(t, S.at(sl.b), `st-${sl.id}`, sl.x, sl.y, sl.size, sl.rot)
      s += FL.pill(t, S.at(37.4), F.free, 540, L.BADGE_Y, { fill: L.YELLOW, rtl: F.rtl })
      return { s, freeze: fr }
    },
  },
  // ---------------------------------------------------------------- B11 the show: your streak
  {
    id: 'show',
    from: 40.9,
    to: 44.4,
    look: 'stage',
    numAt: 43.01,
    labelAt: 43.01,
    build(c, S) {
      const a = S.s('intro-10', 0),
        b = S.s('intro-10', 1)
      c.sfx.push({ kind: 'tick', at: 0, gainDb: -6 }, { kind: 'thud', at: 0.06, gainDb: -5 })
      face(c, a.t0 - 0.06, 'plotting', 200)
      tailTo(c, a.t0 - 0.1, a.t0 + 0.3, 'question')
      REACTIONS['chin-up'](c, b.t0 - 0.05, S.len + 1)
      tailTo(c, b.t0 + 0.2, b.t0 + 0.5, FLAG)
      c.sfx.push(
        { kind: 'pop', at: S.at(43.01), gainDb: 0 },
        { kind: 'sparkle', at: S.at(43.01) + 0.06, gainDb: -9 },
      )
    },
    cam: (S) => ({
      z: [
        [0, 1],
        [S.at(41.4), 1, 'linear'],
        [S.len, 1.12, 'inOut'],
      ],
    }),
    over(t, S, F) {
      return FL.clapper(t, 0) + L.number('stage', t, F.counter(1, S.at(43.01)), Infinity)
    },
  },
  // ---------------------------------------------------------------- B12 the race: the real days
  { id: 'd7', from: 44.4, to: 45.4, day: 7, align: 'R' },
  { id: 'd10', from: 45.4, to: 46.4, day: 10, align: 'R' },
  { id: 'd30', from: 46.4, to: 47.4, day: 30, align: 'R' },
  { id: 'd50', from: 47.4, to: 48.4, day: 50, align: 'R' },
  { id: 'd52', from: 48.4, to: 48.9, day: 52, align: 'bag' },
  { id: 'd59', from: 48.9, to: 49.4, day: 59, align: 'bag' },
  { id: 'd66', from: 49.4, to: 49.9, day: 66, align: 'bag' },
  // the kraft bag pops on "…Different bag."
  { id: 'd93', from: 49.9, to: 51.9, day: 93, align: 'bag', on: ['intro-12', 3] },
  { id: 'd99', from: 51.9, to: 52.9, day: 99, align: 'R' },
  // day 100 slams in (its count reveal overridden), and keeps playing into the wall's dolly
  { id: 'd100', from: 52.9, to: 54.9, day: 100, align: 'slam', runOn: 56.4 },
  // ---------------------------------------------------------------- B13-B14 the wall, the lock
  { id: 'wall', from: 54.9, to: 62.9, wall: true, look: 'stage', defs: ['tiles'] },
  // ---------------------------------------------------------------- B15 the bonk
  {
    id: 'bonk',
    from: 62.9,
    to: 66.8,
    look: 'lilac-dots',
    defs: ['tile31'],
    build(c, S) {
      const s = S.s('intro-16', 0)
      // she has been eyeing the locked frame since the cut
      face(c, 0, 'fixated', 1)
      for (const sd of ['L', 'R'])
        c.add.layer(`eyes.${sd}.py`, [
          [0, -0.8],
          [S.at(63.7), -0.8],
          [S.at(63.7) + 0.1, 0, 'out'],
        ])
      c.k.key('tail.wave', 0, 12)
      const { m0, back } = bonkClock(S)
      MOVE_IMPL['jump-fail'](c, { e: s.t1 + 0.45, sents: [s], v: s.t0 }, m0, {
        top: S.top ?? 300,
        pin: S.pin ?? null,
        slide: S.at(64.8) - back,
        licks: false,
      })
      // the licks wait for the line: two after it
      const after = s.t1 + 0.08
      c.k.seq('mouth.tongue', [
        [after],
        [after + 0.07, 0.75, 'out'],
        [after + 0.17, 0, 'in'],
        [after + 0.27, 0.75, 'out'],
        [after + 0.37, 0, 'in'],
      ])
      // the bonk: the jump's own whoosh, ticks and landing thud stay; its off-screen thud goes.
      // The hit is the leap's last frame, her head on the locked frame's bottom edge (film.mjs
      // bonkTop sets the height, and pins her there while she turns)
      const hit = back - 1 / FPS
      c.sfx = c.sfx.filter((x) => !(x.kind === 'thud' && Math.abs(x.at - (m0 + 0.87)) < 0.01))
      c.sfx.push(
        { kind: 'thud', at: hit, gainDb: 0 },
        { kind: 'boing', at: hit + 0.02, gainDb: -8 },
      )
      c.cam.shakes.push(hit)
      c.bonk = hit
    },
    // pulled back and set down, so the jump to the frame is a real one and her face stays clear
    // of the bubble once she is back on the ground
    cam: () => ({ z: [[0, BONK_CAM.z]], lift: [[0, BONK_CAM.lift]] }),
    under(t, S) {
      // the locked day, high on the wall: it rattles when she hits it
      const u = t - S.c.bonk
      const rot = u > 0 && u < 0.6 ? 3.5 * Math.sin(u * 40) * Math.exp(-u * 6) : 0
      const [x, y, w] = BONK_FRAME
      return `<g transform="rotate(${r3(rot)} ${x + w / 2} ${y})">${FL.lockedFrame(31, x, y, w)}</g>`
    },
    over(t, S) {
      const [x, y, w] = BONK_FRAME
      return L.impact(t, S.c.bonk, x + w / 2, y + w)
    },
  },
  // ---------------------------------------------------------------- B16 the comeback
  {
    id: 'comeback',
    from: 66.8,
    to: 75.0,
    look: 'sky-clouds',
    labelAt: 70.5,
    build(c, S) {
      const a1 = S.s('intro-17', 0),
        a2 = S.s('intro-17', 1),
        r = S.s('intro-18', 0)
      // in the bag, mid-groom on the cut (the comeback day's own entrance, cut short for the line)
      c.k.set('bag', 0, 1)
      c.hasBag = true
      tailAt0(c, 'wrap')
      c.k.seq('paw.lift', [[0, 0.78], [0.12], [0.3, 0, 'inOut']])
      c.add.layer('head.pitch', [
        [0, 15],
        [0.12, 15],
        [0.3, 0, 'inOut'],
      ])
      c.add.layer('head.roll', [
        [0, -12],
        [0.12, -12],
        [0.3, 0, 'inOut'],
      ])
      c.k.seq('mouth.tongue', [
        [0, 0],
        [0.04, 0.75, 'out'],
        [0.12, 0, 'in'],
      ])
      face(c, 0, 'drowsy', 1)
      face(c, a1.t0 - 0.1, 'neutral', 200)
      // "…I take mine in a bag.": smug, sinking into it
      face(c, a2.t0 - 0.05, 'smug-lids', 220)
      c.k.seq('y', [[a2.t0 - 0.05], [a2.t0 + 0.25, 46, 'inOut']])
      c.k.seq('y', [[r.t0 - 0.1], [r.t0 + 0.2, 0, 'inOut']])
      // the counter at one: bored face, the flag tail quivering anyway (a shorter flag: the full
      // one would cross the counter's label)
      const one = S.at(70.5)
      face(c, one, 'bored', 220)
      tailTo(c, one, one + 0.3, [...FLAG.slice(0, 5), 1.4])
      c.k.seq('tail.wave', [[one], [one + 0.3, 10]])
      // she notices the tail and swats it, then looks innocent
      const t1 = S.at(73.75)
      MOVE_IMPL['tail-notice'](
        c,
        { sents: [{ t0: 0 }, { t0: t1 + 0.7 }], v: 0, e: t1 + 1 },
        t1 - 0.4,
      )
      c.sfx.push(
        { kind: 'crinkle', at: 0.02, gainDb: -6 },
        { kind: 'crinkle', at: a2.t0, gainDb: -5 },
        { kind: 'pop', at: one, gainDb: 0 },
        { kind: 'sparkle', at: one + 0.06, gainDb: -9 },
        { kind: 'boing', at: t1 + 0.45, gainDb: -6 },
      )
    },
    // set up while "Breaks happen. …I take mine in a bag." is on, so the bag (the gag's payoff)
    // and her sinking into it show over the bubble; down again under the counter as it pops, by
    // which time she is out of the bag (her ears then have to clear its label)
    cam: (S) => ({
      z: [
        [0, 1.02],
        [S.len, 1.08, 'linear'],
      ],
      dx: [
        [0, -30],
        [S.len, 30, 'linear'],
      ],
      lift: [
        [0, COMEBACK_LIFT],
        [S.at(70.5) - 0.4, COMEBACK_LIFT],
        [S.at(70.5), 0, 'inOut'],
      ],
    }),
    over(t, S, F) {
      return L.number('sky-clouds', t, F.counter(1, S.at(70.5)), Infinity)
    },
  },
  // ---------------------------------------------------------------- B17-B18 hello ring, story
  {
    id: 'hello',
    from: 75.0,
    to: 82.8,
    look: 'sunburst',
    defs: ['hellos'],
    build(c, S) {
      const s2 = S.s('intro-19', 1),
        st2 = S.s('intro-20', 1)
      face(c, 0, 'curious', 1)
      tailAt0(c, 'question')
      REACTIONS['ear-perk'](c, s2.t0, s2.t1 + 0.4)
      face(c, s2.t0 + 0.45, 'delighted', 200)
      tailTo(c, s2.t1 + 0.2, s2.t1 + 0.6, 'wrap')
      // B18 the story: sunglasses, then the standing catwalk turn
      MOVE_IMPL['model-turn'](c, { e: st2.t1 + 0.2 }, S.at(79.2))
      face(c, S.at(79.2) + 0.3, 'diva', 220)
      face(c, st2.t0 - 0.05, 'smug-lids', 220)
      flash(c, S.at(81.0))
      flash(c, S.at(81.6))
      // the slaps on triplets (a third of a beat), climbing; the viewer's own lands last, biggest
      const others = LOCALES.filter((l) => l !== S.lang)
      others.forEach((l, i) =>
        c.sfx.push({ kind: 'pop', at: S.at(75.5 + i / 6), gainDb: -5, pitch: i * 2 }),
      )
      c.sfx.push(
        { kind: 'ding', at: S.at(77.83), gainDb: -6 },
        { kind: 'sparkle', at: S.at(77.85), gainDb: -8 },
        { kind: 'whoosh', at: S.at(79.0), gainDb: -6 },
        { kind: 'pop', at: S.at(79.1), gainDb: -6 },
      )
      c.poofs = [{ t: S.at(79.1) - 0.04, at: 'head' }]
      c.fx.sparkles.push([S.at(77.85), HELLO_AT[0], HELLO_AT[1]])
    },
    items: (S) => [[S.at(79.1) + 0.02, { wear: 'sunglasses' }]],
    over(t, S) {
      const others = LOCALES.filter((l) => l !== S.lang)
      const leave = S.at(79.0)
      let s = ''
      others.forEach((l, i) => {
        const [x, y] = RING[i]
        s += FL.sticker(
          t,
          S.at(75.5 + i / 6),
          `st-${HELLO[l]}`,
          x,
          y,
          RING_SIZE,
          ((i * 37) % 17) - 8,
          { leave, dir: [Math.sign(x - 540), (y - 820) / 600] },
        )
      })
      // the biggest one's pop never overshoots into the player's chrome (y < 270)
      s += FL.sticker(t, S.at(77.83), `st-${HELLO[S.lang]}`, ...HELLO_AT, 0, {
        leave,
        dir: [0, -1],
        minTop: 280,
      })
      return s
    },
  },
  // ---------------------------------------------------------------- B19-B21 the deal, the crack, the end
  {
    id: 'deal',
    from: 82.8,
    to: null,
    look: 'stage',
    burstFade: 86.0,
    build(c, S) {
      const d1 = S.s('intro-21', 0),
        d2 = S.s('intro-21', 1),
        d3 = S.s('intro-21', 2)
      const h1 = S.s('intro-22', 0),
        h2 = S.s('intro-22', 1),
        h3 = S.s('intro-22', 2)
      REACTIONS['ear-perk'](c, d1.t0, d1.t1 + 0.1)
      face(c, d1.t0 + 0.25, 'plotting', 200)
      // "You show up.": a warm look (happy, never loving)
      face(c, d2.t0 - 0.05, 'happy', 300)
      c.add.pulse('head.roll', d2.t0 - 0.05, d2.t0 + 0.3, d3.t0 - 0.15, d3.t0, 6)
      // "I show off.": the cold open's pose, the flag tail, a flash
      MOVE_IMPL.egyptian(c, { e: S.at(86.0) - 0.05 }, d3.t0 - 0.08)
      face(c, d3.t0, 'smug-lids', 200)
      tailTo(c, d3.t0, d3.t0 + 0.3, FLAG)
      flash(c, d3.t0)
      c.sfx.push({ kind: 'sting', at: d3.t0, gainDb: -4 })
      // the crack: the pose breaks, she sits; sceptical, then proud for the honest line
      tailTo(c, S.at(86.0), S.at(86.0) + 0.4, 'wrap')
      face(c, h1.t0 - 0.06, 'sceptical', 200)
      face(c, h2.t0 - 0.06, 'proud', 260)
      // the whisper (render.mjs's own lean-in)
      const wa = h3.t0
      face(c, wa - 0.3, 'whisper', 280)
      c.add.pulse('head.dy', wa - 0.35, wa, h3.t1 + 0.3, h3.t1 + 0.7, 16)
      c.add.pulse('head.s', wa - 0.35, wa, h3.t1 + 0.3, h3.t1 + 0.7, 0.06)
      // caught being nice: a look away and back, then the house slow blink
      const away = S.at(91.3)
      face(c, away, 'proud', 260)
      c.k.seq('head.yaw', [
        [away],
        [away + 0.22, -24, 'inOut'],
        [away + 0.5],
        [away + 0.68, 0, 'inOut'],
      ])
      for (const sd of ['L', 'R'])
        c.add.layer(`eyes.${sd}.px`, [
          [away, 0],
          [away + 0.12, -0.8, 'out'],
          [away + 0.5, -0.8],
          [away + 0.62, 0, 'out'],
        ])
      const b = S.at(92.0)
      // the eyes stay shut a good half second, and she holds the look after it before the card
      face(c, b, 'slowblink', 420, 'in')
      face(c, b + 0.95, 'happy', 380, 'out')
      c.add.pulse('head.pitch', b, b + 0.4, b + 0.8, b + 1.2, 5)
      for (const sd of ['L', 'R'])
        c.k.seq(`ears.${sd}.fold`, [
          [b - 0.05],
          [b + 0.25, 0.25, 'out'],
          [b + 0.9],
          [b + 1.2, 0, 'inOut'],
        ])
      c.sfx.push(
        { kind: 'purr', at: b, seconds: 1.6, gainDb: -4 },
        { kind: 'sparkle', at: b + 0.2, gainDb: -11 },
      )
      c.whisperAt = wa
    },
    cam: (S) => {
      const h3 = S.s('intro-22', 2)
      return {
        z: [
          [0, 1.15],
          [h3.t0 - 0.35, 1.15, 'linear'],
          [h3.t0 + 0.05, 1.38, 'inOut'],
          [h3.t1 + 0.4, 1.38],
          [S.at(92.0) + 0.5, 1.3, 'inOut'],
        ],
      }
    },
  },
]
// the sticker ring of B10, round her and clear of her head (x 340-740, y 735-1270 at zoom 1), and
// inside the frame's safe area (x 90-990, y 290-1240): stickers at a size a phone reads
export const SLAPS = [
  { b: 35.9, id: 'hi', x: 868, y: 800, size: 240, rot: 7 },
  { b: 36.4, id: 'diva', x: 212, y: 1100, size: 240, rot: 6 },
  { b: 36.9, id: 'meantit', x: 868, y: 1110, size: 240, rot: -6 },
  { b: 37.4, id: 'zoomies', x: 225, y: 470, size: 240, rot: -5 },
  { b: 37.9, id: 'boxhide', x: 855, y: 470, size: 240, rot: 8 },
  { b: 38.4, id: 'hamsi', x: 540, y: 570, size: 240, rot: 0 },
]
// her ear tips on the title card's cover frame (12.40) without a lift, and the room the tagline
// pill keeps above them
export const TITLE_EARS_Y = 690
export const TITLE_EARS_GAP = 70
export const BLEP_AT = [215, 790, 240, -8]
// where the print lands first: big, over her head (her ears top out near y 735), under the header
export const BLEP_HERO = [540, 520, 400, -6]
// the print: a square round her face at the booth's zoom
export const PRINT = [190, 690, 700]
// the hello ring of B17: seven slots in two columns either side of her, then the viewer's own,
// biggest, top centre (HELLO_AT)
export const RING = [
  [205, 410],
  [875, 530],
  [205, 650],
  [875, 770],
  [205, 890],
  [875, 1010],
  [205, 1125],
]
export const RING_SIZE = 250
export const HELLO_AT = [540, 500, 380]
// the locked cover the bonk hits: the wall's tile 31, pushed into until it is this square (x 300-780,
// y 300-780: as big as the board's, and high enough over her that the jump to it reads)
export const BONK_FRAME = [300, 300, 480]
export const BONK_CAM = { z: 0.62, lift: -140 }
// the race's bag days (film.mjs dayWindow) and the bag-hop entrance: pulled back and set up so the
// bag clears the caption bubble
export const BAG_CAM = { z: 0.78, lift: 125 }
// the comeback's rise while its bag is the joke
const COMEBACK_LIFT = 170
// the bonk's beats in the shot's clock: the crouch at m0, the leap's last frame (the hit) just before
// `back`, which falls on a frame so the hit is one; the board's leap is 63.70 and the hit 64.00
export function bonkClock(S) {
  const back = Math.round((S.at(63.25) + 0.75) * FPS) / FPS
  return { m0: back - 0.75, back }
}

// ------------------------------------------------------------------ placing and performing
// Every shot in film time: T0, T1 (the next shot's start; the last runs to the end of the card),
// and off (where its animator starts, for a shot that cuts into a move already under way).
export function placeShots(clock, lang = clock.lang) {
  const W = clock.W
  const duration = r3(W(END_BOARD) + END_LEN)
  return SHOTS.map((s, i) => ({
    ...s,
    lang,
    T0: W(s.from),
    T1: i < SHOTS.length - 1 ? W(SHOTS[i + 1].from) : duration,
    off: s.off || 0,
  }))
}
export function shotClock(sh, clock) {
  const base = sh.T0 - sh.off
  const sOf = (s) => ({
    ...s,
    t0: s.t0 - base,
    t1: s.t1 - base,
    words: s.words.map((w) => ({ ...w, t0: w.t0 - base, t1: w.t1 - base })),
  })
  return {
    at: (b) => clock.W(b) - base,
    s: (id, i) => sOf(clock.lines[id].sents[i]),
    line: (id) => clock.lines[id].sents.map(sOf),
    len: sh.T1 - sh.T0 + sh.off,
    lang: sh.lang,
  }
}
// One shot's performance: its context (sounds, effects), its animator (null for an empty set), the
// camera and the wear timeline. The animator only steps forward: frames are asked for in order.
export function performShot(sh, S) {
  const c = newCtx(sh.plan)
  sh.build(c, S)
  S.c = c
  const len = S.len + 0.5
  // idle: a breath under everything, the tail tip never quite still
  c.add.wave('head.dy', 0, len, 1.6, 2.6)
  c.k.seq('tail.phase', [
    [0, 0],
    [len, len * 1.2, 'linear'],
  ])
  const blinks = []
  for (let t = 1.1; t < len - 0.3; t += 2.7 + ((t * 7) % 1.3)) blinks.push(t)
  const anim = sh.empty
    ? null
    : VA.create({
        fps: FPS,
        duration: len,
        base: c.base,
        expr: c.ex,
        keys: c.k.k,
        add: c.add.bake(len),
        blinks,
        springs: SPRINGS,
        couple: COUPLE,
      })
  const cam = sh.cam ? sh.cam(S, c) : { z: [[0, 1]] }
  cam.shakes = c.cam.shakes
  cam.bumps = c.cam.bumps
  const items = (sh.items ? sh.items(S) : []).slice().sort((a, b) => a[0] - b[0])
  return { c, S, anim, cam, items, IT: null, itemsAt: -1 }
}

// ------------------------------------------------------------------ what the checks read
// Every flash the film fires and every hard cut, in film time, from performed shots (placeShots'
// shots, each with performShot's result merged in). The dolly from day 100 into the wall is one
// continuous move, not a cut.
export function flashesAndCuts(shots) {
  const flashes = []
  for (const sh of shots) {
    if (!sh.c) continue
    for (const t of sh.c.fx.flashes) {
      const ft = r3(t - sh.off + sh.T0)
      if (ft >= sh.T0 - 1e-6 && ft < sh.T1) flashes.push(ft)
    }
  }
  const cuts = shots
    .slice(1)
    .filter((s) => !s.wall)
    .map((s) => s.T0)
  return { flashes: flashes.sort((a, b) => a - b), cuts }
}
