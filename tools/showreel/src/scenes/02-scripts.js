/*
 * 02-scripts — Relay: every script moves the way it is read. Reel beats 8–16.
 *
 * Opens on the film's only slice: a replica of 01-caret's last still, cut in
 * two along the Cut and thrown apart over this scene's white world. Then seven
 * greetings hand the stage to one another, each entering in its own reading
 * direction, over type-specimen guides and a rolling annotation.
 *
 * Every centring is by measured ink, taken once after the fonts have loaded:
 * a canvas render of the word is scanned for its inked pixels. Layout boxes
 * lie about side bearings, and for Devanagari the one number that matters —
 * where the headline sits — has no metric at all.
 */
REEL.scene('02-scripts', (ctx) => {
  const { tl, b, E, C, F, GL, CUT, root } = ctx
  const [ux, uy] = CUT.dUp
  const [nx, ny] = CUT.n
  const WHITE = '#ffffff'
  const font = (px, family) => `800 ${px}px ${family}`
  // Hidden by opacity as well as visibility: a child set visible would show
  // through a parent that is only visibility-hidden.
  const HIDDEN = { visibility: 'hidden', opacity: '0' }

  /* ------------------------------------------------------------ measuring */

  // Never attached: a scratch surface for ink scans and advance widths.
  const scratch = ctx.el('canvas', null, null)
  const sg = scratch.getContext('2d', { willReadFrequently: true })
  const setFont = (f, ls = 0, dir = 'ltr') => {
    sg.font = f
    sg.letterSpacing = `${ls}px`
    sg.direction = dir
    sg.textAlign = 'left'
    sg.textBaseline = 'alphabetic'
  }
  const advance = (str, f, ls = 0) => {
    setFont(f, ls)
    return sg.measureText(str).width
  }

  /**
   * The inked box of `str` relative to its pen origin (left edge of the
   * advance, alphabetic baseline), from the pixels a canvas actually paints.
   * Also returns, per row, how many pixels are inked and their x range.
   */
  function scan(str, f, px, ls = 0, dir = 'ltr') {
    setFont(f, ls, dir)
    const pad = Math.ceil(px * 0.5)
    const w = Math.ceil(sg.measureText(str).width + Math.abs(ls) * str.length + pad * 2)
    const h = Math.ceil(px * 2.4)
    const base = Math.round(px * 1.6)
    scratch.width = w
    scratch.height = h
    setFont(f, ls, dir)
    sg.fillStyle = '#000'
    sg.fillText(str, pad, base)
    const data = sg.getImageData(0, 0, w, h).data
    let l = w
    let r = -1
    let t = h
    let bt = -1
    const rows = []
    for (let y = 0; y < h; y++) {
      let n = 0
      let rl = w
      let rr = -1
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] >= 128) {
          n++
          if (x < rl) rl = x
          rr = x
        }
      }
      if (n) {
        if (rl < l) l = rl
        if (rr > r) r = rr
        if (y < t) t = y
        bt = y
      }
      rows.push({ y: y - base, n, l: rl - pad, r: rr + 1 - pad })
    }
    return { l: l - pad, r: r + 1 - pad, t: t - base, b: bt + 1 - base, rows }
  }

  /** A line of type whose baseline can be placed: `base` is its offset from the box top. */
  function type(parent, str, f, style, attrs) {
    const node = ctx.el(
      'div',
      {
        text: str,
        attrs,
        style: Object.assign(
          { position: 'absolute', left: '0px', top: '0px', font: f, whiteSpace: 'pre' },
          style,
        ),
      },
      parent,
    )
    const probe = ctx.el(
      'span',
      {
        style: { display: 'inline-block', width: '0px', height: '0px', verticalAlign: 'baseline' },
      },
      node,
    )
    const base = probe.offsetTop
    probe.remove()
    return { node, base }
  }
  const place = (w, left, baseline) => {
    w.node.style.left = `${left}px`
    w.node.style.top = `${baseline - w.base}px`
  }
  const layer = (parent, style) =>
    ctx.el('div', { style: Object.assign({ position: 'absolute', inset: '0px' }, style) }, parent)

  /* ------------------------------------------------------------- the Cut */

  const P = [960, 540]
  const far = 4000
  /** The half-plane on one side of the Cut through P: -1 upper-left, +1 lower-right. */
  function halfPlane(side, px = P[0], py = P[1]) {
    const a = [px + far * ux, py + far * uy]
    const c = [px - far * ux, py - far * uy]
    const o = [side * far * nx, side * far * ny]
    const pts = [a, c, [c[0] + o[0], c[1] + o[1]], [a[0] + o[0], a[1] + o[1]]]
    return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(', ')})`
  }

  /* ---------------------------------------------------------- annotation */

  // Nunito 800 24 px, 0.12em tracking, left 120, baseline 134 — as in S1.
  const ANN = { f: font(24, F.display), ls: 24 * 0.12, x: 120, base: 134, lh: 34, rise: 26 }
  const annX = (str) => {
    const xs = []
    for (let i = 0; i < str.length; i++) {
      // Pen position of char i with the pair kerning of the run it sits in.
      xs.push(advance(str.slice(0, i + 1), ANN.f, ANN.ls) - advance(str[i], ANN.f, ANN.ls))
    }
    return xs
  }
  const arrowAt = (str) => ANN.x + advance(`${str} `, ANN.f, ANN.ls)
  const capInk = scan('PTLATIN', ANN.f, 24, ANN.ls)
  const arrowY = ANN.base + capInk.t / 2

  /** The SVG arrow: a 2 px stroke, 18 px shaft, 6 px head, centred on (cx, cy). */
  function arrow(parent, cx, cy) {
    const s = ctx.svg(
      'svg',
      {
        width: 30,
        height: 30,
        viewBox: '-15 -15 30 30',
        style: {
          position: 'absolute',
          left: `${cx - 15}px`,
          top: `${cy - 15}px`,
          overflow: 'visible',
        },
      },
      parent,
    )
    ctx.svg(
      'path',
      {
        d: 'M-9 0H9M3 -6L9 0L3 6',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      s,
    )
    return s
  }

  /* ------------------------------------------------- the world, bottom up */

  // The shake at 7.0 moves everything in the world; the slice sits above it.
  const world = layer(root)

  // Type-specimen guides: baseline 646 and cap line 434, on whole pixel rows.
  const guideSvg = ctx.svgLayer(world)
  const guides = [646.5, 433.5].map((y) =>
    ctx.svg(
      'path',
      { d: `M120 ${y}H1800`, stroke: C.border, 'stroke-width': 1, fill: 'none' },
      guideSvg,
    ),
  )

  // RU — Привет, split into letters that rise out of a line mask.
  const ru = type(world, GL.ru.text, font(300, GL.ru.font), {
    color: C.ink,
    letterSpacing: '-0.02em',
    lineHeight: '420px',
    padding: '0px 40px',
    overflow: 'hidden',
  })
  const ruChars = ctx.split(ru.node, { type: 'chars' }).chars
  {
    const first = ruChars[0]
    const last = ruChars[ruChars.length - 1]
    const f = font(300, GL.ru.font)
    const inkL = first.offsetLeft + scan(first.textContent, f, 300).l
    const inkR = last.offsetLeft + scan(last.textContent, f, 300).r
    place(ru, 960 - (inkL + inkR) / 2, 646)
  }

  // EL — Γειά σου, one word that inhales its tracking.
  const EL = { px: 260, from: 260 * 0.5, to: 260 * -0.02 }
  const elFont = font(EL.px, GL.el.font)
  const el = type(world, GL.el.text, elFont, {
    color: C.ink,
    letterSpacing: `${EL.to}px`,
    lineHeight: `${EL.px * 1.4}px`,
    ...HIDDEN,
  })
  {
    const ink = scan(GL.el.text, elFont, EL.px, EL.to)
    place(el, 960 - (ink.l + ink.r) / 2, 646)
  }
  // Tracking lands after every character, so the ink's right edge moves by
  // (n - 1) gaps; sliding x by half of that keeps the ink centred throughout.
  const elDrift = (-(GL.el.text.length - 1) * (EL.from - EL.to)) / 2

  // HE — שלום, revealed from the right by an edge parallel to the Cut.
  const heFont = font(300, GL.he.font)
  const heWrap = layer(world, HIDDEN)
  const he = type(heWrap, GL.he.text, heFont, { color: WHITE, lineHeight: '420px' }, { dir: 'rtl' })
  {
    const ink = scan(GL.he.text, heFont, 300, 0, 'rtl')
    place(he, 960 - (ink.l + ink.r) / 2, 646)
  }

  // HI — नमस्ते, whole, hanging from its own headline at y 434.
  const hiFont = font(280, GL.hi.font)
  const hiWrap = layer(world, { ...HIDDEN, clipPath: 'inset(423px 0px 0px 0px)' })
  const hi = type(hiWrap, GL.hi.text, hiFont, { color: WHITE, lineHeight: '448px' })
  const bar = {}
  {
    const ink = scan(GL.hi.text, hiFont, 280)
    // The headline is the widest run of ink: the rows around the fullest one
    // that stay within 90% of it. (The bowls below it are wide too, but never
    // that wide, and never contiguous with it.)
    const peak = ink.rows.reduce((a, row) => (row.n > a.n ? row : a))
    const at = ink.rows.indexOf(peak)
    let i0 = at
    let i1 = at
    while (ink.rows[i0 - 1].n >= peak.n * 0.9) i0--
    while (ink.rows[i1 + 1].n >= peak.n * 0.9) i1++
    const head = ink.rows.slice(i0, i1 + 1)
    const mid = (head[0].y + head[head.length - 1].y + 1) / 2
    bar.x0 = Math.min(...head.map((row) => row.l))
    bar.x1 = Math.max(...head.map((row) => row.r))
    const left = 960 - (ink.l + ink.r) / 2
    place(hi, left, 434 - mid)
    bar.top = Math.floor(434 - mid + ink.t) - 2
    bar.x0 += left
    bar.x1 += left
  }
  const barSvg = ctx.svgLayer(world)
  const barPath = ctx.svg(
    'path',
    {
      d: `M${bar.x0.toFixed(1)} 434H${bar.x1.toFixed(1)}`,
      stroke: WHITE,
      'stroke-width': 22,
      fill: 'none',
      style: HIDDEN,
    },
    barSvg,
  )

  // KO — 안녕하세요, five 170 px em cells spanning x 535-1385 around (960, 540).
  // Noto's CJK em box runs 0.88 em above the baseline to 0.12 em below it.
  const CELL = 170
  const emBase = CELL * 0.88
  const koFont = font(CELL, GL.ko.font)
  const jaFont = font(CELL, GL.ja.font)
  // The em cells carry the rhythm; the whole set is then nudged so its INK
  // is centred on (960, 540). Noto's CJK glyphs sit a few px left of and
  // above their em box's centre, so the row and the column are each off by
  // 7-9 px without it. Both being ink-centred is also what makes the turned
  // row land exactly on the column at the match cut.
  function inkNudge(chars, f, along) {
    const ink = chars.map((ch) => scan(ch, f, CELL))
    const n = chars.length - 1
    // Pen origin of glyph i: (CELL·i, emBase) along the run, 0 across it.
    const lo = along === 'x' ? ink[0].l : emBase + ink[0].t
    const hi = along === 'x' ? CELL * n + ink[n].r : CELL * n + emBase + ink[n].b
    const acrossLo =
      along === 'x' ? Math.min(...ink.map((k) => emBase + k.t)) : Math.min(...ink.map((k) => k.l))
    const acrossHi =
      along === 'x' ? Math.max(...ink.map((k) => emBase + k.b)) : Math.max(...ink.map((k) => k.r))
    const run = (CELL * chars.length) / 2 - (lo + hi) / 2
    const across = CELL / 2 - (acrossLo + acrossHi) / 2
    return along === 'x' ? { dx: run, dy: across } : { dx: across, dy: run }
  }
  const koNudge = inkNudge(Array.from(GL.ko.text), koFont, 'x')
  const jaNudge = inkNudge(Array.from(GL.ja.text), jaFont, 'y')
  function hangulRow(parent) {
    const row = layer(parent, { transformOrigin: '960px 540px', ...HIDDEN })
    const cells = Array.from(GL.ko.text).map((ch, i) => {
      const cell = ctx.el(
        'div',
        {
          style: {
            position: 'absolute',
            left: `${535 + CELL * i + koNudge.dx}px`,
            top: `${540 - CELL / 2 + koNudge.dy}px`,
            width: `${CELL}px`,
            height: `${CELL}px`,
          },
        },
        row,
      )
      const g = type(cell, ch, koFont, { color: C.ink, lineHeight: `${CELL * 1.5}px` })
      place(g, 0, emBase)
      return cell
    })
    return { row, cells }
  }
  // Echo trails first so they sit beneath the row they trail.
  const trails = [0.3, 0.15, 0.06].map((opacity, k) => ({
    ...hangulRow(world),
    opacity,
    lag: (k + 1) / 30,
  }))
  const ko = hangulRow(world)

  // JA — こんにちは, a vertical column in the box the turned row fills.
  const ja = layer(world, { transformOrigin: '960px 540px', ...HIDDEN })
  const kana = Array.from(GL.ja.text).map((ch, i) => {
    const mask = ctx.el(
      'div',
      {
        style: {
          position: 'absolute',
          left: `${960 - CELL / 2 + jaNudge.dx}px`,
          top: `${115 + CELL * i + jaNudge.dy}px`,
          width: `${CELL}px`,
          height: `${CELL}px`,
          overflow: 'hidden',
        },
      },
      ja,
    )
    const inner = ctx.el('div', { style: { position: 'absolute', inset: '0px' } }, mask)
    const g = type(inner, ch, jaFont, { color: WHITE, lineHeight: `${CELL * 1.5}px` })
    place(g, 0, emBase)
    return inner
  })

  // ZH — 你好, ink box centred on (960, 540).
  const zhFont = font(480, GL.zh.font)
  const zhWrap = layer(world, { transformOrigin: '960px 540px', ...HIDDEN })
  const zh = type(zhWrap, GL.zh.text, zhFont, { color: WHITE, lineHeight: '700px' })
  {
    const ink = scan(GL.zh.text, zhFont, 480)
    place(zh, 960 - (ink.l + ink.r) / 2, 540 - (ink.t + ink.b) / 2)
  }

  // The annotation, one glyph per mask so only the changed letters roll.
  const ann = layer(world, { color: C.muted })
  const annBase = type(ann, 'H', ANN.f, { lineHeight: `${ANN.lh}px`, visibility: 'hidden' })
  annBase.node.remove()
  function glyph(ch, x) {
    const mask = ctx.el(
      'div',
      {
        style: {
          position: 'absolute',
          left: `${ANN.x + x - 6}px`,
          top: `${ANN.base - ANN.rise}px`,
          width: `${advance(ch, ANN.f) + 12}px`,
          height: `${ANN.lh}px`,
          overflow: 'hidden',
        },
      },
      ann,
    )
    const inner = ctx.el(
      'div',
      {
        text: ch,
        style: {
          position: 'absolute',
          left: '6px',
          top: `${ANN.rise - annBase.base}px`,
          font: ANN.f,
          lineHeight: `${ANN.lh}px`,
          whiteSpace: 'pre',
        },
      },
      mask,
    )
    return inner
  }
  const annArrow = arrow(ann, arrowAt('PT · LATIN') + 9, arrowY)
  const arrowHome = arrowAt('PT · LATIN')

  /* ------------------------------------------------------------ the slice */

  // A replica of 01-caret's last still, twice, one clip-path half each.
  function replica(side) {
    const half = layer(root, { clipPath: halfPlane(side) })
    // The ground overhangs the stage so the slip never opens a sliver of the
    // world along the frame edges; the clip path is what bounds it.
    layer(half, { inset: '-200px', background: C.deep })
    const ola = type(half, GL.pt.text, font(300, F.display), {
      color: WHITE,
      letterSpacing: '-0.02em',
      lineHeight: '420px',
    })
    // Centred by advance as 01-caret does it: canvas counts the tracking
    // after the last letter too, and the advance does not.
    const olaAdv = advance(GL.pt.text, font(300, F.display), -6) + 6
    place(ola, 960 - olaAdv / 2, 646)
    const note = type(half, 'PT · LATIN', ANN.f, {
      color: C.faint,
      letterSpacing: `${ANN.ls}px`,
      lineHeight: `${ANN.lh}px`,
    })
    place(note, ANN.x, ANN.base)
    arrow(half, arrowHome + 9, arrowY).style.color = C.faint
    const s = ctx.svgLayer(half)
    const line = ctx.svg(
      'line',
      {
        x1: P[0] - 1300 * ux,
        y1: P[1] - 1300 * uy,
        x2: P[0] + 1300 * ux,
        y2: P[1] + 1300 * uy,
        stroke: WHITE,
        'stroke-width': 12,
      },
      s,
    )
    return { half, line }
  }
  const upper = replica(-1)
  const lower = replica(1)

  /* ============================================================ timeline */

  const once = { immediateRender: false }
  const show = (target, at) => tl.set(target, { autoAlpha: 1 }, at)
  const hide = (target, at) => tl.set(target, { autoAlpha: 0 }, at)

  // 0.0 SLICE. The line flashes 12 px for two frames, then the halves slip
  // along the Cut, then part along its normal and leave the frame.
  tl.set([upper.line, lower.line], { attr: { 'stroke-width': 3 } }, b(1 / 15))
  for (const [half, s] of [
    [upper.half, 1],
    [lower.half, -1],
  ]) {
    const slip = { x: 24 * ux * s, y: 24 * uy * s }
    tl.fromTo(half, { x: 0, y: 0 }, { ...slip, duration: b(0.125), ease: E.snap }, 0)
    tl.fromTo(
      half,
      slip,
      {
        x: slip.x - 1200 * nx * s,
        y: slip.y - 1200 * ny * s,
        duration: b(0.625),
        ease: E.cut,
        ...once,
      },
      b(0.125),
    )
  }
  hide([upper.half, lower.half], b(0.75))
  ctx.cue(0, 'blade', { gain: 0.9 })
  ctx.cue(b(0.125), 'whoosh', { pan: -1, gain: 0.55, dur: 0.3 })
  ctx.cue(b(0.125), 'whoosh', { pan: 1, gain: 0.55, dur: 0.3 })

  // 0.25 guides draw in from the left.
  tl.fromTo(
    guides,
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: b(0.5), ease: E.snap },
    b(0.25),
  )

  // 0.25 Привет rises left to right out of its line mask.
  tl.fromTo(
    ruChars,
    { yPercent: 105 },
    { yPercent: 0, duration: 0.2, ease: E.snap, stagger: b(1 / 32) },
    b(0.25),
  )

  // 1.0 and drops out right to left.
  tl.fromTo(
    ruChars.slice().reverse(),
    { yPercent: 0 },
    { yPercent: 105, duration: b(0.1), ease: E.cut, stagger: b(1 / 32), ...once },
    b(1),
  )

  // 1.25 Γειά σου inhales: tracking +0.5em to -0.02em while it rises 30 px.
  show(el.node, b(1.25))
  tl.fromTo(
    el.node,
    { letterSpacing: `${EL.from}px`, x: elDrift, y: 30 },
    { letterSpacing: `${EL.to}px`, x: 0, y: 0, duration: b(0.5), ease: E.snap },
    b(1.25),
  )
  ctx.cue(b(1.25), 'reverse', { dur: 0.25, gain: 0.6 })

  // 2.0 HARD CUT to ink. שלום is written from the right.
  ctx.ground(C.deep, b(2))
  hide(el.node, b(2))
  tl.set(guides, { attr: { stroke: C.nightBorder } }, b(2))
  tl.set(ann, { color: C.faint }, b(2))
  show(heWrap, b(2))
  tl.fromTo(
    heWrap,
    { clipPath: halfPlane(1, 960 + 900) },
    { clipPath: halfPlane(1, 960 - 900), duration: 0.4, ease: E.snap },
    b(2),
  )
  // It drifts 60 px left with the edge and comes to rest centred.
  tl.fromTo(he.node, { x: 60 }, { x: 0, duration: 0.4, ease: E.snap }, b(2))
  // Once written, the edge lets go, so the exit can run off the frame. (By
  // 2.75 the edge is within 0.2% of its end, out past the word.)
  tl.set(heWrap, { clipPath: 'none' }, b(2.75))
  ctx.cue(b(2), 'swish', { pan: 0.8, gain: 0.6, dur: 0.2 })
  ctx.cue(b(2.125), 'swish', { pan: -0.8, gain: 0.35, dur: 0.2 })
  ctx.cue(b(2.1), 'tick')

  // שלום flicks out the way it reads, accelerating into 3.0 so it is gone on
  // the beat; 3.0 the headline bar zips in on the empty line; 3.25 नमस्ते
  // hangs from it. Started on 3.0 as well, the exit let the bar paint an
  // overline across the still-white Hebrew for three frames.
  tl.fromTo(he.node, { x: 0 }, { x: -1400, duration: b(0.25), ease: E.cut, ...once }, b(2.75))
  hide(heWrap, b(3))
  show([hiWrap, barPath], b(3))
  tl.fromTo(
    barPath,
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: b(0.5), ease: E.snap },
    b(3),
  )
  tl.fromTo(hi.node, { yPercent: -100 }, { yPercent: 0, duration: b(0.5), ease: E.snap }, b(3.25))
  // The frame it lands the drawn bar goes, and the clip edge lifts off the
  // headline so the marks above it (the e-matra of ते) grow up out of the
  // bar as the follow-through, rather than appearing whole on one frame.
  hide(barPath, b(3.75))
  tl.fromTo(
    hiWrap,
    { clipPath: 'inset(423px 0px 0px 0px)' },
    { clipPath: `inset(${bar.top}px 0px 0px 0px)`, duration: b(0.25), ease: E.snap, ...once },
    b(3.75),
  )
  ctx.cue(b(3), 'zip', { dur: 0.25, gain: 0.6 })
  ctx.cue(b(3.2), 'thunk', { note: 'D2', gain: 0.35 })

  // 3.75 guides retract to the right.
  tl.fromTo(
    guides,
    { drawSVG: '0% 100%' },
    { drawSVG: '100% 100%', duration: b(0.25), ease: E.cut, ...once },
    b(3.75),
  )

  // 4.0 HARD CUT to white. Hangul stamps in on 32nds, dead stops.
  ctx.ground(WHITE, b(4))
  hide(hiWrap, b(4))
  tl.set(ann, { color: C.muted }, b(4))
  show(ko.row, b(4))
  const notes = ['D5', 'E5', 'F#5', 'A5', 'B5']
  ko.cells.forEach((cell, i) => {
    const at = b(4 + i / 8)
    tl.set(cell, { autoAlpha: 0 }, 0)
    show(cell, at)
    tl.fromTo(cell, { scale: 1.3 }, { scale: 1, duration: b(0.1), ease: E.cut }, at)
    ctx.cue(at, 'pluck', { note: notes[i], gain: 0.6 })
  })

  // 5.0 THE QUARTER TURN: a counter-turn, then 90° clockwise, accelerating
  // into the cut. The trails are the same turn evaluated 1, 2, 3 frames late.
  const turn = (target, lag) => {
    tl.fromTo(
      target,
      { rotation: 0 },
      { rotation: -5, duration: b(0.125), ease: E.lift },
      b(5) + lag,
    )
    tl.fromTo(
      target,
      { rotation: -5 },
      { rotation: 90, duration: b(0.875), ease: E.cut, ...once },
      b(5.125) + lag,
    )
  }
  turn(ko.row, 0)
  for (const trail of trails) {
    turn(trail.row, trail.lag)
    tl.set(trail.row, { autoAlpha: trail.opacity }, b(5.5))
    hide(trail.row, b(6))
  }
  hide(ko.row, b(6))
  ctx.cue(b(5), 'riser', { dur: b(1), gain: 0.6 })

  // 6.0 HARD CUT to ink, a match on shape: the column fills the same box.
  ctx.ground(C.deep, b(6))
  tl.set(ann, { color: C.faint }, b(6))
  show(ja, b(6))
  kana.forEach((inner, i) => {
    tl.fromTo(inner, { yPercent: -100 }, { yPercent: 0, duration: 0.2, ease: E.snap }, b(6 + i / 8))
    ctx.cue(b(6 + i / 8), 'tick', { gain: 0.5 })
  })
  ctx.cue(b(6), 'thunk', { gain: 0.8 })

  // 6.75 the column crouches into its centre. 7.0 你好 cuts in over it at
  // 1.5 and slams down to 1 in a 32nd: the cut-in is the hit the kick lands
  // on, the dead stop a 32nd later is where the shake starts.
  tl.fromTo(ja, { scaleY: 1 }, { scaleY: 0.15, duration: b(0.25), ease: E.cut }, b(6.75))
  hide(ja, b(7))
  show(zhWrap, b(7))
  tl.fromTo(zhWrap, { scale: 1.5 }, { scale: 1, duration: b(0.125), ease: E.cut }, b(7))
  ctx.cue(b(7), 'impact', { gain: 0.9 })

  // x = 14·e^(-t/0.08)·sin(2π·18·t) from the landing, cut off on its eighth
  // zero crossing (t = 8/36 s, beat 7.57) so it ends without a jump and the
  // outgoing still from 7.6 is exactly 03-grid's first frame.
  const SHAKE_FROM = b(7.125)
  const SHAKE_TO = SHAKE_FROM + 8 / 36
  ctx.draw((t) => {
    const s = t - SHAKE_FROM
    const x = s > 0 && t < SHAKE_TO ? 14 * Math.exp(-s / 0.08) * Math.sin(2 * Math.PI * 18 * s) : 0
    world.style.transform = x ? `translate3d(${x.toFixed(2)}px, 0px, 0px)` : ''
  })

  /* ---------------------------------------------------- annotation rolls */

  // Each state lists when it lands, its text and where the arrow points.
  const states = [
    [0, 'PT · LATIN', 0],
    [b(0.25), 'RU · CYRILLIC', 0],
    [b(1.25), 'EL · GREEK', 0],
    [b(2), 'HE · HEBREW', 180],
    [b(3), 'HI · DEVANAGARI', 360],
    [b(4), 'KO · HANGUL', 360],
    [b(6), 'JA · KANA', 450],
    [b(7), 'ZH · HAN', 360],
  ]
  let live = []
  let rot = 0
  states.forEach(([at, str, angle], si) => {
    const xs = annX(str)
    const next = []
    let k = 0
    let last = at
    for (let i = 0; i < Math.max(live.length, str.length); i++) {
      const old = live[i]
      const ch = str[i]
      if (old && old.ch === ch && Math.abs(old.x - xs[i]) < 0.5) {
        next[i] = old
        continue
      }
      const when = at + k * b(1 / 32)
      let changed = false
      if (old && old.inner) {
        tl.fromTo(
          old.inner,
          { yPercent: 0 },
          { yPercent: -100, duration: 0.06, ease: E.pop, ...once },
          when,
        )
        changed = true
      }
      if (ch !== undefined) {
        const inner = ch === ' ' ? null : glyph(ch, xs[i])
        if (inner && si > 0) {
          tl.fromTo(inner, { yPercent: 100 }, { yPercent: 0, duration: 0.06, ease: E.pop }, when)
          changed = true
        }
        next[i] = { ch, x: xs[i], inner }
      }
      if (changed) {
        last = when
        k++
      }
    }
    live = next
    if (si === 0) return
    // Growing, the arrow gets out of the way first; shrinking, it waits for
    // the last letter to start rolling out, or it slides over letters that
    // are still there ('EL · GREEK →C').
    const dx = arrowAt(str) - arrowHome
    const prevDx = arrowAt(states[si - 1][1]) - arrowHome
    tl.to(annArrow, { x: dx, duration: 0.2, ease: E.snap }, dx < prevDx ? last : at)
    if (angle !== rot) {
      tl.fromTo(
        annArrow,
        { rotation: rot },
        { rotation: angle, duration: 0.2, ease: E.glide, ...once },
        at,
      )
      rot = angle
    }
  })
})
