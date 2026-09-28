/*
 * S5 — Green pen. The stranded mistake is struck on the beat, the correction
 * rises in green and blooms the world, the sentence becomes an Echo card that
 * reads itself aloud, hops the review ladder to 365 days and condenses into
 * the ember S6 starts on.
 *
 * Everything is one SVG layer, so every word is placed by its baseline and
 * measured with canvas metrics after the fonts are in. Words that move by
 * character are laid out one <text> per character at kerned prefix widths.
 * The card's path up the ladder is closed-form (hops, squash, stretch, tilt)
 * and written by the draw callback from the time it is given, as are the
 * waveform bars, whose heights ride the kick envelope of absolute time.
 */
REEL.scene('05-echo', (ctx) => {
  const { tl, b, E, C, F } = ctx
  const BEAT = ctx.BEAT
  const fx = {}
  for (const k of ['snap', 'pop', 'whip', 'cut', 'glide', 'spring', 'lift'])
    fx[k] = gsap.parseEase(E[k])

  const lerp = (a, z, p) => a + (z - a) * p
  const clamp01 = (p) => Math.max(0, Math.min(1, p))
  const seg = (tb, b0, b1) => clamp01((tb - b0) / (b1 - b0))
  const f2 = (n) => Math.round(n * 100) / 100

  /* ------------------------------------------------------------ measuring */

  const mc = document.createElement('canvas').getContext('2d')
  /**
   * Kerned per-character layout of `str` from its origin, plus the ink box.
   * A character's x is the prefix width through it minus its own advance, so
   * the pair kerning in front of it is kept; `track` is added per character
   * the way CSS letter-spacing is.
   */
  function layout(str, weight, size, track = 0) {
    mc.font = `${weight} ${size}px ${F.display}`
    const chars = []
    let prefix = ''
    let l = Infinity
    let r = -Infinity
    let a = 0
    let d = 0
    ;[...str].forEach((ch, i) => {
      prefix += ch
      const m = mc.measureText(ch)
      const x = mc.measureText(prefix).width - m.width + i * track
      const cl = x - m.actualBoundingBoxLeft
      const cr = x + m.actualBoundingBoxRight
      chars.push({ ch, x, adv: m.width, cx: (cl + cr) / 2, l: cl, r: cr })
      if (ch.trim()) {
        l = Math.min(l, cl)
        r = Math.max(r, cr)
        a = Math.max(a, m.actualBoundingBoxAscent)
        d = Math.max(d, m.actualBoundingBoxDescent)
      }
    })
    return { chars, l, r, a, d, w: r - l }
  }
  const capHeight = (weight, size) => {
    mc.font = `${weight} ${size}px ${F.display}`
    return mc.measureText('H').actualBoundingBoxAscent
  }

  /* ------------------------------------------------------------- building */

  const layer = ctx.svgLayer()
  const defs = ctx.svg('defs', {}, layer)
  let clipN = 0
  /** A rectangular clip in the user space of whatever element uses it. */
  function clip(x, y, w, h) {
    const id = `s5-clip-${clipN++}`
    const cp = ctx.svg('clipPath', { id }, defs)
    const shape = ctx.svg('rect', { x: f2(x), y: f2(y), width: f2(w), height: f2(h) }, cp)
    return { url: `url(#${id})`, shape }
  }
  const g = (parent, attrs) => ctx.svg('g', attrs || {}, parent)
  const text = (parent, str, x, y, weight, size, fill, extra) =>
    ctx.svg(
      'text',
      Object.assign(
        {
          x: f2(x),
          y: f2(y),
          fill,
          text: str,
          style: { font: `${weight} ${size}px ${F.display}`, whiteSpace: 'pre' },
        },
        extra,
      ),
      parent,
    )
  /** One <text> per visible character, at its kerned position. */
  function chars(parent, lay, ox, base, weight, size, fill) {
    return lay.chars
      .filter((c) => c.ch.trim())
      .map((c) => Object.assign(text(parent, c.ch, ox + c.x, base, weight, size, fill), { _c: c }))
  }

  /* Z-order, bottom to top. */
  const discLayer = g(layer)
  const struckLayer = g(layer)
  const ladderLayer = g(layer)
  const titleLayer = g(layer)
  const cardG = g(layer)

  /* -------------------------------------------------- 0.0 'estoy', struck */

  const ES = 260
  const esLay = layout('estoy', 700, ES)
  const esX = 960 - (esLay.l + esLay.r) / 2
  const esB = 540 + (esLay.a - esLay.d) / 2
  const inkL = esX + esLay.l
  const inkR = esX + esLay.r

  // Sag outermost (stage px), then the move and scale, then the collapse.
  const stSag = g(struckLayer)
  const stMove = g(stSag)
  const stCollapse = g(stMove)
  const estoyA = text(stCollapse, 'estoy', esX, esB, 700, ES, C.white)
  // The copy inside the bloom. Its clip circle is in the struck group's own
  // space: during the bloom that group is at scale 0.5 with its ink centre on
  // (960,330), so stage (960,610) is local (960,1100) and radii double.
  const bloomClip = ctx.svg('clipPath', { id: 's5-bloom' }, defs)
  const bloomLocal = ctx.svg('circle', { cx: 960, cy: 1100, r: 0 }, bloomClip)
  text(stCollapse, 'estoy', esX, esB, 700, ES, C.muted, {
    'clip-path': 'url(#s5-bloom)',
  })

  const xMid = esB - 0.26 * ES
  const sx0 = inkL - 20
  const sx1 = inkR + 20
  const sy1 = xMid - Math.tan((1.5 * Math.PI) / 180) * (sx1 - sx0)
  // A quadratic's midpoint sits halfway to its control point: 12 up bows 6.
  const strike = ctx.svg(
    'path',
    {
      d: `M${f2(sx0)} ${f2(xMid)}Q${f2((sx0 + sx1) / 2)} ${f2((xMid + sy1) / 2 - 12)} ${f2(sx1)} ${f2(sy1)}`,
      fill: 'none',
      stroke: C.green,
      'stroke-width': 22,
      'stroke-linecap': 'round',
      visibility: 'hidden',
    },
    stCollapse,
  )
  gsap.set(stMove, { scale: 1.04, svgOrigin: '960 540' })
  gsap.set(strike, { drawSVG: '0%' })

  // Recoil, then stillness until the pen.
  tl.to(stMove, { scale: 1, duration: b(0.25), ease: E.snap }, b(0))
  tl.set(strike, { visibility: 'visible' }, b(0.75))
  tl.to(strike, { drawSVG: '100%', duration: b(0.25), ease: E.cut }, b(0.75))
  tl.set(estoyA, { fill: C.faint }, b(1))
  tl.to(stSag, { y: 4, duration: b(0.5), ease: E.spring }, b(1))
  // Centre lands on (960,330) with the sag already counted.
  tl.to(stMove, { scale: 0.5, y: -214, duration: b(0.75), ease: E.snap }, b(1))
  tl.to(
    stCollapse,
    { scaleX: 0, svgOrigin: `${f2(sx0 - 11)} ${f2(xMid)}`, duration: b(0.25), ease: E.cut },
    b(3),
  )
  tl.set(struckLayer, { visibility: 'hidden' }, b(3.25))

  /* ------------------------------------------------------ 2.0 the bloom */

  const disc = ctx.svg('circle', { cx: 960, cy: 610, r: 0, fill: C.greenTint }, discLayer)
  tl.to(disc, { attr: { r: 1250 }, duration: b(0.75), ease: E.snap }, b(2))
  tl.to(bloomLocal, { attr: { r: 2500 }, duration: b(0.75), ease: E.snap }, b(2))
  ctx.ground(C.greenTint, b(2.75))

  /* ------------------------------------------- the card and its sentence */

  // The WORLD: full-frame tint under the text from 4.0, closing to the card.
  const world = ctx.svg(
    'rect',
    { x: 0, y: 0, width: 1920, height: 1080, rx: 0, fill: C.greenTint, visibility: 'hidden' },
    cardG,
  )
  tl.set(world, { visibility: 'visible' }, b(4))
  tl.set(disc, { visibility: 'hidden' }, b(4))
  ctx.ground(C.night, b(4))
  tl.to(
    world,
    { attr: { x: 480, y: 240, width: 960, height: 600, rx: 40 }, duration: b(1), ease: E.whip },
    b(4),
  )
  tl.to(world, { fill: C.white, duration: b(0.5), ease: E.glide }, b(4.5))

  const sentG = g(cardG)

  const SZ = 72
  const TRACK = -0.02
  const sentLay = layout('Sí, tengo hambre.', 800, SZ, TRACK * SZ)
  const sentX = 960 - (sentLay.l + sentLay.r) / 2
  const sentB = 540 + capHeight(800, SZ) / 2

  // 'tengo', authored at 260 with its ink centre on (960,610).
  const TG = 260
  const tgLay = layout('tengo', 800, TG, TRACK * TG)
  const tgX = 960 - (tgLay.l + tgLay.r) / 2
  const tgB = 610 + (tgLay.a - tgLay.d) / 2
  const tgK = SZ / TG
  const slotX = sentX + sentLay.chars[4].x
  const tgSlot = g(sentG)
  const tgHop = g(tgSlot)
  const tgSq = g(tgHop)
  const tgMask = clip(tgX - 0.3 * TG, tgB - 1.0 * TG, tgLay.w + 0.6 * TG, 1.32 * TG)
  const tgClip = g(tgSq, { 'clip-path': tgMask.url })
  const tgChars = chars(tgClip, tgLay, tgX, tgB, 800, TG, C.green)

  const tgRise = 1.3 * TG
  gsap.set(tgChars, { y: tgRise })
  // A 1/32-beat stagger; starting at 1.275 puts the last landing on 2.0.
  tl.to(tgChars, { y: 0, duration: 0.3, ease: E.pop, stagger: b(1 / 32) }, b(1.275))

  // The happy hop, and its landing squash about the baseline.
  const tgFoot = `${f2(960)} ${f2(tgB)}`
  tl.to(tgHop, { y: -24, duration: b(0.25), ease: E.lift }, b(2.5))
  tl.to(tgHop, { y: 0, duration: b(0.25), ease: E.cut }, b(2.75))
  tl.set(tgSq, { scaleX: 1.05, scaleY: 0.95, svgOrigin: tgFoot }, b(3))
  tl.to(tgSq, { scaleX: 1, scaleY: 1, svgOrigin: tgFoot, duration: b(0.5), ease: E.spring }, b(3))

  // Into its slot in the sentence.
  tl.to(
    tgSlot,
    {
      x: slotX - tgX,
      y: sentB - tgB,
      scale: tgK,
      svgOrigin: `${f2(tgX)} ${f2(tgB)}`,
      duration: b(0.75),
      ease: E.snap,
    },
    b(3.25),
  )

  /** A sentence word outside 'tengo': characters in a rising group behind a line mask. */
  function sentWord(from, to) {
    const sub = { chars: sentLay.chars.slice(from, to) }
    const l = Math.min(...sub.chars.filter((c) => c.ch.trim()).map((c) => c.l))
    const r = Math.max(...sub.chars.filter((c) => c.ch.trim()).map((c) => c.r))
    const m = clip(sentX + l - 0.3 * SZ, sentB - 1.1 * SZ, r - l + 0.6 * SZ, 1.42 * SZ)
    const wrap = g(sentG, { 'clip-path': m.url })
    const rise = g(wrap)
    const els = chars(rise, sub, sentX, sentB, 800, SZ, C.ink)
    gsap.set(rise, { y: 1.45 * SZ })
    return { rise, els }
  }
  const si = sentWord(0, 3)
  const ham = sentWord(9, 17)
  tl.to(si.rise, { y: 0, duration: b(0.5), ease: E.snap }, b(3.5))
  tl.to(ham.rise, { y: 0, duration: b(0.375), ease: E.snap }, b(3.625))

  /* --------------------------------------------------- 5.0 'Echo' title */

  const ECHO = 110
  const echoLay = layout('Echo', 900, ECHO, TRACK * ECHO)
  const echoX = 140 - echoLay.l
  const echoMask = clip(100, 190 - 1.05 * ECHO, echoLay.w + 120, 1.4 * ECHO)
  const echoWrap = g(titleLayer, { 'clip-path': echoMask.url })
  const echoExit = g(echoWrap)
  const echoChars = chars(echoExit, echoLay, echoX, 190, 900, ECHO, C.white)
  gsap.set(echoChars, { y: 1.45 * ECHO })
  // 5.0-5.5 including the stagger: the 'o' lands on 5.5.
  tl.to(echoChars, { y: 0, duration: b(0.5 - 3 / 32), ease: E.snap, stagger: b(1 / 32) }, b(5))

  /* ------------------------------------------------ 5.5–7.75 read aloud */

  // Characters in reading order, with where each one's bar stands.
  const sentChars = [...si.els, ...tgChars, ...ham.els]
  const barInfo = []
  const rngBars = ctx.rng(5001)
  const readable = sentLay.chars.filter((c) => c.ch.trim())
  readable.forEach((c, i) => {
    barInfo.push({
      x: sentX + c.cx,
      base: 30 + rngBars() * 110,
      green: i >= 3 && i < 8,
    })
  })
  // Each character folds to the bar's axis (y 540). Inside 'tengo' that point
  // is expressed in the 260 px word's own space.
  const tgLocal540 = tgB + (540 - sentB) / tgK
  const charOrigin = sentChars.map((el, i) => {
    if (i >= 3 && i < 8) return `${f2(tgX + el._c.cx)} ${f2(tgLocal540)}`
    return `${f2(barInfo[i].x)} 540`
  })

  const barsG = g(cardG)
  const bars = barInfo.map((bi) =>
    ctx.svg('rect', { x: f2(bi.x - 5), y: 540, width: 10, height: 0, rx: 5, fill: C.ink }, barsG),
  )

  tl.to(
    sentChars,
    { scaleY: 0, svgOrigin: (i) => charOrigin[i], duration: b(0.5), ease: E.snap, stagger: 0.01 },
    b(5.5),
  )
  tl.to(
    sentChars,
    { scaleY: 1, svgOrigin: (i) => charOrigin[i], duration: b(0.25), ease: E.snap, stagger: 0.01 },
    b(7.5),
  )

  // Speaker: a box, a cone and two waves, 56 px, drawn.
  const spk = g(cardG, { transform: 'translate(548 776)' })
  const spkIn = g(spk)
  ctx.svg(
    'path',
    {
      d: 'M-22 -8H-12L1 -19V19L-12 8H-22Z',
      fill: C.blue,
      stroke: C.blue,
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    },
    spkIn,
  )
  ctx.svg(
    'path',
    {
      d: 'M9 -8A11 11 0 0 1 9 8M15 -15A20 20 0 0 1 15 15',
      fill: 'none',
      stroke: C.blue,
      'stroke-width': 4.5,
      'stroke-linecap': 'round',
    },
    spkIn,
  )
  gsap.set(spkIn, { scale: 0, svgOrigin: '0 0' })
  tl.to(spkIn, { scale: 1, duration: b(0.5), ease: E.pop }, b(5.5))
  tl.to(spkIn, { scale: 0, duration: b(0.25), ease: E.cut }, b(7.5))

  // Playhead: a 3 px line from 450 to 630 with a 12 px dot on top.
  const phX0 = barInfo[0].x - 20
  const phX1 = barInfo[barInfo.length - 1].x + 20
  const ph = g(cardG)
  const phIn = g(ph)
  ctx.svg('rect', { x: -1.5, y: 450, width: 3, height: 180, fill: C.blue }, phIn)
  ctx.svg('circle', { cx: 0, cy: 450, r: 6, fill: C.blue }, phIn)
  gsap.set(phIn, { scaleY: 0, svgOrigin: '0 630' })
  tl.to(phIn, { scaleY: 1, duration: b(0.25), ease: E.snap }, b(5.75))
  tl.to(phIn, { scaleY: 0, duration: b(0.25), ease: E.cut }, b(7.5))

  /* ------------------------------------------------------ the ladder */

  const STAIRS = [
    [300, 930],
    [600, 930],
    [600, 760],
    [900, 760],
    [900, 663],
    [1050, 663],
    [1050, 566],
    [1200, 566],
    [1200, 469],
    [1350, 469],
    [1350, 300],
    [1650, 300],
  ]
  const stairs = ctx.svg(
    'polyline',
    {
      points: STAIRS.map((p) => p.join(',')).join(' '),
      fill: 'none',
      stroke: C.white,
      'stroke-width': 6,
      'stroke-linecap': 'butt',
      'stroke-linejoin': 'miter',
      visibility: 'hidden',
    },
    ladderLayer,
  )
  gsap.set(stairs, { drawSVG: '0%' })
  tl.set(stairs, { visibility: 'visible' }, b(8.25))
  tl.to(stairs, { drawSVG: '100%', duration: b(0.75), ease: E.glide }, b(8.25))

  /** A label centred by its ink on x, rising whole through a line mask. */
  function label(str, cx, base, weight, size) {
    const lay = layout(str, weight, size)
    const x = cx - (lay.l + lay.r) / 2
    const m = clip(x + lay.l - 0.3 * size, base - 1.1 * size, lay.w + 0.6 * size, 1.42 * size)
    const wrap = g(ladderLayer, { 'clip-path': m.url })
    const mv = g(wrap)
    text(mv, str, x, base, weight, size, C.white)
    gsap.set(mv, { y: 1.45 * size })
    return { mv, size }
  }
  const lbl10 = label('10 minutes', 450, 1000, 800, 52)
  const lbl1 = label('1 day', 750, 830, 800, 52)
  const lblDays = label('days', 1500, 530, 800, 56)
  tl.to(lbl10.mv, { y: 0, duration: b(0.5), ease: E.snap }, b(9))
  tl.to(lbl1.mv, { y: 0, duration: b(0.5), ease: E.snap }, b(10))
  tl.to(lblDays.mv, { y: 0, duration: b(0.5), ease: E.snap }, b(12))

  // The ellipsis: one dot per hop, each in a window it can exit through.
  const DOTS = [
    [975, 703, 10.25],
    [1125, 606, 10.5],
    [1275, 509, 10.75],
  ]
  const dots = DOTS.map(([x, y, at]) => {
    const m = clip(x - 12, y - 12, 24, 24)
    const wrap = g(ladderLayer, { 'clip-path': m.url })
    const mv = g(wrap)
    const dot = ctx.svg('circle', { cx: x, cy: y, r: 7, fill: C.white }, mv)
    gsap.set(dot, { scale: 0, svgOrigin: `${x} ${y}` })
    tl.to(dot, { scale: 1, duration: b(0.25), ease: E.pop }, b(at))
    return { mv, size: 16 }
  })

  /* --------------------------------------------------- the odometer */

  const OD = 150
  const odLay = layout('365', 900, OD, TRACK * OD)
  const odX = 960 + 540 - (odLay.l + odLay.r) / 2
  const odB = 470
  const PITCH = 1.2 * OD
  const POP = 0.25
  const POP_HIT = 1 - 1.7 / 2.7
  const odWrap = g(ladderLayer)
  // Each reel starts on a blank cell, so the spin is also the reveal.
  const REELS = [
    { final: 3, laps: 0, lock: 11.875 },
    { final: 6, laps: 1, lock: 11.9375 },
    { final: 5, laps: 2, lock: 12.0 },
  ]
  const reels = REELS.map((rd, i) => {
    const c = odLay.chars[i]
    const cx = odX + c.x + c.adv / 2
    const m = clip(cx - 0.36 * OD, odB - 0.86 * OD, 0.72 * OD, 0.98 * OD)
    const wrap = g(odWrap, { 'clip-path': m.url })
    const strip = g(wrap)
    const cells = ['']
    for (let n = 0; n <= rd.laps * 10 + rd.final; n++) cells.push(String(n % 10))
    cells.forEach((d, k) => {
      if (d) text(strip, d, cx, odB + k * PITCH, 900, OD, C.white, { 'text-anchor': 'middle' })
    })
    const steps = cells.length - 1
    // Spin (a controlled rotation, so 'glide'), then the last 0.8 of a cell
    // locks on 'pop': its 10% overshoot is 8% of a cell. back.out(1.7) first
    // reaches its target 37% of the way in, and that crossing is the hit the
    // eye reads, so it is the part placed on the lock beat; the overshoot
    // and settle ring on after it.
    const popAt = rd.lock - POP_HIT * POP
    tl.to(strip, { y: -(steps - 0.8) * PITCH, duration: b(popAt - 11.25), ease: E.glide }, b(11.25))
    tl.to(strip, { y: -steps * PITCH, duration: b(POP), ease: E.pop }, b(popAt))
    return { strip, steps, popAt, lock: rd.lock }
  })

  /* ------------------------------------------------ 13.0 the exits */

  tl.to(stairs, { drawSVG: '100% 100%', duration: b(0.5), ease: E.cut }, b(13))
  const exits = [
    [lbl10.mv, 1.45 * 52],
    [lbl1.mv, 1.45 * 52],
    [dots[0].mv, 26],
    [dots[1].mv, 26],
    [dots[2].mv, 26],
    [reels, 1.1 * OD],
    [lblDays.mv, 1.45 * 56],
    [echoExit, 1.45 * ECHO],
  ]
  exits.forEach(([el, dy], i) => {
    // The reels leave by spinning on past their last cell, inside their windows.
    const vars = Array.isArray(el) ? { y: (k) => -f2(el[k].steps * PITCH + dy) } : { y: -f2(dy) }
    const targets = Array.isArray(el) ? el.map((r) => r.strip) : el
    tl.to(targets, Object.assign(vars, { duration: b(0.25), ease: E.cut }), b(13 + i / 32))
  })

  /* ------------------------------------------------ 13.5 the ember */

  tl.to(sentG, { scale: 0, svgOrigin: '960 540', duration: b(0.25), ease: E.cut }, b(13.5))
  // 160 local px at the card's 0.15 is the 24 px dot.
  tl.to(
    world,
    { attr: { x: 880, y: 460, width: 160, height: 160, rx: 80 }, duration: b(1.5), ease: E.whip },
    b(13.5),
  )

  /* ---------------------------------------- the card's path, closed-form */

  const K = 0.15
  const P = {
    c0: [960, 540],
    t1: [450, 882],
    t2: [750, 712],
    e1: [975, 615],
    e2: [1125, 518],
    e3: [1275, 421],
    t4: [1500, 252],
  }
  /** h for y = y0 + (y1-y0)u - 4h·u(1-u) whose highest point is apexY. */
  function hopH(y0, y1, apexY) {
    const D = y0 - apexY
    const dl = y1 - y0
    const B = 8 * dl + 16 * D
    return (B + Math.sqrt(B * B - 64 * dl * dl)) / 32
  }
  /**
   * A hop is y = y0 + (y1-y0)u - 4h·u(1-u). `h` is the formula's own height
   * over the chord; the long leap passes its apex y instead and solves for h.
   */
  function makeHop(b0, b1, p0, p1, h, from, stretch, xEase) {
    const dl = p1[1] - p0[1]
    const vmax = Math.max(Math.abs(dl - 4 * h), Math.abs(dl + 4 * h))
    return { b0, b1, p0, p1, h, dl, vmax, from, stretch, xEase: xEase || ((u) => u) }
  }
  /**
   * Rise, then travel. The card leaves the ground straight up and only starts
   * across once its underside is above the next tread (u = |dl| / 4h), then
   * glides over and drops onto the tread. A card that moved across from the
   * first frame would pass through the riser it starts flush against (150 px
   * treads, 144 px card), and one that caught up later ('cut') landed at
   * 5000 px/s, over the cap.
   */
  const riseThenGlide = (dl, h) => {
    const a = Math.abs(dl) / (4 * h)
    return (u) => fx.glide(clamp01((u - a) / (1 - a)))
  }
  // h = 140 is the storyboard's figure used as the formula's h: an apex 68 px
  // above T2 and a 3900 px/s take-off. Reading it as 140 px above T2 needed
  // h = 217 and a 5400 px/s take-off.
  const HOP_T2 = 140
  // The ellipsis at h = 100: an apex about 57 px above each landing tread
  // (the '60 px apex'), with a take-off of 3980 px/s, at the cap.
  const HOP_E = 100
  const HOPS = [
    makeHop(9.625, 10, P.t1, P.t2, HOP_T2, [1.05, 0.9], 0.1, fx.glide),
    makeHop(10, 10.25, P.t2, P.e1, HOP_E, [1.1, 0.86], 0.06, riseThenGlide(-97, HOP_E)),
    makeHop(10.25, 10.5, P.e1, P.e2, HOP_E, [1.03, 0.88], 0.06, riseThenGlide(-97, HOP_E)),
    makeHop(10.5, 10.75, P.e2, P.e3, HOP_E, [1.03, 0.88], 0.06, riseThenGlide(-97, HOP_E)),
    makeHop(11, 12, P.e3, P.t4, hopH(P.e3[1], P.t4[1], 72), [1.04, 0.75], 0.15, fx.cut),
  ]
  function hopState(hp, tb, s) {
    const u = seg(tb, hp.b0, hp.b1)
    s.cx = lerp(hp.p0[0], hp.p1[0], hp.xEase(u))
    s.cy = hp.p0[1] + hp.dl * u - 4 * hp.h * u * (1 - u)
    const v = Math.abs(hp.dl - 4 * hp.h * (1 - 2 * u)) / hp.vmax
    const sy = 1 + hp.stretch * v
    const sx = 1 - 0.5 * hp.stretch * v
    // Out of the crouch into the stretch over the first 30% of the hop.
    const blend = fx.lift(clamp01(u / 0.3))
    s.sy = lerp(hp.from[1], sy, blend)
    s.sx = lerp(hp.from[0], sx, blend)
  }

  function cardState(tb) {
    const s = { cx: 960, cy: 540, k: 1, tilt: 0, sx: 1, sy: 1, bottom: true, heel: false }
    if (tb < 7.75) {
      s.bottom = false
      if (tb >= 5 && tb < 5.25) s.sy = lerp(1, 0.97, fx.lift(seg(tb, 5, 5.25)))
      else if (tb >= 5.25 && tb < 5.5) s.sy = lerp(0.97, 1, fx.spring(seg(tb, 5.25, 5.5)))
      return s
    }
    if (tb < 9) {
      const p = seg(tb, 7.75, 9)
      const w = fx.whip(p)
      s.cx = lerp(P.c0[0], P.t1[0], w)
      s.cy = lerp(P.c0[1], P.t1[1], w) - 120 * 4 * w * (1 - w)
      s.k = lerp(1, K, w)
      s.tilt = -8 * (p < 0.5 ? fx.glide(p * 2) : 1 - fx.glide(p * 2 - 1))
      return s
    }
    s.k = K
    if (tb < 9.5) {
      const q = fx.spring(seg(tb, 9, 9.5))
      ;[s.cx, s.cy] = P.t1
      s.sy = lerp(0.85, 1, q)
      s.sx = lerp(1.12, 1, q)
    } else if (tb < 9.625) {
      const q = fx.lift(seg(tb, 9.5, 9.625))
      ;[s.cx, s.cy] = P.t1
      s.sy = lerp(1, 0.9, q)
      s.sx = lerp(1, 1.05, q)
    } else if (tb < 10.75) {
      hopState(
        HOPS.find((hp) => tb < hp.b1),
        tb,
        s,
      )
    } else if (tb < 11) {
      const q = fx.lift(seg(tb, 10.75, 11))
      ;[s.cx, s.cy] = P.e3
      s.sy = lerp(0.88, 0.75, q)
      s.sx = lerp(1.03, 1.04, q)
      s.tilt = -12 * q
      s.heel = true
    } else if (tb < 12) {
      hopState(HOPS[4], tb, s)
      s.tilt = -12 * (1 - fx.glide(seg(tb, 11, 12)))
      s.heel = true
    } else if (tb < 13.5) {
      const q = fx.spring(seg(tb, 12, 12.5))
      ;[s.cx, s.cy] = P.t4
      s.sy = lerp(0.8, 1, q)
      s.sx = lerp(1.15, 1, q)
    } else {
      const w = fx.whip(seg(tb, 13.5, 15))
      s.cx = lerp(P.t4[0], 960, w)
      s.cy = lerp(P.t4[1], 540, w)
    }
    return s
  }

  /* ------------------------------------------------------------- draw */

  const kick = (tAbs) => {
    const phi = (((tAbs / BEAT) % 1) + 1) % 1
    return Math.exp(-6 * phi)
  }
  let lastCard = ''
  ctx.draw((t) => {
    const tb = t / BEAT

    const s = cardState(tb)
    const a = s.bottom ? 300 * s.k : 0
    // Rearing for the leap, the card tips back onto its heel (bottom-left
    // corner) rather than about its middle, so no corner dips into the tread.
    const px = s.heel ? -480 * s.k : 0
    const py = s.heel ? a : 0
    const tr =
      `translate(${f2(s.cx + px)} ${f2(s.cy + py)}) rotate(${f2(s.tilt)}) ` +
      `translate(${f2(-px)} ${f2(a - py)}) ` +
      `scale(${s.sx.toFixed(4)} ${s.sy.toFixed(4)}) translate(0 ${f2(-a)}) ` +
      `scale(${s.k.toFixed(4)}) translate(-960 -540)`
    if (tr !== lastCard) {
      cardG.setAttribute('transform', tr)
      lastCard = tr
    }

    const phx = lerp(phX0, phX1, seg(tb, 6, 7.5))
    ph.setAttribute('transform', `translate(${f2(phx)} 0)`)

    const tAbs = ctx.abs(t)
    bars.forEach((bar, i) => {
      const bi = barInfo[i]
      const grow = fx.snap(clamp01((t - b(5.5) - 0.01 * i) / b(0.5)))
      const fold = 1 - fx.snap(clamp01((t - b(7.5) - 0.01 * i) / b(0.25)))
      const h = bi.base * (0.6 + 0.4 * kick(tAbs - 0.004 * i)) * grow * fold
      bar.setAttribute('y', f2(540 - h / 2))
      bar.setAttribute('height', f2(h))
      bar.setAttribute('visibility', h > 0.2 ? 'visible' : 'hidden')
      const played = tb >= 6 && bi.x < phx
      bar.setAttribute('fill', bi.green ? C.green : played ? C.blue : C.ink)
    })
  })

  /* ------------------------------------------------------------- sound */

  const pan = (x) => Math.max(-1, Math.min(1, (x - 960) / 960))
  ctx.cue(b(0.75), 'reverse', { dur: b(0.25), gain: 0.5 })
  ctx.cue(b(1), 'glitch', { gain: 0.6 })
  ctx.cue(b(1.5), 'thunk', { note: 'D2', gain: 0.35 })
  ctx.cue(b(2), 'pluck', { note: 'D6', gain: 0.7 })
  ctx.cue(b(2.25), 'pluck', { note: 'F#6', gain: 0.7 })
  ctx.cue(b(2), 'shimmer', { dur: b(0.75), gain: 0.5 })
  ctx.cue(b(3), 'pop', { note: 'A5', gain: 0.6 })
  ctx.cue(b(4), 'boom', { dur: b(1), gain: 0.7 })
  ctx.cue(b(5.5), 'pop', { note: 'D6', gain: 0.5, pan: pan(548) })
  // Read aloud: a pluck per 16th, pitched by the bar under the playhead.
  const SCALE = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6']
  for (let k = 0; k < 6; k++) {
    const at = 6 + k * 0.25
    const x = lerp(phX0, phX1, seg(at, 6, 7.5))
    let near = barInfo[0]
    for (const bi of barInfo) if (Math.abs(bi.x - x) < Math.abs(near.x - x)) near = bi
    const note = SCALE[Math.min(5, Math.floor(((near.base - 30) / 110) * 6))]
    ctx.cue(b(at), 'pluck', { note, gain: 0.45, pan: pan(x) })
  }
  ctx.cue(b(7.75), 'whoosh', { dur: b(1.25), gain: 0.55, pan: -0.5 })
  ctx.cue(b(8.25), 'riser', { dur: b(0.75), gain: 0.35 })
  ctx.cue(b(9), 'pop', { note: 'D5', pan: pan(P.t1[0]) })
  ctx.cue(b(10), 'pop', { note: 'F#5', pan: pan(P.t2[0]) })
  ctx.cue(b(10.25), 'pop', { note: 'A5', gain: 0.6, pan: pan(P.e1[0]) })
  ctx.cue(b(10.5), 'pop', { note: 'B5', gain: 0.6, pan: pan(P.e2[0]) })
  ctx.cue(b(10.75), 'pop', { note: 'C#6', gain: 0.6, pan: pan(P.e3[0]) })
  ctx.cue(b(10.75), 'reverse', { dur: b(0.25), gain: 0.4, pan: pan(P.e3[0]) })
  // The ratchet: one tick per cell the tens reel passes, from its own curve.
  {
    const r = reels[1]
    let prev = 0
    for (let ms = 0; ms <= (b(r.lock) - b(11.25)) * 1000; ms++) {
      const t = b(11.25) + ms / 1000
      const tb = t / BEAT
      const pos =
        tb < r.popAt
          ? (r.steps - 0.8) * fx.glide(seg(tb, 11.25, r.popAt))
          : r.steps - 0.8 + 0.8 * fx.pop(seg(tb, r.popAt, r.popAt + POP))
      const cell = Math.floor(pos + 0.5)
      // The last cell is the lock, which has its own tick below.
      if (cell > prev && cell < r.steps) {
        ctx.cue(t, 'tick', { gain: 0.22, pan: pan(1500) })
        prev = cell
      }
    }
  }
  // The hundreds and tens lock on their own 32nds; the ones lock is the impact.
  ctx.cue(b(11.875), 'tick', { gain: 0.4, pan: pan(1440) })
  ctx.cue(b(11.9375), 'tick', { gain: 0.4, pan: pan(1500) })
  ctx.cue(b(12), 'impact', { gain: 0.8, pan: pan(1500) })
  ctx.cue(b(12), 'bell', { note: 'D6', dur: 3, gain: 0.6 })
  ctx.cue(b(13), 'reverse', { dur: b(0.5), gain: 0.35 })
  ctx.cue(b(13.5), 'swish', { dur: b(1.5), gain: 0.4, pan: 0.3 })
  ctx.cue(b(15), 'tick', { gain: 0.45 })
})
