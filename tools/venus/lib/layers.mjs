// Everything in the frame that is not Venus: the looks (grounds), the number and its label, the
// caption bubble, confetti, flashes, sparkles, zzz, the outfit poof and the end card. Pure functions
// of time; SVG strings out. Generalised from an earlier per-day version (which had one ground per day).
//
// Safe zones (Instagram Reel-safe, and therefore Story-safe): no text above
// y 270 or below y 1540, text inside x 65..935. The number lives in 270..560 once it settles, the
// caption bubble in 1250..1540, Venus on the stage between them.
import fs from 'node:fs'
import path from 'node:path'
import { GEN } from './paths.mjs'
export const W = 1080,
  H = 1920
export const BLUE = '#3b6cf6',
  YELLOW = '#ffc409',
  INK = '#14161b',
  WHITE = '#ffffff'
const n1 = (v) => Math.round(v * 10) / 10
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const EASE = {
  linear: (t) => t,
  inOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => {
    const c1 = 2.2,
      c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
}
export function trk(keys, t) {
  if (!keys || !keys.length) return 0
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++)
    if (t < keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i]
      return (
        a[1] +
        (b[1] - a[1]) *
          (EASE[b[2] || 'inOut'] || EASE.inOut)((t - a[0]) / Math.max(1e-6, b[0] - a[0]))
      )
    }
  return keys[keys.length - 1][1]
}
export function rnd(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Nunito has Latin and Cyrillic; Arabic falls through to the system's Arabic face
export const FONT = `Nunito, 'SF Arabic', 'Geeza Pro', sans-serif`
const rays = (n, R, w = 1) => {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = a0 + (Math.PI / n) * w
    d += `M0 0L${n1(Math.cos(a0) * R)} ${n1(Math.sin(a0) * R)}L${n1(Math.cos(a1) * R)} ${n1(Math.sin(a1) * R)}Z`
  }
  return d
}
const grad = (id, a, b) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
function twinkles(t, seed, n, y0, y1, col = '#fff', big = 4) {
  const r = rnd(seed)
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = 60 + r() * 960,
      y = y0 + r() * (y1 - y0),
      ph = r() * 6,
      sp = 1.5 + r() * 2,
      k = Math.max(0, Math.sin(t * sp + ph))
    if (k > 0.05)
      s += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(2 + big * k)}" fill="${col}" opacity="${n1(k * 80) / 100}"/>`
  }
  return s
}

