// Venus's items in the streak story: which ones a (day, locale) gets, how she interacts with them,
// and the SVG layers around her figure. Everything comes from data/items.json (the registry); the
// drawings are in lib/items-art.mjs.
//
//   planItems(day, lang)          -> { day, ids, seat, wear, neck, prop, air, side, outfit }  (deterministic, memoised)
//   itemsFor(plan)                -> the same, from a grammar plan
//   applyItemPose(IT, t, P, sc)   mutates the rig pose: seat lift, the rig's own bag off, eye tracking, paw pats
//   itemLayers(IT, t, P, fig, sc) -> world-space SVG (rig units, ground origin): seat back, props, the
//                                    figure with neck and head wear spliced in, seat front, air props
//
// Rules the grammar enforces (and test/items.test.mjs checks, days 1-400, every locale):
//   - no item on two days in a row (seats, wear, props, rig outfits alike);
//   - milestone-only items only on milestones; each milestone gets its registry set;
//   - a seat exactly when the score builds the throne (move bag-throne or the bag-hop entrance),
//     and a bag whenever the line names one;
//   - neck wear never over an outfit; the feather wand never when the paw is busy;
//   - an item's cooldown (days) before it comes back, except where a quip calls for it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { planDay, MILESTONES } from '../grammar.mjs'
import * as A from './items-art.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REGISTRY = JSON.parse(fs.readFileSync(path.join(HERE, '../data/items.json'), 'utf8'))
export const ITEMS = Object.fromEntries(REGISTRY.items.map((it) => [it.id, it]))
const isMs = (n) => MILESTONES.includes(n)
const fnv = (s) => {
  let h = 0x811c9dc5
  for (const c of s) {
    h ^= c.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const n1 = (v) => Math.round(v * 10) / 10
const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 2.2,
      c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
}

// ------------------------------------------------------------------ art lookup
// kind -> the art table; an item is drawable when its `draw` key exists in that table
const TABLE = { seat: A.SEATS, floor: A.FLOOR, air: A.AIR, head: A.HEAD, neck: A.NECK }
export const hasArt = (it) => it.kind === 'rig' || !!(TABLE[it.kind] && TABLE[it.kind][it.draw])
// every interaction the layer code below implements
export const IMPLEMENTED = new Set([
  'sits-in',
  'sits-on',
  'wears-head',
  'wears-face',
  'wears-neck',
  'beside',
  'guards',
  'watches',
  'rolls-in',
  'ignores',
  'dangles-bats',
  'chases-dot',
  'flutters',
  'pops',
  'floats',
  'rig-outfit',
])
// the slot an item fills in a day's plan
const SLOT = { seat: 'seat', head: 'wear', neck: 'neck', floor: 'prop', air: 'air', rig: 'outfit' }
export const slotOf = (it) => SLOT[it.kind] || null

// ------------------------------------------------------------------ the grammar
const BAGS = ['paper-bag', 'kraft-bag']
const SEATS = REGISTRY.items
  .filter((it) => it.kind === 'seat' && !it.milestoneOnly && !BAGS.includes(it.id) && hasArt(it))
  .map((it) => it.id)
const PICKABLE = REGISTRY.items.filter(
  (it) =>
    hasArt(it) &&
    it.kind !== 'seat' &&
    it.kind !== 'rig' &&
    !it.milestoneOnly &&
    it.pickable !== false &&
    it.priority !== 'P2',
)
const hasSeat = (p) => p.move === 'bag-throne' || p.entrance === 'bag-hop'
const PAW_BUSY = new Set(['diva-flick'])
const memo = new Map()

// moves that draw their own prop (the red dot, the toy mouse, the treat tube, the moth, the cork, the
// box, the notebook) own that part of the frame: no registry item goes there that day
const MOVE_OWNS = {
  'hunt-wiggle': ['air'],
  chatter: ['air'],
  carry: ['floor'],
  'lick-treat': ['floor'],
  'knock-off': ['floor'],
  'box-hide': ['floor'],
  'sit-on-notes': ['floor'],
}
function fits(it, p, side) {
  if (MOVE_OWNS[p.move]?.includes(it.kind)) return false
  if (it.kind === 'neck' && p.outfit) return false
  if (
    it.interaction === 'dangles-bats' &&
    (PAW_BUSY.has(p.reaction) || p.move === 'sprawl-paw' || p.move === 'loaf')
  )
    return false
  if (it.kind === 'floor' && p.move === 'sprawl-paw' && side < 0) return false
  return true
}

function build(n, lang, p, prevIds, lastUsed, nextMs) {
  const out = {
    day: n,
    lang,
    ids: [],
    seat: null,
    wear: null,
    neck: null,
    prop: null,
    air: null,
    outfit: p.outfit || null,
    seatMode: null,
    side: 1,
  }
  // floor props stand opposite her sprawl; otherwise the side alternates by a hash of the day
  out.side = p.move === 'sprawl-paw' ? 1 : fnv(`side:${n}`) % 2 ? 1 : -1
  const sideFor = (it) => (it.glyphs ? -1 : out.side)
  const banned = new Set([...prevIds, ...nextMs])
  const cool = (id) => {
    const it = ITEMS[id]
    const last = lastUsed.get(id)
    return last === undefined || n - last >= (it.cooldown ?? REGISTRY.rules.defaultCooldown)
  }
  const put = (id) => {
    const it = ITEMS[id],
      slot = slotOf(it)
    if (!slot || out[slot]) return false
    out[slot] = id
    out.ids.push(id)
    return true
  }
  if (p.outfit) out.ids.push(p.outfit)
  // seat: whenever the score builds the throne
  if (hasSeat(p)) {
    out.seatMode = 'bag'
    // a milestone set that names a seat (day 7's cardboard box) gets it as the throne
    let id = isMs(n)
      ? (REGISTRY.milestoneSets[String(n)] || []).find(
          (x) => ITEMS[x].kind === 'seat' && !banned.has(x),
        )
      : undefined
    if (
      !id &&
      (ITEMS['paper-bag'].quips.includes(p.quip.id) ||
        prevIds.has('paper-bag') ||
        prevIds.has('kraft-bag'))
    ) {
      // a bag line gets a bag; the day after a bag gets the other bag (or a non-bag seat on a non-bag line)
      const bagLine = ITEMS['paper-bag'].quips.includes(p.quip.id)
      const bags = p.look === 'stripes' ? ['kraft-bag', 'paper-bag'] : ['paper-bag', 'kraft-bag']
      id = bagLine ? bags.find((b) => !banned.has(b)) : null
    }
    if (!id && !ITEMS['paper-bag'].quips.includes(p.quip.id)) {
      const start = fnv(`seat:${n}:${lang}`) % SEATS.length
      for (let k = 0; k < SEATS.length && !id; k++) {
        const c = SEATS[(start + k) % SEATS.length]
        if (!banned.has(c) && cool(c)) id = c
      }
      for (let k = 0; k < SEATS.length && !id; k++) {
        const c = SEATS[(start + k) % SEATS.length]
        if (!banned.has(c)) id = c
      }
    }
    put(id || BAGS.find((b) => !banned.has(b)))
  }
  // milestone set pieces
  if (isMs(n)) {
    for (const id of REGISTRY.milestoneSets[String(n)] || []) {
      const it = ITEMS[id]
      if (it.kind === 'rig') {
        if (!out.ids.includes(id)) out.ids.push(id)
        continue
      }
      if (it.kind === 'seat') {
        if (!out.seat) {
          put(id)
          out.seatMode = 'always'
        }
        continue
      }
      if (fits(it, p, sideFor(it)) && put(id) && it.kind === 'floor') out.side = sideFor(it)
    }
    return out
  }
  if (out.seat) return out // a throne day is about the throne
  // a line that calls for an item gets it
  for (const it of REGISTRY.items) {
    if (
      it.kind === 'seat' ||
      it.kind === 'rig' ||
      !hasArt(it) ||
      it.milestoneOnly ||
      !it.quips.includes(p.quip.id)
    )
      continue
    if (!banned.has(it.id) && fits(it, p, sideFor(it)) && put(it.id)) {
      if (it.kind === 'floor') out.side = sideFor(it)
      return out
    }
  }
  // otherwise most days get one item, some get none (so items stay a treat)
  if (fnv(`rest:${n}:${lang}`) % 100 < REGISTRY.rules.restShare * 100) return out
  const cands = PICKABLE.filter(
    (it) =>
      !banned.has(it.id) &&
      cool(it.id) &&
      fits(it, p, sideFor(it)) &&
      (!it.moods || it.moods.includes(p.quip.mood)),
  )
  if (!cands.length) return out
  // the least recently shown item wins (a hash breaks ties), so the whole inventory gets its turn
  const order = (it) => [lastUsed.get(it.id) ?? -1e9, fnv(`item:${n}:${lang}:${it.id}`)]
  const pick = cands
    .map((it) => [order(it), it])
    .sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1])[0][1]
  put(pick.id)
  if (pick.kind === 'floor') out.side = sideFor(pick)
  return out
}

