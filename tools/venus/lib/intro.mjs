// Day 1 is two special videos, not the ms-1-a milestone:
//
//   first   venus-day001-<lang>.mp4         Venus introduces herself (a first-ever day 1)
//   return  venus-day001-return-<lang>.mp4  a day 1 after a reset: she never noticed you were gone,
//                                            and her tail gives away that she is glad
//
//   import { planVideo, VARIANTS, LIBRARY_VIDEOS } from './lib/intro.mjs';
//   planVideo(1, 'tr')            -> the self-introduction plan
//   planVideo(1, 'tr', 'return')  -> the welcome-back plan
//   planVideo(22, 'tr')           -> planDay(22, 'tr'), unchanged
//
// The grammar keeps planning day 1 as ms-1-a, because day 2's repair rule reads day 1's picks; the
// special plans only replace what the day-1 *file* shows. Their picks are chosen to differ from
// day 2's on every axis, so the hand-over to the regular run still looks new.
//
// The acting lives here too. Importing this module registers one entrance ('bag-groom') and two
// signature moves ('intro-self', 'intro-return') in lib/score.mjs's tables; buildScore then runs
// them like any other, so the reveal, payoff, end card and timing rules are the shared ones.
// Beats hit sentences by position, so every locale's line has the same number of sentences (the test
// checks it): the roles are listed in ROLES.
import { planDay, LOCALES, LIBRARY_DAYS } from '../grammar.mjs'
import { ENTRANCES, MOVE_IMPL } from './score.mjs'

export const VARIANTS = ['first', 'return']
// the file name's suffix after the day number
export const VARIANT_SUFFIX = { first: '', return: '-return' }

// ------------------------------------------------------------------ the lines
// tr and en are written natively; the other six need a native check (see `check`).
// No digits, no spoken number: the "1" is on screen.
export const LINES = {
  first: {
    id: 'intro-day1',
    mood: 'diva',
    expression: 'neutral-regal',
    move: 'intro-self',
    roles: ['hi', 'name', 'brag', 'undo', 'hush'],
    check: {
      tr: 'native',
      en: 'native',
      es: 'needs native check',
      de: 'needs native check',
      fr: 'needs native check',
      ru: 'needs native check',
      ar: 'needs native check',
      'pt-BR': 'needs native check',
    },
    text: {
      en: "Hi. I'm Venus. I'm in charge of the streak counter. …Cats can't count. Don't tell anyone.",
      tr: 'Selam. Ben Venüs. Seri sayacından ben sorumluyum. …Kediler saymayı bilmez. Kimseye söyleme.',
      es: 'Hola. Soy Venus. Llevo el contador de rachas. …Los gatos no sabemos contar. Ni una palabra.',
      de: 'Hallo. Ich bin Venus. Ich leite den Serienzähler. …Katzen können nicht zählen. Sag’s keinem.',
      fr: 'Salut. Moi, c’est Vénus. Je gère le compteur de série. …Les chats ne savent pas compter. Ne le dis à personne.',
      ru: 'Привет. Я Венера. Веду счётчик серии. …Кошки не умеют считать. Только никому.',
      ar: 'مرحبًا. أنا فينوس. مسؤولة العدّاد. …القطط لا تعرف العدّ. سرّ بيننا.',
      'pt-BR': 'Oi. Sou a Vênus. Cuido do contador. …Gato não sabe contar. Não conta pra ninguém.',
    },
  },
  // Zero guilt: nothing about being away, counting what was lost, or waiting. "I was busy" is the
  // bible's comeback stance (§8.2): she was in a bag anyway. de, fr, es and pt-BR avoid their word for
  // "tail": in each it is also slang (penis, or bottom in much of Latin America and Brazil), so they
  // point at "what's wagging behind me" instead.
  return: {
    id: 'intro-return',
    mood: 'smug',
    expression: 'bored-on-purpose',
    move: 'intro-return',
    roles: ['oh', 'hi', 'busy', 'bag', 'tail', 'shrug'],
    check: {
      tr: 'native',
      en: 'native',
      es: 'needs native check',
      de: 'needs native check',
      fr: 'needs native check',
      ru: 'needs native check',
      ar: 'needs native check',
      'pt-BR': 'needs native check',
    },
    text: {
      en: 'Oh. Hi. I was busy. In a bag. …Ignore my tail. It does that.',
      tr: 'Aa. Selam. Meşguldüm. Poşetteydim. …Kuyruğuma bakma. Kendi kafasına göre.',
      es: 'Ah. Hola. Estaba ocupada. En una bolsa. …Ignora lo que se mueve. Va por libre.',
      de: 'Oh. Hallo. War beschäftigt. In einer Tüte. …Ignorier das Gewackel. Macht es von allein.',
      fr: 'Oh. Salut. J’étais occupée. Dans un sac. …Ignore ce qui bouge derrière moi. Ça fait ça tout seul.',
      ru: 'О. Привет. Была занята. В пакете. …Хвост не слушай. Он сам по себе.',
      ar: 'أوه. مرحبًا. كنتُ مشغولة. في كيس. …ذيلي لا يمثّلني. له رأيه.',
      'pt-BR': 'Ah. Oi. Tava ocupada. Numa sacola. …Ignora o que balança atrás. Tem vida própria.',
    },
  },
}

