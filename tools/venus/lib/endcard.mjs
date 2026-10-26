// The end card: the last ~2 s of every video, after Venus's slow-blink sign-off. It is what is on
// screen when somebody screenshots the story and what the video loops through, so it carries the
// real logo, langx.io and one line of slogan, and its last frames hand back to frame 0.
//
//   splash   (default) the app's own launch screen: white ground, the yellow badge, the three
//            halo rings. Venus peeks over the badge and slow-blinks once more.
//   handoff  Venus leaps out of frame, the badge drops onto the spot she sat on, then floods the
//            screen yellow: the app icon, full screen.
//   sticker  the scene stays, dimmed; the logo, wordmark, slogan, langx.io and a Venus sticker
//            are slapped on as die-cut stickers.
//   legacy   the 1.35 s blue card it replaces (lib/layers.mjs endCard), kept for comparison.
//
// Chosen with `--end <style>` on render.mjs / batch.mjs, or VENUS_END=<style>.
//
// Safe zones for stories, reels and TikTok: nothing that must be read above y 270 (14 %) or below
// y 1536 (20 %). Every word here sits in 960..1420; the logo in 480..930.
//
// Loop: stories and reels play the file again from frame 0, so the card's last BRIDGE seconds
// dissolve into frame 0's own picture (render.mjs passes it in as `scene0`). The final frame is
// still ~90 % card, which is what a player that stops on the last frame shows.
import fs from 'node:fs'
import path from 'node:path'
import { GEN } from './paths.mjs'
import { W, H, EASE, clamp, rnd, endCard as legacyCard } from './layers.mjs'

export const STYLES = ['splash', 'handoff', 'sticker', 'legacy']
export const DEFAULT_STYLE = 'splash'
// The build-in is done by ~0.86 s (the peek lands); then the complete card holds, readable, for
// ~2.6 s before the 0.3 s bridge. Every timing below is absolute seconds of u, so lengthening the
// hold does not slow the build-in.
export const END_LEN = 3.8 // seconds from the end of the slow blink to the last frame
export const BRIDGE = 0.3 // the hand-back to frame 0 inside END_LEN
export const styleOf = (s) => {
  const v = s || process.env.VENUS_END || DEFAULT_STYLE
  if (!STYLES.includes(v)) throw new Error(`unknown end card "${v}" (${STYLES.join(', ')})`)
  return v
}

// ------------------------------------------------------------------ brand
// The palette is the app's (theme/tokens.ts via branding/BRAND.md), not this generator's.
const C = {
  yellow: '#ffc409',
  yellowShade: '#e0ac08',
  ground: '#ffffff',
  text: '#17191c',
  muted: '#62676d',
  accent: '#3b6cf6',
  onYellow: '#201900',
  ink: '#17191c',
}
// The mark and wordmark paths are the shipped vectors (branding/brand/logo/*.svg), copied into
// assets/brand/; nothing here is redrawn.
const WORDMARK = fs
  .readFileSync(path.join(GEN, 'assets/brand/langx-wordmark.svg'), 'utf8')
  .match(/fill="currentColor" d="([^"]+)"/)[1]
const markPart = fs.readFileSync(path.join(GEN, 'assets/brand/langx-mark.svg'), 'utf8')
const ARC_BLACK = markPart.match(/<path fill="#000000" d="([^"]+)"/)[1]
const ARC_WHITE = markPart.match(/<path fill="#ffffff" d="([^"]+)"/)[1]
const n1 = (v) => Math.round(v * 10) / 10
const n3 = (v) => Math.round(v * 1000) / 1000
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ramp = (u, a, b) => clamp((u - a) / (b - a))