export function planItems(n, lang) {
  let arr = memo.get(lang)
  if (!arr) {
    arr = []
    arr.lastUsed = new Map()
    memo.set(lang, arr)
  }
  while (arr.length < n) {
    const d = arr.length + 1
    const prev = new Set(arr.length ? arr[arr.length - 1].ids : [])
    if (d === 2) prev.add('paper-bag') // day 1's welcome-back video is in the bag
    const nextMs = isMs(d + 1) ? REGISTRY.milestoneSets[String(d + 1)] || [] : []
    const it = build(d, lang, planDay(d, lang), prev, arr.lastUsed, nextMs)
    for (const id of it.ids) arr.lastUsed.set(id, d)
    arr.push(it)
  }
  return arr[n - 1]
}
// The day-1 specials (lib/intro.mjs) replace what the day-1 file shows: the welcome-back video opens
// in a bag (the `bag-groom` entrance), so it gets a bag and nothing else; the self-introduction keeps
// day 1's set. A fresh object each call: the renderer stashes per-frame state on it.
//
// `force` (render.mjs --items, previews only) swaps the day's items for the given slots, e.g.
// { prop: 'hamsi' }; the shared library never passes it.
export function itemsFor(plan, force = null) {
  const base = planItems(plan.day, plan.lang)
  if (force) {
    const out = {
      ...base,
      ids: base.ids.filter((id) => ITEMS[id].kind === 'rig'),
      seat: null,
      wear: null,
      neck: null,
      prop: null,
      air: null,
      seatMode: null,
    }
    for (const [slot, id] of Object.entries(force)) {
      if (!ITEMS[id] || slotOf(ITEMS[id]) !== slot)
        throw new Error(`--items: ${id} does not fill ${slot}`)
      out[slot] = id
      out.ids.push(id)
    }
    if (out.seat) out.seatMode = 'bag'
    if (out.prop && ITEMS[out.prop].glyphs) out.side = -1
    return out
  }
  if (plan.special && plan.variant === 'return')
    return {
      ...base,
      ids: ['paper-bag'],
      seat: 'paper-bag',
      seatMode: 'bag',
      wear: null,
      neck: null,
      prop: null,
      air: null,
    }
  return { ...base, ids: [...base.ids] }
}