// ------------------------------------------------------------------ the plans
// Day 2 (every locale) plays zoomies, stripes, drift, slam and purr-blink; nothing here repeats them.
const PICKS = {
  first: {
    title: 'Venus introduces herself',
    entrance: 'peek',
    look: 'stage',
    camera: 'push-in',
    reveal: 'pop',
    reaction: 'tilt',
    payoff: 'look-away',
    music: 'playful',
    extras: { sparkles: true },
  },
  return: {
    title: 'Welcome back',
    entrance: 'bag-groom',
    look: 'sky-clouds',
    camera: 'push-in',
    reveal: 'pop',
    reaction: 'glance-unmoved',
    payoff: 'blink',
    music: 'cozy',
    extras: {},
  },
}
// 10-14 s instead of 8-11: the introduction is the longest line in the library
const LENGTH = [10, 14],
  MAX_VOICE = 6.4

export function planSpecial(variant, lang) {
  const L = LINES[variant]
  if (!L) throw new Error(`unknown variant ${variant} (${VARIANTS.join(', ')})`)
  if (!L.text[lang]) throw new Error(`${L.id} has no ${lang} text`)
  const base = planDay(1, lang),
    P = PICKS[variant]
  return {
    ...base,
    ...P,
    extras: { ...P.extras },
    variant,
    special: true,
    milestone: true,
    quip: {
      id: L.id,
      pool: 'intro',
      mood: L.mood,
      expression: L.expression,
      move: L.move,
      target: null,
      text: L.text[lang],
    },
    move: L.move,
    outfit: null,
    length: LENGTH,
    maxVoice: MAX_VOICE,
  }
}

