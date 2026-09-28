/*
 * 08 — Exchange. Drop 2 and the finale: the ink ground splits open along the
 * Cut onto the film's first yellow, two rivers of hellos stream on rails
 * parallel to it, bend at constant length into the two arc bands, trade places
 * in one 540° turn while the camera pulls back into the lockup, and lock on
 * the downbeat of bar 21. Then the wordmark, the tagline, one caret blink and
 * four beats of stillness.
 *
 * The turn group (rails, ink strokes) and its echo ghosts are driven from one
 * closed-form state function of local time rather than from tweens, because a
 * ghost is that same state evaluated 1/30, 2/30 and 3/30 s earlier. Everything
 * discrete — the plates, the ink draw, the lock, the letters — is on ctx.tl.
 */
REEL.scene('08-exchange', (ctx) => {
  const { tl, b, E, C, F, CUT, MARK, W, H, CX, CY, portrait } = ctx

  const ease = (e) => (typeof e === 'function' ? e : gsap.parseEase(e))
  const eSnap = ease(E.snap)
  const eCut = ease(E.cut)
  const eGlide = ease(E.glide)
  const eLift = ease(E.lift)
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
  const lerp = (a, z, p) => a + (z - a) * p
  const f3 = (v) => Math.round(v * 1000) / 1000

  const [nx, ny] = CUT.n
  const [ux, uy] = CUT.dUp
  /* The rails run along 147° in canvas units, which the 180° start turns into dUp on stage. */
  const dx = -ux
  const dy = -uy

  const RM = MARK.rm // 193.4, the arcs' centre line
  const LEN = Math.PI * RM // 607.6: a rail is exactly one half-circumference long
  const INK = MARK.stroke // 83.8
  /*
   * The 9:16 cut stacks the lockup instead: mark above, wordmark below it,
   * the tagline on two lines under that, all on x = 540 and the group a
   * little above the frame's middle. The camera then pulls straight up the
   * frame's axis into the mark. It opens at 1.9, not 1.4: that makes each
   * rail about as long as the frame is wide, so the hellos cross the whole
   * phone, while the bent bands' flat ends (±276 units from P) still clear
   * its sides.
   */
  const V = portrait && {
    S0: 1.9,
    markY: 668,
    markSize: 560,
    K: 0.375,
    wordBase: 1100,
    tagFont: 48,
    tagBases: [1222, 1288],
    tagLines: ['The friendly way to practise', 'a language with real people'],
  }
  const LOCK = portrait
    ? { x: CX, y: V.markY, S: V.markSize / 1024 }
    : { x: 401.3, y: 493.8, S: 480 / 1024 }
  const START = { x: CX, y: CY, S: portrait ? V.S0 : 1.4 }

  /* --------------------------------------------------------------- layers */

  const layer = ctx.svgLayer()
  const defs = ctx.svg('defs', {}, layer)

  // The hairline: the Cut through the current P, stage pixels, under everything.
  const hair = ctx.svg(
    'path',
    {
      d: `M${f3(-1300 * ux)} ${f3(-1300 * uy)}L${f3(1300 * ux)} ${f3(1300 * uy)}`,
      fill: 'none',
      stroke: C.onYellow,
      'stroke-width': 1.5,
      'stroke-linecap': 'butt',
    },
    layer,
  )

  // Echo ghosts of the two solid strokes, oldest first so the nearest sits on top.
  const inkBlackD = ctx.arcStroke(MARK.black.cx, MARK.black.cy, RM, 327, 147)
  const inkWhiteD = ctx.arcStroke(MARK.white.cx, MARK.white.cy, RM, 507, 327)
  const strokeAttrs = (color) => ({
    fill: 'none',
    stroke: color,
    'stroke-width': INK,
    'stroke-linecap': 'butt',
  })
  const GHOSTS = [
    { lag: 3 / 30, alpha: 0.06 },
    { lag: 2 / 30, alpha: 0.15 },
    { lag: 1 / 30, alpha: 0.3 },
  ].map((spec) => {
    const g = ctx.svg('g', { opacity: spec.alpha, visibility: 'hidden' }, layer)
    ctx.svg('path', Object.assign({ d: inkBlackD }, strokeAttrs('#000000')), g)
    ctx.svg('path', Object.assign({ d: inkWhiteD }, strokeAttrs('#ffffff')), g)
    return Object.assign({ g }, spec)
  })

  // The turn group: translate(P) rotate(ρ) scale(S) translate(-512,-512). No shadows.
  const turn = ctx.svg('g', {}, layer)
  const rails = ctx.svg('g', {}, turn)

  /*
   * A rail is an arc of fixed length LEN through its midpoint M, tangent to
   * the 147° direction there and bending toward its own arc centre (unit
   * normal u) with curvature k. Written as four cubics from closed-form points
   * so a nearly-straight rail never meets a huge-radius arc command.
   *
   * Its window is cut square to the rail at both ends, so a glyph that hangs
   * past an end is sliced there; bent into the band, the two cuts become the
   * arc's flat ends on the Cut.
   */
  function railShape(R, k) {
    const { mx, my, u0, u1 } = R
    const seg = LEN / 4
    const pos = (s) => {
      if (k < 1e-9) return [mx + dx * s, my + dy * s]
      const a = Math.sin(k * s) / k
      const c = (2 * Math.sin((k * s) / 2) ** 2) / k
      return [mx + dx * a + u0 * c, my + dy * a + u1 * c]
    }
    const tan = (s) => [
      dx * Math.cos(k * s) + u0 * Math.sin(k * s),
      dy * Math.cos(k * s) + u1 * Math.sin(k * s),
    ]
    const h = k < 1e-9 ? seg / 3 : ((4 / 3) * Math.tan((k * seg) / 4)) / k
    let s0 = -LEN / 2
    let p0 = pos(s0)
    let d = `M${f3(p0[0])} ${f3(p0[1])}`
    for (let i = 1; i <= 4; i++) {
      const s1 = -LEN / 2 + seg * i
      const p1 = pos(s1)
      const t0 = tan(s0)
      const t1 = tan(s1)
      d +=
        `C${f3(p0[0] + h * t0[0])} ${f3(p0[1] + h * t0[1])} ` +
        `${f3(p1[0] - h * t1[0])} ${f3(p1[1] - h * t1[1])} ${f3(p1[0])} ${f3(p1[1])}`
      s0 = s1
      p0 = p1
    }
    // The window: a big square around M, kept ahead of the start and behind the end.
    const far = 2000
    let poly = [
      [mx - far, my - far],
      [mx + far, my - far],
      [mx + far, my + far],
      [mx - far, my + far],
    ]
    const pS = pos(-LEN / 2)
    const tS = tan(-LEN / 2)
    const pE = pos(LEN / 2)
    const tE = tan(LEN / 2)
    poly = keep(poly, (p) => (p[0] - pS[0]) * tS[0] + (p[1] - pS[1]) * tS[1])
    poly = keep(poly, (p) => -((p[0] - pE[0]) * tE[0] + (p[1] - pE[1]) * tE[1]))
    return { d, points: poly.map((p) => `${f3(p[0])},${f3(p[1])}`).join(' ') }
  }

  /* One Sutherland–Hodgman pass: the part of a convex polygon where side(p) >= 0. */
  function keep(poly, side) {
    const out = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const z = poly[(i + 1) % poly.length]
      const sa = side(a)
      const sz = side(z)
      if (sa >= 0) out.push(a)
      if (sa >= 0 !== sz >= 0) {
        const f = sa / (sa - sz)
        out.push([a[0] + (z[0] - a[0]) * f, a[1] + (z[1] - a[1]) * f])
      }
    }
    return out
  }

  // Black rail midpoint: the black arc's centre line at 237°; bends toward +n.
  const RB = { mx: MARK.black.cx - RM * nx, my: MARK.black.cy - RM * ny, u0: nx, u1: ny }
  // White rail midpoint: the white arc's centre line at 57°; bends toward -n.
  const RW = { mx: MARK.white.cx + RM * nx, my: MARK.white.cy + RM * ny, u0: -nx, u1: -ny }

  const railParts = (R, id) => {
    const shape = railShape(R, 0)
    const path = ctx.svg('path', { id: `s8-rail-${id}`, d: shape.d }, defs)
    const clip = ctx.svg(
      'clipPath',
      { id: `s8-window-${id}`, clipPathUnits: 'userSpaceOnUse' },
      defs,
    )
    const win = ctx.svg('polygon', { points: shape.points }, clip)
    return { R, path, win }
  }
  const partsB = railParts(RB, 'black')
  const partsW = railParts(RW, 'white')

  const RAIL_SIZE = 67
  const railText = (fill, id) =>
    ctx.svg(
      'text',
      {
        'font-size': RAIL_SIZE,
        fill,
        'clip-path': `url(#s8-window-${id})`,
        'dominant-baseline': 'central',
        style: { whiteSpace: 'pre', fontKerning: 'normal' },
      },
      rails,
    )

  const textB = railText('#000000', 'black')
  const tpB = ctx.svg('textPath', { href: '#s8-rail-black' }, textB)
  const BLACK_RUN = 'Hello · Merhaba · Hola · Hallo · Bonjour · Привет · Olá · Ciao · '
  tpB.textContent = BLACK_RUN.repeat(4)
  Object.assign(textB.style, { fontFamily: F.display, fontWeight: '900' })

  const textW = railText('#ffffff', 'white')
  const tpW = ctx.svg('textPath', { href: '#s8-rail-white' }, textW)
  Object.assign(textW.style, { fontFamily: F.display, fontWeight: '800' })
  const WHITE_RUN = ['ja', 'ko', 'zh', 'hi', 'th', 'he', 'ar', 'el'].map((lang) => ctx.GL[lang])
  for (let r = 0; r < 4; r++) {
    for (const g of WHITE_RUN) {
      const word = ctx.svg('tspan', { text: g.text }, tpW)
      word.style.fontFamily = g.font
      word.style.fontWeight = '800'
      // Right-to-left words are isolated, so each keeps its own order inside the left-to-right run.
      if (g.dir === 'rtl') Object.assign(word.style, { direction: 'rtl', unicodeBidi: 'isolate' })
      ctx.svg('tspan', { text: ' · ' }, tpW)
    }
  }

  // Ink-in: butt-capped strokes as wide as the band, drawn along each rail's stream.
  const inkB = ctx.svg('path', Object.assign({ d: inkBlackD }, strokeAttrs('#000000')), turn)
  const inkW = ctx.svg('path', Object.assign({ d: inkWhiteD }, strokeAttrs('#ffffff')), turn)

  // The mark itself, which replaces the turn group on the lock frame.
  const m = ctx.mark(layer, { x: LOCK.x, y: LOCK.y, size: LOCK.S * 1024, shade: C.yellowShade })

  /* ------------------------------------------------------------ wordmark */

  const WORD = {
    L: 'M1368.064 696.9Q1343.16 696.9 1329.725 683.137Q1316.291 669.375 1316.291 645.127V285.334Q1316.291 259.775 1329.398 246.668Q1342.505 233.56 1367.409 233.56Q1391.657 233.56 1404.764 246.668Q1417.871 259.775 1417.871 285.334V611.048H1593.508Q1614.479 611.048 1625.948 622.189Q1637.417 633.33 1637.417 653.646Q1637.417 674.618 1625.948 685.759Q1614.479 696.9 1593.508 696.9Z',
    a: 'M1778.975 704.109Q1743.585 704.109 1715.405 690.346Q1687.224 676.584 1671.496 652.991Q1655.767 629.398 1655.767 599.907Q1655.767 564.517 1674.117 543.873Q1692.467 523.23 1733.755 514.382Q1775.043 505.535 1843.2 505.535H1877.934V556.653H1843.855Q1810.432 556.653 1789.788 560.257Q1769.144 563.862 1760.297 572.382Q1751.45 580.901 1751.45 595.975Q1751.45 614.325 1764.229 626.121Q1777.009 637.918 1801.257 637.918Q1820.262 637.918 1835.008 629.07Q1849.754 620.223 1858.273 604.822Q1866.793 589.421 1866.793 569.76V494.394Q1866.793 465.558 1853.686 453.434Q1840.579 441.31 1809.121 441.31Q1791.427 441.31 1770.783 445.569Q1750.139 449.829 1725.235 459.66Q1710.817 466.213 1699.676 462.609Q1688.535 459.004 1682.637 449.502Q1676.739 439.999 1676.739 428.53Q1676.739 417.061 1683.292 406.248Q1689.846 395.434 1704.919 390.192Q1735.721 377.74 1762.918 373.152Q1790.116 368.565 1813.053 368.565Q1863.516 368.565 1895.956 383.31Q1928.397 398.056 1944.781 428.53Q1961.165 459.004 1961.165 506.846V652.336Q1961.165 676.584 1949.368 689.691Q1937.572 702.798 1915.29 702.798Q1893.007 702.798 1880.883 689.691Q1868.759 676.584 1868.759 652.336V628.087L1873.347 632.019Q1869.414 654.302 1856.635 670.358Q1843.855 686.414 1824.195 695.262Q1804.534 704.109 1778.975 704.109Z',
    n: 'M2071.921 702.798Q2047.672 702.798 2034.893 689.691Q2022.113 676.584 2022.113 652.336V419.683Q2022.113 395.434 2034.893 382.655Q2047.672 369.875 2070.61 369.875Q2094.203 369.875 2106.655 382.655Q2119.107 395.434 2119.107 419.683V457.038L2111.898 435.411Q2126.971 403.299 2156.79 385.932Q2186.609 368.565 2224.62 368.565Q2263.286 368.565 2288.189 383.31Q2313.093 398.056 2325.545 427.875Q2337.997 457.694 2337.997 503.569V652.336Q2337.997 676.584 2325.217 689.691Q2312.438 702.798 2288.189 702.798Q2264.596 702.798 2251.817 689.691Q2239.037 676.584 2239.037 652.336V508.156Q2239.037 474.733 2226.913 459.987Q2214.789 445.242 2189.885 445.242Q2158.428 445.242 2139.75 464.903Q2121.073 484.563 2121.073 517.331V652.336Q2121.073 702.798 2071.921 702.798Z',
    g: 'M2553.61 822.074Q2518.221 822.074 2485.78 816.176Q2453.34 810.277 2428.436 798.481Q2413.363 791.927 2407.137 781.441Q2400.911 770.956 2401.894 759.159Q2402.877 747.363 2409.759 738.188Q2416.64 729.013 2427.126 725.408Q2437.612 721.804 2449.408 727.047Q2478.244 740.154 2502.82 744.086Q2527.396 748.018 2545.091 748.018Q2587.034 748.018 2608.005 729.013Q2628.977 710.007 2628.977 670.686V620.878H2634.875Q2625.044 651.025 2594.243 670.03Q2563.441 689.036 2526.085 689.036Q2482.831 689.036 2450.719 669.047Q2418.606 649.059 2400.911 612.686Q2383.217 576.314 2383.217 528.472Q2383.217 492.428 2393.375 462.936Q2403.533 433.445 2422.211 412.474Q2440.888 391.502 2467.43 380.033Q2493.972 368.565 2526.085 368.565Q2564.751 368.565 2594.57 387.242Q2624.389 405.92 2634.22 436.067L2627.666 457.038V419.683Q2627.666 395.434 2640.445 382.655Q2653.225 369.875 2676.818 369.875Q2700.411 369.875 2712.863 382.655Q2725.315 395.434 2725.315 419.683V659.544Q2725.315 740.154 2681.078 781.114Q2636.841 822.074 2553.61 822.074ZM2555.576 614.98Q2577.859 614.98 2593.915 604.494Q2609.971 594.008 2619.146 574.675Q2628.321 555.342 2628.321 528.472Q2628.321 487.84 2608.333 465.23Q2588.344 442.62 2555.576 442.62Q2533.294 442.62 2516.91 452.778Q2500.526 462.936 2491.679 482.27Q2482.831 501.603 2482.831 528.472Q2482.831 569.105 2502.492 592.042Q2522.153 614.98 2555.576 614.98Z',
    X: 'M2826.24 702.798Q2806.579 702.798 2793.8 691.985Q2781.02 681.171 2779.054 665.115Q2777.088 649.059 2789.54 632.019L2934.374 439.999V485.219L2795.438 300.407Q2782.986 282.712 2784.625 266.656Q2786.263 250.6 2799.043 239.786Q2811.822 228.973 2830.828 228.973Q2847.212 228.973 2859.336 236.837Q2871.46 244.702 2883.912 261.741L2992.046 411.163H2959.278L3066.757 261.741Q3079.209 244.046 3091.661 236.51Q3104.113 228.973 3120.497 228.973Q3140.157 228.973 3152.937 239.459Q3165.716 249.944 3167.355 266.001Q3168.993 282.057 3155.886 300.407L3016.294 485.219V439.999L3160.474 632.019Q3173.581 649.059 3171.942 665.115Q3170.304 681.171 3157.524 691.985Q3144.745 702.798 3124.429 702.798Q3108.7 702.798 3096.576 694.934Q3084.452 687.07 3071.345 669.375L2958.623 514.055H2992.046L2879.324 669.375Q2866.872 687.07 2854.42 694.934Q2841.969 702.798 2826.24 702.798Z',
  }
  // The wordmark's ink runs x 1316.291-3171.942 in these outlines and sits on y 696.9.
  const K = portrait ? V.K : 0.46875
  const WX = portrait ? f3(CX - ((1316.291 + 3171.942) / 2) * K) : 161.3
  const WY = portrait ? f3(V.wordBase - 696.9 * K) : 253.8
  const LOCKUP_T = portrait
    ? `translate(${WX} ${WY}) scale(${K})`
    : 'translate(161.3 253.8) scale(0.46875)'
  const letters = {}
  for (const key of ['L', 'a', 'n', 'g', 'X']) {
    const clipId = `s8-clip-${key}`
    const clip = ctx.svg('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' }, defs)
    const wrap = ctx.svg('g', { 'clip-path': `url(#${clipId})` }, layer)
    const mover = ctx.svg('g', {}, wrap)
    const rot = ctx.svg('g', {}, mover)
    const path = ctx.svg('path', { d: WORD[key], fill: C.ink, transform: LOCKUP_T }, rot)
    const bb = path.getBBox()
    const box = {
      x0: WX + bb.x * K,
      y0: WY + bb.y * K,
      x1: WX + (bb.x + bb.width) * K,
      y1: WY + (bb.y + bb.height) * K,
    }
    letters[key] = { clip, wrap, mover, rot, box }
  }

  /*
   * The X turns about its own centre, and its arms reach further than the gap
   * to the g: turned more than about 8° its lower arm sweeps through the g's
   * stem. So it turns inside its own cell, whose left wall stands midway
   * between the two letters' ink; the arm is sliced there instead of crossing
   * the g. At rest the X sits wholly inside it.
   */
  const cellX = (letters.g.box.x1 + letters.X.box.x0) / 2
  const cellClip = ctx.svg('clipPath', { id: 's8-cell-X', clipPathUnits: 'userSpaceOnUse' }, defs)
  ctx.svg('rect', { x: f3(cellX), y: 0, width: f3(W - cellX), height: H }, cellClip)
  ctx.svg('g', { 'clip-path': 'url(#s8-cell-X)' }, layer).appendChild(letters.X.wrap)

  /*
   * Each letter rises 60 px through a clip whose edge is parallel to the Cut.
   * A fixed edge cannot uncover a 217 px letter in a 60 px rise, so the edge
   * travels with it: it starts on the rising letter's top-left corner and
   * lands just past the resting letter's bottom-right one, on the same ease.
   * The letter shows corner-first, never drops below the baseline by more than
   * the rise, and moves at about 1000 px/s rather than the 5000 a floor-fixed
   * rise from a full letter-height below needed.
   */
  // The rise keeps its proportion to the letters in the smaller portrait wordmark.
  const RISE = portrait ? f3((60 * K) / 0.46875) : 60
  const XB = letters.X.box
  const X_CENTRE = portrait
    ? { x: f3((XB.x0 + XB.x1) / 2), y: f3((XB.y0 + XB.y1) / 2) }
    : { x: 1556.1, y: 472.2 }
  const along = (x, y) => nx * x + ny * y
  for (const key of Object.keys(letters)) {
    const L = letters[key]
    const { x0, y0, x1, y1 } = L.box
    const margin = 3
    let e0 = along(x0, y0 + RISE) - margin
    let e1 = along(x1, y1) + margin
    if (key === 'X') {
      // The X is turning while it rises, so the edge sweeps its whole turning circle.
      const r = Math.hypot(x1 - x0, y1 - y0) / 2
      e0 = along(X_CENTRE.x, X_CENTRE.y + RISE) - r - margin
      e1 = along(X_CENTRE.x, X_CENTRE.y) + r + margin
    }
    // The half-plane on the -n side of the resting edge, in stage pixels.
    const qx = e1 * nx
    const qy = e1 * ny
    const far = 4000
    const pts = [
      [qx - far * ux, qy - far * uy],
      [qx + far * ux, qy + far * uy],
      [qx + far * ux - far * nx, qy + far * uy - far * ny],
      [qx - far * ux - far * nx, qy - far * uy - far * ny],
    ]
    L.edge = ctx.svg(
      'polygon',
      { points: pts.map((p) => `${f3(p[0])},${f3(p[1])}`).join(' ') },
      L.clip,
    )
    L.shift = e0 - e1
  }
  /* A letter's rise: the letter and its clip edge on one ease, landing together. */
  const rise = (L, at, duration, ease) => {
    tl.fromTo(L.mover, { y: RISE }, { y: 0, duration, ease }, at)
    tl.fromTo(
      L.edge,
      { x: f3(L.shift * nx), y: f3(L.shift * ny) },
      { x: 0, y: 0, duration, ease },
      at,
    )
  }

  /* ------------------------------------------------------------- tagline */

  const TAG = 'The friendly way to practise a language with real people'
  // Portrait breaks it in two near-equal lines; each line rises out of its own mask.
  const TAG_LINES = portrait
    ? V.tagLines.map((text, i) => ({ text, base: V.tagBases[i] }))
    : [{ text: TAG, base: 740 }]
  const TAG_SIZE = portrait ? V.tagFont : 40
  const tk = TAG_SIZE / 40
  const TAG_FONT = `700 ${TAG_SIZE}px ${F.display}`
  const meter = document.createElement('canvas').getContext('2d')
  meter.font = TAG_FONT
  const capH = meter.measureText('T').actualBoundingBoxAscent
  const words = []
  let inkRight = 0
  let lastBase = 0
  TAG_LINES.forEach((line, li) => {
    const full = meter.measureText(line.text)
    const tagX = CX - (full.actualBoundingBoxRight - full.actualBoundingBoxLeft) / 2
    inkRight = tagX + full.actualBoundingBoxRight
    lastBase = line.base
    const clipId = li ? `s8-clip-tag-${li}` : 's8-clip-tag'
    const tagClip = ctx.svg('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' }, defs)
    ctx.svg('rect', { x: 0, y: line.base - 60 * tk, width: W, height: 76 * tk }, tagClip)
    const tagWrap = ctx.svg('g', { 'clip-path': `url(#${clipId})` }, layer)
    let at = 0
    for (const word of line.text.split(' ')) {
      const x = tagX + meter.measureText(line.text.slice(0, at)).width
      const node = ctx.svg(
        'text',
        { x: f3(x), y: line.base, fill: C.onYellow, text: word },
        tagWrap,
      )
      Object.assign(node.style, { font: TAG_FONT, whiteSpace: 'pre' })
      words.push(node)
      at += word.length + 1
    }
  })

  // The bookend caret: 4×44, 8 px after the ink of 'people', centred on the cap height.
  const caret = ctx.svg(
    'rect',
    {
      x: f3(inkRight + 8 * tk),
      y: f3(lastBase - capH / 2 - 22 * tk),
      width: f3(4 * tk),
      height: f3(44 * tk),
      fill: C.onYellow,
    },
    layer,
  )

  /* -------------------------------------------------------------- plates */

  // S7's last frame, drawn on top: two ink half-planes meeting on the Cut, and its yellow line.
  const plates = ctx.svg('g', {}, layer)
  const plate = (side) => {
    const far = 3200
    const pts = [
      [CX - far * ux, CY - far * uy],
      [CX + far * ux, CY + far * uy],
      [CX + far * ux + side * far * nx, CY + far * uy + side * far * ny],
      [CX - far * ux + side * far * nx, CY - far * uy + side * far * ny],
    ]
    return ctx.svg(
      'polygon',
      { points: pts.map((p) => `${f3(p[0])},${f3(p[1])}`).join(' '), fill: C.deep },
      plates,
    )
  }
  const plateUL = plate(-1)
  const plateLR = plate(1)
  /*
   * Only frame 0 ever shows the blade: from frame 1 it lies over the yellow
   * the plates have opened. Portrait keeps it at the handoff table's 4 px, so
   * its first frame is S7's last exactly.
   */
  const blade = ctx.svg(
    'path',
    {
      d: `M${f3(CX - 1300 * ux)} ${f3(CY - 1300 * uy)}L${f3(CX + 1300 * ux)} ${f3(CY + 1300 * uy)}`,
      stroke: C.yellow,
      'stroke-width': portrait ? 4 : 12,
      'stroke-linecap': 'butt',
      fill: 'none',
    },
    plates,
  )

  /* ------------------------------------------------------ the state of it */

  const rng = ctx.rng(8001)
  const OFF_B = -(2000 + rng() * 600)
  const OFF_W = -(rng() * 600)

  /* The turn group at local time t (seconds): where P is, the angle, the scale. */
  function turnState(t) {
    const bt = t / ctx.BEAT
    let rho = 180
    if (bt >= 12) rho = 720
    else if (bt >= 6.25) rho = 174 + 546 * eGlide((bt - 6.25) / 5.75)
    else if (bt >= 6) rho = 180 - 6 * eLift((bt - 6) / 0.25)
    const c = eGlide(clamp01((bt - 6) / 6))
    return {
      px: lerp(START.x, LOCK.x, c),
      py: lerp(START.y, LOCK.y, c),
      S: lerp(START.S, LOCK.S, c),
      rho,
    }
  }
  const transformOf = (s) =>
    `translate(${f3(s.px)} ${f3(s.py)}) rotate(${f3(s.rho)}) scale(${f3(s.S)}) translate(-512 -512)`

  /*
   * Stream offset: a constant 243 units a beat. The storyboard asked for a
   * 43-unit surge snapped in on each beat; on 'snap' that is a 45 px jump in
   * one frame out of a 9 px/frame flow, which reads as the text catching and
   * skipping, not as a pulse. The beat stays in the hairline. 243 is the old
   * 200 a beat plus the four surges spread evenly, so the bend at beat 4 still
   * starts on the same words.
   */
  function streamed(bt) {
    return 243 * bt
  }

  /* The hairline's beat pulse, 1.5 → 4 → 1.5 px inside a quarter beat. */
  function hairWidth(bt) {
    for (let k = 0; k < 4; k++) {
      const x = bt - k
      if (x >= 0 && x < 0.0625) return 1.5 + 2.5 * eSnap(x / 0.0625)
      if (x >= 0.0625 && x < 0.25) return 1.5 + 2.5 * (1 - eCut((x - 0.0625) / 0.1875))
    }
    return 1.5
  }

  let lastK = 0
  ctx.draw((t) => {
    const bt = t / ctx.BEAT
    const s = turnState(t)
    turn.setAttribute('transform', transformOf(s))
    hair.setAttribute('transform', `translate(${f3(s.px)} ${f3(s.py)})`)
    hair.setAttribute('stroke-width', f3(hairWidth(bt)))

    if (bt < 9) {
      const k = bt < 4 ? 0 : bt < 6 ? eGlide((bt - 4) / 2) / RM : 1 / RM
      // Rebuilt only when the curvature changes; a seek from anywhere lands on the right shape.
      if (k !== lastK) {
        for (const part of [partsB, partsW]) {
          const shape = railShape(part.R, k)
          part.path.setAttribute('d', shape.d)
          part.win.setAttribute('points', shape.points)
        }
        lastK = k
      }
      const v = streamed(bt)
      tpB.setAttribute('startOffset', f3(OFF_B + v))
      tpW.setAttribute('startOffset', f3(OFF_W - v))
    }

    const trails = bt >= 9 && bt < 11
    const spread = eGlide(clamp01((bt - 9) / 0.5)) * eGlide(clamp01((11 - bt) / 0.5))
    for (const ghost of GHOSTS) {
      ghost.g.setAttribute('visibility', trails ? 'visible' : 'hidden')
      // The lag opens over the first half-beat and closes over the last, so the
      // trail grows out of the solid strokes and folds back into them. Only the
      // angle lags: with the camera's travel and scale lagging too, the ghosts
      // stacked down-right of the arcs and read as a hard shadow, which belongs
      // to the mark alone and must first appear at the lock.
      if (trails) {
        const past = turnState(t - ghost.lag * spread)
        ghost.g.setAttribute('transform', transformOf(Object.assign({}, s, { rho: past.rho })))
      }
    }
  })

  /* ------------------------------------------------------------ timeline */

  // 0.0 SPLIT-OPEN: the blade shows 12 px for two frames, the plates part along the Cut.
  tl.set(blade, { visibility: 'hidden' }, 2 / 60)
  // The bars stay ink while the plates cover the stage's edges. On 'snap' the
  // plates have uncovered about half of every edge by the second frame, so the
  // bars turn yellow with the blade, not a beat early.
  ctx.letterbox(C.deep, 0, 2 / 60)
  /*
   * The travel carries each plate 1000 px off the Cut, past the wide frame's
   * far corners (976 px). The tall frame's are 1099 px off it, so portrait
   * goes 15% further along the same line.
   */
  const reach = portrait ? 1.15 : 1
  tl.to(plateUL, { x: -343.3 * reach, y: -969.4 * reach, duration: b(0.75), ease: E.snap }, b(0))
  tl.to(plateLR, { x: 343.3 * reach, y: 969.4 * reach, duration: b(0.75), ease: E.snap }, b(0))
  tl.set(plates, { visibility: 'hidden' }, b(0.75))

  // 7.0-9.0 INK-IN, then the lettering underneath is gone.
  tl.fromTo(
    inkB,
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: b(1.5), ease: E.whip },
    b(7),
  )
  tl.fromTo(
    inkW,
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: b(1.5), ease: E.whip },
    b(7.5),
  )
  tl.set(rails, { visibility: 'hidden' }, b(9))

  // 12.0 LOCK: the mark takes over, its shadow snaps out, the hairline retracts into the seam.
  tl.set(m.g, { visibility: 'hidden' }, 0)
  tl.set(turn, { visibility: 'hidden' }, b(12))
  tl.set(m.g, { visibility: 'visible' }, b(12))
  tl.fromTo(
    m.shadows,
    { x: 0, y: 0 },
    { x: MARK.shadow.dx, y: MARK.shadow.dy, duration: 0.25, ease: E.snap },
    b(12),
  )
  tl.fromTo(
    hair,
    { drawSVG: '0% 100%' },
    { drawSVG: '50% 50%', duration: 0.25, ease: E.cut },
    b(12),
  )

  // 12.5-14.5 WORDMARK: L a n g rise on 16ths; the X turns its last half-turn and lands on 14.5.
  ;['L', 'a', 'n', 'g'].forEach((key, i) => rise(letters[key], b(12.5 + 0.25 * i), 0.4, E.snap))
  const X = letters.X
  tl.fromTo(
    X.rot,
    { rotation: 180, svgOrigin: `${X_CENTRE.x} ${X_CENTRE.y}` },
    { rotation: 0, svgOrigin: `${X_CENTRE.x} ${X_CENTRE.y}`, duration: b(2), ease: E.glide },
    b(12.5),
  )
  rise(X, b(13.5), b(1), E.whip)

  // 14.5-15.5 TAGLINE: the words rise out of one line mask, a 1/32 s apart.
  const stagger = 1 / 32
  words.forEach((node, i) => {
    tl.fromTo(
      node,
      { y: 56 },
      { y: 0, duration: b(1) - stagger * (words.length - 1), ease: E.snap },
      b(14.5) + stagger * i,
    )
  })

  // 15.5-16.0 the caret, once. Then nothing moves.
  tl.set(caret, { visibility: 'hidden' }, 0)
  tl.set(caret, { visibility: 'visible' }, b(15.5))
  tl.set(caret, { visibility: 'hidden' }, b(16))

  /* --------------------------------------------------------------- sound */

  ctx.cue(b(0), 'impact', { gain: 1 })
  ctx.cue(b(0), 'glitch', { gain: 0.7 })
  ctx.cue(b(0), 'whoosh', { pan: -1, dur: b(0.75), gain: 0.5 })
  ctx.cue(b(0), 'whoosh', { pan: 1, dur: b(0.75), gain: 0.5 })
  ctx.cue(b(4), 'riser', { dur: b(2), note: 'D4', gain: 0.6 })
  // The turn whoosh stops on 11.75, into the storyboard's one 8th of silence before the lock.
  ctx.cue(b(6), 'whoosh', { dur: b(5.75), gain: 0.6 })
  // Pawl ticks, one per 15° of the turn, placed by inverting the glide.
  for (let deg = 180; deg < 720; deg += 15) {
    const u = Math.acos(1 - (2 * (deg - 174)) / 546) / Math.PI
    const rad = (deg * Math.PI) / 180
    ctx.cue(b(6.25 + 5.75 * u), 'tick', { gain: 0.3, pan: f3(0.6 * Math.cos(rad)) })
  }
  ctx.cue(b(7), 'shimmer', { note: 'D5', dur: b(1.5), gain: 0.5 })
  ctx.cue(b(7.5), 'shimmer', { note: 'A5', dur: b(1.5), gain: 0.5 })
  ctx.cue(b(10), 'riser', { dur: b(1.75), gain: 0.6 })
  ctx.cue(b(12), 'impact', { gain: 1 })
  ctx.cue(b(12), 'tick', { gain: 0.9 })
  ;['D5', 'E5', 'F#5', 'A5'].forEach((note, i) => ctx.cue(b(12.5 + 0.25 * i), 'pluck', { note }))
  ctx.cue(b(14.5), 'pop', { note: 'D6' })
  ctx.cue(b(14.5), 'shimmer', { dur: b(1), gain: 0.5 })
  ctx.cue(b(15.5), 'tick')
})
