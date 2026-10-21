import { outlineLength, pointAlong, withoutArcs } from './pathData'

/**
 * The badges drawn as embroidered patches: the geometry behind the v3 badge
 * art master sheet, ported from its generator so the app draws what the sheet
 * was judged on.
 *
 * Units: a 64 × 64 box, one unit a pixel at the largest cut. Every shape is a
 * path, written without arcs (see `pathData.ts`).
 *
 * **One container per family, never shared** — a circle for the streak, a
 * shield for corrections, a bubble for messages — so a stranger reads the
 * family from the outline alone. **The tier is the thread**: cotton, twill,
 * appliqué, satin, silver, gold and bullion, from a chain-stitched edge to a
 * gold border with studs and one glint. A ladder's motif grows inside it: a
 * candle becomes a bonfire becomes the sun.
 *
 * Three cuts, because detail that reads at 64 px is noise at 24: `full` for
 * 56 px and up (stitches and merrow), `s40` from 32 (a solid band, at most six
 * shapes, no dashes), `s24` below that (a silhouette, the tier ring and one
 * accent). Stroke widths are in units, so a thick stroke at a small cut is
 * thick on purpose.
 *
 * **Art colours are fixed in both schemes**, like the frames; a keyline in the
 * family colour gives every outer edge 3:1 on the light ground and on the
 * dark. Only the locked and in-progress drawings — a pencil pattern on paper,
 * never faded colour — take the scheme's paper and pencil.
 *
 * Pure data and no React: `BadgePatch` turns each node into a react-native-svg
 * `Path`.
 */

export type PatchCut = 'full' | 's40' | 's24'
export type PatchScheme = 'light' | 'dark'

export interface PatchNode {
  readonly d: string
  readonly fill: string
  readonly stroke: string
  readonly strokeWidth: number
  readonly dash?: string
  readonly opacity: number
  readonly transform?: string
  readonly cap: 'round' | 'butt'
}

export type PatchState =
  | { readonly kind: 'earned' }
  | { readonly kind: 'locked' }
  /** The next badge on its ladder, its border stitched `progress` of the way. */
  | { readonly kind: 'next'; readonly progress: number }

export function cutFor(size: number): PatchCut {
  if (size >= 56) return 'full'
  if (size >= 32) return 's40'
  return 's24'
}

// ---------- primitives, as on the sheet ----------

const n = (v: number) => Math.round(v * 100) / 100

interface Spec {
  d: string
  f: string
  s: string
  w: number
  da: string | null
  o: number
  t: string
  lc: 'round' | 'butt'
}

const L = (d: string, o: Partial<Spec> = {}): Spec => ({
  d,
  f: 'none',
  s: 'none',
  w: 0,
  da: null,
  o: 1,
  t: '',
  lc: 'round',
  ...o,
})
const Fi = (d: string, f: string, o: Partial<Spec> = {}) => L(d, { f, ...o })
const St = (d: string, s: string, w: number, o: Partial<Spec> = {}) => L(d, { s, w, ...o })

/** An ellipse as two half-arcs; `withoutArcs` turns them into cubics. */
const E = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)} ${cy}A${rx} ${ry} 0 1 0 ${n(cx + rx)} ${cy}A${rx} ${ry} 0 1 0 ${n(cx - rx)} ${cy}Z`
const C = (cx: number, cy: number, r: number) => E(cx, cy, r, r)
const R = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${n(x + r)} ${y}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${r} ${r} 0 0 1 ${x} ${n(y + h - r)}V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${y}Z`
    : `M${x} ${y}H${n(x + w)}V${n(y + h)}H${x}Z`
const Z = (k: number, cx = 32, cy = 32) =>
  `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`
const rays = (cnt: number, r1: number, r2: number, off: number, cx: number, cy: number) => {
  let p = ''
  for (let i = 0; i < cnt; i++) {
    const a = ((off + (i * 360) / cnt) * Math.PI) / 180
    p += `M${n(cx + r1 * Math.cos(a))} ${n(cy + r1 * Math.sin(a))}L${n(cx + r2 * Math.cos(a))} ${n(cy + r2 * Math.sin(a))}`
  }
  return p
}

// ---------- containers and families ----------

const OUTLINES = {
  circle: 'M5 32A27 27 0 1 0 59 32A27 27 0 1 0 5 32Z',
  shield: 'M15 9H49Q53 9 53 13V33C53 46 43 53 32 57.5C21 53 11 46 11 33V13Q11 9 15 9Z',
  bubble:
    'M18 8H46A10 10 0 0 1 56 18V36A10 10 0 0 1 46 46H31L21 56L22.5 46H18A10 10 0 0 1 8 36V18A10 10 0 0 1 18 8Z',
  hex: 'M32 5L55.4 18.5V45.5L32 59L8.6 45.5V18.5Z',
  rosette:
    'M32 8A7 7 0 0 1 44 11.22A7 7 0 0 1 52.78 20A7 7 0 0 1 56 32A7 7 0 0 1 52.78 44A7 7 0 0 1 44 52.78A7 7 0 0 1 32 56A7 7 0 0 1 20 52.78A7 7 0 0 1 11.22 44A7 7 0 0 1 8 32A7 7 0 0 1 11.22 20A7 7 0 0 1 20 11.22A7 7 0 0 1 32 8Z',
  oval: 'M10 32A22 27 0 1 0 54 32A22 27 0 1 0 10 32Z',
  pill: 'M24 14H40A18 18 0 0 1 40 50H24A18 18 0 0 1 24 14Z',
  square: 'M14 7H50A7 7 0 0 1 57 14V50A7 7 0 0 1 50 57H14A7 7 0 0 1 7 50V14A7 7 0 0 1 14 7Z',
  card: 'M18 6H46A7 7 0 0 1 53 13V51A7 7 0 0 1 46 58H18A7 7 0 0 1 11 51V13A7 7 0 0 1 18 6Z',
  diamond: 'M32 6L58 32L32 58L6 32Z',
  banner: 'M12 7H52V57L32 47L12 57Z',
  arch: 'M10 57V30A22 22 0 0 1 54 30V57Z',
} as const
type Outline = keyof typeof OUTLINES