// The mark on the 1024 icon canvas: `size` is the canvas width in px (the arcs are 54 % of it).
// The drop shadow is the brand's: the same shapes 20 px along 57° on the canvas, in the yellow's
// shade, and it stays down-right however the arcs are turned.
function mark(x, y, size, { rot = 0, shadow = C.yellowShade, op = 1 } = {}) {
  const k = size / 1024,
    inner = `rotate(${n1(rot)}) scale(${n3(k)}) translate(-512 -512)`
  const sh = shadow
    ? `<g transform="translate(${n1(x + 10.893 * k)} ${n1(y + 16.773 * k)}) ${inner}" fill="${shadow}"><path d="${ARC_BLACK}"/><path d="${ARC_WHITE}"/></g>`
    : ''
  return `<g opacity="${n3(op)}">${sh}<g transform="translate(${n1(x)} ${n1(y)}) ${inner}"><path fill="#000000" d="${ARC_BLACK}"/><path fill="#ffffff" d="${ARC_WHITE}"/></g></g>`
}
// the launch badge: the icon canvas inscribed in a yellow disc (branding/brand/splash/badge.png)
export const badge = (x, y, r, { rot = 0, op = 1 } = {}) =>
  `<g opacity="${n3(op)}"><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${C.yellow}"/>${mark(x, y, 2 * r, { rot })}</g>`
// the outlined "LangX" (source box 1874 x 589 from x 1316, y 233); (x, top) is its top centre
const WM_W = 1874,
  WM_H = 589
const wordmark = (x, top, width, fill, op = 1) => {
  const k = width / WM_W
  return `<g opacity="${n3(op)}" transform="translate(${n1(x - width / 2)} ${n1(top)}) scale(${n3(k * 1000) / 1000}) translate(-1316 -233)"><path fill="${fill}" d="${WORDMARK}"/></g>`
}

// ------------------------------------------------------------------ words
const SLOGANS = JSON.parse(fs.readFileSync(path.join(GEN, 'data/endcard-slogans.json'), 'utf8'))
export const URL_TEXT = 'langx.io'
// Arabic is set in Noto Sans Arabic (assets/endcard/fonts, OFL; the face the API's share cards use),
// right to left. Everything else is Nunito, which covers Latin and Cyrillic.
const fam = (lang) => (lang === 'ar' ? `'Noto Sans Arabic'` : 'Nunito')
export function slogan(lang, key = process.env.VENUS_SLOGAN || SLOGANS.recommended) {
  const c = SLOGANS.candidates[key]
  if (!c) throw new Error(`unknown slogan "${key}"`)
  return c[lang] || (c.fallback && SLOGANS.candidates[c.fallback][lang]) || c.en
}
// measured once per video in the same browser that draws it, so the fit is exact
export async function prepare(B, lang) {
  const text = slogan(lang),
    rtl = lang === 'ar'
  const weight = rtl ? 700 : 800
  const [w100] = await B.measure([text], `${weight} 100px ${fam(lang)}`)
  const [u100] = await B.measure([URL_TEXT], `900 100px Nunito`)
  // a line of comma-separated beats ("Practice, learn, succeed.") can rise one beat at a time;
  // right-to-left text stays one run, so the shaping and order are the browser's
  const parts = rtl ? [text] : text.split(/(?<=,)\s+/)
  const pw =
    parts.length > 1 ? await B.measure([...parts, ' '], `${weight} 100px ${fam(lang)}`) : [w100]
  return { lang, text, rtl, weight, w100, u100, parts, pw }
}
// one line, as large as `max` px, no wider than `maxW`
function line(
  ec,
  x,
  y,
  { max = 56, maxW = 860, fill = C.muted, op = 1, dy = 0, beats = null } = {},
) {
  const F = Math.min(max, (100 * maxW) / ec.w100)
  // beats: [{ op, dy }] per comma group, laid out left to right from the measured widths
  if (beats && ec.parts.length > 1) {
    const sp = ec.pw[ec.parts.length],
      k = F / 100,
      total = ec.parts.reduce((a, _, i) => a + ec.pw[i], 0) + sp * (ec.parts.length - 1)
    let cx = x - (total * k) / 2,
      out = ''
    ec.parts.forEach((p, i) => {
      const b = beats[Math.min(i, beats.length - 1)]
      out += `<text x="${n1(cx)}" y="${n1(y + b.dy)}" font-family="${fam(ec.lang)}" font-weight="${ec.weight}" font-size="${n1(F)}" fill="${fill}" opacity="${n3(op * b.op)}">${esc(p)}</text>`
      cx += (ec.pw[i] + sp) * k
    })
    return out
  }
  return `<text x="${n1(x)}" y="${n1(y + dy)}" font-family="${fam(ec.lang)}" font-weight="${ec.weight}" font-size="${n1(F)}" text-anchor="middle" fill="${fill}" opacity="${n3(op)}"${ec.rtl ? ' direction="rtl"' : ''}>${esc(ec.text)}</text>`
}
const url = (x, y, F, fill, op = 1, dy = 0) =>
  `<text x="${n1(x)}" y="${n1(y + dy)}" font-family="Nunito" font-weight="900" font-size="${F}" letter-spacing="${n1(F * 0.01)}" text-anchor="middle" fill="${fill}" opacity="${n3(op)}" direction="ltr">${URL_TEXT}</text>`
