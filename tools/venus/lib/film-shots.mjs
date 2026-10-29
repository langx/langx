// The introduction film's shots: what Venus does in each, in the day videos' own vocabulary
// (lib/score.mjs entrances, reactions and moves), timed by the film's clock (lib/film-clock.mjs).
// Pure: no browser, no files. film.mjs draws them; the tests perform them in every locale and check
// the red lines (faces, flashes, joins, the camera) without drawing a frame.
//
// The film is one place: the dark stage's floor is under her in every shot of hers, and colour comes
// on backdrop flats (FLATS) that drop in behind her and fly out again. A shot is written in board
// time (English seconds). Each one has from/to on the board, how it is entered (tx), and
//   build(c, S)   her performance; S.at(b) is board time b in the shot's own clock, S.s(id, i) the
//                 i-th sentence of a line there ({ t0, t1, words })
//   cam(S, c)     { z, dx, lift } keyed in the shot's clock (the zoom keeps her face in place)
//   items(S)      [[t, { wear, neck }], ...] what she wears from t on
//   over(t, S, F, ft, flats)  what the film draws over her (F: film.mjs's measured text; ft: film
//                 time; flats: the backdrop's flats this frame, film-layers.mjs flatsAt)
// A shot with `day` is a day window (the race), with `wall` the wall; neither has her own animator.
//
// tx, the only ways one shot follows another (there is no bare cut):
//   first  the opening frame
//   cont   the same space and camera, her pose continuous or her off screen on both sides
//   poof   a big poof over her, centred on the join (film.mjs), the backdrop carrying on behind it
//   swipe  the race: the old day slides up as the new one comes in from below (the app's own gesture)
//   dolly  day 100 shrinks into its tile on the wall
//   match  the wall's push settles on the locked day, and she walks in under it
import { createRequire } from 'node:module'
import path from 'node:path'
import { LOCALES, ANCHORS } from './film-clock.mjs'
import {
  SPRINGS,
  COUPLE,
  ENTRANCES,
  REACTIONS,
  MOVE_IMPL,
  TAIL,
  TP,
  Keys,
  Adds,
  hopToSit,
  squash,
  walkKeys,
  setTail,
} from './score.mjs'
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
export const TX = ['first', 'cont', 'poof', 'swipe', 'dolly', 'match']
// The board's beats (English silent seconds) that more than one place reads
export const TITLE_HIT = ANCHORS.A.at // the VENUS slam: bar 0 of the score
const TITLE_OUT = 13.2 // the title flies up, she dashes out, the sunburst flat drops
const PEEK_UP = 18.8 // up over the stage's edge
const LOOKS_TURN = 19.7
const SWAPS = [20.7, 21.2, 21.7, 22.2, 22.7] // beret, shades, scarf, hoodie, onesie
const BOOTH = 26.2 // the booth's first flash: the onesie and the crown go in a poof
const BOOTH_FACES = 26.7
const BLEP = 28.2
const STICKER_AT = 29.5
const FREE_AT = 33.7
export const SHOW_AT = 37.2 // the mint flat flies, the stickers on it: the dark stage again
export const COUNTER_AT = 39.31
// the push into the locked tile, on "The rest stay locked.": 0.9 s to settle, then 0.3 s held
const WALL_PUSH = 57.3
const BONK = 58.5
const BONK_STOP = 59.1
const LEAP = 59.4
const BONK_LAND = 60.75
const COMEBACK_BAG = 62.6
const COMEBACK_ONE = 67.0
const HELLO_IN = 71.2
const RING_AT = 71.7
const SHADES_ON = 75.3
const STORY_FLASHES = [77.2, 77.8]
const DEAL_SIT = 78.55
const DEAL_FLY = ANCHORS.C.hold // the lilac flat flies; C's 0-3 beat hold waits here
export const CRACK_AT = 81.94
const LOOK_AWAY = 87.24
const BLINK_AT = 87.94
// where the end card starts: after her slow blink has had its moment, on the board
export const END_BOARD = 89.34
// The backdrop: [board time, look, 'drop' | 'fly' | 'set']. A drop lands over the flat below it and
// replaces it; 'wall' is the wall itself, held as the bonk's backdrop (film.mjs draws it).
export const FLATS = [
  [TITLE_OUT, 'sunburst', 'drop'],
  [BOOTH, 'mint-halftone', 'drop'],
  [SHOW_AT, 'mint-halftone', 'fly'],
  [BONK, 'wall', 'set'],
  [COMEBACK_BAG, 'sky-clouds', 'drop'],
  [HELLO_IN, 'lilac-dots', 'drop'],
  [DEAL_FLY, 'lilac-dots', 'fly'],
]
// the stage's yellow burst behind the header: [on, off] on the board (off fades over 0.4 s)
export const BURSTS = [
  [TITLE_HIT, 13.7],
  [COUNTER_AT, 40.7],
  [78.2, CRACK_AT],
]

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
// a two-line tagline (de, es, fr, pt-BR, ru) comes down to her ears: the stage drops with her until
// they clear it by TITLE_EARS_GAP on the cover
const titleLift = (S) =>
  Math.max(0, Math.round((S.pillBottom ?? 0) + TITLE_EARS_GAP - TITLE_EARS_Y))