// ------------------------------------------------------------------ looks
// bg(t, G, ctx) draws behind her; floor is the colour of what she sits on (also used for the
// ledge she peeks over); num is the number's fill / shadow / label colour; bubble the caption's shadow.
export const LOOKS = {
  // brand blue, a slow sunburst, a floor (day 7's ground)
  sunburst: {
    floor: '#2e5de2',
    floorLine: '#5a88fb',
    num: { fill: YELLOW, shadow: INK, label: WHITE },
    bubble: INK,
    bg: (t) =>
      `<rect width="${W}" height="${H}" fill="${BLUE}"/><g transform="translate(540 600) rotate(${n1(t * 7)})"><path d="${rays(18, 2000)}" fill="#4b7bf8"/></g>`,
  },
  // warm yellow, slow diagonal stripes, a blue counter (day 22's ground)
  stripes: {
    floor: '#6c90fa',
    floorLine: '#8eaaff',
    num: { fill: WHITE, shadow: BLUE, label: INK },
    bubble: INK,
    bg: (t) => {
      const off = (t * 18) % 150
      let st = ''
      for (let x = -1200; x < 1400; x += 150)
        st += `<rect x="${n1(x + off)}" y="-600" width="64" height="3200" fill="#ffcb2b"/>`
      return `<rect width="${W}" height="${H}" fill="${YELLOW}"/><g transform="rotate(-28 540 960)">${st}</g>`
    },
  },
  // ink stage, a spotlight, twinkles; a yellow burst behind the number once it lands (day 100's)
  stage: {
    floor: '#1f2230',
    floorLine: '#2c3044',
    num: { fill: YELLOW, shadow: BLUE, label: WHITE },
    bubble: BLUE,
    bg: (t, G, ctx) => {
      let s = `<rect width="${W}" height="${H}" fill="${INK}"/><defs><linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/></linearGradient><radialGradient id="pool"><stop offset="0" stop-color="${BLUE}" stop-opacity="0.85"/><stop offset="1" stop-color="${BLUE}" stop-opacity="0"/></radialGradient></defs>`
      const burst = clamp((t - ctx.numAt) / 0.4)
      if (burst > 0)
        s += `<g transform="translate(540 470) rotate(${n1(t * 9)}) scale(${n1(0.3 + 0.7 * EASE.out(burst))})" opacity="${n1(22 * burst) / 100}"><path d="${rays(16, 1600, 0.73)}" fill="${YELLOW}"/></g>`
      return (
        s +
        `<path d="M430 0L650 0L1000 ${G + 40}L80 ${G + 40}Z" fill="url(#cone)"/>` +
        twinkles(t, ctx.seed, 22, 240, G - 160)
      )
    },
    pool: true,
  },
  // lilac with drifting polka dots
  'lilac-dots': {
    floor: '#8a70e6',
    floorLine: '#a891f2',
    num: { fill: WHITE, shadow: '#5b3fc9', label: INK },
    bubble: '#5b3fc9',
    bg: (t) => {
      let s =
        grad('lil', '#d9c8ff', '#a98ef7') + `<rect width="${W}" height="${H}" fill="url(#lil)"/>`
      const off = (t * 22) % 120
      for (let y = -120; y < H; y += 120)
        for (let x = -120; x < W + 120; x += 120) {
          const o = ((y / 120) % 2) * 60
          s += `<circle cx="${n1(x + o + off)}" cy="${n1(y + off * 0.6)}" r="13" fill="#ffffff" opacity="0.28"/>`
        }
      return s
    },
  },
  // mint with a comic halftone falling off from a corner
  'mint-halftone': {
    floor: '#2fa96c',
    floorLine: '#5cc78f',
    num: { fill: YELLOW, shadow: INK, label: INK },
    bubble: INK,
    bg: (t) => {
      let s = `<rect width="${W}" height="${H}" fill="#8ff0bd"/>`
      const sh = (t * 10) % 54
      for (let y = 0; y < H + 54; y += 54)
        for (let x = 0; x < W + 54; x += 54) {
          const d = Math.hypot(x - 1080, y - 0) / 1500,
            r = 19 * clamp(1 - d)
          if (r > 1.2) s += `<circle cx="${x - sh}" cy="${y + sh}" r="${n1(r)}" fill="#56d99a"/>`
        }
      return s
    },
  },
  // day sky with drifting clouds
  'sky-clouds': {
    floor: '#3f7fe0',
    floorLine: '#6aa0f0',
    num: { fill: WHITE, shadow: BLUE, label: INK },
    bubble: BLUE,
    bg: (t) => {
      let s =
        grad('sky', '#bfe0ff', '#5d9ef0') + `<rect width="${W}" height="${H}" fill="url(#sky)"/>`
      const cloud = (x, y, k) =>
        `<g transform="translate(${n1(x)} ${n1(y)}) scale(${k})" fill="#ffffff" opacity="0.85"><ellipse cx="0" cy="0" rx="120" ry="48"/><ellipse cx="-60" cy="-26" rx="64" ry="52"/><ellipse cx="40" cy="-42" rx="76" ry="64"/></g>`
      ;[
        [100, 300, 1, 14],
        [820, 620, 0.8, 9],
        [380, 900, 0.6, 6],
        [960, 1120, 0.9, 11],
      ].forEach(([x, y, k, v]) => {
        s += cloud(((x + t * v) % 1400) - 160, y, k)
      })
      return s
    },
  },
  // night: plum, a moon, twinkling stars (the sleepy look)
  night: {
    floor: '#2a1d66',
    floorLine: '#43318f',
    num: { fill: YELLOW, shadow: '#14093f', label: WHITE },
    bubble: '#14093f',
    bg: (t, G, ctx) =>
      grad('nit', '#5a43c4', '#21155e') +
      `<rect width="${W}" height="${H}" fill="url(#nit)"/><circle cx="860" cy="330" r="92" fill="#fff4c2"/><circle cx="822" cy="304" r="92" fill="#4e39b5"/>` +
      twinkles(t, ctx.seed + 3, 30, 240, G - 200, '#fff6d0', 5),
  },
}