// a soft rise-in for a line of text: 0 -> 1 over 0.22 s from `at`
const rise = (u, at, dist = 28) => {
  const k = EASE.out(ramp(u, at, at + 0.22))
  return { op: k, dy: dist * (1 - k) }
}

// ------------------------------------------------------------------ Venus cameo
// She is drawn from the same rig as the film, at a fraction of its size, with one more slow blink:
// the lids close over 0.22 s, hold 0.16 s, open over 0.3 s.
function blinkLid(u, at) {
  const k = u - at
  if (k < 0 || k > 0.68) return 0
  return k < 0.22 ? EASE.inOut(k / 0.22) : k < 0.38 ? 1 : 1 - EASE.inOut((k - 0.38) / 0.3)
}
function cameo(
  V,
  { x, y, s, u, blinkAt, flickAt = null, roll = 0, expr = 'loving', whiskers = true, extra = {} },
) {
  const P = V.pose({ expr, shadow: 0, head: { roll }, ...extra })
  const b = blinkLid(u, blinkAt)
  for (const e of ['L', 'R']) {
    P.eyes[e].lid += (1 - P.eyes[e].lid) * b
    P.eyes[e].low += (0.15 - P.eyes[e].low) * b
  }
  P.head.pitch = (P.head.pitch || 0) + 5 * b
  // an ear flick: the right ear twitches back and returns in 0.28 s
  if (flickAt !== null) {
    const k = (u - flickAt) / 0.28
    if (k > 0 && k < 1)
      P.ears.R.rot = (P.ears.R.rot || 0) + 16 * Math.sin(Math.PI * k) * (1 - k * 0.3)
  }
  // breathing under the hold
  P.head.dy = (P.head.dy || 0) + 2.5 * Math.sin(u * 2.4)
  // the tail tip keeps moving, as it does in the film
  if (P.tail) P.tail.phase = u * 1.2
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n3(s)})">${V.draw(P, { whiskers })}</g>`
}

// ------------------------------------------------------------------ the hand-back to frame 0
// dissolve: the card fades out over frame 0's picture, the way the app's splash fades into the app
const dissolve = (scene0, k) => (k > 0 ? `<g opacity="${n3(EASE.inOut(k))}">${scene0}</g>` : '')