interface Family {
  o: Outline
  /** Ground, the appliqué layer, the family thread and its merrow, the stitch, the keyline. */
  g: string
  g2: string
  fc: string
  fm: string
  st: string
  ec: string
}

/**
 * Keyed by the id's family prefix — `streak.30` is `streak` — rather than by
 * `BadgeKind`, so this module draws every patch on the sheet, including the
 * families a server has not started sending.
 */
const FAMILIES: Record<string, Family> = {
  streak: {
    o: 'circle',
    g: '#25305c',
    g2: '#33417a',
    fc: '#ff9f52',
    fm: '#c66a24',
    st: '#ffc94d',
    ec: '#5b6bc0',
  },
  correction: {
    o: 'shield',
    g: '#f3ead2',
    g2: '#ffffff',
    fc: '#2f8f5b',
    fm: '#1f6b42',
    st: '#2f8f5b',
    ec: '#2f8f5b',
  },
  messages: {
    o: 'bubble',
    g: '#3b6cf6',
    g2: '#5a84f8',
    fc: '#ffffff',
    fm: '#9fb6f7',
    st: '#ffffff',
    ec: '#3b6cf6',
  },
  tokens: {
    o: 'hex',
    g: '#5338b8',
    g2: '#6a52cc',
    fc: '#cbbaff',
    fm: '#8d77e0',
    st: '#cbbaff',
    ec: '#7a5ed6',
  },
  veteran: {
    o: 'rosette',
    g: '#2f5e46',
    g2: '#3f7a5b',
    fc: '#b8e15c',
    fm: '#86a83a',
    st: '#b8e15c',
    ec: '#4f8a3a',
  },
  origin: {
    o: 'oval',
    g: '#f3ead2',
    g2: '#ffffff',
    fc: '#3b6cf6',
    fm: '#2a54d0',
    st: '#3b6cf6',
    ec: '#3b6cf6',
  },
  languages: {
    o: 'pill',
    g: '#f3ead2',
    g2: '#ffffff',
    fc: '#ff9f52',
    fm: '#c66a24',
    st: '#ff9f52',
    ec: '#c2702a',
  },
  calls: {
    o: 'square',
    g: '#2fbfbc',
    g2: '#5fd6d3',
    fc: '#d3f4ef',
    fm: '#7cc9c3',
    st: '#d3f4ef',
    ec: '#1f8a86',
  },
  echo: {
    o: 'card',
    g: '#2a54d0',
    g2: '#3b6cf6',
    fc: '#e3ebfe',
    fm: '#8aa6ff',
    st: '#e3ebfe',
    ec: '#4a78f0',
  },
  testimonials: {
    o: 'diamond',
    g: '#f3ead2',
    g2: '#ffffff',
    fc: '#a68cf5',
    fm: '#6f58c9',
    st: '#a68cf5',
    ec: '#7a5ed6',
  },
  guide: {
    o: 'banner',
    g: '#3f4a63',
    g2: '#4b5875',
    fc: '#5fdc98',
    fm: '#2f9e63',
    st: '#5fdc98',
    ec: '#6b7a9c',
  },
  openers: {
    o: 'arch',
    g: '#b5683a',
    g2: '#c97d4c',
    fc: '#fbe6c8',
    fm: '#c9935f',
    st: '#fbe6c8',
    ec: '#b5683a',
  },
}

export const PATCH_TIERS = [
  'cotton',
  'twill',
  'applique',
  'satin',
  'silver',
  'gold',
  'bullion',
  'woven',
] as const
export type PatchTier = (typeof PATCH_TIERS)[number]

const THREADS = {
  satin: ['#f6f1e4', '#bdb39b'],
  silver: ['#c9ced6', '#8d94a3'],
  gold: ['#c99a2e', '#8a6a1c'],
} as const

/** [band, appliqué layer, top-tier extras] */
const TIER: Record<PatchTier, readonly ['fam' | keyof typeof THREADS | null, boolean, boolean]> = {
  cotton: [null, false, false],
  twill: ['fam', false, false],
  applique: ['fam', true, false],
  satin: ['satin', true, false],
  silver: ['silver', true, false],
  gold: ['gold', true, false],
  bullion: ['gold', true, true],
  woven: ['fam', true, false],
}

const bandOf = (fa: Family, tier: PatchTier): readonly [string, string] | null => {
  const band = TIER[tier][0]
  if (band === 'fam') return [fa.fc, fa.fm]
  return band ? THREADS[band] : null
}
const glintOf = (fa: Family) =>
  fa.o === 'diamond'
    ? 'M18.5 30.5A15 15 0 0 1 30.5 18.5'
    : fa.o === 'pill'
      ? 'M12.5 29A13 13 0 0 1 20 19.5'
      : 'M14.5 23.5A20 20 0 0 1 23.5 14.5'
const wrap = (x: Spec, k: number): Spec => ({ ...x, t: Z(k) + (x.t ? ' ' + x.t : '') })

// ---------- the three cuts ----------

/** 64: keyline, ground, appliqué layer, motif, band and merrow (or a cotton chain), bullion extras. */
function big(fa: Family, tier: PatchTier, motif: readonly Spec[]): Spec[] {
  const o = OUTLINES[fa.o]
  const b = bandOf(fa, tier)
  const a = [St(o, fa.ec, b ? 8.6 : 4), Fi(o, fa.g)]
  if (TIER[tier][1]) {
    a.push(Fi(o, fa.g2, { t: Z(0.74) }), St(o, fa.st, 1.5, { da: '1.9 1.5', o: 0.8, t: Z(0.74) }))
  }
  a.push(...motif)
  if (b) a.push(St(o, b[0], 4.6), St(o, b[1], 4.6, { da: '.55 .8', o: 0.6, lc: 'butt' }))
  else a.push(St(o, fa.st, 2.1, { da: '2 1.5', t: Z(0.87) }))
  if (TIER[tier][2]) {
    a.push(
      St(o, '#f2d27a', 1.1, { da: '1.3 1', t: Z(0.86) }),
      St(o, '#fff1c2', 2.6, { da: '0 9', t: Z(0.86) }),
      St(glintOf(fa), '#ffffff', 1.5),
    )
  }
  return a
}

