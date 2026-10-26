// Venus's chat stickers: 12 text-free die-cut PNGs (transparent, white border, soft shadow) drawn
// from the polished rig, plus one sheet. Output: out/stickers/.
//   node stickers.mjs
// The die-cut recipe: the white border is grown from a render without whiskers, so it hugs the body
// and not the hairs.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { openBrowser } from './lib/frames.mjs'
import { EXTRA_EXPR } from './lib/score.mjs'
import { RIG, OUT_ROOT, WORK } from './lib/paths.mjs'
const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig.js'))
Object.assign(V.EXPR, EXTRA_EXPR)
const OUTD = path.join(OUT_ROOT, 'stickers'),
  WK = path.join(WORK, 'stickers')
fs.mkdirSync(OUTD, { recursive: true })
fs.mkdirSync(WK, { recursive: true })

const INK = '#14161B',
  BLUE = '#3B6CF6'
const TAILQ = { pitch: 0, yaw: 95, curl: 100, hook: 110, side: -20, len: 1.2 }
const TAILUP = { pitch: 88, yaw: 90, side: -10, curl: 0, hook: 10, len: 1.15 }
const LOAFT = { pitch: 0, yaw: 90, side: 120, curl: 0, hook: 0, len: 0.9 }
const sparkle = (x, y, r, c = '#FFC409') =>
  `<path transform="translate(${x} ${y})" d="M0 ${-r}C${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r} 0C${r * 0.12} ${r * 0.12} ${r * 0.12} ${r * 0.12} 0 ${r}C${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r} 0C${-r * 0.12} ${-r * 0.12} ${-r * 0.12} ${-r * 0.12} 0 ${-r}Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
// a chat "typing" bubble: three dots, no letters
const typing = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M-78 -40Q-78 -62 -56 -62H56Q78 -62 78 -40V8Q78 30 56 30H-20L-44 54L-40 30H-56Q-78 30 -78 8Z" fill="#FFFFFF" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>${[-36, 0, 36].map((dx, i) => `<circle cx="${dx}" cy="-16" r="13" fill="${i === 1 ? BLUE : INK}"/>`).join('')}</g>`
// two little motion arcs beside a raised paw: the world's smallest round of applause
const clapLines = (x, y) =>
  `<g transform="translate(${x} ${y}) scale(-1 1)" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"><path d="M-6 -30Q10 -40 24 -34"/><path d="M0 -6Q20 -10 34 0"/><path d="M-4 18Q12 22 22 34"/></g>`
// a wave: arcs above the paw
const waveLines = (x, y) =>
  `<g transform="translate(${x} ${y})" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"><path d="M-30 -10Q-34 -40 -14 -58"/><path d="M30 -10Q34 -40 14 -58"/></g>`

// [id, pose, scale, cx, cy, extra svg over her]
const S = [
  [
    'squint',
    {
      expr: 'squint',
      head: { roll: 14, s: 1.1 },
      tail: { pitch: 0, yaw: 80, side: 230, len: 1.2 },
    },
    0.8,
    300,
    575,
  ],
  [
    'slow-blink',
    { expr: 'slowblink', head: { pitch: 9, roll: 6 }, ears: { L: { rot: 10 }, R: { rot: 10 } } },
    0.8,
    300,
    575,
    sparkle(470, 120, 30) + sparkle(512, 182, 16),
  ],
  ['blep', { expr: 'blep', head: { roll: -9 }, tail: TAILQ }, 0.82, 300, 570],
  [
    'bag-throne',
    { bag: 0.86, expr: 'proud', tail: Object.assign({}, TAILQ, { pitch: 28 }) },
    0.82,
    300,
    560,
  ],
  [
    'paw-at-camera',
    {
      mode: 'sprawl',
      persp: 640,
      pcy: -40,
      elev: 4,
      paw: { reach: 1 },
      head: { roll: 8 },
      expr: 'innocent',
      tail: { pitch: 0, yaw: -95, side: -30 },
    },
    0.72,
    330,
    470,
  ],
  [
    'sleepy',
    { mode: 'loaf', expr: 'sleepy', eyes: { L: { lid: 0.86 }, R: { lid: 0.8 } }, tail: LOAFT },
    1.0,
    300,
    500,
  ],
  ['shocked', { expr: 'shocked', tail: TAILUP, rise: 0 }, 0.8, 300, 575],
  [
    'diva-hoodie',
    { outfit: 'hoodie', expr: 'diva', yaw: 18, head: { yaw: -8 }, tail: TAILQ },
    0.82,
    300,
    570,
  ],
  [
    'onesie',
    {
      outfit: 'onesie',
      expr: 'regal',
      yaw: 28,
      head: { yaw: -10, pitch: -14 },
      ears: { L: { rot: -10 }, R: { rot: -10 } },
      tail: TAILQ,
    },
    0.82,
    290,
    570,
  ],
  [
    'clapping',
    {
      expr: 'bored',
      paw: { lift: 0.55 },
      head: { roll: -4 },
      tail: { pitch: 0, yaw: 80, side: 230, len: 1.2 },
    },
    0.8,
    300,
    575,
    clapLines(205, 462),
  ],
  [
    'typing-loaf',
    {
      mode: 'loaf',
      expr: 'plotting',
      eyes: { L: { px: 0, py: -0.4 }, R: { px: 0, py: -0.4 } },
      tail: LOAFT,
    },
    0.95,
    300,
    540,
    typing(430, 130),
  ],
  [
    'sorry-wave',
    {
      expr: 'embarrassed',
      paw: { lift: 1 },
      ears: { L: { rot: 24 }, R: { rot: 20 } },
      head: { roll: -10 },
      tail: { pitch: 0, yaw: 80, side: 230, len: 1.2 },
    },
    0.8,
    300,
    575,
    waveLines(244, 492),
  ],
]

const B = await openBrowser()
const jobs = []
for (const [n, p, sc, cx, cy, over = ''] of S) {
  const base = Object.assign({ shadow: 0 }, p)
  jobs.push({
    svg: V.svg(base, { width: 600, height: 600, cx, cy, scale: sc, over }),
    w: 600,
    h: 600,
    out: `${WK}/st-${n}.png`,
    transparent: true,
  })
  jobs.push({
    svg: V.svg(base, { width: 600, height: 600, cx, cy, scale: sc, whiskers: false, over }),
    w: 600,
    h: 600,
    out: `${WK}/stm-${n}.png`,
    transparent: true,
  })
}
await B.render(jobs, 4)
await B.close()
for (const [n] of S) {
  const out = `${OUTD}/venus-${n}.png`
  execSync(
    `magick ${WK}/st-${n}.png -bordercolor none -border 40 \\( ${WK}/stm-${n}.png -bordercolor none -border 40 -alpha extract -morphology Dilate Disk:18 -background white -alpha shape \\) +swap -compose over -composite \\( +clone -background '#14161B' -shadow 35x8+0+8 \\) +swap -background none -layers merge +repage -trim +repage -resize 492x492 -gravity center -background none -extent 512x512 ${out}`,
  )
}
execSync(
  `magick montage ${S.map(([n]) => `${OUTD}/venus-${n}.png`).join(' ')} -tile 4x3 -geometry 512x512+24+24 -background '#F4F1EA' ${OUTD}/sheet.png`,
)
console.log('wrote', S.length, 'stickers and sheet.png to', OUTD)
