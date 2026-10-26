// Venus · LangX sticker pack: chat-emotion die-cut stickers (512 px PNG, transparent) drawn from the
// polished rig, 18 text-free, 4 English word stickers and "Hello" in the app's eight languages. Output: out/stickers/pack/.
//   node sticker-pack.mjs [--only id,id]
// Same die-cut recipe as stickers.mjs. The rig is the pack's own copy (rig/venus-rig-pack.js) with one
// addition: paw.at = [wrist, paw] targets, so a wave can rise clear of the body instead of sitting
// on the chest where the outline swallows it.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { openBrowser } from './lib/frames.mjs'
import { EXTRA_EXPR } from './lib/score.mjs'
import { RIG, OUT_ROOT, WORK } from './lib/paths.mjs'
const V = createRequire(import.meta.url)(path.join(RIG, 'venus-rig-pack.js'))
Object.assign(V.EXPR, EXTRA_EXPR)
const PACK = path.join(OUT_ROOT, 'stickers/pack'),
  PNG = path.join(PACK, 'png'),
  WK = path.join(WORK, 'pack')
fs.mkdirSync(PNG, { recursive: true })
const only = (() => {
  const i = process.argv.indexOf('--only')
  return i > 0 ? process.argv[i + 1].split(',') : null
})()

const INK = '#14161B',
  BLUE = '#3B6CF6',
  GOLD = '#FFC409',
  RED = '#E5484D',
  GREEN = '#2FB36B',
  PINK = '#F2667E',
  TEAR = '#7CC4FF'
const sw = `stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`
const TAILQ = { pitch: 0, yaw: 95, curl: 100, hook: 110, side: -20, len: 1.2 }
const TAILUP = { pitch: 88, yaw: 90, side: -10, curl: 0, hook: 10, len: 1.15 }
const TAILS = { pitch: 0, yaw: 80, side: 230, len: 1.2 }
const LOAFT = { pitch: 0, yaw: 90, side: 120, curl: 0, hook: 0, len: 0.9 }
// a raised paw beside her face (cat-local 3D: x her left-right, y up negative, z toward camera)
const WAVE = (k = 1) => ({
  lift: 1,
  size: 1.35,
  at: [
    [-112 - 20 * k, -246, 86],
    [-128 - 26 * k, -282, 92],
  ],
  tilt: -30 + 10 * k,
})
const STOP = {
  lift: 1,
  size: 1.5,
  at: [
    [-96, -214, 150],
    [-104, -244, 170],
  ],
  tilt: 0,
}

// ---- overlay bits, in 600x600 canvas coordinates
const sparkle = (x, y, r, c = GOLD) =>
  `<path transform="translate(${x} ${y})" d="M0 ${-r}C${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r} 0C${r * 0.12} ${r * 0.12} ${r * 0.12} ${r * 0.12} 0 ${r}C${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r} 0C${-r * 0.12} ${-r * 0.12} ${-r * 0.12} ${-r * 0.12} 0 ${-r}Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
const heart = (x, y, r, rot = 0, c = PINK) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${r / 30})" d="M0 26C-30 6 -40 -8 -36 -20C-32 -34 -12 -36 0 -20C12 -36 32 -34 36 -20C40 -8 30 6 0 26Z" fill="${c}" stroke="${INK}" stroke-width="${(6 * 30) / r}" stroke-linejoin="round"/><path transform="translate(${x} ${y}) rotate(${rot}) scale(${r / 30})" d="M-24 -20Q-22 -26 -14 -26" stroke="#fff" stroke-width="${(6 * 30) / r}" fill="none" stroke-linecap="round" opacity="0.8"/>`
const arcs = (x, y, rot = 0, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="none" ${sw} stroke-width="7"><path d="M-14 -34Q-34 -8 -20 22"/><path d="M-36 -48Q-64 -6 -42 38"/></g>`
const drop = (x, y, r, rot = 0, c = TEAR) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${r / 20})" d="M0 -26C8 -12 18 0 18 10C18 20 10 26 0 26C-10 26 -18 20 -18 10C-18 0 -8 -12 0 -26Z" fill="${c}" stroke="${INK}" stroke-width="${(5 * 20) / r}" stroke-linejoin="round"/>`
const badge = (x, y, ok) =>
  `<g transform="translate(${x} ${y})"><circle r="46" fill="${ok ? GREEN : RED}" stroke="${INK}" stroke-width="7"/>${ok ? `<path d="M-22 2L-6 18L24 -16" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M-18 -18L18 18M18 -18L-18 18" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/>`}</g>`
const glyph = (x, y, t, size, rot = 0, fill = INK) =>
  `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-family="Nunito" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}" stroke="${INK}" stroke-width="${fill === INK ? 0 : 6}" paint-order="stroke" stroke-linejoin="round">${t}</text>`
const zzz = (x, y) =>
  glyph(x, y, 'z', 46, -10, '#fff') +
  glyph(x + 40, y - 46, 'z', 62, -6, '#fff') +
  glyph(x + 92, y - 104, 'z', 80, 0, '#fff')
const confetti = (pts) =>
  pts
    .map(([x, y, r0, c, k]) => [x, y, r0 * 1.7, c, k])
    .map(([x, y, r, c, k]) =>
      k
        ? `<rect x="${x - r}" y="${y - r * 0.45}" width="${2 * r}" height="${r * 0.9}" rx="3" transform="rotate(${((x * 7 + y) % 90) - 45} ${x} ${y})" fill="${c}" stroke="${INK}" stroke-width="4"/>`
        : `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="${c}" stroke="${INK}" stroke-width="4"/>`,
    )
    .join('')
const sun = (x, y) =>
  `<g transform="translate(${x} ${y})">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45})" d="M0 -50L0 -66" ${sw} stroke="${INK}" stroke-width="8"/><path transform="rotate(${i * 45})" d="M0 -50L0 -66" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>`).join('')}<circle r="36" fill="${GOLD}" stroke="${INK}" stroke-width="7"/></g>`
const moon = (x, y) =>
  `<path transform="translate(${x} ${y})" d="M10 -44A44 44 0 1 0 40 26A36 36 0 1 1 10 -44Z" fill="${GOLD}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`