/** 40: at most six shapes, a solid band, no dashes, detail 1.5 px or more. */
function mid(fa: Family, tier: PatchTier, picks: readonly Spec[]): Spec[] {
  const o = OUTLINES[fa.o]
  const b = bandOf(fa, tier)
  const a = [St(o, fa.ec, b ? 12 : 7), L(o, { f: fa.g, s: b ? b[0] : 'none', w: b ? 5 : 0 })]
  if (!b) a.push(St(o, fa.st, 2.6, { t: Z(0.84) }))
  for (const x of picks) a.push({ ...x, w: x.w ? Math.max(x.w, 2.6) : 0, da: null })
  if (TIER[tier][2]) a.push(St(glintOf(fa), '#ffffff', 2.6))
  return a.map((x) => wrap(x, 0.92))
}

/** 24: the silhouette with a thick keyline, the tier ring, one accent. */
function small(fa: Family, tier: PatchTier, accent: Spec): Spec[] {
  const o = OUTLINES[fa.o]
  const b = bandOf(fa, tier)
  const a = [L(o, { f: b ? b[0] : fa.g, s: fa.ec, w: 7.8 })]
  if (b) a.push(Fi(o, fa.g, { t: Z(0.64) }))
  a.push(accent)
  return a.map((x) => wrap(x, 0.86))
}

/** Locked or in progress: the pattern pencilled on paper and pinned there. */
function pencil(
  fa: Family,
  picks: readonly Spec[],
  cut: PatchCut,
  scheme: PatchScheme,
  progress: number | null,
): Spec[] {
  const o = OUTLINES[fa.o]
  const pen = PENCIL[scheme]
  const paper = PAPER[scheme]
  const a = [
    L(o, {
      f: paper,
      s: pen,
      w: cut === 'full' ? 2 : cut === 's40' ? 3.5 : 7.8,
      ...(cut === 'full' ? { da: '3 2.4' } : {}),
    }),
  ]
  const pw = cut === 'full' ? 1.5 : cut === 's40' ? 2.6 : 4.5
  for (const x of cut === 's24' ? picks.slice(0, 1) : picks) {
    a.push(L(x.d, { s: pen, w: pw, t: x.t }))
  }
  if (cut === 'full') a.push(Fi(C(52, 12, 2.4), pen), St('M52 12L46 20', pen, 1.2))
  if (progress !== null && progress > 0) {
    const length = outlineLength(o)
    const done = Math.min(1, progress)
    // The circle's path starts at nine o'clock, so it is turned a quarter to
    // start the stitching at twelve. Any other outline is stitched from where
    // its path starts: turning a shield would lift the thread off its edge.
    const turn = fa.o === 'circle'
    a.push(
      St(o, fa.fc, cut === 'full' ? 4.6 : cut === 's40' ? 5 : 7.8, {
        da: `${n(done * length)} ${n(length + 10)}`,
        t: turn ? 'rotate(90 32 32)' : '',
        lc: 'butt',
      }),
    )
    // The needle where the stitching stopped, at the two larger cuts.
    if (cut !== 's24' && done < 1) {
      const { at, heading } = pointAlong(o, done)
      // Under the same quarter turn as the stitched band, where it has one.
      const x = turn ? 32 - (at[1] - 32) : at[0]
      const y = turn ? 32 + (at[0] - 32) : at[1]
      const hx = turn ? -heading[1] : heading[0]
      const hy = turn ? heading[0] : heading[1]
      const len = cut === 'full' ? 12 : 10
      a.push(
        St(
          `M${n(x)} ${n(y)}L${n(x + hx * len)} ${n(y + hy * len)}`,
          NEEDLE,
          cut === 'full' ? 1.8 : 2.6,
        ),
        St(
          `M${n(x)} ${n(y)}L${n(x + hx * len * 0.18)} ${n(y + hy * len * 0.18)}`,
          '#2b2f3a',
          cut === 'full' ? 1.8 : 2.6,
          { o: 0.45 },
        ),
      )
    }
  }
  return cut === 'full' ? a : a.map((x) => wrap(x, cut === 's40' ? 0.92 : 0.86))
}

/** An id this build has no drawing for: an empty hoop, keeping the space. */
function hoop(cut: PatchCut): Spec[] {
  if (cut === 'full') {
    return [
      St(C(32, 33, 24), '#a8794a', 3.5),
      St(C(32, 33, 20), '#c9a36a', 1.5),
      Fi(R(28, 4, 8, 6, 1.5), '#a8794a'),
    ]
  }
  if (cut === 's40') {
    return [St(C(32, 33, 24), '#a8794a', 4.5), Fi(R(27.5, 3.5, 9, 7, 1.5), '#a8794a')].map((x) =>
      wrap(x, 0.92),
    )
  }
  return [St(C(32, 33, 23), '#a8794a', 7.8), Fi(R(27, 3, 10, 8, 2), '#a8794a')].map((x) =>
    wrap(x, 0.86),
  )
}

/** The pencil and the paper, the only part of a patch that follows the scheme. */
const PENCIL: Record<PatchScheme, string> = { light: '#5a5f69', dark: '#a3a8b3' }
const PAPER: Record<PatchScheme, string> = { light: '#fbfaf6', dark: '#24262c' }
const NEEDLE = '#c9ced6'

// ---------- the motifs ----------

interface Entry {
  family: string
  tier: PatchTier
  /** The 64 cut's motif. */
  motif: readonly Spec[]
  /** The 40 cut's few shapes, also what the pencil draws. */
  picks: readonly Spec[]
  /** The 24 cut's one accent. */
  accent: Spec
}