// ------------------------------------------------------------------ splash
const SP = {
  x: 540,
  y: 735,
  r: 205,
  wordTop: 1030,
  wordW: 500,
  sloganY: 1292,
  urlY: 1388,
  halo: 1.6,
}
const bOpOf = (u) => 1 - EASE.out(ramp(u, END_LEN - BRIDGE, END_LEN - BRIDGE + 0.13))
function splash(a) {
  const { u, hx, hy, V, ec, scene0 } = a
  const out = END_LEN - BRIDGE,
    kOut = ramp(u, out, END_LEN)
  // the white ground opens from her head, with the brand yellow on its edge
  const io = ramp(u, 0, 0.42),
    R = 2300 * EASE.inOut(io)
  let s =
    io < 1
      ? `<circle cx="${n1(hx)}" cy="${n1(hy)}" r="${n1(R + 22)}" fill="${C.yellow}"/><circle cx="${n1(hx)}" cy="${n1(hy)}" r="${n1(R)}" fill="${C.ground}"/>`
      : `<rect width="${W}" height="${H}" fill="${C.ground}"/>`
  // the halo: three rings a third of a period apart, grown from the badge's edge (AppSplash.tsx)
  const hFade = bOpOf(u)
  for (let i = 0; i < 3; i++) {
    const p = (u - 0.42 - (i * SP.halo) / 3) / SP.halo
    if (p < 0) continue
    const k = p % 1,
      sc = 1 + 1.2 * (1 - Math.pow(1 - k, 2)),
      o = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * 0.45 * hFade
    if (o > 0.005)
      s += `<circle cx="${SP.x}" cy="${SP.y}" r="${n1(SP.r * sc)}" fill="none" stroke="${C.yellowShade}" stroke-width="${n1(5 * sc)}" opacity="${n3(o)}"/>`
  }
  // Venus behind the badge: rises over its top edge, then the slow blink; cut off below the rim
  const pk = EASE.outBack(ramp(u, 0.5, 0.86)),
    ex = 1 - EASE.in(ramp(u, out, out + 0.18))
  if (pk > 0) {
    const vs = 0.62,
      headY = SP.y - SP.r - 28 + 240 * (1 - pk) + 90 * (1 - ex)
    s += `<defs><clipPath id="ec-peek"><rect x="0" y="0" width="${W}" height="${SP.y - 40}"/></clipPath></defs><g clip-path="url(#ec-peek)" opacity="${n3(bOpOf(u))}">${cameo(V, { x: SP.x + 48, y: headY + 320 * vs, s: vs, u, blinkAt: 2.0, flickAt: 2.95, roll: 9, expr: 'loving' })}</g>`
  }
  // the badge comes out of her head and settles where the app draws it, turning as it lands
  const bp = ramp(u, 0.04, 0.46),
    e = EASE.out(bp),
    breathe = 1 + 0.03 * (0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, u - 0.46)) / 2.6))
  const bx = hx + (SP.x - hx) * e,
    by = hy + (SP.y - hy) * e - 120 * Math.sin(Math.PI * bp)
  const exitScale = 1 + 0.06 * EASE.in(ramp(u, out, out + 0.2)),
    bOp = bOpOf(u)
  if (bp > 0)
    s += badge(bx, by, SP.r * Math.max(0, EASE.outBack(bp)) * breathe * exitScale, {
      rot: -140 * (1 - e),
      op: bOp,
    })
  // the words
  const w = rise(u, 0.36),
    sl = rise(u, 0.46),
    beats = [0.46, 0.58, 0.7].map((a) => rise(u, a, 22)),
    ur = rise(u, 0.82),
    tOp = bOpOf(u)
  s += `<g transform="translate(0 ${n1(w.dy)})">${wordmark(540, SP.wordTop, SP.wordW, C.text, w.op * tOp)}</g>`
  s += line(ec, 540, SP.sloganY, {
    max: 62,
    maxW: 860,
    fill: C.muted,
    op: (ec.parts.length > 1 ? 1 : sl.op) * tOp,
    dy: sl.dy,
    beats,
  })
  s += url(540, SP.urlY, 50, C.accent, ur.op * tOp, ur.dy)
  // the ground fades last, so the next frame-0 picture is never revealed from under a logo
  const gOp = 1 - EASE.inOut(ramp(u, out + 0.07, END_LEN))
  return { cover: io >= 1, over: kOut > 0 ? `${scene0}<g opacity="${n3(gOp)}">${s}</g>` : s }
}

