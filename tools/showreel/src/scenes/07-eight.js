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
 *
 * Portrait: the same beats, restacked for a frame 1080 wide. The manifesto is
 * set at the size that fits 'Open source.' between x=96 and the right safe
 * edge, on a wider line pitch that centres the block in the tall frame. The
 * block sits at the height that keeps each stop's fall inside the distance a
 * dot can cover at terminal speed, so the stops keep their beats and their
 * speed cap; below that floor there is room to show them leave, so they fall
 * on out of the frame instead of vanishing. The roll is sized so Teşekkürler
 * fits the same width, centred on (540,960), with the tab row under it on a
 * tighter pitch; the bar then has almost exactly the wide cut's distance to
 * travel to the centre.
 */
REEL.scene('07-eight', (ctx) => {
  const { tl, b, E, C, F, CUT, W, H, CX, CY } = ctx
  const P = ctx.portrait
  const BEAT = ctx.BEAT
  const ez = (e) => gsap.parseEase(e)
  const eSnap = ez(E.snap)
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
  ctx.svg('rect', { x: 0, y: 0, width: W, height: H, fill: C.deep }, layer)

  /* ------------------------------------------------------------ manifesto */

  // Portrait: 144 px puts 'Open source.' (1019 px of ink at 170) on x 96-960.
  // The pitch and the floor are held to the fall budget in the stops' comment.
  const M_SIZE = P ? 144 : 170
  const M_LEFT = P ? 96 : 200
  const M_B = P ? [720, 940, 1160] : [360, 560, 760]
  const FLOOR = P ? 1440 : 1040
  const MF = { family: F.display, weight: 900, size: M_SIZE, spacing: -0.02 * M_SIZE }
  const mFont = `900 ${M_SIZE}px ${F.display}`
  const LINES = [
    { str: 'No ads', B: M_B[0] },
    { str: 'Real people', B: M_B[1] },
    { str: 'Open source', B: M_B[2] },
  ]
  let asc = 0
  let desc = 0
  for (const line of LINES) {
    const m = ink(`${line.str}.`, mFont, MF.spacing)
    line.x = M_LEFT + m.l // ink left edge on M_LEFT
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
      width: W,
      height: maskH + EXIT_CROUCH + STRETCH_ROOM,
    })
    const wrap = group(manifesto, { 'clip-path': mask.url })
    line.squash = group(wrap)
    line.text = text(line.squash, line.str, { ...MF, x: line.x, y: line.B, fill: C.white })
    line.stop = ctx.svg('tspan', { text: '.' }, line.text)
    gsap.set(line.squash, { svgOrigin: `${M_LEFT} ${line.B}` })
  }

  /* The full stops, as free glyphs that take over from the inline ones at 3.0. */
  const dotInk = ink('.', mFont, 0)
  // Sideways drift in px/s, fanning out from left to right. 'Real people.' ends
  // just short of 'Open source.', so its stop sits a few dozen px left of the
  // last one: the middle stop drifts left and the last one right, or the two
  // close on each other and land as one blob.
  const DRIFT = [-150, -300, 280]
  // A 'cut' fall into the landing peaked at 6700-8000 px/s: a 33 px dot jumping
  // 120-165 px on its last frame, which strobes whatever the stretch. The fall
  // is gravity up to a terminal speed instead, then a straight drop at it, so a
  // dot moves at most 56 px a frame (66 at its centre into the landing squash):
  // under the 4000 px/s tracking cap, and still landing on its beat. The
  // accelerating phase is sized so the fall covers its distance exactly.
  // That only works for a drop between TERMINAL * fallT / 2 and TERMINAL *
  // fallT: 420-840, 315-630 and 210-420 px for the three stops. Wide's are
  // about 678, 478 and 278; portrait's baselines and floor give 718, 498, 278.
  const TERMINAL = 3360
  // The hop is 60 * 4w(1 - w) px over w = 0..1 (3/16 of a beat). Portrait runs
  // it on past w = 1 until its fall reaches TERMINAL, at HOP_WT, HOP_DT px
  // below the floor.
  const HOP_S = 0.1875 * BEAT
  const HOP_V = 240 / HOP_S
  const HOP_WT = (TERMINAL / HOP_V + 1) / 2
  const HOP_DT = 240 * HOP_WT * (HOP_WT - 1)
  const DOT_H = dotInk.a + dotInk.d
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
    const d0 = 3 + 0.125 * i
    const floor = FLOOR - (line.B + dotInk.d)
    const fallT = (3.5 - d0) * BEAT
    return {
      el,
      line,
      d0,
      bx: px + (dotInk.r - dotInk.l) / 2,
      by: line.B + dotInk.d,
      floor,
      vx: DRIFT[i],
      // floor = TERMINAL * (fallT - ta / 2): the time spent accelerating.
      ta: 2 * (fallT - floor / TERMINAL),
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
  // Portrait: 156 px fits Teşekkürler (1070 px of ink at 200) inside x 123-957,
  // clear of the right safe edge; the window and the exit scale with it.
  const WORD_SIZE = P ? 156 : 200
  const WIN = P ? { x0: 60, x1: 1020, y: CY - 102, h: 204 } : { x0: 260, x1: 1660, y: 410, h: 260 }
  const WORD_EXIT = P ? -220 : -280
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
  // Portrait: eight 105 px tabs centred on x=540 span 120-960, the safe width.
  const CODE_X0 = P ? CX - 3.5 * 105 : 435
  const CODE_PITCH = P ? 105 : 150
  const CODE_B = P ? CY + 280 : 860
  const codes = LANGS.map((lang, i) => {
    const str = lang.toUpperCase()
    const m = ink(str, cFont, CODE.spacing)
    const cx = CODE_X0 + CODE_PITCH * i
    const half = (m.l + m.r) / 2
    return { str, x: cx - (m.r - m.l) / 2, left: cx - half, right: cx + half, copies: [] }
  })
  const codeMask = clip('rect', { x: 0, y: CODE_B - 34, width: W, height: 46 })
  const CODE_DROP = 44

  const PALETTES = [
    { word: C.white, idle: C.faint, active: C.white },
    { word: C.ink, idle: C.muted, active: C.ink },
  ]
  const sweepClip = clip('polygon', { points: '0,0 0,0 0,0' })
  const eightDark = group(layer)
  const eightLight = group(layer, { 'clip-path': sweepClip.url })
  ctx.svg('rect', { x: 0, y: 0, width: W, height: H, fill: C.white }, eightLight)

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
      c.copies.push(text(row, c.str, { ...CODE, x: c.x, y: CODE_B, fill: pal.idle }))
    }
  })

  /*
   * Words are centred on the stage's centre by measured ink: horizontally per
   * word; a shared baseline for the Latin and Cyrillic words (their cap height
   * centred on it) so the roll does not bob; the Arabic by its own ink box. Redone
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
        x = CX - (m.r - m.l) / 2
        y = CY + (m.a - m.d) / 2
      } else {
        const m = ink(w.str, wFontOf(w), w.spacing)
        x = CX - (m.r - m.l) / 2
        y = CY + cap / 2
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
  tl.to(last.exits, { y: WORD_EXIT, duration: b(0.5), ease: E.cut }, b(8))

  /* --------------------------------------------------------- the tab bar */

  const bar = ctx.svg(
    'line',
    { stroke: C.yellow, 'stroke-width': 8, 'stroke-linecap': 'butt', visibility: 'hidden' },
    layer,
  )
  const S = { x1: codes[0].left, x2: codes[0].left, y: CODE_B + 28, rot: 0, w: 8 }
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
    { x1: CX - 1300, x2: CX + 1300, y: CY, rot: -33, w: 4, duration: b(0.875), ease: E.whip },
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
  const SWEEP_TO = P ? 2210 : 1962 // (1920,1080)·n is 1951.5, (1080,1920)·n 2198.5

  ctx.draw((t) => {
    const tb = t / BEAT

    if (!wordsLaid && fontsIn()) {
      wordsLaid = true
      layoutWords()
    }

    // The full stops: a pop as they let go, a fall to terminal speed with
    // speed-stretch, one closed-form hop off FLOOR with a squash released on
    // 'spring', and the same parabola carries them out through the bottom of
    // the frame.
    for (const d of dots) {
      attr(d.line.stop, 'fill-opacity', tb < d.d0 ? '1' : '0')
      if (tb < d.d0 || tb >= (P ? 4.5 : 3.75)) {
        attr(d.el, 'visibility', 'hidden')
        continue
      }
      let dy
      let sx
      let sy
      if (tb < 3.5) {
        const since = (tb - d.d0) * BEAT
        const pop = 1 + 0.3 * Math.sin(Math.PI * clamp01((tb - d.d0) / 0.125))
        // k is the speed as a fraction of TERMINAL, so the stretch peaks with it.
        const k = Math.min(1, since / d.ta)
        dy = since < d.ta ? (TERMINAL * since * since) / (2 * d.ta) : TERMINAL * (since - d.ta / 2)
        sy = pop * (1 + 0.2 * k)
        sx = pop * (1 - 0.08 * k)
      } else {
        const w = (tb - 3.5) / 0.1875
        dy = d.floor - 60 * 4 * w * (1 - w)
        sy = 0.62 + 0.38 * eSpring(clamp01((tb - 3.5) / 0.25))
        sx = 1 + (1 - sy) * 0.9
        if (P && w > 1) {
          // Portrait's floor is 480 px above the frame's bottom edge: past the
          // hop the parabola runs on until it reaches terminal speed, then the
          // dot drops straight out at it, stretching with the speed as it fell in.
          if (w > HOP_WT) dy = d.floor + HOP_DT + TERMINAL * (w - HOP_WT) * HOP_S
          const k = Math.min(1, (HOP_V * (2 * w - 1)) / TERMINAL)
          sy *= 1 + 0.2 * k
          sx *= 1 - 0.08 * k
        }
      }
      // Wide hides the stops on 3.75, already below the frame; portrait when they have left it.
      if (P && d.by + dy - DOT_H * sy > H) {
        attr(d.el, 'visibility', 'hidden')
        continue
      }
      attr(d.el, 'visibility', 'visible')
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
  // The score is the same in both cuts, so portrait pans each pop where the
  // wide cut's stop sits: 170 px type from x=200, as measured above.
  function widePan(line) {
    const font = `900 170px ${F.display}`
    const left = 200 + ink(`${line.str}.`, font, -3.4).l
    const advance = probe.measureText(line.str).width // same font and tracking as that ink()
    const dot = ink('.', font, 0)
    return (left + advance + (dot.r - dot.l) / 2 - 960) / 960
  }
  dots.forEach((d, i) => {
    const pan = P ? widePan(d.line) : (d.bx - 960) / 960
    ctx.cue(b(d.d0), 'pop', { note: ['A5', 'B5', 'C#6'][i], gain: 0.5, pan })
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