const ENTRIES: Record<string, Entry> = {}
function add(
  id: string,
  family: string,
  tier: PatchTier,
  motif: readonly Spec[],
  k: readonly number[] | readonly Spec[],
  acc: number | Spec,
) {
  const picks =
    typeof k[0] === 'number' ? (k as readonly number[]).map((i) => motif[i]!) : (k as Spec[])
  const accent = typeof acc === 'number' ? motif[acc]! : acc
  ENTRIES[id] = { family, tier, motif, picks, accent }
}

// streak: candle to sun
const fl1 = 'M32 18C36 23 37 27 32 31C27 27 28 23 32 18Z'
const candle = [
  Fi(C(32, 25, 9), '#ffc94d', { o: 0.18 }),
  Fi(R(27, 33, 10, 15, 1.5), '#f3ead2'),
  Fi(E(32, 48.5, 9, 2.6), '#c9a36a'),
  St('M32 33V30', '#2b2f3a', 1.2),
  Fi(fl1, '#ffc94d'),
  Fi('M32 23C34 26 34 28 32 30C30 28 30 26 32 23Z', '#fff1c2'),
]
add(
  'streak.7',
  'streak',
  'cotton',
  candle,
  [1, 4],
  Fi('M32 13C40 21 41 28 32 35C23 28 24 21 32 13Z', '#ffc94d'),
)
const lantern = [
  Fi(C(32, 33, 15), '#ffc94d', { o: 0.15 }),
  St('M27 20Q32 12 37 20', '#c9a36a', 1.8),
  Fi(R(25, 19, 14, 4, 1.5) + R(24, 41, 16, 4, 1.5), '#c9a36a'),
  Fi(R(26, 23, 12, 18, 3), '#ffcf6b'),
  St('M29 23.5V40.5M35 23.5V40.5', '#c9a36a', 1.1),
  Fi('M32 26C35 30 35 33 32 37C29 33 29 30 32 26Z', '#ff9f52'),
  Fi('M32 30C33.5 32 33.5 34 32 36C30.5 34 30.5 32 32 30Z', '#fff1c2'),
]
add('streak.30', 'streak', 'twill', lantern, [3, 5], Fi(R(24, 19, 16, 26, 4), '#ffcf6b'))
const bigFlame = 'M32 13C41 21 44 29 40 36C38 40 26 40 24 36C20 29 24 22 32 13Z'
const campfire = [
  Fi(C(32, 34, 16), '#ffc94d', { o: 0.15 }),
  St('M19 47L45 40M19 40L45 47', '#8a5a3c', 4.5),
  Fi(bigFlame, '#ff9f52'),
  Fi('M32 21C38 27 39 32 36 37C34 39 30 39 28 37C25 32 27 27 32 21Z', '#ffc94d'),
  Fi('M32 28C35 31 35 34 33 37L31 37C29 34 29 31 32 28Z', '#fff1c2'),
]
add('streak.100', 'streak', 'applique', campfire, [1, 2], Fi(bigFlame, '#ff9f52'))
const mainFlame = 'M32 10C42 19 45 28 41 36C39 41 25 41 23 36C19 28 23 20 32 10Z'
const bonfire = [
  Fi(C(32, 32, 19), '#ffc94d', { o: 0.14 }),
  St('M17 47L47 42M17 42L47 47', '#8a5a3c', 4.5),
  Fi(
    'M22 41C16 34 18 27 22 22C24 28 27 31 27 37ZM42 41C48 34 46 27 42 22C40 28 37 31 37 37Z',
    '#ff9f52',
  ),
  Fi(mainFlame, '#ff8a3d'),
  Fi('M32 19C39 26 40 32 37 37C35 40 29 40 27 37C24 32 25 26 32 19Z', '#ffc94d'),
  Fi('M32 27C35.5 30 35.5 34 33.5 37.5L30.5 37.5C28.5 34 28.5 30 32 27Z', '#fff1c2'),
  Fi(C(18, 16, 1.2) + C(46, 14, 1.2) + C(50, 25, 1) + C(14, 27, 1), '#ffc94d'),
]
add('streak.180', 'streak', 'satin', bonfire, [1, 3, 4], Fi(mainFlame, '#ff8a3d'))
const sunrise = [
  St(rays(6, 16, 21, 195, 32, 38), '#ffc94d', 2),
  Fi('M19 38A13 13 0 0 1 45 38Z', '#ffc94d'),
  Fi('M24.5 38A7.5 7.5 0 0 1 39.5 38Z', '#fff1c2'),
  St('M11 38L53 38', '#f3ead2', 1.6),
  St('M17 43.5L47 43.5M23 48.5L41 48.5', '#74b9ff', 1.6, { da: '3 2.2' }),
]
add(
  'streak.365',
  'streak',
  'silver',
  sunrise,
  [0, 1, 3],
  Fi('M16 40A16 16 0 0 1 48 40Z', '#ffc94d'),
)
const highSun = [
  Fi(C(32, 32, 16), '#ffc94d', { o: 0.14 }),
  St(rays(8, 12.5, 18.5, 0, 32, 32), '#ffc94d', 2.6),
  Fi(C(32, 32, 9), '#ffc94d'),
  Fi(C(32, 32, 5.5), '#fff1c2'),
]
add('streak.730', 'streak', 'gold', highSun, [1, 2], Fi(C(32, 32, 11), '#ffc94d'))
const goldenSun = [
  Fi(C(32, 32, 18), '#f2c45a', { o: 0.14 }),
  St(rays(6, 13.5, 21, 0, 32, 32), '#f2c45a', 2.6),
  St(rays(6, 13.5, 17.5, 30, 32, 32), '#f2c45a', 2),
  Fi(C(32, 32, 10.5), '#f2c45a'),
  Fi(C(32, 32, 6.5), '#ffe08a'),
  St(C(32, 32, 8.6), '#a77a28', 1, { da: '1 1' }),
]
add('streak.1095', 'streak', 'bullion', goldenSun, [1, 3], Fi(C(32, 32, 11.5), '#f2c45a'))