// ------------------------------------------------------------------ geometry shared with the rig
const D2R = Math.PI / 180,
  HR = 112,
  HEAD_Y = -330 // head sphere radius; her head centre, sitting (rig units)
// where a head-local 3D point lands after the head's yaw and pitch (the rig's hp())
export function headAt(P, [x, y, z]) {
  const phi = ((P.yaw || 0) + (P.head.yaw || 0)) * D2R,
    c = Math.cos(phi),
    s = Math.sin(phi)
  const xr = x * c + z * s,
    zr = -x * s + z * c
  return { x: xr, y: y + ((P.head.pitch || 0) * 0.85 * Math.max(0, zr)) / HR, z: zr, c, s, phi }
}
// the head group in the rig's output: <g transform="translate(X Y) rotate(R) scale(S) translate(0 -80)">
const HEAD_RE =
  /<g transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\(([-\d.]+)\) translate\(0 -80\)">/g
function headGroup(fig) {
  let m,
    last = null
  HEAD_RE.lastIndex = 0
  while ((m = HEAD_RE.exec(fig)))
    last = { index: m.index, tr: m[0].slice(14, -2), x: +m[1], y: +m[2], r: +m[3], s: +m[4] }
  return last
}
// the props' resting place on the floor
const PROP_X = 228 // close enough to stay in frame under a 1.24 push-in
// beside a throne a prop steps out a little, standing just behind the seat's corner
const propX = (IT) => IT.side * (ITEMS[IT.prop]?.propX || (IT.seat ? 255 : PROP_X))

