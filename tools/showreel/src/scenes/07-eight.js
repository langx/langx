/*
 * 07-eight — the manifesto, then "thank you" in the app's eight interface
 * languages, and the yellow tab bar that turns into the Cut.
 *
 * One SVG layer. Anything that is a function of several overlapping clocks —
 * the falling full stops, the word wipes (each word is clipped by its own
 * edge AND the next word's), the theme sweep, the tab bar — is written by one
 * draw function from the local time or from a proxy the timeline tweens, so a
 * seek in either direction lands on the same frame. Plain one-clock moves
 * (line rises, exits, code drops) are ordinary timeline tweens.
 *
 * The light theme is a second, complete palette copy of the Eight, stacked
 * above the dark one with its own white ground and clipped to the half-plane
 * behind a Cut-parallel edge. The dark copy underneath is its complement, so
 * a word straddling the edge changes colour exactly on it.
 */
REEL.scene('07-eight', (ctx) => {
  const { tl, b, E, C, F, CUT } = ctx
  const BEAT = ctx.BEAT
  const ez = (e) => gsap.parseEase(e)
  const eSnap = ez(E.snap)
  const eCut = ez(E.cut)
  const eWhip = ez(E.whip)
  const eSpring = ez(E.spring)
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
  const rad = (deg) => (deg * Math.PI) / 180

  const layer = ctx.svgLayer()
  const defs = ctx.svg('defs', {}, layer)
  let clipCount = 0
  function clip(shape, attrs) {
    const id = `s07-clip-${clipCount++}`
    const cp = ctx.svg('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs)
    return { url: `url(#${id})`, shape: ctx.svg(shape, attrs, cp) }
  }
  const group = (parent, attrs) => ctx.svg('g', attrs || {}, parent)

  /* Ink boxes come from canvas metrics: SVG's getBBox gives advance boxes, not ink. */
  const probe = document.createElement('canvas').getContext('2d')
  function ink(str, font, spacing, align, dir) {
    probe.font = font
    probe.letterSpacing = `${spacing || 0}px`
    probe.textAlign = align || 'left'
    probe.direction = dir || 'ltr'
    const m = probe.measureText(str)
    return {
      l: m.actualBoundingBoxLeft,
      r: m.actualBoundingBoxRight,
      a: m.actualBoundingBoxAscent,
      d: m.actualBoundingBoxDescent,
    }
  }
  function text(parent, str, o) {
    const t = ctx.svg('text', { x: o.x || 0, y: o.y || 0, fill: o.fill }, parent)
    if (o.anchor) t.setAttribute('text-anchor', o.anchor)
    if (o.dir) t.setAttribute('direction', o.dir)
    Object.assign(t.style, {
      fontFamily: o.family,
      fontWeight: String(o.weight),
      fontSize: `${o.size}px`,
      letterSpacing: `${o.spacing || 0}px`,
    })
    t.textContent = str
    return t
  }

  /* The scene's own dark ground: during the sweep back to dark the stage ground is still white. */
  ctx.svg('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.deep }, layer)

  /* ------------------------------------------------------------ manifesto */

  const MF = { family: F.display, weight: 900, size: 170, spacing: -0.02 * 170 }
  const mFont = `900 170px ${F.display}`
  const LINES = [
    { str: 'No ads', B: 360 },
    { str: 'Nothing sold', B: 560 },
    { str: 'Open source', B: 760 },
  ]
  let asc = 0
  let desc = 0
  for (const line of LINES) {
    const m = ink(`${line.str}.`, mFont, MF.spacing)
    line.x = 200 + m.l // ink left edge on x=200
    asc = Math.max(asc, m.a)
    desc = Math.max(desc, m.d)
  }
  const maskH = asc + desc + 12
  const hideY = maskH * 1.05 // yPercent 105 of the line's mask
  // The mask reaches EXIT_CROUCH further down than the line needs, so the crouch
  // before each exit does not shave the descenders of 'g' and 'p' flat. hideY
  // still clears it: a rising line's tallest ascender starts below that edge.
  const EXIT_CROUCH = 12
  // The rises peak near 4500 px/s on the frame before their dead stop, over the
  // tracking cap, so they speed-stretch vertically (about the baseline) into the
  // landing squash. The mask's top edge sits STRETCH_ROOM higher so the stretched
  // ascenders are not shaved flat; a rising line still starts below the mask and
  // an exiting one still clears its top.
  const STRETCH = 1.08
  const STRETCH_ROOM = 8

  const manifesto = group(layer)
  for (const line of LINES) {
    const mask = clip('rect', {
      x: 0,
      y: line.B - asc - 6 - STRETCH_ROOM,
      width: 1920,
      height: maskH + EXIT_CROUCH + STRETCH_ROOM,
    })
    const wrap = group(manifesto, { 'clip-path': mask.url })
    line.squash = group(wrap)
    line.text = text(line.squash, line.str, { ...MF, x: line.x, y: line.B, fill: C.white })
    line.stop = ctx.svg('tspan', { text: '.' }, line.text)
    gsap.set(line.squash, { svgOrigin: `200 ${line.B}` })
  }

  /* The full stops, as free glyphs that take over from the inline ones at 3.0. */
  const dotInk = ink('.', mFont, 0)
  // Sideways drift in px/s. The last two stops start 40 px apart, so they part
  // in opposite directions rather than landing on each other.
  const DRIFT = [150, 190, -170]
  const dots = LINES.map((line, i) => {
    let px
    try {
      px = line.text.getStartPositionOfChar(line.str.length).x
    } catch {
      probe.font = mFont
      probe.letterSpacing = `${MF.spacing}px`
      px = line.x + probe.measureText(line.str).width
    }
    const el = text(manifesto, '.', { ...MF, spacing: 0, x: px, y: line.B, fill: C.white })
    el.style.visibility = 'hidden'
    return {
      el,
      line,
      d0: 3 + 0.125 * i,
      bx: px + (dotInk.r - dotInk.l) / 2,
      by: line.B + dotInk.d,
      floor: 1040 - (line.B + dotInk.d),
      vx: DRIFT[i],
    }
  })

  // 0.0: the hard cut is itself the first slam.
  tl.fromTo(LINES[0].squash, { scale: 1.08 }, { scale: 1, duration: 0.12, ease: E.snap }, 0)

  // 0.75 and 1.75: rise through the line mask into a dead stop on the beat, stretching with
  // the speed, then a squash released on 'spring'.
  ;[1, 2].forEach((k) => {
    const line = LINES[k]
    tl.fromTo(line.text, { y: hideY }, { y: 0, duration: b(0.25), ease: E.cut }, b(k - 0.25))
    tl.fromTo(
      line.squash,
      { scaleY: 1 },
      { scaleY: STRETCH, duration: b(0.25), ease: E.cut, immediateRender: false },
      b(k - 0.25),
    )
    tl.to(line.squash, { scaleY: 0.93, scaleX: 1.02, duration: 1 / 30, ease: 'none' }, b(k))
    tl.to(line.squash, { scaleY: 1, scaleX: 1, duration: 0.35, ease: E.spring }, b(k) + 1 / 30)
  })

  // 3.5-4.0: exits up through the masks, bottom line first, each after a small crouch.
  ;[2, 1, 0].forEach((k, j) => {
    const at = 3.5 + 0.125 * j
    tl.to(LINES[k].text, { y: EXIT_CROUCH, duration: b(0.125), ease: E.lift }, b(at - 0.125))
    tl.to(LINES[k].text, { y: -hideY, duration: b(0.25), ease: E.cut }, b(at))
  })

  /* ------------------------------------------------------------ the eight */

  const LANGS = ['en', 'tr', 'es', 'de', 'fr', 'ru', 'ar', 'pt']
  const WORD_SIZE = 200
  const WIN = { x0: 260, x1: 1660, y: 410, h: 260 }
  const words = LANGS.map((lang, i) => {
    const w = ctx.TL[lang]
    const rtl = w.dir === 'rtl'
    return {
      lang,
      str: w.text,
      rtl,
      family: w.font,
      spacing: rtl ? 0 : -0.02 * WORD_SIZE, // tracking would tear the Arabic joins
      at: 4 + 0.5 * i,
      clip: clip('rect', { x: WIN.x0, y: WIN.y, width: 0, height: WIN.h }),
      copies: [],
      exits: [],
    }
  })

  const CODE = { family: F.display, weight: 800, size: 30, spacing: 0.14 * 30 }
  const cFont = `800 30px ${F.display}`
  const codes = LANGS.map((lang, i) => {
    const str = lang.toUpperCase()
    const m = ink(str, cFont, CODE.spacing)
    const cx = 435 + 150 * i
    const half = (m.l + m.r) / 2
    return { str, x: cx - (m.r - m.l) / 2, left: cx - half, right: cx + half, copies: [] }
  })
  const codeMask = clip('rect', { x: 0, y: 826, width: 1920, height: 46 })
  const CODE_DROP = 44

  const PALETTES = [
    { word: C.white, idle: C.faint, active: C.white },
    { word: C.ink, idle: C.muted, active: C.ink },
  ]
  const sweepClip = clip('polygon', { points: '0,0 0,0 0,0' })
  const eightDark = group(layer)
  const eightLight = group(layer, { 'clip-path': sweepClip.url })
  ctx.svg('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.white }, eightLight)

  ;[eightDark, eightLight].forEach((parent, p) => {
    const pal = PALETTES[p]
    for (const w of words) {
      const exit = group(group(parent, { 'clip-path': w.clip.url }))
      const t = text(exit, w.str, {
        family: w.family,
        weight: 800,
        size: WORD_SIZE,
        spacing: w.spacing,
        fill: pal.word,
        anchor: w.rtl ? 'middle' : 'start',
        dir: w.rtl ? 'rtl' : null,
      })
      w.copies.push(t)
      w.exits.push(exit)
    }
    const row = group(parent, { 'clip-path': codeMask.url })
    for (const c of codes) {
      c.copies.push(text(row, c.str, { ...CODE, x: c.x, y: 860, fill: pal.idle }))
    }
  })

  /*
   * Words are centred on (960,540) by measured ink: horizontally per word; a
   * shared baseline for the Latin and Cyrillic words (their cap height centred
   * on 540) so the roll does not bob; the Arabic by its own ink box. Redone
   * once the Latin Extended face (the ş of Teşekkürler) has arrived: the boot
   * probes do not load it.
   */
  const wFontOf = (w) => `800 ${WORD_SIZE}px ${w.family}`
  function layoutWords() {
    const cap = ink('H', `800 ${WORD_SIZE}px ${F.display}`, 0).a
    for (const w of words) {
      let x
      let y
      if (w.rtl) {
        const m = ink(w.str, wFontOf(w), 0, 'center', 'rtl')
        x = 960 - (m.r - m.l) / 2
        y = 540 + (m.a - m.d) / 2
      } else {
        const m = ink(w.str, wFontOf(w), w.spacing)
        x = 960 - (m.r - m.l) / 2
        y = 540 + cap / 2
      }
      for (const t of w.copies) {
        t.setAttribute('x', x.toFixed(2))
        t.setAttribute('y', y.toFixed(2))
      }
    }
  }
  const fontsIn = () => document.fonts.check(`800 ${WORD_SIZE}px Nunito`, 'Teşekkürler')
  let wordsLaid = fontsIn()
  if (!wordsLaid) document.fonts.load(`800 ${WORD_SIZE}px Nunito`, 'Teşekkürler').catch(() => null)
  layoutWords()

  // Codes rise into place just before the roll starts, 1/32-beat ripple from EN.
  const CODE_DUR = 0.5 - 7 / 32
  codes.forEach((c, i) => {
    tl.fromTo(
      c.copies,
      { y: CODE_DROP },
      { y: 0, duration: b(CODE_DUR), ease: E.cut },
      b(3.5 + i / 32),
    )
    tl.to(c.copies, { y: CODE_DROP, duration: b(CODE_DUR), ease: E.cut }, b(8 + i / 32))
  })

  // 8.0-8.5: Obrigado leaves up through the window, after a small crouch.
  const last = words[words.length - 1]
  tl.to(last.exits, { y: 14, duration: b(0.125), ease: E.lift }, b(7.875))
  tl.to(last.exits, { y: -280, duration: b(0.5), ease: E.cut }, b(8))

  /* --------------------------------------------------------- the tab bar */

  const bar = ctx.svg(
    'line',
    { stroke: C.yellow, 'stroke-width': 8, 'stroke-linecap': 'butt', visibility: 'hidden' },
    layer,
  )
  const S = { x1: codes[0].left, x2: codes[0].left, y: 888, rot: 0, w: 8 }
  tl.to(S, { x2: codes[0].right, duration: 0.1, ease: E.snap }, b(4))
  for (let i = 1; i < codes.length; i++) {
    // Caterpillar: the leading edge goes first and fast, the trailing edge follows.
    tl.to(S, { x2: codes[i].right, duration: 0.1, ease: E.snap }, b(4 + 0.5 * i))
    tl.to(S, { x1: codes[i].left, duration: 0.18, ease: E.snap }, b(4 + 0.5 * i + 1 / 16))
  }
  const pt = codes[codes.length - 1]
  const ptW = pt.right - pt.left
  // 9.0: anticipation, scaleX 0.9 about its centre.
  tl.to(
    S,
    { x1: pt.left + 0.05 * ptW, x2: pt.right - 0.05 * ptW, duration: b(0.125), ease: E.lift },
    b(9),
  )
  // 9.125-10.0: it turns -33°, stretches to 2600, thins to 4 and travels to the stage centre: the Cut.
  tl.to(
    S,
    { x1: 960 - 1300, x2: 960 + 1300, y: 540, rot: -33, w: 4, duration: b(0.875), ease: E.whip },
    b(9.125),
  )

  /* ---------------------------------------------------------- the grounds */

  ctx.ground(C.white, b(5.5))
  ctx.ground(C.deep, b(7.5))

  /* ----------------------------------------------------------------- draw */

  const cache = new Map()
  function attr(el, name, value) {
    let m = cache.get(el)
    if (!m) cache.set(el, (m = {}))
    if (m[name] !== value) {
      m[name] = value
      if (name === 'visibility') el.style.visibility = value
      else el.setAttribute(name, value)
    }
  }
  const f2 = (n) => n.toFixed(2)
  const [nx, ny] = CUT.n
  const [ux, uy] = CUT.dUp
  const SWEEP_FROM = -10
  const SWEEP_TO = 1962 // (1920,1080)·n is 1951.5

  ctx.draw((t) => {
    const tb = t / BEAT

    if (!wordsLaid && fontsIn()) {
      wordsLaid = true
      layoutWords()
    }

    // The full stops: a pop as they let go, a 'cut' fall with speed-stretch,
    // one closed-form hop off y=1040 with a squash released on 'spring', and
    // the same parabola carries them out through the bottom of the frame.
    for (const d of dots) {
      attr(d.line.stop, 'fill-opacity', tb < d.d0 ? '1' : '0')
      if (tb < d.d0 || tb >= 3.75) {
        attr(d.el, 'visibility', 'hidden')
        continue
      }
      attr(d.el, 'visibility', 'visible')
      let dy
      let sx
      let sy
      if (tb < 3.5) {
        const u = (tb - d.d0) / (3.5 - d.d0)
        const pop = 1 + 0.3 * Math.sin(Math.PI * clamp01((tb - d.d0) / 0.125))
        dy = eCut(u) * d.floor
        sy = pop * (1 + 0.2 * u * u)
        sx = pop * (1 - 0.08 * u * u)
      } else {
        const w = (tb - 3.5) / 0.1875
        dy = d.floor - 60 * 4 * w * (1 - w)
        sy = 0.62 + 0.38 * eSpring(clamp01((tb - 3.5) / 0.25))
        sx = 1 + (1 - sy) * 0.9
      }
      const dx = d.vx * (tb - d.d0) * BEAT
      attr(
        d.el,
        'transform',
        `translate(${f2(d.bx + dx)} ${f2(d.by + dy)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${f2(-d.bx)} ${f2(-d.by)})`,
      )
    }

    // The roll: word i is behind its own wipe edge and ahead of word i+1's.
    const edge = (w) => {
      const p = eSnap(clamp01((t - b(w.at)) / 0.2))
      return { p, x: w.rtl ? WIN.x1 - (WIN.x1 - WIN.x0) * p : WIN.x0 + (WIN.x1 - WIN.x0) * p }
    }
    words.forEach((w, i) => {
      let lo = WIN.x0
      let hi = WIN.x0
      let slide = 0
      if (tb >= w.at && tb < 8.6) {
        const own = edge(w)
        if (w.rtl) {
          lo = own.x
          hi = WIN.x1
        } else {
          lo = WIN.x0
          hi = own.x
        }
        const next = words[i + 1]
        if (next && tb >= next.at) {
          const e = edge(next)
          if (next.rtl) hi = Math.min(hi, e.x)
          else lo = Math.max(lo, e.x)
        }
        slide = (1 - own.p) * 40 * (w.rtl ? 1 : -1)
      }
      const width = Math.max(0, hi - lo)
      attr(w.clip.shape, 'x', f2(lo))
      attr(w.clip.shape, 'width', f2(width))
      for (const c of w.copies) {
        attr(c, 'visibility', width > 0 ? 'visible' : 'hidden')
        attr(c, 'transform', `translate(${f2(slide)} 0)`)
      }
    })

    // The active code: white on dark, ink on light.
    const active = tb >= 4 ? Math.min(7, Math.floor((tb - 4) / 0.5)) : -1
    codes.forEach((c, i) => {
      c.copies.forEach((el, p) =>
        attr(el, 'fill', i === active ? PALETTES[p].active : PALETTES[p].idle),
      )
    })

    // The theme sweeps: the light copy's clip is the half-plane behind a Cut-parallel edge.
    let s = SWEEP_FROM
    if (tb >= 5 && tb < 7) s = SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * eWhip(clamp01((tb - 5) / 0.5))
    else if (tb >= 7 && tb < 7.5)
      s = SWEEP_TO + (SWEEP_FROM - SWEEP_TO) * eWhip(clamp01((tb - 7) / 0.5))
    attr(eightLight, 'visibility', s > SWEEP_FROM ? 'visible' : 'hidden')
    const ox = s * nx
    const oy = s * ny
    const corner = (a, k) => `${f2(ox + a * ux - k * nx)},${f2(oy + a * uy - k * ny)}`
    attr(
      sweepClip.shape,
      'points',
      `${corner(3000, 0)} ${corner(-3000, 0)} ${corner(-3000, 4000)} ${corner(3000, 4000)}`,
    )

    // The bar: two edges while it caterpillars, a centre, length and angle when it becomes the Cut.
    attr(bar, 'visibility', tb >= 4 ? 'visible' : 'hidden')
    const cx = (S.x1 + S.x2) / 2
    const half = (S.x2 - S.x1) / 2
    const th = rad(S.rot)
    const hx = half * Math.cos(th)
    const hy = half * Math.sin(th)
    attr(bar, 'x1', f2(cx - hx))
    attr(bar, 'y1', f2(S.y - hy))
    attr(bar, 'x2', f2(cx + hx))
    attr(bar, 'y2', f2(S.y + hy))
    attr(bar, 'stroke-width', f2(S.w))
  })

  /* ---------------------------------------------------------------- sound */

  ctx.cue(b(0), 'impact', { note: 'F#2' })
  ctx.cue(b(1), 'impact', { note: 'G2' })
  ctx.cue(b(2), 'impact', { note: 'A2' })
  dots.forEach((d, i) => {
    ctx.cue(b(d.d0), 'pop', { note: ['A5', 'B5', 'C#6'][i], gain: 0.5, pan: (d.bx - 960) / 960 })
  })
  ctx.cue(b(3.5), 'tick', { note: 'D6', gain: 0.35 })
  ctx.cue(b(3.5), 'swish', { gain: 0.5, dur: b(0.5) })
  const SCALE = ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6']
  codes.forEach((c, i) => {
    const pan = (435 + 150 * i - 960) / 960
    ctx.cue(b(4 + 0.5 * i), 'clack', { gain: 0.45, pan })
    ctx.cue(b(4 + 0.5 * i), 'tick', { note: SCALE[i], gain: 0.5, pan })
  })
  // The sweeps: each whoosh lasts exactly as long as its edge takes to cross,
  // and travels with it — top-left to bottom-right into light, back into dark.
  ctx.cue(b(5), 'whoosh', { note: 'D6', gain: 0.6, dur: b(0.5), pan: -0.6, panTo: 0.6 })
  ctx.cue(b(7), 'whoosh', { note: 'D3', gain: 0.6, dur: b(0.5), pan: 0.6, panTo: -0.6 })
  ctx.cue(b(8), 'swish', { gain: 0.5, dur: b(0.5) })
  ctx.cue(b(9), 'reverse', { gain: 0.6, dur: b(1) })
  ctx.cue(b(10), 'riser', { gain: 0.7, dur: b(1.75) })
})