const typing = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M-78 -40Q-78 -62 -56 -62H56Q78 -62 78 -40V8Q78 30 56 30H-20L-44 54L-40 30H-56Q-78 30 -78 8Z" fill="#FFFFFF" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>${[-36, 0, 36].map((dx, i) => `<circle cx="${dx}" cy="-16" r="13" fill="${i === 1 ? BLUE : INK}"/>`).join('')}</g>`
// two small chat bubbles, one in each colour: two people, two languages
const duo = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M-60 -30Q-60 -50 -40 -50H20Q40 -50 40 -30V-4Q40 16 20 16H-20L-40 36L-36 16H-40Q-60 16 -60 -4Z" fill="${BLUE}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M0 26Q0 6 20 6H80Q100 6 100 26V52Q100 72 80 72H60L64 92L40 72H20Q0 72 0 52Z" fill="${GOLD}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/></g>`

// a speech bubble with a word in it; width comes from the measured text, the tail points at (tx, ty)
const FONT = (sz) => `900 ${sz}px Nunito, 'Noto Sans Arabic'`
let measure
async function bubble(text, cx, cy, size, tx, ty, rot = -4) {
  const [w] = await measure([text], FONT(size))
  // a floor on width: a short word (Olá!, مرحبا) would otherwise run under the highlight stroke
  const W = Math.max(w + size * 0.9, size * 3.9),
    H = size * 1.45,
    x0 = cx - W / 2,
    y0 = cy - H / 2,
    r = H / 2
  const bx = Math.max(x0 + r, Math.min(x0 + W - r, tx + (cx - tx) * 0.35)),
    by = y0 + H
  const body = `M${x0 + r} ${y0}H${x0 + W - r}A${r} ${r} 0 0 1 ${x0 + W - r} ${y0 + H}H${bx + 18}L${tx} ${ty}L${bx - 22} ${by}H${x0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`
  return `<g transform="rotate(${rot} ${cx} ${cy})"><path d="${body}" fill="${BLUE}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><path d="M${x0 + r * 0.7} ${y0 + H * 0.3}Q${x0 + r * 0.8} ${y0 + H * 0.16} ${x0 + r * 1.3} ${y0 + H * 0.14}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.55"/><text x="${cx}" y="${cy + size * 0.35}" font-family="Nunito, 'Noto Sans Arabic'" font-weight="900" font-size="${size}" text-anchor="middle" fill="#fff">${text}</text></g>`
}

// [lang, word, in-app sticker id, extra keywords]. Arabic has no "!": in a right-to-left run it lands on
// the left and reads as a stray mark to a Latin reader.
const HELLOS = [
  ['en', 'Hello!', 'hello', []],
  ['es', '¡Hola!', 'hola', ['hola']],
  ['pt', 'Olá!', 'ola', ['olá', 'ola']],
  ['fr', 'Bonjour!', 'bonjour', ['bonjour']],
  ['de', 'Hallo!', 'hallo', ['hallo']],
  ['tr', 'Merhaba!', 'merhaba', ['merhaba']],
  ['ru', 'Привет!', 'privet', ['привет', 'privet']],
  ['ar', 'مرحبا', 'marhaban', ['مرحبا', 'marhaba']],
]
// the in-app pack's id for each sticker (packages/shared cosmetics.ts), where it differs from ours
const APP_ID = Object.assign(
  { 'slow-blink': 'blink', 'good-morning': 'morning', 'good-night': 'goodnight' },
  Object.fromEntries(HELLOS.map(([l, , a]) => [`hello-${l}`, a])),
)