// ------------------------------------------------------------------ timing helpers
const lastSent = (sc) => sc.T.sents[sc.T.sents.length - 1]
// a milestone item pops in at the number; ordinary days have it from frame 0
const popIn = (IT, t, sc) => {
  if (!isMs(IT.day)) return 1
  const u = (t - (sc.R + 0.15)) / 0.32
  return u <= 0 ? 0 : u >= 1 ? 1 : ease.outBack(u)
}
// where an air prop is (world rig units) at t, for drawing and for her eyes
function airPos(IT, t, sc) {
  const id = IT.air
  if (id === 'red-dot') {
    const t0 = sc.R + 0.2
    if (t < t0 || t > sc.endAt) return null
    const u = t - t0
    return {
      x: 230 * Math.sin(u * 1.3 + 0.6) + 40 * Math.sin(u * 5.1),
      y: -250 + 70 * Math.sin(u * 1.9) + 18 * Math.sin(u * 7.3),
      k: 1 + 0.08 * Math.sin(u * 30),
    }
  }
  if (id === 'moth') {
    const t0 = lastSent(sc).t0 - 0.35
    if (t < t0 || t > sc.endAt) return null
    const u = t - t0,
      inK = clamp(u / 0.6)
    return {
      x: 520 * (1 - ease.out(inK)) + 150 * Math.sin(u * 2.4),
      y: -470 + 60 * Math.sin(u * 4.8) - 200 * (1 - inK),
      flap: u * 7,
    }
  }
  if (id === 'feather-wand') {
    const ang = 16 * Math.sin(t * 2.3) + 7 * Math.sin(t * 5.1)
    const tip = [-215 + 24 * Math.sin(t * 1.1), -590]
    const a = ang * D2R
    return { ang, tip, x: tip[0] + Math.sin(a) * 210, y: tip[1] + Math.cos(a) * 210 }
  }
  return null
}

