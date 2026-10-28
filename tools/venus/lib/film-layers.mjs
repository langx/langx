// What the introduction film draws that a day video does not: the title card, the header pills,
// the clapperboard, the film's caption bubble (voice-over and whisper modes, sentences that stay
// hidden until said, a text swap instead of a flicker), the stickers, the photo-booth print, the
// wall of covers and its lock. Pure functions of time; SVG strings out, like lib/layers.mjs, whose
// pieces (the number's type, the bubble's outline, the poof) they reuse.
//
// Sticker and tile pictures are not inlined per frame: film.mjs hands frames.mjs one set of <defs>
// per page (images by id), and these layers <use> them.
import * as L from './layers.mjs'

const { EASE, INK, BLUE, YELLOW, clamp } = L
const n1 = (v) => Math.round(v * 10) / 10
const n3 = (v) => Math.round(v * 1000) / 1000
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Nunito for Latin and Cyrillic, the bundled Noto Sans Arabic for Arabic (frames.mjs loads both),
// never the machine's own Arabic face
export const FILM_FONT = `Nunito, 'Noto Sans Arabic', sans-serif`
// 0 -> 1.12 -> 1 over len: how pills, stickers and pops land
const popK = (u, len = 0.24) =>
  u <= 0
    ? 0
    : u >= len
      ? 1
      : u < len * 0.6
        ? 1.12 * EASE.out(u / (len * 0.6))
        : 1.12 - 0.12 * EASE.inOut((u / len - 0.6) / 0.4)

// ------------------------------------------------------------------ text layout (measured)
// Wraps words into as few lines as fit, at most `maxLines`, none wider than maxW and the widest as
// narrow as it can be. m: the measured width of each word and of ' ' at one size. null when it does
// not fit. Sentences (word indices): each of `must` starts a line whatever it costs, a smaller size
// or one more line (a sentence after a "…" is not drawn until it is said, so it never waits at the
// end of a line); `prefer` are the other sentence starts, where a break goes when one can. `only`:
// no break but between sentences. A line that ends on a word of one or two letters ("in", "en",
// "по", "في") counts as SHORT_END px wider, so the little word goes down with the words it belongs to.
const SHORT_END = 120
const shortWord = (x) => !/[.,!?…:;»]$/u.test(x) && [...x].length <= 2
export function wrap(ws, m, maxW, maxLines, { prefer = [], must = [], only = false } = {}) {
  const sp = m[' ']
  const w = (a) => a.reduce((s, x, i) => s + m[x] + (i ? sp : 0), 0)
  let best = null
  // every way to cut the words into n lines (n - 1 cuts, all of `must` among them)
  const cut = (n, from, cuts) => {
    if (cuts.length === n - 1) {
      if (!must.every((i) => cuts.includes(i))) return
      if (only && !cuts.every((i) => prefer.includes(i) || must.includes(i))) return
      const at = [0, ...cuts, ws.length]
      const lines = cuts.concat(ws.length).map((b, k) => ws.slice(at[k], b))
      const widest = Math.max(...lines.map(w))
      if (widest > maxW) return
      const score =
        widest +
        SHORT_END * cuts.filter((i) => shortWord(ws[i - 1])).length -
        1e6 * cuts.filter((i) => prefer.includes(i)).length
      if (!best || score < best.score) best = { score, lines }
      return
    }
    for (let i = from; i < ws.length; i++) cut(n, i + 1, [...cuts, i])
  }
  for (let n = 1; n <= maxLines && !best; n++) cut(n, 1, [])
  return best ? best.lines : null
}