// corrections: pencil to owl
const rot = 'rotate(45 32 30)'
const pencilArt = [
  Fi(R(28.5, 12, 7, 4, 1), '#e98a9a', { t: rot }),
  Fi(R(28.5, 16, 7, 3), '#c9ccd4', { t: rot }),
  Fi(R(28.5, 19, 7, 20), '#ffc94d', { t: rot }),
  St('M32 19.5V38.5', '#e0a92e', 1, { t: rot }),
  Fi('M28.5 39L35.5 39L32 47Z', '#f1d3a6', { t: rot }),
  Fi('M30.8 44.3L33.2 44.3L32 47Z', '#2b2f3a', { t: rot }),
]
add(
  'correction.1',
  'correction',
  'cotton',
  pencilArt,
  [2, 4, 5],
  Fi(R(27.5, 13, 9, 26, 2) + 'M27.5 38L36.5 38L32 48Z', '#c9821c', { t: rot }),
)
const nib = 'M32 12C37 17 42 23 42 29L35 43L32 50L29 43L22 29C22 23 27 17 32 12Z'
add(
  'correction.10',
  'correction',
  'twill',
  [
    Fi(nib, '#2b2f3a'),
    Fi(C(32, 30, 2.6), '#f3ead2'),
    St('M32 32.8V49', '#f3ead2', 1),
    Fi(C(44, 47, 2.4), '#0b7a3e'),
  ],
  [0, 1],
  Fi(nib, '#2b2f3a'),
)
const tick = 'M20 32L28.5 41L45 21'
add(
  'correction.100',
  'correction',
  'applique',
  [
    St('M19 20L45 20M19 27L40 27M19 34L44 34M19 41L36 41', '#8a8577', 1.6, { da: '2.4 1.8' }),
    St(tick, '#0b7a3e', 5.2),
    St(tick, '#5ee39a', 1.3, { o: 0.8 }),
  ],
  [1],
  St('M19 33L28.5 42L46 20', '#0b7a3e', 7.5),
)
const pages = 'M14 21Q23 17 31 21V44Q23 40 14 44ZM50 21Q41 17 33 21V44Q41 40 50 44Z'
add(
  'correction.1000',
  'correction',
  'satin',
  [
    St('M12 24V46Q22 42 32 46Q42 42 52 46V24', '#0b7a3e', 2.4),
    Fi(pages, '#ffffff', { s: '#b9b2a0', w: 1 }),
    St('M17 27L28 26M17 32L28 31M17 37L28 36', '#9a9484', 1.2, { da: '2 1.4' }),
    St('M37 31L40.5 35L47 26.5', '#0b7a3e', 2.4),
  ],
  [0, 1, 3],
  Fi(pages, '#0b7a3e'),
)
const owl = (t: string, glasses: string | null, cap: boolean, book: boolean) => {
  const a = [
    Fi('M21 21L24 12L28 19ZM43 21L40 12L36 19Z', '#6e5038', { t }),
    Fi(E(32, 34, 13, 15), '#8a6a4a', { t }),
    Fi(E(32, 39, 8, 9), '#d9b98c', { t }),
    St(
      'M27.5 38L29.8 40.2L32 38L34.2 40.2L36.5 38M28.5 43L30.3 44.8L32 43L33.7 44.8L35.5 43',
      '#a8865c',
      1,
      { t },
    ),
    Fi(
      'M19.5 31C17 39 20.5 46 26 47.5C23 41 22 36 19.5 31ZM44.5 31C47 39 43.5 46 38 47.5C41 41 42 36 44.5 31Z',
      '#6e5038',
      { t },
    ),
    Fi(C(27, 29, 5.4) + C(37, 29, 5.4), '#f3ead2', { t }),
    Fi(C(27.4, 29.4, 2.4) + C(36.6, 29.4, 2.4), '#2b2f3a', { t }),
    Fi(C(28.2, 28.6, 1) + C(37.4, 28.6, 1), '#ffffff', { t }),
    Fi('M30.4 32.4L33.6 32.4L32 36Z', '#ff9f52', { t }),
    St('M29 49V51M35 49V51', '#ff9f52', 1.4, { t }),
  ]
  if (glasses)
    a.push(
      St(C(27, 29, 6.4) + C(37, 29, 6.4) + 'M30.6 27.6Q32 26.6 33.4 27.6', glasses, 1.5, { t }),
    )
  if (cap) {
    a.push(
      Fi('M19 17L32 11.5L45 17L32 22.5Z' + R(26.5, 18.5, 11, 4.5, 1), '#2b2f3a', { t }),
      St('M45 17Q46 20 45.6 24', '#f2c45a', 1.4, { t }),
      Fi(C(45.6, 24.6, 1.5), '#f2c45a', { t }),
    )
  }
  if (book) a.push(Fi(R(20, 46.5, 24, 5.5, 1.2), '#0b7a3e'), Fi(R(21.2, 47, 21.6, 2.2), '#ffffff'))
  return a
}
const owlSil = (t: string) =>
  Fi(E(32, 34, 14, 16) + 'M20 23L24 11L30 19ZM44 23L40 11L34 19Z', '#6e5038', { t })
add('correction.5000', 'correction', 'silver', owl('', null, false, false), [1, 5, 6], owlSil(''))
const sc84 = Z(0.84, 32, 30)
add(
  'correction.10000',
  'correction',
  'gold',
  owl(sc84, '#2b2f3a', false, true),
  [1, 5, 11],
  owlSil(sc84),
)
add(
  'correction.25000',
  'correction',
  'bullion',
  owl(sc84, '#f2c45a', true, true),
  [1, 5, 11],
  owlSil(sc84),
)

// messages: one bubble to many voices
add(
  'messages.100',
  'messages',
  'cotton',
  [Fi(C(21, 27, 3.6) + C(32, 27, 3.6) + C(43, 27, 3.6), '#ffffff')],
  [0],
  Fi(C(19, 27, 5.2) + C(32, 27, 5.2) + C(45, 27, 5.2), '#ffffff'),
)
const bubA =
  'M30 14H46A5 5 0 0 1 51 19V28A5 5 0 0 1 46 33H44.5L45.5 38.5L39.5 33H30A5 5 0 0 1 25 28V19A5 5 0 0 1 30 14Z'