export function ground(look, t, G, ctx) {
  const L = LOOKS[look]
  let s = L.bg(t, G, ctx)
  s += `<rect y="${G - 80}" width="${W}" height="${H - G + 80}" fill="${L.floor}"/><rect y="${G - 80}" width="${W}" height="6" fill="${L.floorLine}"/>`
  if (L.pool)
    s += `<defs><radialGradient id="pool2"><stop offset="0" stop-color="${BLUE}" stop-opacity="0.85"/><stop offset="1" stop-color="${BLUE}" stop-opacity="0"/></radialGradient></defs><ellipse cx="540" cy="${G}" rx="430" ry="90" fill="url(#pool2)"/>`
  return s
}
// the ledge she peeks over: drawn in front of her only while she is below it
export function ledge(look, G) {
  const L = LOOKS[look]
  return `<rect y="${G - 40}" width="${W}" height="${H - G + 40}" fill="${L.floor}"/><rect y="${G - 40}" width="${W}" height="8" fill="${L.floorLine}"/>`
}

// ------------------------------------------------------------------ the number and its label
export const NUM_Y = 470,
  BADGE_Y = 392
const NUM_SIZE = (txt) => (txt.length <= 1 ? 430 : txt.length === 2 ? 390 : 330)
function numText(text, F, st, fill) {
  const base = `font-family="Nunito" font-weight="900" font-size="${F}" text-anchor="middle" letter-spacing="${-F * 0.03}"`
  const y = n1(F * 0.35)
  return (
    `<text ${base} x="0" y="${n1(y + F * 0.045)}" fill="${st.shadow}" stroke="${st.shadow}" stroke-width="${n1(F * 0.075)}" stroke-linejoin="round">${text}</text>` +
    `<text ${base} x="0" y="${y}" fill="${fill}" stroke="${INK}" stroke-width="${n1(F * 0.075)}" stroke-linejoin="round" paint-order="stroke">${text}</text>`
  )
}
// How far down the label reaches (px), under the full-size number or under the badge it shrinks
// to; the 14 px below its baseline are the descenders (Russian Д, the Arabic letters).
export const labelBottom = (text, badge = false) =>
  badge
    ? BADGE_Y + (NUM_SIZE(text) * 0.35 + 92 + 14) * 0.75
    : NUM_Y + NUM_SIZE(text) * 0.35 + 92 + 14