// ------------------------------------------------------------------ the title card
// "VENUS" drops in the number's slam (lib/layers.mjs number), in the stage look's colours. It sits
// higher than a day's number: the tagline goes under it, and her ears and raised tail need the room.
export const TITLE_Y = L.NUM_Y - 80
export function title(t, t0, F, text = 'VENUS') {
  const u = t - t0
  if (u < 0) return ''
  const st = L.LOOKS.stage.num
  const dy = -760 * (1 - EASE.in(clamp(u / 0.13)))
  const s = u < 0.13 ? 1.1 : u < 0.22 ? 1 + 0.12 * Math.sin(((u - 0.13) / 0.09) * Math.PI) : 1
  let burst = ''
  const bu = u - 0.13
  if (bu >= 0 && bu < 0.4) {
    const k = bu / 0.4
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2,
        r0 = F * (1.3 + 0.9 * EASE.out(k)),
        r1 = r0 + F * 0.35 * (1 - k)
      burst += `<path d="M${n1(Math.cos(a) * r0)} ${n1(Math.sin(a) * r0 * 0.5)}L${n1(Math.cos(a) * r1)} ${n1(Math.sin(a) * r1 * 0.5)}" stroke="#ffffff" stroke-width="${n1(14 * (1 - k) + 2)}" stroke-linecap="round"/>`
    }
  }
  return `<g transform="translate(540 ${n1(TITLE_Y + dy)})">${burst}<g transform="scale(${n3(s)})">${L.numText(text, F, st, st.fill)}</g></g>`
}

// ------------------------------------------------------------------ pills (the tagline, "Free")
// lay: { F, lines: [text], w: [px] } from film.mjs (measured at F in FILM_FONT 900)
export function pill(
  t,
  t0,
  lay,
  cx,
  cy,
  { fill = '#ffffff', color = INK, rtl = false, out = null } = {},
) {
  const u = t - t0
  let k = popK(u)
  if (out !== null && t > out) k *= 1 - EASE.in(clamp((t - out) / 0.2))
  if (k <= 0.001) return ''
  const lineH = Math.round(lay.F * 1.18),
    padX = Math.round(lay.F * 0.62),
    padY = Math.round(lay.F * 0.34)
  const w = Math.max(...lay.w) + padX * 2,
    h = lay.lines.length * lineH + padY * 2
  const r = Math.min(h / 2, lay.F * 0.9)
  let s = `<rect x="${n1(-w / 2)}" y="${n1(-h / 2 + 9)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(r)}" fill="${INK}"/>`
  s += `<rect x="${n1(-w / 2)}" y="${n1(-h / 2)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(r)}" fill="${fill}" stroke="${INK}" stroke-width="6"/>`
  lay.lines.forEach((ln, i) => {
    const y = -h / 2 + padY + lineH * i + lay.F * 0.86
    s += `<text x="0" y="${n1(y)}" font-family="${FILM_FONT}" font-weight="900" font-size="${lay.F}" letter-spacing="${n1(lay.F * 0.04)}" text-anchor="middle" fill="${color}"${rtl ? ' direction="rtl"' : ''}>${esc(ln)}</text>`
  })
  return `<g transform="translate(${n1(cx)} ${n1(cy)}) scale(${n3(k)})">${s}</g>`
}