add(
  'messages.1000',
  'messages',
  'applique',
  [
    Fi(bubA, '#ffffff'),
    Fi(C(33, 23.5, 1.9) + C(38, 23.5, 1.9) + C(43, 23.5, 1.9), '#3b6cf6'),
    Fi(
      'M16 22H25A4 4 0 0 1 29 26V33A4 4 0 0 1 25 37H20L16.5 41L17 37H16A4 4 0 0 1 12 33V26A4 4 0 0 1 16 22Z',
      '#ff9f52',
    ),
    St('M16 28L25 28M16 32L22 32', '#ffffff', 1.6),
  ],
  [0, 2],
  Fi(bubA, '#ffffff'),
)
add(
  'messages.10000',
  'messages',
  'silver',
  [
    St('M17 18L47 18M17 24L44 24M17 30L47 30M17 36L36 36', '#ffffff', 2.2, { da: '3.2 1.8' }),
    Fi(C(40.5, 36, 2.4), '#ff9f52'),
  ],
  [0, 1],
  St('M18 19H46M18 28H46M18 37H38', '#ffffff', 5),
)
const bub = (x: number, y: number) =>
  `M${x} ${y}h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-7l-4 4l.6-4h-1.6a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4z`
const voiceEdge = { s: '#ffffff', w: 1.1, da: '1.6 1.1' }
add(
  'messages.50000',
  'messages',
  'bullion',
  [
    Fi(bub(14, 13), '#ff9f52', voiceEdge),
    Fi(bub(30, 16), '#5fdc98', voiceEdge),
    Fi(bub(20, 26), '#bba4ff', voiceEdge),
  ],
  [0, 1, 2],
  Fi(bub(14, 13) + bub(30, 16) + bub(20, 26), '#ffffff'),
)

// tokens: spool to golden spool
const spool = (c: string, lc: string, t: string) => [
  Fi(R(25, 20, 14, 24), c, { t }),
  St(
    'M25.5 23L38.5 24M25.5 26L38.5 27M25.5 29L38.5 30M25.5 32L38.5 33M25.5 35L38.5 36M25.5 38L38.5 39M25.5 41L38.5 42',
    lc,
    1,
    { o: 0.6, t },
  ),
  Fi(R(22.5, 16.5, 19, 4.5, 1.6) + R(22.5, 43, 19, 4.5, 1.6), '#c99a62', { t }),
  St('M23.5 21L40.5 21M23.5 43L40.5 43', '#9c6a37', 1, { t }),
]
add(
  'tokens.10000',
  'tokens',
  'twill',
  [...spool('#5fdc98', '#2f9e63', ''), St('M39 33C45 35 47 40 44 45', '#5fdc98', 1.4)],
  [0, 2],
  Fi(R(23, 17, 18, 30, 2), '#5fdc98'),
)
add(
  'tokens.50000',
  'tokens',
  'silver',
  [
    ...spool('#ff9f52', '#c66a24', 'translate(22.5 32) scale(.72) translate(-32 -32)'),
    ...spool('#48d3d0', '#1f8f8c', 'translate(41.5 32) scale(.72) translate(-32 -32)'),
  ],
  [0, 4],
  Fi(R(17.5, 22, 10, 20, 1.5) + R(36.5, 22, 10, 20, 1.5), '#ffcf6b'),
)
add(
  'tokens.250000',
  'tokens',
  'bullion',
  [
    ...spool('#f2c45a', '#a77a28', 'translate(34 34) scale(.86) translate(-32 -32)'),
    St('M14 49L44 13', '#d8dbe3', 1.9),
    Fi(E(42.2, 15.2, 1.1, 2.2), '#5338b8', { t: 'rotate(40 42.2 15.2)' }),
    St('M42.6 15.6C50 20 50 30 40 33', '#f2c45a', 1.3),
  ],
  [0, 2, 4],
  Fi(R(28, 23.7, 12, 20.6, 1.5), '#f2c45a'),
)

// member: growth rings
const ring = (rs: readonly number[], dots: boolean) => {
  const a = [
    Fi(C(32, 33, 15), '#6b4a2c'),
    Fi(C(32, 33, 13), '#e0b07a'),
    St(rs.map((r) => C(32, 33, r)).join(''), '#a9743f', 1.2),
    Fi(C(32, 33, 1.4), '#a9743f'),
    Fi('M32 18.5C31 13 35 10 40 10C40 15 37 18 32 18.5Z', '#b8e15c'),
    St('M32 18.5L35.5 13.5', '#86a83a', 1),
  ]
  if (dots) a.push(Fi(C(20, 22, 1.5) + C(45, 24, 1.5) + C(46, 42, 1.5), '#f2c45a'))
  return a
}
const disc = Fi(C(32, 33, 14), '#e0b07a')
add('veteran.365', 'veteran', 'satin', ring([7.75], false), [0, 1, 4], disc)
add('veteran.730', 'veteran', 'gold', ring([5.67, 9.83], false), [0, 1, 4], disc)
add('veteran.1095', 'veteran', 'bullion', ring([4.62, 7.75, 10.88], true), [0, 1, 4], disc)

// early adopter: a sprout, woven
const leaves =
  'M32 35C26 35 22 31 21 26C27 26 31 29 32 35ZM32 30.5C37 29.5 41 25.5 42 20.5C36 20.5 33 24.5 32 30.5Z'
add(
  'origin.v1',
  'origin',
  'woven',
  [
    Fi(E(32, 46.5, 9, 2.6), '#8a5a3c'),
    St('M32 46C32 40 32 34 32 28', '#2f8f5b', 2.2),
    Fi(leaves, '#45c883'),
    Fi('M32 35C26 35 22 31 21 26C27 26 31 29 32 35Z', '#5fdc98'),
  ],
  [1, 2],
  Fi(leaves + 'M30.8 46V28H33.2V46Z', '#2f8f5b'),
)