// num: { at, text, label, labelW (measured px at 54), mode: pop|slam|count, from, countFrom }
export function number(look, t, num, toBadgeAt) {
  const st = LOOKS[look].num,
    F = NUM_SIZE(num.text)
  // the label is the app's own unit, in caps; squeezed if a locale's words run long
  const lw = num.labelW || 600,
    lsc = Math.min(1, 820 / lw)
  const label = (op) =>
    `<text x="0" y="${n1(F * 0.35 + 92)}" font-family="${FONT}" font-weight="900" font-size="${n1(54 * lsc)}" letter-spacing="${n1(6 * lsc)}" text-anchor="middle" fill="${st.label}" opacity="${op}"${num.rtl ? ' direction="rtl"' : ''}>${esc(num.label)}</text>`
  if (t < num.at) {
    if (num.mode !== 'count' || t < num.countFrom) return ''
    // the hook: a counter racing up, slowing as it nears the day
    const u = clamp((t - num.countFrom) / (num.at - num.countFrom)),
      a = num.from,
      b = num.value - 1
    const v = Math.min(b, a + Math.floor((b - a + 1) * (1 - Math.pow(1 - u, 2.2))))
    const jig = Math.sin(t * 60) * 3
    return `<g transform="translate(540 ${n1(NUM_Y + jig)}) scale(0.8)">${numText(num.format(Math.max(a, v)), F, { ...st, shadow: '#2a2d36' }, '#ffffff')}${label(0.55)}</g>`
  }
  const u = t - num.at
  let s,
    rot = 0,
    dy = 0
  if (num.mode === 'slam') {
    // drops from above, hits, squashes
    const f = clamp(u / 0.13)
    dy = -760 * (1 - EASE.in(f))
    s = u < 0.13 ? 1.1 : u < 0.22 ? 1 + 0.12 * Math.sin(((u - 0.13) / 0.09) * Math.PI) : 1
  } else {
    s =
      u < 0.1
        ? 1.25 * EASE.out(u / 0.1)
        : u < 0.22
          ? 1.25 - 0.31 * EASE.inOut((u - 0.1) / 0.12)
          : u < 0.36
            ? 0.94 + 0.06 * EASE.inOut((u - 0.22) / 0.14)
            : 1
    rot =
      u < 0.12 ? -12 + 16 * EASE.out(u / 0.12) : u < 0.3 ? 4 - 4 * EASE.inOut((u - 0.12) / 0.18) : 0
  }
  const b = EASE.inOut(clamp((t - toBadgeAt) / 0.32))
  const y = NUM_Y + (BADGE_Y - NUM_Y) * b + dy,
    sc = s * (1 - 0.25 * b)
  let burst = ''
  const bu = num.mode === 'slam' ? u - 0.13 : u
  if (bu >= 0 && bu < 0.4) {
    const k = bu / 0.4
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2,
        r0 = F * (0.5 + 0.55 * EASE.out(k)),
        r1 = r0 + F * 0.22 * (1 - k)
      burst += `<path d="M${n1(Math.cos(a) * r0)} ${n1(Math.sin(a) * r0 * 0.8)}L${n1(Math.cos(a) * r1)} ${n1(Math.sin(a) * r1 * 0.8)}" stroke="${st.label === INK ? INK : '#ffffff'}" stroke-width="${n1(14 * (1 - k) + 2)}" stroke-linecap="round"/>`
    }
  }
  // the label lands 0.2 s after the number
  const lk = clamp((u - 0.2) / 0.18)
  return `<g transform="translate(540 ${n1(y)})">${burst}<g transform="rotate(${n1(rot)}) scale(${n1(sc * 1000) / 1000})">${numText(num.text, F, st, st.fill)}${lk > 0 ? `<g transform="translate(0 ${n1(20 * (1 - EASE.out(lk)))})">${label(n1(lk * 100) / 100)}</g>` : ''}</g></g>`
}