// ------------------------------------------------------------------ the pose hook
// Called after the score's pose is sampled and lip sync applied, before the rig draws.
export function applyItemPose(IT, t, P, sc) {
  // the seat replaces the rig's yellow plastic bag; `bag` becomes the seat's pop amount
  // the rig's plastic bag never shows: a bag beat with no seat planned gets the paper bag
  if (!IT.seat && P.bag > 0) {
    IT.seat = 'paper-bag'
    IT.seatMode = 'bag'
  }
  const amt = IT.seat ? (IT.seatMode === 'always' ? 1 : P.bag) : 0
  IT._seat = amt
  if (IT.seat) {
    P.bag = 0
    const lift = A.SEATS[ITEMS[IT.seat].draw]().lift || 0
    if (lift) P.y -= lift * clamp(amt, 0, 1.15)
  }
  // eyes: only when she sits facing us (profile walks have their own look direction)
  const facing = P.flip > 0 && Math.abs(P.yaw || 0) < 25 && (P.mode === 'sit' || P.mode === 'loaf')
  let target = null,
    w = 0
  if (IT.air) {
    const a = airPos(IT, t, sc)
    if (a) {
      target = a
      w =
        IT.air === 'moth'
          ? clamp((t - (lastSent(sc).t0 - 0.1)) / 0.2)
          : IT.air === 'red-dot'
            ? clamp((t - sc.R - 0.35) / 0.15) * (t < sc.blink - 0.1 ? 1 : 0)
            : (t > sc.R + 0.1 && t < sc.T.v - 0.2) || (t > sc.T.e + 0.1 && t < sc.blink - 0.15)
              ? 1
              : 0.35
    }
  } else if (IT.prop) {
    const it = ITEMS[IT.prop],
      x = propX(IT)
    const win =
      it.interaction === 'guards'
        ? [lastSent(sc).t0, lastSent(sc).t1 + 0.2]
        : it.interaction === 'watches'
          ? [sc.R + 0.15, sc.R + 0.9]
          : it.interaction === 'rolls-in'
            ? [0.35, 1.5]
            : null
    if (win) {
      target = { x: it.interaction === 'rolls-in' ? rollX(IT, t) : x, y: -60 }
      w = clamp(Math.min((t - win[0]) / 0.12, (win[1] - t) / 0.12))
    }
    if (it.interaction === 'ignores') {
      // the snub: eyes up and away from it through the reaction, then one sneaky glance on the last sentence
      const away = clamp(Math.min((t - sc.R - 0.15) / 0.12, (sc.R + 1.1 - t) / 0.12))
      const peek = clamp(Math.min((t - lastSent(sc).t0) / 0.12, (lastSent(sc).t0 + 0.6 - t) / 0.12))
      if (away > 0) {
        target = { x: -x * 1.6, y: -520 }
        w = away
      } else if (peek > 0) {
        target = { x, y: -60 }
        w = peek
      }
    }
  }
  if (facing && target && w > 0) {
    const dx = clamp((target.x - P.x) / 230, -0.85, 0.85),
      dy = clamp((target.y - HEAD_Y) / 320, -0.7, 0.75)
    for (const s of ['L', 'R']) {
      P.eyes[s].px = P.eyes[s].px * (1 - w) + dx * w
      P.eyes[s].py = P.eyes[s].py * (1 - w) + dy * w
    }
  }
  // two pats at the feather wand after the number (her raised paw is the screen-left one)
  if (IT.air === 'feather-wand' && facing && P.mode === 'sit') {
    for (const p0 of [sc.R + 0.45, sc.R + 0.85]) {
      const u = (t - p0) / 0.3
      if (u > 0 && u < 1) P.paw.lift = Math.max(P.paw.lift || 0, Math.sin(u * Math.PI) * 0.85)
    }
  }
}
const rollX = (IT, t) => {
  const x1 = IT.side * PROP_X,
    x0 = IT.side * 760,
    u = clamp((t - 0.25) / 1.1)
  return x0 + (x1 - x0) * ease.out(u)
}