// ------------------------------------------------------------------ the clapperboard
// A chapter card without words: it pops in open on the beat, snaps shut 0.06 s later (the sound's
// thud), holds, and leaves upwards. Drawn in the header slot.
export function clapper(t, t0) {
  const u = t - t0
  if (u < 0 || u > 0.56) return ''
  const k = u < 0.07 ? 0.7 + 0.3 * EASE.outBack(u / 0.07) : 1
  const ang =
    u < 0.06
      ? -30 * (1 - EASE.in(u / 0.06))
      : u < 0.16
        ? 4 * Math.sin(((u - 0.06) / 0.1) * Math.PI)
        : 0
  const lift = 520 * EASE.in(clamp((u - 0.4) / 0.16))
  const W = 330,
    stripes = (x0, y, h) => {
      let s = ''
      for (let i = -1; i < 7; i++) {
        const x = x0 + i * 56
        s += `<path d="M${x} ${y + h}L${x + 26} ${y}L${x + 52} ${y}L${x + 26} ${y + h}Z" fill="#ffffff"/>`
      }
      return s
    }
  const body =
    `<rect x="${-W / 2}" y="-40" width="${W}" height="190" rx="18" fill="${INK}" stroke="#ffffff" stroke-width="7"/>` +
    `<clipPath id="clb"><rect x="${-W / 2}" y="-40" width="${W}" height="44"/></clipPath><g clip-path="url(#clb)">${stripes(-W / 2, -40, 44)}</g>` +
    `<path d="M${-W / 2 + 26} 50H${W / 2 - 26}M${-W / 2 + 26} 100H${W / 2 - 26}M0 50V150" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.85"/>`
  const stick =
    `<g transform="translate(${-W / 2} -46) rotate(${n1(ang)})">` +
    `<rect x="0" y="-44" width="${W}" height="44" rx="10" fill="${INK}" stroke="#ffffff" stroke-width="7"/>` +
    `<clipPath id="cls"><rect x="0" y="-44" width="${W}" height="44" rx="10"/></clipPath><g clip-path="url(#cls)">${stripes(0, -44, 44)}</g>` +
    `<circle cx="22" cy="-22" r="9" fill="#ffffff"/></g>`
  return `<g transform="translate(540 ${n1(430 - lift)}) scale(${n3(k)})">${body}${stick}</g>`
}

// ------------------------------------------------------------------ the caption bubble
// block: { lines: [[word index, ...]], F, words: [{ text, t0, t1, hideUntil }], whisper, tails:
// [{ t, on }] } laid out by film.mjs. Unlike the day videos' bubble it has no tail while she is
// off screen or not the one speaking (tail 0..1 eases between), and a word whose sentence follows
// a "…" is not drawn before that sentence starts.
export function bubble(look, t, a) {
  const { block: B, rtl } = a
  const F = B.F,
    lineH = Math.round(F * 1.2),
    pad = 32
  const { top, tailX } = L.BUB
  const bottom = top + B.lines.length * lineH + pad * 2 - 12
  let s = a.scale
  if (s <= 0.01) return ''
  // the tail eases in and out over 0.12 s as a sentence changes mode
  let tail = B.tails[0].on ? 1 : 0
  for (let i = 1; i < B.tails.length; i++) {
    const c = B.tails[i]
    if (t < c.t - 0.12) break
    const k = clamp((t - (c.t - 0.12)) / 0.12)
    tail = tail + ((c.on ? 1 : 0) - tail) * k
  }
  const shadow = L.LOOKS[look].bubble
  let g = B.whisper
    ? L.bubbleBox(bottom, 8, shadow, '', tail) +
      L.bubbleBox(
        bottom,
        0,
        '#ffffff',
        `stroke="${INK}" stroke-width="5" stroke-dasharray="16 12" stroke-linejoin="round"`,
        tail,
      )
    : L.bubbleBox(bottom, 10, shadow, '', tail) +
      L.bubbleBox(
        bottom,
        0,
        '#ffffff',
        `stroke="${INK}" stroke-width="6" stroke-linejoin="round"`,
        tail,
      )
  B.lines.forEach((line, li) => {
    const y = top + pad + lineH * li + F * 0.8
    let spans = ''
    line.forEach((wi, j) => {
      const w = B.words[wi]
      const hidden = t < w.hideUntil
      const said = t >= w.t0,
        now = said && t < w.t1 + 0.08
      spans += `<tspan fill="${now ? BLUE : INK}" fill-opacity="${hidden ? 0 : said ? 1 : 0.26}">${esc(w.text)}${j < line.length - 1 ? ' ' : ''}</tspan>`
    })
    g += `<text x="540" y="${n1(y)}" font-family="${FILM_FONT}" font-weight="${B.whisper ? 800 : 900}" font-size="${F}" text-anchor="middle"${rtl ? ' direction="rtl"' : ''} xml:space="preserve">${spans}</text>`
  })
  // it grows from the tail's root, or from the middle of its top edge when there is no tail
  const ox = tail > 0.5 ? tailX : 540
  return `<g transform="translate(${ox} ${top}) scale(${n3(s)}) translate(${-ox} ${-top})">${g}</g>`
}