// ------------------------------------------------------------------ caption bubble
// blocks: [{ lines: [[word, ...], ...], words: [{ t0, t1 }], whisper, F }]
export const BUB = { x0: 70, x1: 930, top: 1290, tailX: 600 }
export function bubble(look, t, blocks, hideAt, rtl) {
  let k = -1
  for (let i = 0; i < blocks.length; i++) if (t >= blocks[i].words[0].t0 - 0.14) k = i
  if (k < 0 || t > hideAt + 0.2) return ''
  const B = blocks[k],
    first = blocks[0].words[0].t0 - 0.14
  const F = B.F,
    lineH = Math.round(F * 1.2),
    pad = 32
  const { x0, x1, top, tailX } = BUB
  const h = B.lines.length * lineH + pad * 2 - 12,
    bottom = top + h
  const uIn = t - first,
    uBlk = t - (B.words[0].t0 - 0.14),
    uOut = t - hideAt
  let s = uIn < 0.2 ? 0.6 + 0.4 * EASE.outBack(uIn / 0.2) : 1
  if (k > 0 && uBlk < 0.16) s *= 1 + 0.05 * Math.sin((uBlk / 0.16) * Math.PI)
  if (uOut > 0) s *= 1 - EASE.in(clamp(uOut / 0.2))
  if (s <= 0.01) return ''
  const shadow = LOOKS[look].bubble
  const box = (dy, fill, stroke) =>
    `<path d="M${x0} ${top + 34 + dy}Q${x0} ${top + dy} ${x0 + 34} ${top + dy}H${tailX - 22}L${tailX + 10} ${top - 46 + dy}L${tailX + 40} ${top + dy}H${x1 - 34}Q${x1} ${top + dy} ${x1} ${top + 34 + dy}V${bottom - 34 + dy}Q${x1} ${bottom + dy} ${x1 - 34} ${bottom + dy}H${x0 + 34}Q${x0} ${bottom + dy} ${x0} ${bottom - 34 + dy}Z" fill="${fill}" ${stroke}/>`
  let g = B.whisper
    ? box(8, shadow, '') +
      box(
        0,
        '#ffffff',
        `stroke="${INK}" stroke-width="5" stroke-dasharray="16 12" stroke-linejoin="round"`,
      )
    : box(10, shadow, '') +
      box(0, '#ffffff', `stroke="${INK}" stroke-width="6" stroke-linejoin="round"`)
  let wi = 0
  B.lines.forEach((line, li) => {
    const y = top + pad + lineH * li + F * 0.8
    let spans = ''
    line.forEach((w, j) => {
      const tm = B.words[wi++]
      const said = t >= tm.t0,
        now = said && t < tm.t1 + 0.08
      spans += `<tspan fill="${now ? BLUE : INK}" fill-opacity="${said ? 1 : 0.26}">${esc(w)}${j < line.length - 1 ? ' ' : ''}</tspan>`
    })
    g += `<text x="540" y="${n1(y)}" font-family="${FONT}" font-weight="${B.whisper ? 800 : 900}" font-size="${F}" text-anchor="middle"${rtl ? ' direction="rtl"' : ''} xml:space="preserve">${spans}</text>`
  })
  return `<g transform="translate(${tailX} ${top - 46}) scale(${n1(s * 1000) / 1000}) translate(${-tailX} ${-(top - 46)})">${g}</g>`
}