// ------------------------------------------------------------------ handoff
const HO = {
  r: 150,
  markY: 715,
  markSize: 820,
  wordTop: 1010,
  wordW: 520,
  sloganY: 1270,
  urlY: 1372,
}
function handoff(a) {
  const { u, cx, cy, V, ec, scene0 } = a
  const out = END_LEN - BRIDGE
  // her leap: a crouch, then up and out of the top with a stretch
  // once she is out of the top she stays out (the film's own pose would sit her back down)
  let fig = 'translate(0 -4000)'
  if (u < 0.4) {
    let sx,
      sy,
      dy = 0
    if (u < 0.1) {
      const k = EASE.out(u / 0.1)
      sx = 1 + 0.07 * k
      sy = 1 - 0.12 * k
    } else {
      const k = ramp(u, 0.1, 0.34)
      sx = 0.9
      sy = 1.16
      dy = -2600 * k * k
    }
    fig = `translate(${n1(cx)} ${n1(cy + dy)}) scale(${n3(sx)} ${n3(sy)}) translate(${n1(-cx)} ${n1(-cy)})`
  }
  let s = ''
  // take-off dust
  const du = ramp(u, 0.1, 0.45)
  if (du > 0 && du < 1) {
    const r = rnd(5)
    for (let i = 0; i < 7; i++) {
      const sd = i % 2 ? 1 : -1,
        d = 60 + 170 * EASE.out(du) * (0.6 + 0.4 * r())
      s += `<circle cx="${n1(cx + sd * d)}" cy="${n1(cy - 50 - 30 * r() - 40 * du)}" r="${n1((26 + 18 * r()) * (1 - du))}" fill="#ffffff" opacity="${n3(0.9 * (1 - du))}"/>`
    }
  }
  // the badge drops onto the floor where she sat, and squashes
  const landY = cy - 40 - HO.r,
    fp = ramp(u, 0.24, 0.42)
  let bx = cx,
    by = -HO.r - 40 + (landY + HO.r + 40) * EASE.in(fp),
    bsx = 1,
    bsy = 1
  const sq = ramp(u, 0.42, 0.56)
  if (sq > 0 && sq < 1) {
    const k = Math.sin(Math.PI * sq) * (1 - sq * 0.4)
    bsx = 1 + 0.16 * k
    bsy = 1 - 0.16 * k
  }
  // then it floods the screen: the badge's own yellow becomes the ground, the mark rises to centre
  const fl = ramp(u, 0.56, 0.86),
    fe = EASE.in(fl)
  if (fp > 0 && fl < 1) {
    const R = HO.r + 2300 * fe
    const ox = bx,
      oy = landY + HO.r * (1 - bsy)
    s += `<ellipse cx="${n1(bx)}" cy="${n1(cy - 34)}" rx="${n1(HO.r * 0.8 * fp * bsx)}" ry="${n1(18 * fp)}" fill="#000000" opacity="${n3(0.18 * fp * (1 - fl))}"/>`
    s += `<g transform="translate(${n1(ox)} ${n1(oy)}) scale(${n3(bsx)} ${n3(bsy)}) translate(${n1(-ox)} ${n1(-oy)})">`
    s +=
      fl > 0
        ? `<circle cx="${n1(bx)}" cy="${n1(by)}" r="${n1(R + 18)}" fill="${C.yellowShade}"/>`
        : ''
    s += `<circle cx="${n1(bx)}" cy="${n1(by)}" r="${n1(R)}" fill="${C.yellow}"/></g>`
  } else if (fl >= 1) s += `<rect width="${W}" height="${H}" fill="${C.yellow}"/>`
  if (fp > 0) {
    const me = EASE.in(fl),
      mx = bx + (540 - bx) * me,
      my = by + (HO.markY - by) * me
    const size = 2 * HO.r + (HO.markSize - 2 * HO.r) * me
    const breathe = 1 + 0.025 * (0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, u - 0.86)) / 2.6))
    s += `<g transform="translate(${n1(mx)} ${n1(my)}) scale(${n3(bsx * breathe)} ${n3(bsy * breathe)}) translate(${n1(-mx)} ${n1(-my)})">${mark(mx, my, size, { rot: -180 * (1 - EASE.out(ramp(u, 0.24, 0.6))) })}</g>`
  }
  const w = rise(u, 0.72),
    sl = rise(u, 0.82),
    ur = rise(u, 0.9)
  s += `<g transform="translate(0 ${n1(w.dy)})">${wordmark(540, HO.wordTop, HO.wordW, C.ink, w.op)}</g>`
  s += line(ec, 540, HO.sloganY, {
    max: 54,
    maxW: 860,
    fill: C.onYellow,
    op: 0.72 * sl.op,
    dy: sl.dy,
  })
  if (ur.op > 0) {
    const F = 46,
      pw = (ec.u100 * F) / 100 + 76,
      ph = 86,
      y = HO.urlY + ur.dy
    s += `<g opacity="${n3(ur.op)}"><rect x="${n1(540 - pw / 2)}" y="${n1(y - ph / 2)}" width="${n1(pw)}" height="${ph}" rx="${ph / 2}" fill="${C.ink}"/>${url(540, y + F * 0.36, F, '#ffffff')}</g>`
  }
  // she comes back: up over the bottom edge, one more slow blink
  const pk = EASE.outBack(ramp(u, 1.0, 1.32))
  if (pk > 0)
    s += cameo(V, {
      x: 806,
      y: 1555 + 0.66 * 320 + 240 * (1 - pk),
      s: 0.66,
      u,
      blinkAt: 1.36,
      roll: -12,
      expr: 'loving',
    })
  // the hand-back: the yellow closes back down to a point at the mark, frame 0 outside it
  const kOut = ramp(u, out, END_LEN)
  if (kOut > 0) {
    const R = 1400 * (1 - EASE.inOut(kOut))
    return {
      cover: true,
      fig,
      over: `${scene0}<defs><clipPath id="ec-close"><circle cx="540" cy="${HO.markY}" r="${n1(R)}"/></clipPath></defs><circle cx="540" cy="${HO.markY}" r="${n1(R + 18)}" fill="${C.yellowShade}"/><g clip-path="url(#ec-close)">${s}</g>`,
    }
  }
  return { cover: fl >= 1, fig, over: s }
}