// ------------------------------------------------------------------ stickers
// The app's stickers (apps/mobile/assets/stickers/venus, 384 px, already die-cut) by <defs> id.
// A slap: in from 1.7x with a squash, then still. leave: when it is flicked away (towards dir).
export function sticker(
  t,
  t0,
  id,
  x,
  y,
  size,
  rot = 0,
  { leave = null, dir = [0, -1], op = 1 } = {},
) {
  const u = t - t0
  if (u < 0) return ''
  let k =
    u < 0.1
      ? 1.7 - 0.78 * EASE.in(u / 0.1)
      : u < 0.2
        ? 0.92 + 0.08 * EASE.outBack((u - 0.1) / 0.1)
        : 1
  let o = clamp(u / 0.05) * op,
    dx = 0,
    dy = 0,
    r = rot
  if (leave !== null && t > leave) {
    const v = EASE.in(clamp((t - leave) / 0.3))
    if (v >= 1) return ''
    dx = dir[0] * 900 * v
    dy = dir[1] * 900 * v
    r += 40 * v * Math.sign(dir[0] || 1)
    k *= 1 - 0.4 * v
  }
  if (o <= 0.001) return ''
  return `<g transform="translate(${n1(x + dx)} ${n1(y + dy)}) rotate(${n1(r)}) scale(${n3((size / 384) * k)})" opacity="${n3(o)}"><use href="#${id}" x="-192" y="-192"/></g>`
}

// ------------------------------------------------------------------ the photo-booth print
// The frozen frame becomes a print: everything outside the print's square dims, a white border draws
// on round it (0.15 s); then it flies to `to` ({ x, y, size, rot }), shrinking, and cross-dissolves
// into the sticker (`id`). scene: the frozen frame's SVG; rect: [x, y, w, h], square.
export function print(t, { scene, rect, freezeAt, flyAt, flyEnd, to, id }) {
  if (t < freezeAt || t > flyEnd + 0.01) return ''
  const [x, y, w] = rect
  const draw = clamp((t - freezeAt) / 0.15)
  const per = 4 * w
  const border = `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="6" fill="none" stroke="#ffffff" stroke-width="22" stroke-dasharray="${per}" stroke-dashoffset="${n1(per * (1 - draw))}"/>`
  const clip = `<clipPath id="prc"><rect x="${x}" y="${y}" width="${w}" height="${w}" rx="6"/></clipPath>`
  if (t < flyAt)
    return `${scene}<rect width="${L.W}" height="${L.H}" fill="${INK}" opacity="${n3(0.55 * draw)}"/>${clip}<g clip-path="url(#prc)">${scene}</g>${border}`
  // the flight: size and place follow one exponential zoom, so it does not drift sideways
  const v = EASE.inOut(clamp((t - flyAt) / (flyEnd - flyAt)))
  const size = Math.exp(Math.log(w) + (Math.log(to.size * 0.86) - Math.log(w)) * v)
  const q = (w - size) / (w - to.size * 0.86)
  const cx = x + w / 2 + (to.x - (x + w / 2)) * q,
    cy = y + w / 2 + (to.y - (y + w / 2)) * q
  const k = size / w,
    rot = to.rot * q
  const fade = clamp((v - 0.55) / 0.45)
  const card = `${clip}<g clip-path="url(#prc)">${scene}</g>${border}`
  return (
    `<g transform="translate(${n1(cx)} ${n1(cy)}) rotate(${n1(rot)}) scale(${n3(k)}) translate(${n1(-(x + w / 2))} ${n1(-(y + w / 2))})" opacity="${n3(1 - fade)}">${card}</g>` +
    (fade > 0 ? sticker(flyEnd, flyEnd - 1, id, to.x, to.y, to.size, to.rot, { op: fade }) : '')
  )
}