// ------------------------------------------------------------------ effects
export function confetti(t, t0, seed = 7, ox = 540, oy = 470) {
  const u = t - t0
  if (u < 0 || u > 4) return ''
  const r = rnd(seed),
    cols = [YELLOW, BLUE, '#ffffff', YELLOW, '#ff8a3d', '#ff7ab8']
  let s = ''
  for (let i = 0; i < 90; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.5,
      v = 900 + r() * 1300,
      drag = 1.6 + r() * 1.2
    const sw = 30 + r() * 50,
      swp = r() * 6,
      spin = (r() - 0.5) * 1400,
      flip = 6 + r() * 10,
      c = cols[i % cols.length],
      w = 14 + r() * 12,
      h = 22 + r() * 14
    const e = (1 - Math.exp(-drag * u)) / drag
    const x = ox + Math.cos(a) * v * e + Math.sin(u * 3 + swp) * sw * clamp(u - 0.4)
    const y = oy + Math.sin(a) * v * e + 234 * u * u + 160 * u
    if (y > H + 40 || x < -60 || x > W + 60) continue
    s += `<rect x="${n1(-w / 2)}" y="${n1(-h / 2)}" width="${n1(w)}" height="${n1(h)}" rx="3" fill="${c}" transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(spin * u)}) scale(1 ${n1(Math.cos(u * flip) * 100) / 100})"/>`
  }
  return s
}
export function flashes(t, times) {
  let s = ''
  const spots = [
    [170, 620],
    [900, 900],
    [240, 1180],
    [880, 420],
    [180, 860],
    [860, 700],
  ]
  times.forEach((t0, i) => {
    const u = t - t0
    if (u < 0 || u > 0.28) return
    const k = 1 - u / 0.28,
      [x, y] = spots[i % spots.length],
      R = 150 * (0.5 + 0.5 * k)
    s += `<rect width="${W}" height="${H}" fill="#fff" opacity="${n1(55 * Math.pow(k, 3)) / 100}"/>`
    s += `<g transform="translate(${x} ${y}) rotate(${n1(u * 120)})" opacity="${n1(k * 100) / 100}">${star(R)}<circle r="${n1(R * 0.22)}" fill="#fff"/></g>`
  })
  return s
}
const star = (R, c = '#fff') =>
  `<path d="M0 ${-R}Q${R * 0.12} ${-R * 0.12} ${R} 0Q${R * 0.12} ${R * 0.12} 0 ${R}Q${-R * 0.12} ${R * 0.12} ${-R} 0Q${-R * 0.12} ${-R * 0.12} 0 ${-R}Z" fill="${c}"/>`
// small four-point sparkles round a point, popping in sequence
export function sparkles(t, t0, cx, cy, seed = 3, n = 5, spread = 260) {
  const r = rnd(seed)
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = cx + (r() - 0.5) * spread * 2,
      y = cy + (r() - 0.5) * spread,
      d = t0 + i * 0.09 + r() * 0.1,
      u = (t - d) / 0.55
    if (u < 0 || u > 1) continue
    const k = Math.sin(u * Math.PI),
      R = (18 + r() * 22) * k
    s += `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(u * 60)})">${star(R)}</g>`
  }
  return s
}
// zzz rising from a sleeping head
export function zzz(t, t0, t1, x, y) {
  if (t < t0 || t > t1 + 0.6) return ''
  let s = ''
  for (let i = 0; i < 3; i++) {
    const u = ((t - t0) * 0.7 + i / 3) % 1,
      fade = clamp((t1 + 0.6 - t) / 0.6)
    const op = Math.sin(u * Math.PI) * fade
    s += `<text x="${n1(x + 40 * u + i * 6)}" y="${n1(y - 160 * u)}" font-family="Nunito" font-weight="900" font-size="${n1(40 + 30 * u)}" fill="#ffffff" stroke="${INK}" stroke-width="5" paint-order="stroke" opacity="${n1(op * 100) / 100}">z</text>`
  }
  return s
}
// a cloud poof that hides an outfit change
export function poof(t, t0, x, y) {
  const u = (t - t0) / 0.45
  if (u < 0 || u > 1) return ''
  const r = rnd(9)
  let s = ''
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2,
      d = 60 + 140 * EASE.out(u),
      R = (70 + r() * 30) * (1 - u * 0.7)
    s += `<circle cx="${n1(x + Math.cos(a) * d)}" cy="${n1(y + Math.sin(a) * d * 0.8)}" r="${n1(R)}" fill="#ffffff" opacity="${n1((1 - u) * 95) / 100}"/>`
  }
  return (
    s +
    `<circle cx="${x}" cy="${y}" r="${n1(150 * (1 - u))}" fill="#ffffff" opacity="${n1((1 - u) * 90) / 100}"/>`
  )
}
// impact stars on a landing
export function impact(t, t0, x, y) {
  const u = (t - t0) / 0.3
  if (u < 0 || u > 1) return ''
  let s = ''
  for (const sd of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const a = (sd > 0 ? 0 : Math.PI) + (i - 1) * 0.45 * sd,
        d = 120 + 120 * EASE.out(u)
      s += `<g transform="translate(${n1(x + Math.cos(a) * d)} ${n1(y - 30 + Math.sin(a) * d * 0.4)})" opacity="${n1((1 - u) * 100) / 100}">${star(26 * (1 - u * 0.5), '#ffffff')}</g>`
    }
  return s
}