// id, emoji, keywords, pose, scale, cx, cy, over (string or async fn)
const S = [
  [
    'hi',
    '👋',
    ['hi', 'hello', 'hey', 'wave'],
    { expr: 'happy', paw: WAVE(), head: { roll: 6 }, tail: TAILQ },
    0.78,
    320,
    575,
    arcs(170, 320, -20, 1.0),
  ],
  [
    'love',
    '❤️',
    ['love', 'heart', 'aww'],
    { expr: 'loving', tail: TAILQ },
    0.78,
    290,
    575,
    heart(470, 150, 46, 12) + heart(520, 250, 26, -10) + heart(110, 210, 30, -14),
  ],
  [
    'lol',
    '😂',
    ['lol', 'haha', 'laugh'],
    { expr: 'laughing', head: { roll: 12 }, tail: TAILUP, rise: 0 },
    0.78,
    300,
    575,
    drop(140, 230, 22, -40) +
      drop(462, 210, 22, 40) +
      arcs(102, 330, 0, 0.8) +
      arcs(498, 330, 180, 0.8),
  ],
  [
    'ok',
    '👌',
    ['ok', 'okay', 'yes'],
    { expr: 'proud', head: { pitch: 2 }, tail: TAILQ },
    0.8,
    270,
    575,
    badge(470, 380, true),
  ],
  [
    'no',
    '🙅',
    ['no', 'nope', 'stop'],
    { expr: 'mock', paw: STOP, head: { roll: -6, yaw: 14 }, tail: TAILS },
    0.8,
    310,
    575,
    badge(480, 150, false),
  ],
  [
    'sorry',
    '🥺',
    ['sorry', 'oops', 'my bad'],
    { expr: 'sad', head: { roll: -8 }, tail: { pitch: 0, yaw: -80, side: -230, len: 1.2 } },
    0.8,
    300,
    575,
    drop(420, 150, 18, 10),
  ],
  [
    'crying',
    '😭',
    ['cry', 'sad', 'tears'],
    {
      expr: 'sad',
      eyes: { L: { lid: 0.5 }, R: { lid: 0.5 } },
      mouth: { open: 0.4, wide: 0.7 },
      tail: { pitch: 0, yaw: -80, side: -230, len: 1.2 },
    },
    0.8,
    300,
    575,
    drop(212, 320, 16, -20) +
      drop(388, 320, 16, 20) +
      drop(190, 380, 12, -30) +
      drop(410, 380, 12, 30),
  ],
  [
    'shocked',
    '😱',
    ['shocked', 'omg', 'wow'],
    { expr: 'shocked', tail: TAILUP },
    0.8,
    300,
    575,
    glyph(470, 190, '!', 120, 12, GOLD) + glyph(520, 230, '!', 80, 20, GOLD),
  ],
  [
    'thinking',
    '🤔',
    ['hmm', 'think', 'what'],
    { expr: 'curious', tail: TAILQ },
    0.8,
    280,
    575,
    glyph(470, 210, '?', 130, 14, BLUE) + glyph(530, 120, '?', 70, 24, BLUE),
  ],
  [
    'celebrate',
    '🎉',
    ['yay', 'congrats', 'party'],
    { expr: 'delighted', paw: WAVE(0.4), rise: 0, tail: TAILUP },
    0.78,
    310,
    575,
    confetti([
      [110, 120, 14, GOLD, 1],
      [180, 60, 10, BLUE],
      [460, 70, 14, RED, 1],
      [520, 160, 10, GREEN],
      [90, 280, 10, PINK],
      [510, 300, 13, BLUE, 1],
      [400, 30, 9, GREEN, 1],
    ]) + sparkle(470, 220, 22),
  ],
  [
    'proud',
    '😎',
    ['proud', 'boss', 'confident'],
    { bag: 0.86, expr: 'proud', tail: Object.assign({}, TAILQ, { pitch: 28 }) },
    0.82,
    300,
    560,
  ],
  [
    'slow-blink',
    '😌',
    ['blink', 'trust', 'calm'],
    { expr: 'slowblink', head: { pitch: 9, roll: 6 }, ears: { L: { rot: 10 }, R: { rot: 10 } } },
    0.8,
    300,
    575,
    sparkle(470, 120, 30) + sparkle(512, 182, 16),
  ],
  [
    'squint',
    '🤨',
    ['sus', 'really', 'suspicious'],
    { expr: 'squint', head: { roll: 14, s: 1.1 }, tail: TAILS },
    0.8,
    300,
    575,
  ],
  [
    'blep',
    '😛',
    ['blep', 'tongue', 'silly'],
    { expr: 'blep', head: { roll: -9 }, tail: TAILQ },
    0.82,
    300,
    570,
  ],
  [
    'typing',
    '💬',
    ['typing', 'wait', 'brb'],
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
    'boop',
    '🐾',
    ['boop', 'paw', 'poke'],
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
    '😴',
    ['sleepy', 'tired', 'zzz'],
    { mode: 'loaf', expr: 'sleepy', eyes: { L: { lid: 0.86 }, R: { lid: 0.8 } }, tail: LOAFT },
    0.9,
    280,
    540,
    zzz(430, 230),
  ],
  [
    'diva',
    '💅',
    ['diva', 'fabulous', 'sassy'],
    { outfit: 'hoodie', expr: 'diva', yaw: 18, head: { yaw: -8 }, tail: TAILQ },
    0.82,
    300,
    570,
  ],
  // English word stickers
  [
    'thanks',
    '🙏',
    ['thanks', 'thank you', 'thx'],
    {
      expr: 'slowblink',
      head: { pitch: 9, roll: 6 },
      ears: { L: { rot: 10 }, R: { rot: 10 } },
      tail: TAILQ,
    },
    0.66,
    300,
    590,
    () => bubble('Thanks!', 300, 90, 76, 330, 200, 3).then((s) => s + heart(500, 250, 26, 12)),
  ],
  [
    'good-morning',
    '☀️',
    ['good morning', 'morning', 'gm'],
    {
      mode: 'stretch',
      expr: 'yawn',
      yaw: 90,
      tail: { pitch: 60, yaw: 0, side: 0, curl: 30, hook: 60, len: 1.1 },
    },
    0.62,
    330,
    590,
    () => bubble('Good morning!', 290, 90, 60, 380, 220, -3).then((s) => s + sun(515, 250)),
  ],
  [
    'good-night',
    '🌙',
    ['good night', 'night', 'gn'],
    { mode: 'loaf', expr: 'asleep', tail: LOAFT },
    0.8,
    300,
    590,
    () => bubble('Good night', 300, 100, 66, 320, 230, 3).then((s) => s + moon(520, 260)),
  ],
  [
    'practise',
    '🗣',
    ['practise', 'practice', "let's talk"],
    { expr: 'happy', head: { roll: -10 }, ears: { L: { rot: -8 }, R: { rot: -8 } }, tail: TAILQ },
    0.66,
    280,
    590,
    () => bubble("Let's practise!", 300, 90, 60, 300, 210, -3).then((s) => s + duo(470, 290)),
  ],
  // "Hello" in each of the app's eight languages: one greeting per language, Turkish among them, not ahead of them
  ...HELLOS.map(([l, t, , kw], i) => [
    `hello-${l}`,
    '👋',
    ['hello', 'hi', ...kw],
    { expr: 'happy', paw: WAVE(0.6), head: { roll: i % 2 ? 6 : -6 }, tail: TAILQ },
    0.66,
    320,
    590,
    () => bubble(t, 300, 90, 76, 250, 200, i % 2 ? 3 : -4),
  ]),
]