export const SHOTS = [
  // ---------------------------------------------------------------- 1 the spotlight: open, name, title
  // One shot from the first frame to her exit: the camera's pull-back lands on the VENUS slam (bar 0
  // of the score), so the title comes in over her with no cut
  {
    id: 'spotlight',
    tx: 'first',
    from: 0,
    to: 13.6,
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
      // the name: chin up, then an ear perk on "LangX's cat."
      const n1 = S.s('intro-02', 0),
        n2 = S.s('intro-02', 1)
      REACTIONS['chin-up'](c, n1.t0 - 0.1, n2.t0 - 0.05)
      REACTIONS['ear-perk'](c, n2.t0, n2.t1 + 0.4)
      tailTo(c, n2.t1 + 0.1, n2.t1 + 0.5, 'question')
      // the setup: unmoved by the brief, then the diva flick on "…I made a film."
      const a1 = S.s('intro-03', 0),
        a2 = S.s('intro-03', 1)
      REACTIONS['glance-unmoved'](c, a1.t0, a1.t1)
      noFlashes(c, () => REACTIONS['diva-flick'](c, a2.t0 - 0.12, a2.t1 + 0.2))
      face(c, a2.t1 - 0.1, 'smug-lids', 220)
      // the flick flows into the poster pose, held on the slam with the flag tail up
      const hit = S.at(TITLE_HIT),
        out = S.at(TITLE_OUT)
      MOVE_IMPL.egyptian(c, { e: out - 0.12 }, hit - 0.35)
      tailTo(c, hit + 0.05, hit + 0.35, FLAG)
      c.k.seq('tail.wave', [[hit + 0.05], [hit + 0.35, 9]])
      c.cam.shakes.push(hit)
      c.fx.impacts.push(hit)
      c.fx.sparkles.push([hit + 0.5, 540, 640])
      c.sfx.push(
        { kind: 'whoosh', at: hit - 0.1, gainDb: -6 },
        // +3 dB: the SFX bus came down 3 dB, and the slam keeps its level against the voice
        { kind: 'thud', at: hit, gainDb: 3 },
        { kind: 'sting', at: hit, gainDb: 0 },
        { kind: 'pop', at: hit + 0.5, gainDb: -4 },
        { kind: 'sparkle', at: hit + 0.55, gainDb: -9 },
      )
      // the exit: the zoomies gag in 0.35 s, out to screen-left, the way the strut carries on
      c.k.set('mode', out, 'stand')
      c.k.set('yaw', out, 90)
      c.k.set('flip', out, -1)
      c.k.set('head.yaw', out, -20)
      setTail(c, out, 'streak')
      c.k.seq('x', [
        [out, 0],
        [out + 0.35, -1100, 'in'],
      ])
      c.k.seq('walk.phase', [
        [out, 0],
        [out + 0.35, 2.4, 'linear'],
      ])
      c.k.seq('walk.amt', [[out, 1.5]])
      c.fx.props.push({
        kind: 'streaks',
        layer: 'back',
        t0: out,
        t1: out + 0.4,
        v: [
          [out, 0],
          [out + 0.3, -3000, 'in'],
          [out + 0.36, 0, 'linear'],
        ],
      })
      face(c, out, 'delighted', 80)
      c.sfx.push({ kind: 'whoosh', at: out + 0.05, gainDb: -4 })
    },
    // the slow push; an eased push-in from "They asked…"; and the pull-back that lands on the slam
    // (0.65 s, out: a faster one would zoom more than 1.2 a second), easing the stage down for a
    // two-line tagline as it goes
    cam: (S) => ({
      z: [
        [0, 1],
        [S.at(4.1), 1.04, 'inOut'],
        [S.at(6.5), 1.15, 'inOut'],
        [S.at(6.7), 1.15],
        [S.at(7.5), 1.25, 'inOut'],
        [S.at(TITLE_HIT) - 0.65, 1.25],
        [S.at(TITLE_HIT), 1, 'out'],
      ],
      lift: [
        [S.at(TITLE_HIT) - 0.65, 0],
        [S.at(TITLE_HIT), -titleLift(S), 'out'],
      ],
    }),
    over(t, S, F) {
      // the title and the pill fly up as she dashes out
      const up = 1400 * L.EASE.in(L.clamp((t - S.at(TITLE_OUT)) / 0.4))
      if (up >= 1400) return ''
      const s =
        FL.title(t, S.at(TITLE_HIT) - 0.13, F.titleF) +
        FL.pill(t, S.at(TITLE_HIT) + 0.5, F.tagline, 540, F.taglineY, {
          color: L.BLUE,
          rtl: F.rtl,
        })
      return up > 0 ? `<g transform="translate(0 ${-Math.round(up)})">${s}</g>` : s
    },
  },
  // ---------------------------------------------------------------- 2 entrances, one space
  // ENTRANCES.strut, from further right: she is off screen on the join's first frame as she is on
  // the spotlight's last, so the stage stands empty for a moment rather than cutting
  {
    id: 'strut',
    tx: 'cont',
    from: TITLE_OUT + 0.4,
    to: 15.7,
    build(c) {
      c.base = { mode: 'stand', yaw: 90, flip: -1 }
      c.k.set('mode', 0, 'stand')
      c.k.set('yaw', 0, 90)
      c.k.set('flip', 0, -1)
      walkKeys(c, 0, 1.2, 700, 90, 3.4)
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
      face(c, 0, 'diva', 1)
      face(c, 1.2, 'curious', 160)
      face(c, 1.75, 'smug-lids', 220)
      hopToSit(c, 1.18)
    },
    // the title's lift (a two-line tagline) eases out as she comes in
    cam: (S) => ({
      z: [[0, 1]],
      lift: [
        [0, -titleLift(S)],
        [0.5, 0, 'inOut'],
      ],
    }),
  },
  {
    id: 'bag-hop',
    tx: 'poof',
    from: 15.7,
    to: 17.2,
    off: 0.8,
    build(c) {
      ENTRANCES['bag-hop'](c)
      face(c, 1.62, 'regal', 260)
      // the bag pops in under a puff: nothing she wears or sits on comes from nowhere
      c.poofs = [{ t: 1.44, at: 'seat' }]
    },
    // the race's bag framing, eased in: pulled back and set up, so the hop and the bag it lands in
    // (the film's running gag, planted here) clear the caption bubble
    cam: () => ({
      z: [
        [0.8, 1],
        [1.2, BAG_CAM_IN.z, 'inOut'],
      ],
      lift: [
        [0.8, 0],
        [1.2, BAG_CAM_IN.lift, 'inOut'],
      ],
    }),
  },
  // ---------------------------------------------------------------- 3 the peek, then the looks
  // One animator: her ears and eyes over the stage's edge ("…I have a few."), up over it, and the
  // looks from there
  {
    id: 'looks',
    tx: 'poof',
    from: 17.2,
    to: BOOTH,
    // model-turn's seated 3/4 (the outfit rule: what she wears only reads on the sitting body)
    plan: { outfit: 'any' },
    build(c, S) {
      const p = S.s('intro-04', 1)
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
      face(c, p.t0 - 0.12, 'plotting', 160)
      face(c, p.t1 + 0.05, 'smug-lids', 220)
      for (const sd of ['L', 'R'])
        c.add.layer(`eyes.${sd}.px`, [
          [p.t1 + 0.1, 0],
          [p.t1 + 0.16, -0.7, 'out'],
          [p.t1 + 0.3, -0.7],
          [p.t1 + 0.36, 0.7, 'out'],
          [p.t1 + 0.5, 0.7],
          [p.t1 + 0.56, 0, 'out'],
        ])
      c.sfx.push(
        { kind: 'blip', at: 0.12, gainDb: -6 },
        { kind: 'tick', at: p.t1 + 0.16, gainDb: -9 },
      )
      // up over the edge (ENTRANCES.peek's hop), the camera coming down with her
      const up = S.at(PEEK_UP)
      c.k.seq('y', [[up], [up + 0.14, 260, 'in'], [up + 0.44, 0, 'out']])
      c.k.seq('rise', [[up + 0.16], [up + 0.36, 70, 'out'], [up + 0.5, 0, 'in']])
      c.k.seq('crouch', [
        [up],
        [up + 0.14, 0.6, 'in'],
        [up + 0.2, 0, 'out'],
        [up + 0.5],
        [up + 0.54, 0.6, 'out'],
        [up + 0.8, 0, 'inOut'],
      ])
      squash(c, up + 0.5, 0.12, 0.34)
      c.k.tail(up + 0.3, up + 0.75, 'wrap')
      c.sfx.push(
        { kind: 'whoosh', at: up + 0.16, gainDb: -8 },
        { kind: 'thud', at: up + 0.5, gainDb: -6 },
      )
      // the looks
      const w = S.s('intro-06', 0),
        a1 = S.s('intro-07', 0),
        a2 = S.s('intro-07', 1)
      REACTIONS['chin-up'](c, w.t0, w.t1)
      MOVE_IMPL['model-turn'](c, { e: S.at(BOOTH - 0.2) }, S.at(LOOKS_TURN))
      face(c, S.at(LOOKS_TURN) + 0.3, 'smug-lids', 220)
      // a quarter turn on every swap, then square to the lens for the onesie
      SWAPS.forEach((b, i) => {
        const t = S.at(b)
        const yaw = i === 4 ? 0 : i % 2 ? 28 : -28
        c.k.seq('yaw', [[t - 0.04], [t + 0.14, yaw, 'out']])
        c.k.seq('head.yaw', [[t - 0.04], [t + 0.14, i === 4 ? 0 : -yaw * 0.4, 'out']])
      })
      flash(c, S.at(SWAPS[1]))
      c.k.set('outfit', S.at(SWAPS[3]) + 0.06, 'hoodie')
      c.k.set('outfit', S.at(SWAPS[4]) + 0.06, 'onesie')
      // the onesie: affronted, airplane ears, mouth shut; then the ears come back before she talks
      face(c, S.at(SWAPS[4]) + 0.06, 'offended', 80, 'out')
      face(c, a1.t0 - 0.06, 'embarrassed', 200)
      REACTIONS['chin-up'](c, a2.t0 - 0.05, a2.t1 + 0.3)
      face(c, a2.t0 + 0.3, 'regal', 260)
      const crown = crownAt(S)
      c.fx.sparkles.push([crown, 540, 780])
      const pops = [0, 2, 4, 5]
      SWAPS.slice(0, 4).forEach((b, i) =>
        c.sfx.push({ kind: 'pop', at: S.at(b), gainDb: -5, pitch: pops[i] }),
      )
      c.sfx.push(
        { kind: 'boing', at: S.at(SWAPS[4]), gainDb: -4 },
        { kind: 'pop', at: crown - 0.02, gainDb: -6, pitch: 7 },
        { kind: 'ding', at: crown + 0.02, gainDb: -7 },
      )
      c.poofs = [
        ...SWAPS.slice(0, 3).map((b) => ({ t: S.at(b), at: 'head' })),
        { t: S.at(SWAPS[3]), at: 'body' },
        { t: S.at(SWAPS[4]), at: 'body', big: true },
        { t: crown - 0.04, at: 'head' },
      ]
    },
    // from the bag framing to the peek's, eased; down with her as she comes up; and the onesie is
    // the joke of "…Almost everything.": the camera rises with it, so the bubble under that line
    // leaves the onesie in view, not just its collar
    cam: (S) => ({
      z: [
        [0, BAG_CAM_IN.z],
        [0.4, 1, 'inOut'],
        [S.at(LOOKS_TURN), 1],
        [S.len, LOOKS_END.z, 'inOut'],
      ],
      lift: [
        [0, BAG_CAM_IN.lift],
        [0.4, 330, 'inOut'],
        [S.at(PEEK_UP), 330],
        [S.at(PEEK_UP) + 0.5, 0, 'inOut'],
        [S.at(SWAPS[4]), 0],
        [S.at(SWAPS[4]) + 0.35, LOOKS_END.lift, 'inOut'],
      ],
    }),
    items: (S) => [
      [S.at(SWAPS[0]) + 0.06, { wear: 'beret' }],
      [S.at(SWAPS[1]) + 0.06, { wear: 'sunglasses' }],
      [S.at(SWAPS[2]) + 0.06, { wear: null, neck: 'scarf' }],
      [S.at(SWAPS[3]) + 0.06, { neck: null }],
      [crownAt(S), { wear: 'crown' }],
    ],
  },
  // ---------------------------------------------------------------- 4-5 the booth, the real show
  // The booth's first flash and a poof take the onesie and the crown as the mint flat drops; the
  // stickers and the Free pill sit on that flat and fly out with it, which shows the dark stage
  // again for "Now, the real show."
  {
    id: 'booth',
    tx: 'poof',
    from: BOOTH,
    to: 40.7,
    labelAt: COUNTER_AT,
    defs: ['blep', 'hi', 'diva', 'meantit', 'zoomies', 'boxhide', 'hamsi'],
    build(c, S) {
      flash(c, 0)
      face(c, 0, 'smug-lids', 1)
      // three faces on the beat, one flash each, then the blep: the frame freezes on it
      const faces = ['saucer', 'sceptical', 'diva']
      const yaws = [10, -6, -16],
        rolls = [6, 10, -10]
      faces.forEach((name, i) => {
        const t = S.at(BOOTH_FACES + i * 0.5)
        face(c, t - 0.02, name, 70, 'out')
        c.k.seq('head.yaw', [[t - 0.05], [t + 0.05, yaws[i], 'out']])
        c.add.pulse('head.roll', t - 0.04, t + 0.06, t + 0.38, t + 0.46, rolls[i])
        flash(c, t)
      })
      const bl = S.at(BLEP)
      c.k.seq('head.yaw', [[bl - 0.05], [bl + 0.05, 0, 'out']])
      face(c, bl - 0.02, 'blep', 60, 'out')
      c.k.seq('mouth.tongue', [[bl - 0.02], [bl + 0.06, 1, 'out']])
      flash(c, bl)
      // live again: flustered, a swipe at the print, the tongue back in
      const live = S.at(BLEP + 0.5)
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
      // the slaps: delighted, then proud on "Free"
      REACTIONS['pupils-bloom'](c, S.at(SLAPS[0].b), S.at(SLAPS[0].b + 1.4))
      face(c, S.at(SLAPS[0].b) + 0.05, 'delighted', 200)
      const f1 = S.s('intro-09', 0),
        f2 = S.s('intro-09', 1)
      REACTIONS['chin-up'](c, f1.t0, f2.t1)
      tailTo(c, f2.t1, f2.t1 + 0.4, 'wrap')
      // the print's whoosh and the sticker landing; the slaps climb in pitch
      c.sfx.push(
        { kind: 'whoosh', at: live, gainDb: -6 },
        { kind: 'pop', at: S.at(STICKER_AT), gainDb: -4 },
        { kind: 'sparkle', at: S.at(STICKER_AT), gainDb: -9 },
        { kind: 'ding', at: S.at(FREE_AT), gainDb: -8 },
      )
      SLAPS.forEach((s, i) => c.sfx.push({ kind: 'pop', at: S.at(s.b), gainDb: -4, pitch: i * 2 }))
      c.freeze = { at: bl + 0.08, live, flyEnd: S.at(STICKER_AT) }
      // the real show: plotting, then the counter's 1 with the flag tail
      const a = S.s('intro-10', 0),
        b = S.s('intro-10', 1)
      face(c, a.t0 - 0.06, 'plotting', 200)
      tailTo(c, a.t0 - 0.1, a.t0 + 0.3, 'question')
      REACTIONS['chin-up'](c, b.t0 - 0.05, S.len + 1)
      tailTo(c, b.t0 + 0.2, b.t0 + 0.5, FLAG)
      c.sfx.push(
        { kind: 'pop', at: S.at(COUNTER_AT), gainDb: 0 },
        { kind: 'sparkle', at: S.at(COUNTER_AT) + 0.06, gainDb: -9 },
      )
    },
    // in for the faces as a half-second push (no snap), out again as the print flies, and the
    // real show's slow push. It opens on the looks' last framing (risen for the onesie), so the
    // floor does not jump under the poof, and leaves it with the push.
    cam: (S) => {
      const f = S.at(BOOTH_FACES),
        live = S.at(BLEP + 0.5)
      return {
        z: [
          [0, LOOKS_END.z],
          [f - 0.3, LOOKS_END.z],
          [f + 0.2, 1.35, 'inOut'],
          [live, 1.35],
          [live + 0.5, 1, 'inOut'],
          [S.at(SHOW_AT) + 0.7, 1],
          [S.len, 1.12, 'inOut'],
        ],
        lift: [
          [0, LOOKS_END.lift],
          [f - 0.3, LOOKS_END.lift],
          [f + 0.2, 0, 'inOut'],
        ],
      }
    },
    over(t, S, F, ft, flats = []) {
      let s = ''
      // the blep lands big above her, the punchline of "It's a sticker now.", and only takes its
      // place in the ring as the slaps begin
      if (t >= S.at(STICKER_AT) - 0.001) {
        const v = L.EASE.inOut(L.clamp((t - (S.at(SLAPS[0].b) - 0.45)) / 0.4))
        const [x, y, size, rot] = BLEP_HERO.map((h, i) => h + (BLEP_AT[i] - h) * v)
        s += FL.sticker(t, S.at(STICKER_AT) - 0.2, 'st-blep', x, y, size, rot)
      }
      for (const sl of SLAPS)
        s += FL.sticker(t, S.at(sl.b), `st-${sl.id}`, sl.x, sl.y, sl.size, sl.rot)
      s += FL.pill(t, S.at(FREE_AT), F.free, 540, L.BADGE_Y, { fill: L.YELLOW, rtl: F.rtl })
      // they are on the mint flat, and leave with it: carried up as it flies (flats: the backdrop's
      // flats as drawn this frame), gone once it is out. Left behind, they hung over the dark stage.
      if (t >= S.at(SHOW_AT) - 1e-6) {
        const mint = flats.find((f) => f.look === 'mint-halftone')
        if (!mint) s = ''
        else if (mint.dy < 0) s = `<g transform="translate(0 ${Math.round(mint.dy)})">${s}</g>`
      }
      s += L.number('stage', t, F.counter(1, S.at(COUNTER_AT)), Infinity)
      return { s, freeze: S.c.freeze }
    },
  },
  // ---------------------------------------------------------------- 6 the race: the real days
  { id: 'd7', tx: 'swipe', from: 40.7, to: 41.7, day: 7, align: 'R' },
  { id: 'd10', tx: 'swipe', from: 41.7, to: 42.7, day: 10, align: 'R' },
  { id: 'd30', tx: 'swipe', from: 42.7, to: 43.7, day: 30, align: 'R' },
  { id: 'd50', tx: 'swipe', from: 43.7, to: 44.7, day: 50, align: 'R' },
  { id: 'd52', tx: 'swipe', from: 44.7, to: 45.2, day: 52, align: 'bag' },
  { id: 'd59', tx: 'swipe', from: 45.2, to: 45.7, day: 59, align: 'bag' },
  { id: 'd66', tx: 'swipe', from: 45.7, to: 46.2, day: 66, align: 'bag' },
  // the kraft bag pops on "…Different bag."
  { id: 'd93', tx: 'swipe', from: 46.2, to: 48.2, day: 93, align: 'bag', on: ['intro-12', 3] },
  // anchor B's hold (0-3 beats) lengthens this one, so day 100 lands on a downbeat
  { id: 'd99', tx: 'swipe', from: 48.2, to: ANCHORS.B.at, day: 99, align: 'R' },
  // day 100 slams in (its count reveal overridden), and keeps playing into the wall's dolly
  {
    id: 'd100',
    tx: 'swipe',
    from: ANCHORS.B.at,
    to: 50.7,
    day: 100,
    align: 'slam',
    runOn: 52.2,
  },
  // ---------------------------------------------------------------- 7 the wall, the lock
  { id: 'wall', tx: 'dolly', from: 50.7, to: BONK, wall: true, defs: ['tiles'] },
  // ---------------------------------------------------------------- 8 the bonk, the comeback
  // One animator. The wall's push settles on day 31 and the wall stays as the backdrop; she walks in,
  // leaps, bonks, licks; a poof pops the bag under her as the sky flat drops over the wall.
  {
    id: 'bonk',
    tx: 'match',
    from: BONK,
    to: HELLO_IN,
    labelAt: COMEBACK_ONE,
    defs: ['tiles'],
    build(c, S) {
      const s = S.s('intro-16', 0)
      // in from screen-left, brisk, eyes on the locked frame
      c.base = { mode: 'stand', yaw: 90 }
      c.k.set('mode', 0, 'stand')
      c.k.set('yaw', 0, 90)
      const stop = S.at(BONK_STOP)
      walkKeys(c, 0, stop, -900, 0, 2.4, 1.3)
      c.k.tailAt0('walkQ')
      c.k.seq('head.yaw', [[0, -20]])
      face(c, 0, 'fixated', 1)
      for (const sd of ['L', 'R'])
        c.add.layer(`eyes.${sd}.py`, [
          [0, -0.5],
          [stop, -0.5],
          [stop + 0.1, -0.8, 'out'],
          [stop + 0.5, -0.8],
          [stop + 0.6, 0, 'out'],
        ])
      c.add.pulse('head.pitch', stop - 0.05, stop + 0.1, stop + 0.3, stop + 0.4, -10)
      c.k.seq('tail.wave', [[0], [stop, 12]])
      c.sfx.push({ kind: 'whoosh', at: 0.02, gainDb: -12 })
      const { m0, back } = bonkClock(S)
      MOVE_IMPL['jump-fail'](c, { e: s.t1 + 0.45, sents: [s], v: s.t0 }, m0, {
        top: S.top ?? 300,
        pin: S.pin ?? null,
        slide: S.at(BONK_LAND) - back,
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
        // +3 dB with the bus 3 dB down: the bonk keeps its level against the voice
        { kind: 'thud', at: hit, gainDb: 3 },
        { kind: 'boing', at: hit + 0.02, gainDb: -8 },
      )
      c.cam.shakes.push(hit)
      c.bonk = hit
      // into the bag: it pops under her in a puff as the sky drops over the wall
      const bag = S.at(COMEBACK_BAG)
      MOVE_IMPL['bag-throne'](c, { e: bag + 1 }, bag)
      c.poofs = [{ t: bag + 0.28, at: 'seat' }]
      // the comeback: "Breaks happen. …I take mine in a bag." and her first day back
      const a1 = S.s('intro-17', 0),
        a2 = S.s('intro-17', 1),
        r = S.s('intro-18', 0)
      face(c, a1.t0 - 0.1, 'neutral', 200)
      // "…I take mine in a bag.": smug, sinking into it
      face(c, a2.t0 - 0.05, 'smug-lids', 220)
      c.k.seq('y', [[a2.t0 - 0.05], [a2.t0 + 0.25, 46, 'inOut']])
      c.k.seq('y', [[r.t0 - 0.1], [r.t0 + 0.2, 0, 'inOut']])
      // the counter at one: bored face, the flag tail quivering anyway (a shorter flag: the full
      // one would cross the counter's label)
      const one = S.at(COMEBACK_ONE)
      face(c, one, 'bored', 220)
      tailTo(c, one, one + 0.3, [...FLAG.slice(0, 5), 1.4])
      c.k.seq('tail.wave', [[one], [one + 0.3, 10]])
      c.sfx.push(
        { kind: 'crinkle', at: a2.t0, gainDb: -5 },
        { kind: 'pop', at: one, gainDb: 0 },
        { kind: 'sparkle', at: one + 0.06, gainDb: -9 },
      )
    },
    // the bonk's far framing (the jump to the frame is a real one), eased to the comeback's as the
    // sky drops, so the bag shows over the bubble; down again under the counter as it pops (her ears
    // then have to clear its label)
    cam: (S) => {
      const a = S.at(COMEBACK_BAG),
        b = a + 0.8,
        one = S.at(COMEBACK_ONE)
      return {
        z: [
          [0, BONK_CAM.z],
          [a, BONK_CAM.z],
          [b, 1.02, 'inOut'],
          [S.len, 1.08, 'linear'],
        ],
        dx: [
          [a, 0],
          [b, -30, 'inOut'],
          [S.len, 30, 'linear'],
        ],
        lift: [
          [0, BONK_CAM.lift],
          [a, BONK_CAM.lift],
          [b, COMEBACK_LIFT, 'inOut'],
          [one - 0.4, COMEBACK_LIFT],
          [one, 0, 'inOut'],
        ],
      }
    },
    over(t, S, F) {
      // the impact stars at the locked frame's bottom edge
      const [x, y, w] = BONK_FRAME
      // the counter leaves with the bag, fading as the join's poof grows (it vanished on a frame)
      const k = L.clamp((S.len - t) / 0.2)
      const num = k > 0 ? L.number('sky-clouds', t, F.counter(1, S.at(COMEBACK_ONE)), Infinity) : ''
      return (
        L.impact(t, S.c.bonk, x + w / 2, y + w) +
        (k < 1 && num ? `<g opacity="${k.toFixed(3)}">${num}</g>` : num)
      )
    },
  },
  // ---------------------------------------------------------------- 9 hello, story, deal, crack, end
  // One animator. A poof takes the bag as the lilac flat drops; the flat flies out for the deal and
  // shows the stage with the title card's yellow burst again for "I show off."
  {
    id: 'hello',
    tx: 'poof',
    from: HELLO_IN,
    to: null,
    defs: ['hellos'],
    build(c, S) {
      const s2 = S.s('intro-19', 1),
        st2 = S.s('intro-20', 1)
      face(c, 0, 'curious', 1)
      tailAt0(c, 'question')
      REACTIONS['ear-perk'](c, s2.t0, s2.t1 + 0.4)
      face(c, s2.t0 + 0.45, 'delighted', 200)
      tailTo(c, s2.t1 + 0.2, s2.t1 + 0.6, 'wrap')
      // the story: sunglasses on in a puff, then the standing catwalk turn
      const shades = S.at(SHADES_ON)
      MOVE_IMPL['model-turn'](c, { e: st2.t1 + 0.2 }, shades + 0.1)
      face(c, shades + 0.4, 'diva', 220)
      face(c, st2.t0 - 0.05, 'smug-lids', 220)
      flash(c, S.at(STORY_FLASHES[0]))
      flash(c, S.at(STORY_FLASHES[1]))
      // the slaps on triplets (a third of a beat), climbing; the viewer's own lands last, biggest
      const others = LOCALES.filter((l) => l !== S.lang)
      others.forEach((l, i) =>
        c.sfx.push({ kind: 'pop', at: S.at(RING_AT + i / 6), gainDb: -5, pitch: i * 2 }),
      )
      c.sfx.push(
        { kind: 'ding', at: s2.t0, gainDb: -6 },
        { kind: 'sparkle', at: s2.t0 + 0.02, gainDb: -8 },
        { kind: 'whoosh', at: shades - 0.1, gainDb: -6 },
        { kind: 'pop', at: shades, gainDb: -6 },
      )
      c.fx.sparkles.push([s2.t0 + 0.02, HELLO_AT[0], HELLO_AT[1]])
      // down from the catwalk to sit for the deal
      hopToSit(c, S.at(DEAL_SIT), { rise: 40, fromYaw: 32 })
      // the deal
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
      // "I show off." (anchor C, on a downbeat): the cold open's pose, the flag tail, a flash, the
      // sting
      const crack = S.at(CRACK_AT)
      MOVE_IMPL.egyptian(c, { e: crack - 0.05 }, d3.t0 - 0.35)
      face(c, d3.t0, 'smug-lids', 200)
      tailTo(c, d3.t0, d3.t0 + 0.3, FLAG)
      flash(c, d3.t0)
      c.sfx.push({ kind: 'sting', at: d3.t0, gainDb: -4 })
      // the crack: the shades come off in a puff as the pose breaks; sceptical, then proud for
      // the honest line
      tailTo(c, crack, crack + 0.4, 'wrap')
      face(c, h1.t0 - 0.06, 'sceptical', 200)
      face(c, h2.t0 - 0.06, 'proud', 260)
      // the whisper (render.mjs's own lean-in)
      const wa = h3.t0
      face(c, wa - 0.3, 'whisper', 280)
      c.add.pulse('head.dy', wa - 0.35, wa, h3.t1 + 0.3, h3.t1 + 0.7, 16)
      c.add.pulse('head.s', wa - 0.35, wa, h3.t1 + 0.3, h3.t1 + 0.7, 0.06)
      // caught being nice: a look away and back, then the house slow blink
      const away = S.at(LOOK_AWAY)
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
      const b = S.at(BLINK_AT)
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
      c.poofs = [
        { t: shades - 0.04, at: 'head' },
        { t: crack - 0.04, at: 'head' },
      ]
      c.whisperAt = wa
    },
    items: (S) => [
      [S.at(SHADES_ON) + 0.02, { wear: 'sunglasses' }],
      [S.at(CRACK_AT) + 0.02, { wear: null }],
    ],
    // still for the hello ring and the story; in a little as the flat flies for the deal; the
    // whisper's push-in, and out a touch for the blink
    cam: (S) => {
      const h3 = S.s('intro-22', 2),
        fly = S.at(DEAL_FLY)
      return {
        z: [
          [0, 1],
          [fly, 1],
          [fly + 0.6, 1.15, 'inOut'],
          [h3.t0 - 0.35, 1.15],
          [h3.t0 + 0.05, 1.38, 'inOut'],
          [h3.t1 + 0.4, 1.38],
          [S.at(BLINK_AT) + 0.5, 1.3, 'inOut'],
        ],
      }
    },
    over(t, S) {
      const others = LOCALES.filter((l) => l !== S.lang)
      const leave = S.at(SHADES_ON) - 0.1
      if (t > leave + 0.4) return ''
      let s = ''
      others.forEach((l, i) => {
        const [x, y] = RING[i]
        s += FL.sticker(
          t,
          S.at(RING_AT + i / 6),
          `st-${HELLO[l]}`,
          x,
          y,
          RING_SIZE,
          ((i * 37) % 17) - 8,
          { leave, dir: [Math.sign(x - 540), (y - 820) / 600] },
        )
      })
      // the biggest one's pop never overshoots into the player's chrome (y < 270)
      s += FL.sticker(t, S.s('intro-19', 1).t0, `st-${HELLO[S.lang]}`, ...HELLO_AT, 0, {
        leave,
        dir: [0, -1],
        minTop: 280,
      })
      return s
    },
  },
]
// the crown lands on the last word of "Still a queen."
const crownAt = (S) => {
  const a2 = S.s('intro-07', 1)
  return a2.words[a2.words.length - 1].t0
}
// the sticker ring of the slaps, round her and clear of her head (x 340-740, y 735-1270 at zoom 1),
// and inside the frame's safe area (x 90-990, y 290-1240): stickers at a size a phone reads
export const SLAPS = [
  { b: 32.2, id: 'hi', x: 868, y: 800, size: 240, rot: 7 },
  { b: 32.7, id: 'diva', x: 212, y: 1100, size: 240, rot: 6 },
  { b: 33.2, id: 'meantit', x: 868, y: 1110, size: 240, rot: -6 },
  { b: 33.7, id: 'zoomies', x: 225, y: 470, size: 240, rot: -5 },
  { b: 34.2, id: 'boxhide', x: 855, y: 470, size: 240, rot: 8 },
  { b: 34.7, id: 'hamsi', x: 540, y: 570, size: 240, rot: 0 },
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
// the hello ring: seven slots in two columns either side of her, then the viewer's own, biggest,
// top centre (HELLO_AT)
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
// the race's bag days (film.mjs dayWindow): pulled back and set up so the bag clears the caption
// bubble; the bag-hop eases to a little less of it (its hop starts mid-frame)
export const BAG_CAM = { z: 0.78, lift: 125 }
export const BAG_CAM_IN = { z: 0.85, lift: 100 }
// where the looks leave the camera (risen with the onesie), and where the booth picks it up
const LOOKS_END = { z: 1.1, lift: 150 }
// the comeback's rise while its bag is the joke
const COMEBACK_LIFT = 170
// the bonk's beats in the shot's clock: the crouch at m0, the leap's last frame (the hit) just before
// `back`, which falls on a frame so the hit is one; on the board the crouch is LEAP, the hit 0.75 later
export function bonkClock(S) {
  const back = Math.round((S.at(LEAP) + 0.75) * FPS) / FPS
  return { m0: back - 0.75, back }
}
// the wall's push into tile 31, on the board (film.mjs drawWall)
export const WALL_TIMES = { a: 50.7, b: 52.2, glint: 54.25, push: WALL_PUSH }
// where the score turns, on the board (lib/film-score.mjs moves each to a bar line): the real show,
// the wall, hello, the crack; and the slow blink, which the last statement of the motif sits under
export const SCORE_CUES = {
  show: SHOW_AT,
  wall: WALL_TIMES.a,
  hello: HELLO_IN,
  crack: CRACK_AT,
  blink: BLINK_AT,
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
// One shot's performance: its context (sounds, effects), its animator, the
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
  const anim = VA.create({
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
// Every flash the film fires and every cut, in film time, from performed shots (placeShots' shots,
// each with performShot's result merged in). The race's swipes count as cuts (a whole new picture in
// 0.24 s); a poof, a flat, the dolly and the match keep the place, so they do not.
export function flashesAndCuts(shots) {
  const flashes = []
  for (const sh of shots) {
    if (!sh.c) continue
    for (const t of sh.c.fx.flashes) {
      const ft = r3(t - sh.off + sh.T0)
      if (ft >= sh.T0 - 1e-6 && ft < sh.T1) flashes.push(ft)
    }
  }
  const cuts = shots.filter((s) => s.tx === 'swipe').map((s) => s.T0)
  return { flashes: flashes.sort((a, b) => a - b), cuts }
}