// ------------------------------------------------------------------ end card
// the mark and wordmark are read from the brand vectors in assets/brand/ rather than retyped
const WORDMARK = fs
  .readFileSync(path.join(GEN, 'assets/brand/langx-wordmark.svg'), 'utf8')
  .match(/fill="currentColor" d="([^"]+)"/)[1]
const MARK = fs
  .readFileSync(path.join(GEN, 'assets/brand/langx-mark.svg'), 'utf8')
  .match(/<path fill="#000000"[^>]*\/>\s*<path fill="#ffffff"[^>]*\/>/)[0]
export function endCard(t, t0, hx, hy) {
  const u = t - t0
  if (u < 0) return ''
  const R = 1500 * EASE.in(clamp(u / 0.34)) + 1
  let s =
    u < 0.34
      ? `<circle cx="${n1(hx)}" cy="${n1(hy)}" r="${n1(R + 26)}" fill="${YELLOW}"/><circle cx="${n1(hx)}" cy="${n1(hy)}" r="${n1(R)}" fill="${BLUE}"/>`
      : `<rect width="${W}" height="${H}" fill="${BLUE}"/>`
  const k = u - 0.2
  if (k > 0) {
    const sMark =
      k < 0.18
        ? 1.12 * EASE.out(k / 0.18)
        : k < 0.34
          ? 1.12 - 0.12 * EASE.inOut((k - 0.18) / 0.16)
          : 1
    const k2 = k - 0.08,
      sWord =
        k2 <= 0
          ? 0
          : k2 < 0.18
            ? 1.08 * EASE.out(k2 / 0.18)
            : k2 < 0.34
              ? 1.08 - 0.08 * EASE.inOut((k2 - 0.18) / 0.16)
              : 1
    const MS = 0.5,
      WS = 600 / 1874
    s += `<g transform="translate(540 820) scale(${n1(sMark * 1000) / 1000}) rotate(${n1((1 - Math.min(1, k / 0.3)) * -30)}) translate(${-512 * MS} ${-512 * MS}) scale(${MS})">${MARK}</g>`
    if (sWord > 0)
      s += `<g transform="translate(540 1080) scale(${n1(sWord * 1000) / 1000}) translate(${-300} ${-94}) scale(${n1(WS * 10000) / 10000}) translate(-1316 -233)"><path fill="#ffffff" d="${WORDMARK}"/></g>`
  }
  return s
}