// ------------------------------------------------------------------ layers
function seatLayers(IT) {
  const it = ITEMS[IT.seat],
    k = IT._seat
  if (!(k > 0.01)) return { back: '', front: '' }
  const S = A.SEATS[it.draw](it.params || {})
  // pops from the ground: height follows the spring (overshoot included), width a little less
  const tr = `scale(${n1((0.72 + 0.28 * Math.min(1.1, k)) * 1000) / 1000} ${n1(k * 1000) / 1000})`
  return {
    back: `<g transform="${tr}">${S.back}</g>`,
    front: `<g transform="${tr}">${S.front}</g>`,
  }
}
function propLayer(IT, t, sc) {
  const it = ITEMS[IT.prop],
    par = { ...(it.params || {}) }
  if (it.draw === 'flashcards') {
    par.glyph = A.GLYPH[IT.lang]
    par.other = A.foreignGlyph(IT.lang, IT.day)
  }
  par.t = t
  par.rot = t * 40
  let x = propX(IT),
    inner
  if (it.interaction === 'rolls-in') {
    x = rollX(IT, t)
    par.rot = ((x - IT.side * 760) / 52) * (180 / Math.PI)
  }
  if (it.interaction === 'pops') {
    par.pop = sc.R
    par.dir = -IT.side
  }
  if (it.interaction === 'floats') par.sway = 6 * Math.sin(t * 1.4) - IT.side * 6
  inner = A.FLOOR[it.draw](par)
  // the speech sign, globe and balloon are tall: they lean in toward her, the rest face the lens
  const k = popIn(IT, t, sc)
  if (k <= 0.001) return ''
  let s = `<g transform="translate(${n1(x)} 0) scale(${n1(k * 1000) / 1000})">${inner}</g>`
  if (it.interaction === 'pops') s += cannonBurst(IT, t, sc, x)
  return s
}
// streamers and paper from the cannon's mouth
function cannonBurst(IT, t, sc, x0) {
  const u = t - sc.R
  if (u < 0 || u > 2.6) return ''
  const dir = -IT.side,
    tilt = A.CANNON_TILT * D2R,
    a0 = -Math.PI / 2 + tilt * dir // the tube's axis, leaning toward her
  const mouth = [x0 + Math.sin(tilt) * dir * 150, -26 - Math.cos(tilt) * 150]
  let s = ''
  if (u < 0.22) {
    const k = 1 - u / 0.22
    s += `<g transform="translate(${n1(mouth[0])} ${n1(mouth[1])})" opacity="${n1(k * 100) / 100}"><circle r="${n1(60 * (1 - k) + 20)}" fill="#FFFFFF" opacity="0.8"/></g>`
  }
  const cols = ['#FFC409', '#3B6CF6', '#FFFFFF', '#F6A6B8', '#5CCBB9']
  let r = 1234567 + IT.day
  const rnd = () => {
    r = (r * 1103515245 + 12345) % 2147483648
    return r / 2147483648
  }
  for (let i = 0; i < 26; i++) {
    const a = a0 + (rnd() - 0.5) * 0.9,
      v = 700 + rnd() * 700,
      drag = 2.2,
      e = (1 - Math.exp(-drag * u)) / drag
    const px = mouth[0] + Math.cos(a) * v * e,
      py = mouth[1] + Math.sin(a) * v * e + 260 * u * u
    const c = cols[i % cols.length],
      spin = (rnd() - 0.5) * 900
    if (i % 3 === 0) {
      // a curly streamer
      s += `<path transform="translate(${n1(px)} ${n1(py)}) rotate(${n1(spin * u)})" d="M0 0q10 -14 20 0t20 0t20 0" fill="none" stroke="${A.LN}" stroke-width="11" stroke-linecap="round"/><path transform="translate(${n1(px)} ${n1(py)}) rotate(${n1(spin * u)})" d="M0 0q10 -14 20 0t20 0t20 0" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`
    } else
      s += `<rect x="-8" y="-5" width="16" height="10" rx="2" fill="${c}" stroke="${A.LN}" stroke-width="2.5" transform="translate(${n1(px)} ${n1(py)}) rotate(${n1(spin * u)}) scale(1 ${n1(Math.cos(u * 9 + i) * 100) / 100})"/>`
  }
  return s
}
function airLayer(IT, t, sc) {
  const a = airPos(IT, t, sc)
  if (!a) return ''
  if (IT.air === 'red-dot')
    return `<g transform="translate(${n1(a.x)} ${n1(a.y)})">${A.AIR['red-dot']({ k: a.k * 1.7 })}</g>`
  if (IT.air === 'moth')
    return `<g transform="translate(${n1(a.x)} ${n1(a.y)}) scale(0.9)">${A.AIR.moth({ flap: a.flap })}</g>`
  if (IT.air === 'feather-wand')
    return A.AIR['feather-wand']({
      ang: a.ang,
      tip: a.tip,
      stick: [a.tip[0] - 700, a.tip[1] - 900],
    })
  return ''
}
// wear spliced into the rig's own output: neck wear just before the head group, head wear in the
// head's transform just after it (so roll, pitch and squash all follow her head)
function dress(fig, IT, t, P, sc) {
  if (!IT.wear && !IT.neck) return fig
  const h = headGroup(fig)
  if (!h) return fig
  const k = popIn(IT, t, sc)
  if (k <= 0.001) return fig
  let neck = '',
    head = ''
  if (IT.neck) {
    const lean = (P.yaw || 0) * 0.6
    neck = `<g transform="translate(${h.x} ${h.y}) rotate(${n1(h.r * 0.4)}) scale(${n1(h.s * k * 1000) / 1000})"><g transform="translate(${n1(lean)} 0) scale(${n1(Math.max(0.55, Math.cos(((P.yaw || 0) * Math.PI) / 180)) * 1000) / 1000} 1)">${A.NECK[ITEMS[IT.neck].draw]()}</g></g>`
  }
  if (IT.wear) {
    const W = A.HEAD[ITEMS[IT.wear].draw],
      q = headAt(P, W.anchor)
    if (q.z > -30) {
      const fx = Math.max(0.35, Math.abs(q.c))
      let par = {}
      if (W.anchor[2] > 70) {
        // face wear: each lens squashed like the eye under it
        const f = [-1, 1].map((sd) => Math.cos(Math.atan2(sd * 57, 72) + q.phi))
        par = { lensX: 57 * q.c, f }
      }
      head = `<g transform="${h.tr}"><g transform="translate(${n1(q.x)} ${n1(q.y)}) scale(${n1((W.anchor[2] > 70 ? 1 : fx) * k * 1000) / 1000} ${n1(k * 1000) / 1000})">${W.draw(par)}</g></g>`
    }
  }
  // the rig's figure ends with the head group's </g> then the outer </g>
  const end = fig.lastIndexOf('</g>')
  return fig.slice(0, h.index) + neck + fig.slice(h.index, end) + head + fig.slice(end)
}
export function itemLayers(IT, t, P, fig, sc) {
  const seat = IT.seat ? seatLayers(IT) : { back: '', front: '' }
  let back = seat.back,
    front = seat.front
  // a prop that stands nearer the lens than she does (the sign: its glyphs must never hide behind an ear)
  if (IT.prop) {
    if (ITEMS[IT.prop].front) front = propLayer(IT, t, sc) + front
    else back = propLayer(IT, t, sc) + back
  }
  if (IT.air === 'red-dot') back = airLayer(IT, t, sc) + back
  else if (IT.air) front += airLayer(IT, t, sc)
  return back + dress(fig, IT, t, P, sc) + front
}