const B = await openBrowser()
measure = B.measure
const todo = S.filter(([n]) => !only || only.includes(n))
const jobs = []
for (const [n, , , p, sc, cx, cy, over0 = ''] of todo) {
  const over = typeof over0 === 'function' ? await over0(B) : over0
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
await B.render(jobs, 6)
await B.close()
const files = []
S.forEach(([n], i) => {
  const out = `${PNG}/${String(i + 1).padStart(2, '0')}-${n}.png`
  files.push(out)
  if (only && !only.includes(n)) return
  execSync(
    `magick ${WK}/st-${n}.png -bordercolor none -border 40 \\( ${WK}/stm-${n}.png -bordercolor none -border 40 -alpha extract -morphology Dilate Disk:18 -background white -alpha shape \\) +swap -compose over -composite \\( +clone -background '#14161B' -shadow 35x8+0+8 \\) +swap -background none -layers merge +repage -trim +repage -resize 492x492 -gravity center -background none -extent 512x512 -strip ${out}`,
  )
})
fs.writeFileSync(
  path.join(PACK, 'stickers.json'),
  JSON.stringify(
    S.map(([n, e, k], i) => ({
      file: path.basename(files[i]),
      id: n,
      appId: APP_ID[n] || n,
      emoji: e,
      keywords: k,
    })),
    null,
    2,
  ),
)
console.log('wrote', todo.length, 'of', S.length, 'stickers to', PNG)