// the plan behind a video file: day 1 is a special plan, every other day the grammar's
export function planVideo(day, lang, variant = 'first') {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown variant ${variant}`)
  if (day === 1) return planSpecial(variant, lang)
  if (variant !== 'first') throw new Error(`the ${variant} variant exists for day 1 only`)
  return planDay(day, lang)
}
// variants a day has: day 1 has both, the rest only the regular one
export const variantsOf = (day) => (day === 1 ? VARIANTS : ['first'])
// every video of the library: (day, lang, variant)
export const LIBRARY_VIDEOS = LOCALES.flatMap((lang) =>
  LIBRARY_DAYS.flatMap((day) => variantsOf(day).map((variant) => ({ day, lang, variant }))),
)

// ------------------------------------------------------------------ acting helpers
const squash = (c, t, amt = 0.12, len = 0.34) => {
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
const eyes = (c, axis, keys) => {
  for (const s of ['L', 'R']) c.add.layer(`eyes.${s}.${axis}`, keys)
}
// a tail shape outside score.mjs's set: [pitch, yaw, side, curl, hook, len]
const TP = ['pitch', 'yaw', 'side', 'curl', 'hook', 'len']
// the flag: up beside her head with a hooked tip, long enough to show above the bag and the caption
export const FLAG = [50, 90, -140, 0, 80, 1.85]
const tailTo = (c, t0, t1, shape, e = 'inOut') =>
  TP.forEach((q, i) => c.k.to('tail.' + q, t0, t1, shape[i], e))
const byRole = (T, roles) =>
  Object.fromEntries(roles.map((r, i) => [r, T.sents[Math.min(i, T.sents.length - 1)]]))

// ------------------------------------------------------------------ return: the entrance
// Frame 0: she is already in the bag, grooming a paw, busy and unbothered. A ding; her ears come
// up one at a time (the tell starts before she admits anything), the paw goes down, and she looks at
// the lens with her best "oh, it's you" face.
ENTRANCES['bag-groom'] = (c) => {
  c.k.set('bag', 0, 1)
  c.hasBag = true
  c.k.tailAt0('wrap')
  c.k.seq('paw.lift', [[0, 0.78], [0.95], [1.25, 0, 'inOut']])
  c.add.layer('head.pitch', [
    [0, 15],
    [0.95, 15],
    [1.25, 0, 'inOut'],
  ])
  c.add.layer('head.roll', [
    [0, -12],
    [0.95, -12],
    [1.25, 0, 'inOut'],
  ])
  // licks: the tongue flicks out against the paw, four times
  const licks = [0.08, 0.32, 0.56, 0.8]
  c.k.seq(
    'mouth.tongue',
    licks.flatMap((t) => [
      [t, 0],
      [t + 0.07, 0.75, 'out'],
      [t + 0.17, 0, 'in'],
    ]),
  )
  c.add.layer(
    'head.dy',
    licks.flatMap((t) => [
      [t, 0],
      [t + 0.07, 5, 'out'],
      [t + 0.17, 0, 'in'],
    ]),
  )
  licks.forEach((t) => c.sfx.push({ kind: 'tick', at: t + 0.06, gainDb: -16 }))
  c.ex.push({ t: 0, name: 'purr', ms: 1 })
  // the ding, then one ear, then the other
  c.sfx.push({ kind: 'ding', at: 0.9, gainDb: -8 })
  c.add.pulse('ears.R.rot', 0.95, 1.05, 1.6, 1.9, -16)
  c.add.pulse('ears.L.rot', 1.18, 1.28, 1.6, 1.9, -16)
  c.ex.push({ t: 1.0, name: 'curious', ms: 160 }, { t: 1.45, name: 'bored', ms: 220 })
  c.sfx.push({ kind: 'crinkle', at: 1.2, gainDb: -12 })
  return 1.75
}

// ------------------------------------------------------------------ first: the self-introduction
// Regal → the big brag (with imaginary paparazzi) → she looks up at the counter, goes cross-eyed
// trying to count it, and the cat wins: blep, tongue out through "cats can't count" → she leans in
// for "don't tell anyone" → the payoff's slow blink and the look-away.
MOVE_IMPL['intro-self'] = (c, T) => {
  const S = byRole(T, LINES.first.roles)
  // hi: a small nod; name: she sits up tall, chin up, a little ta-da
  c.add.pulse('head.pitch', S.hi.t0 - 0.12, S.hi.t0 + 0.08, S.hi.t1, S.hi.t1 + 0.2, 6)
  c.k.tail(S.hi.t0 - 0.2, S.hi.t0 + 0.25, 'question')
  c.ex.push({ t: S.name.t0 - 0.06, name: 'proud', ms: 240 })
  c.k.seq('sy', [[S.name.t0 - 0.1], [S.name.t0 + 0.2, 1.05, 'out']])
  c.add.pulse('head.pitch', S.name.t0 - 0.06, S.name.t0 + 0.18, S.name.t1, S.name.t1 + 0.25, -7)
  c.fx.sparkles.push([S.name.t0 + 0.05, 540, 930])
  c.sfx.push({ kind: 'sparkle', at: S.name.t0 + 0.05, gainDb: -9 })
  // brag: the diva face, the tail straight up, and the paparazzi she imagines
  c.ex.push({ t: S.brag.t0 - 0.06, name: 'diva', ms: 240 })
  c.fx.flashes.push(S.brag.t0 + 0.2, S.brag.t0 + 0.38)
  c.sfx.push(
    { kind: 'shutter', at: S.brag.t0 + 0.2, gainDb: -6 },
    { kind: 'shutter', at: S.brag.t0 + 0.38, gainDb: -8 },
  )
  c.add.pulse('head.pitch', S.brag.t0, S.brag.t0 + 0.25, S.brag.t1 - 0.15, S.brag.t1 + 0.1, -6)
  c.k.tail(S.brag.t0, S.brag.t0 + 0.4, 'straight')
  c.sfx.push({ kind: 'sparkle', at: S.brag.t0 + 0.25, gainDb: -12 })
  // the beat: she looks up at the number and tries to count it (one nod per count, it's one)
  const u = S.brag.t1
  c.ex.push({ t: u + 0.02, name: 'curious', ms: 140 })
  eyes(c, 'py', [
    [u - 0.15, 0],
    [u, -0.8, 'out'],
    [S.undo.t0 + 0.3, -0.8],
    [S.undo.t0 + 0.5, 0, 'inOut'],
  ])
  // ...and goes cross-eyed doing it: the pupils meet on the number
  c.add.layer('eyes.L.px', [
    [u - 0.05, 0],
    [u + 0.15, 1, 'out'],
    [S.undo.t0 + 0.3, 1],
    [S.undo.t0 + 0.5, 0, 'inOut'],
  ])
  c.add.layer('eyes.R.px', [
    [u - 0.05, 0],
    [u + 0.15, -1, 'out'],
    [S.undo.t0 + 0.3, -1],
    [S.undo.t0 + 0.5, 0, 'inOut'],
  ])
  c.add.pulse('head.pitch', u + 0.02, u + 0.12, u + 0.16, u + 0.3, 7)
  // undo: the blep. Tongue out (lip sync pauses under it), big innocent eyes, the brag deflates
  c.ex.push({ t: S.undo.t0 - 0.06, name: 'blep', ms: 80, ease: 'out' })
  c.k.seq('mouth.tongue', [
    [S.undo.t0 - 0.08],
    [S.undo.t0, 1, 'out'],
    [S.hush.t0 - 0.14],
    [S.hush.t0 - 0.05, 0, 'in'],
  ])
  c.k.seq('sy', [
    [S.undo.t0],
    [S.undo.t0 + 0.35, 0.98, 'inOut'],
    [S.hush.t0],
    [S.hush.t0 + 0.2, 1, 'inOut'],
  ])
  c.add.pulse('head.roll', S.undo.t0, S.undo.t0 + 0.18, S.undo.t1 - 0.1, S.undo.t1 + 0.15, 15)
  c.k.tail(S.undo.t0, S.undo.t0 + 0.5, 'question')
  c.sfx.push({ kind: 'blip', at: S.undo.t0 - 0.02, gainDb: -6 })
  // hush: leans in close, a suspicious glance both ways (the peek, again)
  c.ex.push({ t: S.hush.t0 - 0.03, name: 'whisper', ms: 200 })
  c.add.pulse('head.s', S.hush.t0 - 0.1, S.hush.t0 + 0.15, S.hush.t1, S.hush.t1 + 0.3, 0.07)
  c.add.pulse('head.dy', S.hush.t0 - 0.1, S.hush.t0 + 0.15, S.hush.t1, S.hush.t1 + 0.3, 16)
  const h = S.hush.t0,
    d = Math.max(0.5, S.hush.t1 - h)
  eyes(c, 'px', [
    [h, 0],
    [h + 0.06, -0.8, 'out'],
    [h + d * 0.4, -0.8],
    [h + d * 0.4 + 0.08, 0.8, 'out'],
    [h + d * 0.85, 0.8],
    [h + d * 0.85 + 0.08, 0, 'out'],
  ])
  c.cam.bumps.push(h - 0.05)
}

// ------------------------------------------------------------------ return: the line
// Cool face, flat voice; the tail behind her shoots straight up on "Oh." and quivers through the
// whole act. On the beat she notices it, she owns it ("ignore my tail"), and it keeps wagging.
MOVE_IMPL['intro-return'] = (c, T) => {
  const S = byRole(T, LINES.return.roles)
  // the tell: straight up, quivering (a fast travelling wave), from the first word to the end
  tailTo(c, S.oh.t0 - 0.15, S.oh.t0 + 0.3, FLAG, 'out')
  c.k.seq('tail.wave', [
    [S.oh.t0 - 0.15],
    [S.oh.t0 + 0.3, 10, 'out'],
    [S.tail.t0],
    [S.tail.t0 + 0.2, 13, 'out'],
    [S.shrug.t1],
    [S.shrug.t1 + 0.4, 7, 'inOut'],
  ])
  c.add.layer('tail.phase', [
    [S.oh.t0 - 0.15, 0],
    [T.e + 8, (T.e + 8 - S.oh.t0) * 2.6, 'linear'],
  ])
  c.sfx.push({ kind: 'boing', at: S.oh.t0 - 0.05, gainDb: -16 })
  // oh / hi: the casual glance; one ear turns, flat face
  c.add.pulse('head.pitch', S.oh.t0 - 0.1, S.oh.t0 + 0.1, S.oh.t1, S.oh.t1 + 0.2, -4)
  c.add.pulse('ears.R.swivel', S.hi.t0 - 0.05, S.hi.t0 + 0.08, S.hi.t1, S.hi.t1 + 0.2, 0.6)
  // busy: chin up, the squint of a very important cat
  c.ex.push({ t: S.busy.t0 - 0.06, name: 'squint', ms: 220 })
  c.add.pulse('head.pitch', S.busy.t0 - 0.06, S.busy.t0 + 0.2, S.bag.t1 - 0.1, S.bag.t1 + 0.15, -7)
  // bag: a glance down at it and a pat-down squash
  eyes(c, 'py', [
    [S.bag.t0 - 0.05, 0],
    [S.bag.t0 + 0.08, 0.6, 'out'],
    [S.bag.t1 - 0.05, 0.6],
    [S.bag.t1 + 0.08, 0, 'out'],
  ])
  squash(c, S.bag.t0, 0.06, 0.3)
  c.sfx.push({ kind: 'crinkle', at: S.bag.t0 + 0.02, gainDb: -8 })
  // the beat: she notices her own tail over her shoulder (screen-right), caught
  const u = S.bag.t1
  c.ex.push(
    { t: u, name: 'shocked', ms: 70, ease: 'out' },
    { t: S.tail.t0 + 0.1, name: 'embarrassed', ms: 200 },
  )
  c.k.seq('head.yaw', [
    [u],
    [u + 0.12, 28, 'out'],
    [S.tail.t0 + 0.12],
    [S.tail.t0 + 0.32, 0, 'inOut'],
  ])
  eyes(c, 'px', [[u, 0], [u + 0.08, 0.85, 'out'], [S.tail.t0 + 0.1], [S.tail.t0 + 0.3, 0, 'inOut']])
  c.cam.bumps.push(u)
  c.sfx.push({ kind: 'blip', at: u + 0.02, gainDb: -8 })
  // shrug: innocent eyes, the tail curls into a happy question mark and keeps going
  c.ex.push({ t: S.shrug.t0 - 0.04, name: 'innocent', ms: 160 })
  c.add.pulse('head.roll', S.shrug.t0 - 0.04, S.shrug.t0 + 0.15, S.shrug.t1, S.shrug.t1 + 0.2, -9)
  c.k.tail(S.shrug.t0, S.shrug.t0 + 0.4, 'question')
  // glad, and a purr under the sign-off says so
  c.sfx.push({ kind: 'purr', at: T.e + 0.15, seconds: 1.8, gainDb: -4 })
}