// ------------------------------------------------------------------ v2 move props
// The props a signature move brings with it (lib/score.mjs pushes them to sc.fx.props), drawn in
// rig world units inside the figure group: 'back' before her, 'front' after her. Each entry is
// { kind, t0, t1, layer, x, y, rot, s (keyframe lists or numbers), attach: 'mouth' | null, par }.
// The food, seats and toys are the inventory's own drawings (lib/items-art.mjs, read only), so a
// move's box or mouse is the same object the item system draws; the cork, the notebook and the
// speed lines are drawn here.
import * as ART from './items-art.mjs'
// a hold key ([t] with no value) keeps the value before it, as in the score's c.k.seq
const holds = (v) => {
  let last = 0
  return v.map((k) => (k.length > 1 ? ((last = k[1]), k) : [k[0], last]))
}
const kv = (v, t, d = 0) => (v == null ? d : typeof v === 'number' ? v : trk(holds(v), t))
const LN = '#3B2414'
const PROP_ART = {
  // a wine cork: the knock-off's victim (never a phone or a glass)
  cork: () =>
    `<g transform="translate(0 -20)"><rect x="-26" y="-20" width="52" height="40" rx="9" fill="#D9A86C" stroke="${LN}" stroke-width="6"/><ellipse cx="26" cy="0" rx="8" ry="20" fill="#C08A4C" stroke="${LN}" stroke-width="5"/><circle cx="-8" cy="-6" r="3" fill="#B07A40"/><circle cx="6" cy="8" r="2.5" fill="#B07A40"/></g>`,
  // an open notebook seen from above the counter: blue cover, two ruled pages, no letters
  notebook: () => {
    const page = (sd) =>
      `<path d="M0 -6L${sd * 210} -20L${sd * 226} 30L0 40Z" fill="#FFFFFF" stroke="${LN}" stroke-width="6" stroke-linejoin="round"/>` +
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<path d="M${sd * 26} ${-2 + i * 10}L${sd * (196 + i * 4)} ${-12 + i * 11}" stroke="#9DB6F7" stroke-width="3.5" stroke-linecap="round"/>`,
        )
        .join('')
    return `<g transform="translate(0 -26)"><path d="M-236 -26L236 -26L250 44L-250 44Z" fill="${BLUE}" stroke="${LN}" stroke-width="6" stroke-linejoin="round"/>${page(-1)}${page(1)}<path d="M0 -6V40" stroke="${LN}" stroke-width="5"/></g>`
  },
  dot: (p, t) => ART.AIR['red-dot']({ k: 1.6 + 0.1 * Math.sin(t * 30) }),
  moth: (p, t) => `<g transform="scale(0.9)">${ART.AIR.moth({ flap: t * 7 })}</g>`,
  mouse: (p, t) => `<g transform="scale(0.62)">${ART.FLOOR['toy-mouse']({ t })}</g>`,
  tube: () => `<g transform="scale(0.7)">${ART.FLOOR['treat-tube']()}</g>`,
  floor: (p) => ART.FLOOR[p.draw](p.par || {}),
}
export function moveProps(props, t, P, V, layer) {
  let s = ''
  for (const pr of props || []) {
    if (pr.layer !== layer || t < pr.t0 || t > pr.t1) continue
    if (pr.kind === 'box') {
      const B = ART.SEATS['cardboard-box']()
      const k = kv(pr.s, t, 1)
      s += `<g transform="translate(${n1(kv(pr.x, t))} 0) scale(${n1(k * 1000) / 1000})">${layer === 'back' ? B.back : B.front}</g>`
      continue
    }
    if (pr.kind === 'streaks') {
      // speed lines trailing her, fading as she slows
      const x = P.x,
        v = kv(pr.v, t),
        dir = Math.sign(v) || 1,
        a = clamp(Math.abs(v) / 2400)
      if (a < 0.05) continue
      ;[
        [-300, 300],
        [-200, 380],
        [-120, 240],
        [-60, 330],
      ].forEach(([y, L], i) => {
        const x0 = x - dir * (160 + i * 30),
          x1 = x0 - dir * L * a
        s += `<path d="M${n1(x0)} ${y}L${n1(x1)} ${y}" stroke="#FFFFFF" stroke-width="${14 - i * 2}" stroke-linecap="round" opacity="${n1(a * 85) / 100}"/>`
      })
      continue
    }
    let x = kv(pr.x, t),
      y = kv(pr.y, t),
      rot = kv(pr.rot, t),
      sc = kv(pr.s, t, 1)
    if (pr.attach === 'mouth') {
      const q = V.headPoint(P, [0, 78, 128])
      x += q.x
      y += q.y
      rot += q.roll
    }
    if (sc <= 0.001) continue
    s += `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(rot)}) scale(${n1(sc * 1000) / 1000})">${PROP_ART[pr.kind](pr, t)}</g>`
  }
  return s
}
// while she is in the move's box, nothing of her shows below its bottom edge
export const inBox = (props, t) =>
  (props || []).some((p) => p.kind === 'box' && t >= p.t0 && t <= p.t1)