// ------------------------------------------------------------------ the wall of covers
// 10 x 10 squares of 86 px, 6 px apart, x 83..997, y 300..1214; right to left for ar
export const WALL = { x0: 83, y0: 300, cell: 86, gap: 6 }
export function tileRect(i, rtl) {
  const r = Math.floor((i - 1) / 10),
    c = (i - 1) % 10
  const col = rtl ? 9 - c : c
  return [WALL.x0 + col * (WALL.cell + WALL.gap), WALL.y0 + r * (WALL.cell + WALL.gap), WALL.cell]
}
// a padlock, centred on (x, y), `s` px tall
export function lock(x, y, s, op = 1) {
  const k = s / 100
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n3(k)})" opacity="${n3(op)}"><path d="M-24 -6V-22A24 24 0 0 1 24 -22V-6" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M-24 -6V-22A24 24 0 0 1 24 -22V-6" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/><rect x="-38" y="-10" width="76" height="60" rx="12" fill="#ffffff" stroke="${INK}" stroke-width="6"/><circle cx="0" cy="16" r="8" fill="${INK}"/><rect x="-3.5" y="18" width="7" height="16" rx="3" fill="${INK}"/></g>`
}
// one tile: its cover (#tc-N) or its frosted copy (#tf-N) cross-faded by frost 0..1, dimmed with it,
// the lock popping in as it lands; pop: 0..1 its own entrance; glint: 0..1 a sheen across it
export function tile(i, rect, { pop = 1, frost = 0, glint = -1 } = {}) {
  if (pop <= 0.001) return ''
  const [x, y, w] = rect,
    c = w / 2
  const k = pop < 1 ? EASE.outBack(pop) : 1
  const sc = w / 256
  let s = `<clipPath id="tl${i}"><rect x="0" y="0" width="${w}" height="${w}" rx="10"/></clipPath><g clip-path="url(#tl${i})">`
  s += `<g transform="scale(${n3(sc)})"><use href="#tc-${i}"/>${frost > 0 ? `<use href="#tf-${i}" opacity="${n3(frost)}"/>` : ''}</g>`
  if (frost > 0)
    s += `<rect width="${w}" height="${w}" fill="${INK}" opacity="${n3(0.55 * frost)}"/>`
  if (glint >= 0 && glint <= 1) {
    const gx = -w + 2.4 * w * glint
    s += `<path d="M${n1(gx)} ${w}L${n1(gx + w * 0.5)} 0L${n1(gx + w * 0.8)} 0L${n1(gx + w * 0.3)} ${w}Z" fill="#ffffff" opacity="0.55"/>`
  }
  s += `</g><rect x="0" y="0" width="${w}" height="${w}" rx="10" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.9"/>`
  if (frost > 0.5) s += lock(c, c + 4, 42 * EASE.outBack(clamp((frost - 0.5) / 0.5)))
  return `<g transform="translate(${n1(x + c)} ${n1(y + c)}) scale(${n3(k)}) translate(${-c} ${-c})">${s}</g>`
}

// ------------------------------------------------------------------ small things
// the house poof, faster and smaller: a wear swap rather than an outfit change
export function quickPoof(t, t0, x, y, len = 0.25, k = 0.6) {
  const s = L.poof(t0 + ((t - t0) * 0.45) / len, t0, 0, 0)
  return s ? `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n3(k)})">${s}</g>` : ''
}
// the stage look with its yellow burst, fading out from `fadeAt` (the deal's pose breaks)
export function burstFade(t, G, ctx, fadeAt) {
  const on = L.ground('stage', t, G, { ...ctx, numAt: -1 })
  const k = clamp((t - fadeAt) / 0.4)
  if (k <= 0) return on
  return (
    on +
    `<g opacity="${n3(EASE.inOut(k))}">${L.ground('stage', t, G, { ...ctx, numAt: Infinity })}</g>`
  )
}
export { YELLOW }