// ------------------------------------------------------------------ standalone art (assets, catalog)
// One item at rest, in its own rig-unit space, plus the box it occupies: [x, y, w, h].
export function restArt(id, { lang = 'en', day = 1, t = 0.4 } = {}) {
  const it = ITEMS[id]
  A.resetIds()
  switch (it.kind) {
    case 'seat': {
      const S = A.SEATS[it.draw](it.params || {})
      return { svg: S.back + S.front, box: [-290, -(S.h || 260) - 30, 580, (S.h || 260) + 60] }
    }
    case 'floor': {
      const par = {
        ...(it.params || {}),
        t,
        rot: 20,
        glyph: A.GLYPH[lang],
        other: A.foreignGlyph(lang, day),
        pop: it.interaction === 'pops' ? -1 : 1e9,
        sway: 4,
      }
      const svg = A.FLOOR[it.draw](par)
      const tall =
        {
          'speech-sign': 500,
          globe: 310,
          balloon: 640,
          trophy: 260,
          'cat-grass': 280,
          catnip: 230,
          'boiled-chicken': 230,
          'treat-tube': 220,
        }[id] || 200
      const w = { balloon: 300, 'yarn-ball': 420, 'confetti-cannon': 300 }[id] || 280
      return { svg, box: [-w / 2, -tall, w, tall + 30] }
    }
    case 'air':
      if (id === 'feather-wand')
        return {
          svg: A.AIR['feather-wand']({ ang: 8, tip: [-60, -330], stick: [160, -470] }),
          box: [-200, -480, 400, 500],
        }
      if (id === 'red-dot')
        return {
          svg: `<g transform="translate(0 -60) scale(2.4)">${A.AIR['red-dot']()}</g>`,
          box: [-120, -170, 240, 220],
        }
      return {
        svg: `<g transform="translate(0 -70) scale(1.8)">${A.AIR[it.draw]({ flap: 0.1 })}</g>`,
        box: [-150, -190, 300, 240],
      }
    case 'head': {
      const W = A.HEAD[it.draw]
      return {
        svg: `<g transform="translate(${W.anchor[0] * 0} 0)">${W.draw({})}</g>`,
        box: [-200, -260, 400, 320],
      }
    }
    case 'neck':
      return { svg: A.NECK[it.draw](), box: [-140, -40, 280, 240] }
    default:
      return null
  }
}