// ------------------------------------------------------------------ sticker
// die-cut: a white border grown from the artwork's own alpha, and a soft drop shadow under it
const DIECUT = (id, r = 14) =>
  `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="d"/><feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="w"/><feGaussianBlur in="d" stdDeviation="9" result="b"/><feOffset in="b" dx="0" dy="12" result="bo"/><feFlood flood-color="#0b0c10" flood-opacity="0.38"/><feComposite in2="bo" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
// a slap: falls from 1.5x onto the page, a small bounce, then still; leaves in the hand-back
function slap(u, at, leaveAt) {
  const k = (u - at) / 0.17
  if (k < 0) return null
  let s =
    k < 1
      ? 1.5 - 0.5 * EASE.in(k)
      : 1 - 0.05 * Math.sin(Math.PI * clamp((k - 1) / 0.7)) * (1 - clamp((k - 1) / 0.7))
  let op = k < 1 ? 0.35 + 0.65 * k : 1,
    rot = k < 1 ? 7 * (1 - k) : 0
  const l = ramp(u, leaveAt, leaveAt + 0.16)
  if (l > 0) {
    s *= 1 - EASE.in(l)
    rot -= 25 * l
  }
  return s > 0.01 ? { s, op, rot } : null
}
const ST = {
  logo: [540, 640, 360, -6],
  word: [540, 955, 560, 3],
  slogan: [540, 1135, -2.5],
  url: [604, 1262, 4],
  venus: [232, 830],
}
function sticker(a) {
  const { u, V, ec, scene0 } = a
  const out = END_LEN - BRIDGE
  let s = `<defs>${DIECUT('ec-dc', 14)}${DIECUT('ec-dc-s', 11)}</defs>`
  const kOut = ramp(u, out, END_LEN)
  if (kOut > 0) s += dissolve(scene0, kOut)
  s += `<rect width="${W}" height="${H}" fill="#0b0c10" opacity="${n3(0.5 * EASE.out(ramp(u, 0, 0.3)) * (1 - EASE.inOut(kOut)))}"/>`
  const put = (p, x, y, rot, body, filter = 'ec-dc') =>
    `<g filter="url(#${filter})" opacity="${n3(p.op)}"><g transform="translate(${x} ${y}) rotate(${n1(rot + p.rot)}) scale(${n3(p.s)})">${body}</g></g>`
  // the logo: the app's rounded icon (branding/brand/logo/logo-rounded.png), drawn from the vector
  let p = slap(u, 0.12, out)
  if (p) {
    const [x, y, z, r] = ST.logo
    s += put(
      p,
      x,
      y,
      r,
      `<rect x="${-z / 2}" y="${-z / 2}" width="${z}" height="${z}" rx="${z * 0.225}" fill="${C.yellow}"/>${mark(0, 0, z)}`,
    )
  }
  p = slap(u, 0.3, out + 0.03)
  if (p) {
    const [x, y, w, r] = ST.word
    s += put(p, x, y, r, wordmark(0, (-w * WM_H) / WM_W / 2, w, C.ink))
  }
  p = slap(u, 0.44, out + 0.06)
  if (p) {
    const F = Math.min(50, (100 * 760) / ec.w100),
      tw = (ec.w100 * F) / 100,
      [x, y, r] = ST.slogan
    s += put(
      p,
      x,
      y,
      r,
      `<rect x="${n1(-tw / 2 - 34)}" y="-46" width="${n1(tw + 68)}" height="92" rx="16" fill="#ffffff"/><text x="0" y="${n1(F * 0.36)}" font-family="${fam(ec.lang)}" font-weight="${ec.weight}" font-size="${n1(F)}" text-anchor="middle" fill="${C.text}"${ec.rtl ? ' direction="rtl"' : ''}>${esc(ec.text)}</text>`,
      'ec-dc-s',
    )
  }
  p = slap(u, 0.56, out + 0.09)
  if (p) {
    const F = 48,
      pw = (ec.u100 * F) / 100 + 80,
      [x, y, r] = ST.url
    s += put(
      p,
      x,
      y,
      r,
      `<rect x="${n1(-pw / 2)}" y="-45" width="${n1(pw)}" height="90" rx="45" fill="${C.accent}"/>${url(0, F * 0.36, F, '#ffffff')}`,
      'ec-dc-s',
    )
  }
  // Venus, as one of her own chat stickers, with the slow blink
  p = slap(u, 0.68, out + 0.12)
  if (p) {
    const [x, y] = ST.venus,
      vs = 0.6
    const body = (wh) =>
      cameo(V, { x: 0, y: 0, s: vs, u, blinkAt: 1.12, roll: 6, expr: 'loving', whiskers: wh })
    s += `<g opacity="${n3(p.op)}"><g filter="url(#ec-dc-s)"><g transform="translate(${x} ${y}) rotate(${n1(-8 + p.rot)}) scale(${n3(p.s)})">${body(false)}</g></g><g transform="translate(${x} ${y}) rotate(${n1(-8 + p.rot)}) scale(${n3(p.s)})">${body(true)}</g></g>`
  }
  return { cover: false, over: s }
}

// ------------------------------------------------------------------ dispatch
// a: { u (s since the card began), t, hx, hy (her head), cx, cy (her feet), V, ec, scene0 }
// -> { cover: the card hides the film entirely, fig: optional transform for her figure, over: svg }
export function frame(style, a) {
  if (a.u < 0) return null
  if (style === 'legacy') return { cover: a.u > 0.34, over: legacyCard(a.t, a.t - a.u, a.hx, a.hy) }
  return { splash, handoff, sticker }[style](a)
}

// Sounds, as score.mjs's sfx entries, at endAt + offset. The sting is lib/sting.mjs.
export function endSfx(style, endAt) {
  const at = (o) => +(endAt + o).toFixed(3)
  const bridge = { kind: 'whoosh', at: at(END_LEN - BRIDGE - 0.04), gainDb: -16 }
  if (style === 'legacy')
    return [
      { kind: 'whoosh', at: at(-0.05), gainDb: -8 },
      { kind: 'pop', at: at(0.2), gainDb: -5 },
      { kind: 'ding', at: at(0.28), gainDb: -12 },
    ]
  if (style === 'splash')
    return [
      { kind: 'whoosh', at: at(-0.02), gainDb: -11 },
      { kind: 'sting', at: at(0.3), gainDb: -3 },
      bridge,
    ]
  if (style === 'handoff')
    return [
      { kind: 'whoosh', at: at(0.08), gainDb: -7 },
      { kind: 'thud', at: at(0.42), gainDb: -4 },
      { kind: 'whoosh', at: at(0.54), gainDb: -12 },
      { kind: 'sting', at: at(0.78), gainDb: -3 },
      { kind: 'pop', at: at(1.02), gainDb: -14 },
      bridge,
    ]
  return [
    { kind: 'sting', at: at(0.27), gainDb: -4 },
    ...[0.12, 0.3, 0.44, 0.56, 0.68].map((o, i) => ({
      kind: 'pop',
      at: at(o + 0.15),
      gainDb: i ? -9 : -5,
    })),
    { kind: 'thud', at: at(0.27), gainDb: -9 },
    bridge,
  ]
}