// languages: strands become a braid
const wave = (ph: number, amp: number) => {
  let p = ''
  for (let x = 12; x <= 52; x += 2) {
    p += (p ? 'L' : 'M') + x + ' ' + n(32 + amp * Math.sin(((x - 12) / 40) * 2.6 * Math.PI + ph))
  }
  return p
}
const PI = Math.PI
const strands = (cnt: number, w: number, amp: number) => {
  const cols = ['#ff9f52', '#2fbfbc', '#a68cf5', '#3b6cf6', '#45c883']
  const a: Spec[] = []
  for (let i = 0; i < cnt; i++) a.push(St(wave((2 * PI * i) / cnt, amp), cols[i]!, w))
  return a
}
const braidAcc = St(wave(0, 5) + wave(PI, 5), '#c66a24', 5, { t: Z(0.72) })
add('languages.2', 'languages', 'twill', strands(2, 3.6, 7), [0, 1], braidAcc)
add('languages.3', 'languages', 'silver', strands(3, 3.4, 7), [0, 1, 2], braidAcc)
add(
  'languages.5',
  'languages',
  'bullion',
  strands(5, 2.8, 8),
  [
    St(wave(0, 8) + wave((6 * PI) / 5, 8), '#ff9f52', 2.6),
    St(wave((2 * PI) / 5, 8) + wave((8 * PI) / 5, 8), '#2fbfbc', 2.6),
    St(wave((4 * PI) / 5, 8), '#a68cf5', 2.6),
  ],
  braidAcc,
)

// calls: a tin-can line, then a voice, then knots on the line
const tl = 'rotate(-14 16 34)'
const tr2 = 'rotate(14 48 34)'
const cans = [
  Fi(R(11, 27, 10, 14, 1), '#d8dbe3', { t: tl }),
  Fi(E(16, 27, 5, 1.6), '#b9bcc6', { t: tl }),
  St('M11 31h10M11 37h10', '#9aa0ad', 1, { t: tl }),
  Fi(R(43, 27, 10, 14, 1), '#d8dbe3', { t: tr2 }),
  Fi(E(48, 27, 5, 1.6), '#b9bcc6', { t: tr2 }),
  St('M43 31h10M43 37h10', '#9aa0ad', 1, { t: tr2 }),
  St('M20 28Q32 16 44 28', '#f3ead2', 1.5),
]
const voice = St('M27 41q2.5 2 5 0q2.5-2 5 0M27 46q2.5 2 5 0q2.5-2 5 0', '#ffffff', 1.4)
const knots = Fi(C(26, 23.5, 1.7) + C(32, 22, 1.7) + C(38, 23.5, 1.7), '#ffc94d')
const canAcc = Fi(R(10, 25, 12, 17, 2.5) + R(42, 25, 12, 17, 2.5), '#ffffff')
add('calls.1', 'calls', 'twill', cans, [0, 3, 6], canAcc)
add('calls.10', 'calls', 'silver', [...cans, voice], [0, 3, 6], canAcc)
add('calls.50', 'calls', 'bullion', [...cans, voice, knots], [0, 3, 6], canAcc)

// echo reviews: one ripple widens
const arc = (r: number) =>
  `M${n(20 + r * 0.6691)} ${n(32 - r * 0.7431)}A${r} ${r} 0 0 1 ${n(20 + r * 0.6691)} ${n(32 + r * 0.7431)}`
const ripple = (rs: readonly number[]) => [
  Fi(C(20, 32, 3.4), '#ffffff'),
  ...rs.map((r, i) => St(arc(r), '#ffffff', 2.2 - i * 0.2, { o: [1, 0.8, 0.6, 0.45][i]! })),
]
const ripMid = (rs: readonly number[]) => [
  Fi(C(20, 32, 3.6), '#ffffff'),
  St(rs.map(arc).join(''), '#ffffff', 2.6),
]
const ripAcc = St(arc(10) + arc(18), '#ffffff', 5)
add('echo.100', 'echo', 'twill', ripple([9, 15]), ripMid([9, 15]), ripAcc)
add('echo.1000', 'echo', 'silver', ripple([9, 15, 21]), ripMid([9, 15, 21]), ripAcc)
add('echo.5000', 'echo', 'bullion', ripple([9, 15, 21, 27]), ripMid([9, 15, 21, 27]), ripAcc)

// testimonials: one square, four, nine
const quilt = (cnt: number, x0: number, size: number, cols: readonly string[], seams: boolean) => {
  const s = size / cnt
  const paths = cols.map(() => '')
  let sm = ''
  for (let i = 0; i < cnt; i++) {
    for (let j = 0; j < cnt; j++) {
      const x = x0 + j * s
      const y = x0 + i * s
      const q = i * 2 + j
      paths[q % cols.length] += `M${n(x)} ${n(y)}H${n(x + s)}V${n(y + s)}Z`
      paths[(q + 1) % cols.length] += `M${n(x)} ${n(y)}V${n(y + s)}H${n(x + s)}Z`
    }
  }
  for (let i = 0; i <= cnt; i++) {
    sm += `M${x0} ${n(x0 + i * s)}H${x0 + size}M${n(x0 + i * s)} ${x0}V${x0 + size}`
  }
  const a = paths.map((p, i) => Fi(p, cols[i]!)).filter((x) => x.d)
  if (seams) a.push(St(sm, '#2b2f3a', 1, { da: '1.6 1.4' }))
  return a
}
const QC = ['#ff9f52', '#48d3d0', '#bba4ff', '#5fdc98']
const Q2 = ['#ff9f52', '#48d3d0']
const upper = (cnt: number, x0: number, size: number) => {
  const s = size / cnt
  let p = ''
  for (let i = 0; i < cnt; i++) {
    for (let j = 0; j < cnt; j++) {
      p += `M${n(x0 + j * s)} ${n(x0 + i * s)}H${n(x0 + j * s + s)}V${n(x0 + i * s + s)}Z`
    }
  }
  return Fi(p, '#6f58c9', { t: Z(0.72) })
}
add(
  'testimonials.1',
  'testimonials',
  'twill',
  quilt(1, 21, 22, QC, true),
  quilt(1, 21, 22, Q2, false),
  upper(1, 21, 22),
)
add(
  'testimonials.5',
  'testimonials',
  'silver',
  quilt(2, 19, 26, QC, true),
  quilt(2, 19, 26, Q2, false),
  upper(2, 19, 26),
)
add(
  'testimonials.20',
  'testimonials',
  'bullion',
  quilt(3, 19, 26, QC, true),
  quilt(3, 19, 26, Q2, false),
  upper(3, 19, 26),
)

// people you helped: threads over a hole, a woven darn, the darn and its needle
const darn = (cols: readonly number[], rows: readonly number[], needle: boolean) => {
  let v = ''
  let h = ''
  for (const dx of cols) {
    const hl = Math.sqrt(169 - dx * dx) - 1.5
    v += `M${32 + dx} ${n(27 - hl)}V${n(27 + hl)}`
  }
  rows.forEach((dy, i) => {
    const hl = Math.sqrt(169 - dy * dy) - 1.5
    h += `M${n(32 - hl + (i % 2 ? 4 : 0))} ${27 + dy}H${n(32 + hl)}`
  })
  const a = [Fi(C(32, 27, 13), '#2a3245'), St(v, '#5fdc98', 2.4)]
  if (h) a.push(St(h, '#f3ead2', 2.4, { da: '4 4', lc: 'butt' }))
  a.push(St(C(32, 27, 13), '#f3ead2', 1.1, { da: '1.6 1.3' }))
  if (needle)
    a.push(St('M38 45L49 20', '#d8dbe3', 1.9), St('M48.6 21C53 27 47 34 42 32', '#5fdc98', 1.3))
  return a
}
const darnAcc = St('M26 18V36M32 16V38M38 18V36', '#5fdc98', 5)
const G6 = [-10, -6, -2, 2, 6, 10]
const R5 = [-8, -4, 0, 4, 8]
add('guide.3', 'guide', 'twill', darn([-6, 0, 6], [], false), [0, 1], darnAcc)
add('guide.10', 'guide', 'silver', darn(G6, R5, false), [0, 1], darnAcc)
add('guide.50', 'guide', 'bullion', darn(G6, R5, true), [0, 1, 4], darnAcc)

// first replies: an open door, a reply on the step, the porch light on
const doorway = 'M22 52V32A10 10 0 0 1 42 32V52Z'
const door = (bubble: boolean, lamp: boolean) => {
  const a = [
    Fi(doorway, '#ffcf6b'),
    Fi('M22 31L14.5 27.5L14.5 55L22 52Z', '#6b3c22'),
    Fi(C(17, 41, 1.2), '#e7bb85'),
    St('M18 52.5L46 52.5', '#fbe6c8', 1.6),
  ]
  if (bubble) {
    a.push(
      Fi(
        'M27 34h10a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-5l-3 3l.4-3h-2.4a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3z',
        '#b5683a',
      ),
    )
  }
  if (lamp)
    a.push(Fi('M22 52H42L49 56H15Z', '#ffcf6b', { o: 0.55 }), Fi(C(32, 16.5, 2.6), '#ffcf6b'))
  return a
}
const doorAcc = Fi('M21 53V31A11 11 0 0 1 43 31V53Z', '#ffcf6b')
add('openers.10', 'openers', 'twill', door(false, false), [0, 1], doorAcc)
add('openers.50', 'openers', 'silver', door(true, false), [0, 1, 4], doorAcc)
add('openers.200', 'openers', 'bullion', door(true, true), [0, 1, 4], doorAcc)

// ---------- out ----------

/** Every id the sheet draws, in the sheet's order. */
export const PATCH_IDS: readonly string[] = Object.keys(ENTRIES)

export function hasPatch(id: string): boolean {
  return id in ENTRIES
}

/** The thread a badge is sewn in, for the detail sheet's "Silver · 365 days". */
export function patchTier(id: string): PatchTier | null {
  return ENTRIES[id]?.tier ?? null
}

function toNode(x: Spec): PatchNode {
  return {
    d: withoutArcs(x.d),
    fill: x.f,
    stroke: x.s,
    strokeWidth: x.w,
    ...(x.da ? { dash: x.da } : {}),
    opacity: x.o,
    ...(x.t ? { transform: x.t } : {}),
    cap: x.lc,
  }
}

const cache = new Map<string, readonly PatchNode[]>()

/**
 * What to draw for `id` at `cut` in `state`. An id this build does not know
 * draws the empty hoop, which keeps the badge's space without inventing a
 * face for it.
 */
export function patchNodes(
  id: string,
  cut: PatchCut,
  state: PatchState,
  scheme: PatchScheme,
): readonly PatchNode[] {
  const progress = state.kind === 'next' ? Math.round(state.progress * 100) / 100 : null
  const key = `${id}|${cut}|${state.kind}|${progress ?? ''}|${state.kind === 'earned' ? '' : scheme}`
  const hit = cache.get(key)
  if (hit) return hit

  const entry = ENTRIES[id]
  const family = entry ? FAMILIES[entry.family] : undefined
  let specs: Spec[]
  if (!entry || !family) specs = hoop(cut)
  else if (state.kind === 'earned') {
    specs =
      cut === 'full'
        ? big(family, entry.tier, entry.motif)
        : cut === 's40'
          ? mid(family, entry.tier, entry.picks)
          : small(family, entry.tier, entry.accent)
  } else {
    specs = pencil(family, entry.picks, cut, scheme, progress)
  }
  const nodes = specs.map(toNode)
  cache.set(key, nodes)
  return nodes
}

/**
 * The patch's outline, its thread colour and its length — what the earned
 * moment stitches once around the border. `null` for an id with no drawing.
 */
export function patchOutline(id: string): { d: string; color: string; length: number } | null {
  const entry = ENTRIES[id]
  const family = entry ? FAMILIES[entry.family] : undefined
  if (!family) return null
  const d = OUTLINES[family.o]
  return { d: withoutArcs(d), color: family.fc, length: outlineLength(d) }
}
