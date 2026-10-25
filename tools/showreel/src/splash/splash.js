/*
 * Launch — the app's opening, built as the closing card of Venus's streak
 * videos: the yellow badge, three halo rings breathing out of it, the
 * wordmark under it and Venus peeking over its top edge. The videos build
 * that card out of their last scene; the launch builds it out of the ground
 * the OS has just drawn, and ends with Venus dropping in from the top.
 *
 * Light: the whole yellow screen is the badge, too close to see. It closes
 * down to the badge's size, and white — the app's own ground — opens round
 * it. Dark: the ground stays the app's dark `bg` and the badge pops out of
 * its centre, the way it lands on the card in the videos.
 *
 * Then Venus falls in from above the frame, legs everywhere, lands behind the
 * badge hard enough to dent it, bobs up, looks at you as if that was the
 * plan, flicks an ear and slow-blinks: her sign-off in every video.
 *
 * The card's layout, eases and timings are the end card's
 * (`venus/gen/lib/endcard.mjs`, style `splash`), moved 140 px down so the
 * lockup without the slogan and URL sits in the middle of the 9:16 frame.
 * There are no words: the only letters are the outlined wordmark.
 *
 * Frame 0 must be the bare ground and nothing else: the app cuts to the film
 * from a view of that colour, and anything on it would pop in at the seam.
 *
 * Every frame is drawn in `ctx.draw` from the time alone, so a seek lands on
 * the same picture as playback. Times are seconds; there is no score.
 */
REEL.scene('splash', (ctx) => {
  const { C, W, H, MARK } = ctx
  const V = window.Venus

  /* `?theme=dark` is the night cut, for a phone in dark mode. */
  const params = new URLSearchParams(location.search)
  const DARK = params.get('theme') === 'dark'
  /*
   * `?still` draws the reduced-motion mark (`assets/splash/badge*.png`): the
   * last frame without the halo, on the launch ground rather than the card's,
   * because with reduced motion the app shows it on the colour the OS drew.
   */
  const STILL = params.has('still')
  /* What the card stands on once it is built: the app's `bg` in each scheme. */
  const PAPER = DARK ? C.night : STILL ? C.yellow : C.white
  const INK = DARK ? C.snow : C.ink

  /* ---------------------------------------------------------------- eases */

  // The end card's, so the two read as one hand.
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
  const ramp = (t, a, b) => clamp01((t - a) / (b - a))
  const E = {
    inOut: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    in: (p) => p * p * p,
    out: (p) => 1 - (1 - p) ** 3,
    outBack: (p) => {
      const c1 = 2.2
      const c3 = c1 + 1
      return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2
    },
  }
  const n1 = (v) => Math.round(v * 10) / 10
  const n3 = (v) => Math.round(v * 1000) / 1000

  /* --------------------------------------------------------------- layout */

  /*
   * The end card's numbers: the badge's centre and radius, the wordmark's top
   * and width, the halo's period. Its card also carries a slogan and the URL
   * under the wordmark; without them the lockup sits 140 px lower, centred.
   */
  const SP = { x: 540, y: 875, r: 205, wordTop: 1170, wordW: 500, halo: 1.6 }

  /*
   * The beats, in seconds. The build is the end card's own (badge by 0.46,
   * the wordmark rising from 0.40, the halo from 0.46); Venus's landing is
   * put on 0.993, the second halo ring's birth, so the ring reads as the
   * shock of it.
   */
  const T = {
    close: [0, 0.46], // light: the yellow closing down to the badge
    pop: [0.04, 0.46], // dark: the badge growing out of its centre; light: the mark
    word: 0.4,
    halo: 0.46,
    drop: 0.62, // she leaves the top edge
    land: SP.halo / 3 + 0.46,
    sink: 0, // set below: the lowest point of the landing
    up: 0, // back at rest
    flick: 1.38,
    blink: 1.56,
  }
  T.sink = T.land + 0.08
  T.up = T.sink + 0.24

  /* --------------------------------------------------------------- layers */

  const layer = ctx.svgLayer()
  const defs = ctx.svg('defs', {}, layer)

  // The card's paper, under the yellow that closes off it.
  ctx.svg('rect', { x: 0, y: 0, width: W, height: H, fill: PAPER }, layer)

  // The halo: three rings a third of a period apart, grown from the badge's edge.
  const rings = [0, 1, 2].map(() =>
    ctx.svg(
      'circle',
      { cx: SP.x, cy: SP.y, r: SP.r, fill: 'none', stroke: C.yellowShade, opacity: 0 },
      layer,
    ),
  )

  // Venus, behind the badge. Below the clip's edge she is the badge's business.
  const peek = ctx.svg('clipPath', { id: 'sp-peek', clipPathUnits: 'userSpaceOnUse' }, defs)
  ctx.svg('rect', { x: 0, y: -400, width: W, height: SP.y - 40 + 400 }, peek)
  const venus = ctx.svg('g', { 'clip-path': 'url(#sp-peek)' }, layer)

  // The badge: a yellow disc, and the rim the light cut's closing yellow carries.
  const badge = ctx.svg('g', {}, layer)
  const rim = ctx.svg('circle', { cx: SP.x, cy: SP.y, r: 0, fill: C.yellowShade }, badge)
  const disc = ctx.svg('circle', { cx: SP.x, cy: SP.y, r: 0, fill: C.yellow }, badge)

  // The mark on it. The shadow is laid in screen space, so it stays down-right as the arcs turn.
  const markShadow = ctx.svg('g', { fill: C.yellowShade }, badge)
  ctx.svg('path', { d: MARK.d.black }, markShadow)
  ctx.svg('path', { d: MARK.d.white }, markShadow)
  const markArcs = ctx.svg('g', {}, badge)
  ctx.svg('path', { d: MARK.d.black, fill: '#000000' }, markArcs)
  ctx.svg('path', { d: MARK.d.white, fill: '#ffffff' }, markArcs)

  /*
   * The outlined wordmark (branding/brand/logo), the same outlines 08 sets.
   * Its ink box is 1874 by 589 from (1316, 233), as the end card measures it.
   */
  const WORD = [
    'M1368.064 696.9Q1343.16 696.9 1329.725 683.137Q1316.291 669.375 1316.291 645.127V285.334Q1316.291 259.775 1329.398 246.668Q1342.505 233.56 1367.409 233.56Q1391.657 233.56 1404.764 246.668Q1417.871 259.775 1417.871 285.334V611.048H1593.508Q1614.479 611.048 1625.948 622.189Q1637.417 633.33 1637.417 653.646Q1637.417 674.618 1625.948 685.759Q1614.479 696.9 1593.508 696.9Z',
    'M1778.975 704.109Q1743.585 704.109 1715.405 690.346Q1687.224 676.584 1671.496 652.991Q1655.767 629.398 1655.767 599.907Q1655.767 564.517 1674.117 543.873Q1692.467 523.23 1733.755 514.382Q1775.043 505.535 1843.2 505.535H1877.934V556.653H1843.855Q1810.432 556.653 1789.788 560.257Q1769.144 563.862 1760.297 572.382Q1751.45 580.901 1751.45 595.975Q1751.45 614.325 1764.229 626.121Q1777.009 637.918 1801.257 637.918Q1820.262 637.918 1835.008 629.07Q1849.754 620.223 1858.273 604.822Q1866.793 589.421 1866.793 569.76V494.394Q1866.793 465.558 1853.686 453.434Q1840.579 441.31 1809.121 441.31Q1791.427 441.31 1770.783 445.569Q1750.139 449.829 1725.235 459.66Q1710.817 466.213 1699.676 462.609Q1688.535 459.004 1682.637 449.502Q1676.739 439.999 1676.739 428.53Q1676.739 417.061 1683.292 406.248Q1689.846 395.434 1704.919 390.192Q1735.721 377.74 1762.918 373.152Q1790.116 368.565 1813.053 368.565Q1863.516 368.565 1895.956 383.31Q1928.397 398.056 1944.781 428.53Q1961.165 459.004 1961.165 506.846V652.336Q1961.165 676.584 1949.368 689.691Q1937.572 702.798 1915.29 702.798Q1893.007 702.798 1880.883 689.691Q1868.759 676.584 1868.759 652.336V628.087L1873.347 632.019Q1869.414 654.302 1856.635 670.358Q1843.855 686.414 1824.195 695.262Q1804.534 704.109 1778.975 704.109Z',
    'M2071.921 702.798Q2047.672 702.798 2034.893 689.691Q2022.113 676.584 2022.113 652.336V419.683Q2022.113 395.434 2034.893 382.655Q2047.672 369.875 2070.61 369.875Q2094.203 369.875 2106.655 382.655Q2119.107 395.434 2119.107 419.683V457.038L2111.898 435.411Q2126.971 403.299 2156.79 385.932Q2186.609 368.565 2224.62 368.565Q2263.286 368.565 2288.189 383.31Q2313.093 398.056 2325.545 427.875Q2337.997 457.694 2337.997 503.569V652.336Q2337.997 676.584 2325.217 689.691Q2312.438 702.798 2288.189 702.798Q2264.596 702.798 2251.817 689.691Q2239.037 676.584 2239.037 652.336V508.156Q2239.037 474.733 2226.913 459.987Q2214.789 445.242 2189.885 445.242Q2158.428 445.242 2139.75 464.903Q2121.073 484.563 2121.073 517.331V652.336Q2121.073 702.798 2071.921 702.798Z',
    'M2553.61 822.074Q2518.221 822.074 2485.78 816.176Q2453.34 810.277 2428.436 798.481Q2413.363 791.927 2407.137 781.441Q2400.911 770.956 2401.894 759.159Q2402.877 747.363 2409.759 738.188Q2416.64 729.013 2427.126 725.408Q2437.612 721.804 2449.408 727.047Q2478.244 740.154 2502.82 744.086Q2527.396 748.018 2545.091 748.018Q2587.034 748.018 2608.005 729.013Q2628.977 710.007 2628.977 670.686V620.878H2634.875Q2625.044 651.025 2594.243 670.03Q2563.441 689.036 2526.085 689.036Q2482.831 689.036 2450.719 669.047Q2418.606 649.059 2400.911 612.686Q2383.217 576.314 2383.217 528.472Q2383.217 492.428 2393.375 462.936Q2403.533 433.445 2422.211 412.474Q2440.888 391.502 2467.43 380.033Q2493.972 368.565 2526.085 368.565Q2564.751 368.565 2594.57 387.242Q2624.389 405.92 2634.22 436.067L2627.666 457.038V419.683Q2627.666 395.434 2640.445 382.655Q2653.225 369.875 2676.818 369.875Q2700.411 369.875 2712.863 382.655Q2725.315 395.434 2725.315 419.683V659.544Q2725.315 740.154 2681.078 781.114Q2636.841 822.074 2553.61 822.074ZM2555.576 614.98Q2577.859 614.98 2593.915 604.494Q2609.971 594.008 2619.146 574.675Q2628.321 555.342 2628.321 528.472Q2628.321 487.84 2608.333 465.23Q2588.344 442.62 2555.576 442.62Q2533.294 442.62 2516.91 452.778Q2500.526 462.936 2491.679 482.27Q2482.831 501.603 2482.831 528.472Q2482.831 569.105 2502.492 592.042Q2522.153 614.98 2555.576 614.98Z',
    'M2826.24 702.798Q2806.579 702.798 2793.8 691.985Q2781.02 681.171 2779.054 665.115Q2777.088 649.059 2789.54 632.019L2934.374 439.999V485.219L2795.438 300.407Q2782.986 282.712 2784.625 266.656Q2786.263 250.6 2799.043 239.786Q2811.822 228.973 2830.828 228.973Q2847.212 228.973 2859.336 236.837Q2871.46 244.702 2883.912 261.741L2992.046 411.163H2959.278L3066.757 261.741Q3079.209 244.046 3091.661 236.51Q3104.113 228.973 3120.497 228.973Q3140.157 228.973 3152.937 239.459Q3165.716 249.944 3167.355 266.001Q3168.993 282.057 3155.886 300.407L3016.294 485.219V439.999L3160.474 632.019Q3173.581 649.059 3171.942 665.115Q3170.304 681.171 3157.524 691.985Q3144.745 702.798 3124.429 702.798Q3108.7 702.798 3096.576 694.934Q3084.452 687.07 3071.345 669.375L2958.623 514.055H2992.046L2879.324 669.375Q2866.872 687.07 2854.42 694.934Q2841.969 702.798 2826.24 702.798Z',
  ]
  const word = ctx.svg('g', {}, layer)
  for (const d of WORD) ctx.svg('path', { d, fill: INK }, word)
  const WM = { x0: 1316, y0: 233, w: 1874 }

  /* ----------------------------------------------------------- the badge */

  /*
   * The badge's radius and the mark's scale and turn at time t. Light: the
   * yellow is a disc already, as wide as the frame's far corner, and closes
   * on the end card's inOut while the mark pops inside it. Dark: disc and
   * mark pop together on outBack, as the card's badge does.
   */
  const FAR = Math.hypot(SP.x, H - SP.y) + 40
  function badgeAt(t) {
    const breathe = 1 + 0.03 * (0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, t - T.halo)) / 2.6))
    // The landing's dent: down and wide for a moment, then back.
    const k = ramp(t, T.land, T.land + 0.26)
    const dent = k > 0 && k < 1 ? Math.sin(Math.PI * k) * (1 - 0.5 * k) : 0
    const pop = ramp(t, T.pop[0], T.pop[1])
    const markScale = Math.max(0, E.outBack(pop))
    const turn = -140 * (1 - E.out(pop))
    let r
    let rimW = 0
    if (DARK) {
      r = SP.r * markScale
    } else {
      const c = ramp(t, T.close[0], T.close[1])
      r = SP.r + (FAR - SP.r) * (1 - E.inOut(c))
      rimW = 22 * (1 - c)
    }
    return {
      r: r * breathe,
      rimW,
      sx: 1 + 0.035 * dent,
      sy: 1 - 0.05 * dent,
      dy: 7 * dent,
      markScale: markScale * breathe,
      turn,
    }
  }

  /* --------------------------------------------------------------- Venus */

  /*
   * Where her ground point is, and how she is posed, at time t. At rest she
   * is the end card's cameo: 0.62 of the rig, 48 px right of the badge's
   * centre, her head over its top edge, `loving`, rolled 9°.
   */
  const VS = 0.62
  const REST = { x: SP.x + 48, y: SP.y - SP.r - 28 + 320 * VS }
  const TOP = -70 // her ground point when the whole of her is above the frame

  function blinkLid(t, at) {
    const k = t - at
    if (k < 0 || k > 0.68) return 0
    return k < 0.22 ? E.inOut(k / 0.22) : k < 0.38 ? 1 : 1 - E.inOut((k - 0.38) / 0.3)
  }

  function venusAt(t) {
    if (t < T.drop) return null
    let y
    let sx
    let sy
    let lean = 0
    let x = REST.x
    let P

    if (t < T.land) {
      /*
       * The fall: from rest under gravity, stretched by her speed, all four
       * legs out and the fore paws paddling at air. Eyes as round as they go:
       * this was not quite the plan.
       */
      const q = (t - T.drop) / (T.land - T.drop)
      y = TOP + (REST.y - TOP) * q * q
      sy = 1 + 0.16 * q
      sx = 1 - 0.08 * q
      lean = -7 * (1 - q)
      x = REST.x + 26 * (1 - q)
      const wide = { lid: 0, low: 0, pupil: 0.72, round: 1, s: 1.1 }
      P = V.pose({
        mode: 'startle',
        shadow: 0,
        eyes: { L: wide, R: wide },
        mouth: { open: 0.32, wide: 0.55, smile: 0 },
        ears: { L: { rot: -14 }, R: { rot: -14 } },
        whisk: { ang: 16 },
        paw: { knead: t * 7, kamt: 0.8 },
        tail: { pitch: 34, yaw: 70, side: 60, curl: 70, hook: 40, wave: 0.5, phase: t * 3 },
      })
    } else {
      /*
       * Down behind the badge: the legs fold, the head goes on sinking, the
       * eyes squeeze shut and the ears swing down. Then she bobs up past
       * where she sits and settles, ears springing up — `innocent`, round
       * eyes, nothing happened — and the slow blink turns that into `loving`.
       */
      let ears
      let sink
      if (t < T.sink) {
        const k = E.out((t - T.land) / (T.sink - T.land))
        sink = 66 * k
        sy = 1 - 0.18 * k
        sx = 1 + 0.12 * k
        ears = 26 * k
      } else {
        const k = ramp(t, T.sink, T.up)
        const b = E.outBack(k)
        sink = 66 * (1 - b)
        sy = 1 - 0.18 * (1 - b)
        sx = 1 + 0.12 * (1 - b)
        ears = 26 - 40 * b
      }
      y = REST.y + sink
      const squeeze = t < T.sink + 0.1 ? 1 : 0
      const b = blinkLid(t, T.blink)
      // Through the blink: innocent's open stare closes, and opens as loving.
      const love = t >= T.blink + 0.22 ? 1 : 0
      const roll = 9 * E.inOut(ramp(t, T.blink, T.blink + 0.38))
      const innocent = { lid: 0, low: 0, pupil: 0.78, round: 1, squeeze }
      const loving = { lid: 0.55, low: 0.3 }
      const eye = love ? loving : innocent
      const settle = ramp(t, T.up, T.blink + 0.5)
      P = V.pose({
        mode: 'sit',
        shadow: 0,
        sx: 1,
        eyes: { L: Object.assign({}, eye), R: Object.assign({}, eye) },
        mouth: { smile: love ? 0.45 : 0.08 },
        head: { roll, pitch: love ? 4 : 0 },
        ears: {
          L: { rot: ears * (1 - settle) + 10 * settle * love, fold: Math.max(0, ears) / 70 },
          R: { rot: ears * (1 - settle) + 10 * settle * love, fold: Math.max(0, ears) / 70 },
        },
      })
      for (const e of ['L', 'R']) {
        P.eyes[e].lid += (1 - P.eyes[e].lid) * b
        P.eyes[e].low += (0.15 - P.eyes[e].low) * b
      }
      P.head.pitch += 5 * b
      // An ear flick once she is up: the right ear twitches back and returns.
      const f = (t - T.flick) / 0.28
      if (f > 0 && f < 1) P.ears.R.rot += 16 * Math.sin(Math.PI * f) * (1 - f * 0.3)
      // Breathing, and the tail tip that never quite stops.
      P.head.dy = (P.head.dy || 0) + 2.5 * Math.sin(t * 2.4)
      P.tail.phase = t * 1.2
    }
    P.sx = sx
    P.sy = sy
    P.lean = lean
    return { x, y, P }
  }

  /* ------------------------------------------------------------- the draw */

  ctx.draw((t) => {
    const B = badgeAt(t)

    // The halo, faint and slow, a ring every third of a period.
    rings.forEach((ring, i) => {
      const p = (t - T.halo - (i * SP.halo) / 3) / SP.halo
      let o = 0
      let sc = 1
      if (p >= 0) {
        const k = p % 1
        sc = 1 + 1.2 * (1 - (1 - k) ** 2)
        o = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * (DARK ? 0.55 : 0.45)
      }
      ring.setAttribute('r', n1(SP.r * sc))
      ring.setAttribute('stroke-width', n1(5 * sc))
      ring.setAttribute('opacity', STILL ? 0 : n3(o))
    })

    const v = venusAt(t)
    venus.innerHTML = v
      ? `<g transform="translate(${n1(v.x)} ${n1(v.y)}) scale(${VS})">${V.draw(v.P)}</g>`
      : ''

    // The badge squashes about its foot, where she landed on it from behind.
    const foot = SP.y + SP.r
    badge.setAttribute(
      'transform',
      `translate(0 ${n1(B.dy)}) translate(${SP.x} ${foot}) scale(${n3(B.sx)} ${n3(B.sy)}) translate(${-SP.x} ${-foot})`,
    )
    disc.setAttribute('r', n1(B.r))
    /*
     * On the still's yellow ground the disc has no edge of its own, and Venus
     * would be peeking over nothing; the rim stays on as a thin line in the
     * yellow's shade, the colour the halo's rings are drawn in.
     */
    const rimW = STILL && !DARK ? 9 : B.rimW
    rim.setAttribute('r', n1(rimW > 0.5 ? B.r + rimW : 0))

    const k = (SP.r * 2 * B.markScale) / 1024
    const inner = `rotate(${n1(B.turn)}) scale(${n3(k)}) translate(-512 -512)`
    const shown = k > 0.002 ? 'visible' : 'hidden'
    markArcs.setAttribute('transform', `translate(${SP.x} ${SP.y}) ${inner}`)
    markShadow.setAttribute(
      'transform',
      `translate(${n1(SP.x + MARK.shadow.dx * k)} ${n1(SP.y + MARK.shadow.dy * k)}) ${inner}`,
    )
    markArcs.setAttribute('visibility', shown)
    markShadow.setAttribute('visibility', shown)

    // The wordmark rises 28 px into place, the end card's soft rise.
    const w = E.out(ramp(t, T.word, T.word + 0.22))
    const ws = SP.wordW / WM.w
    word.setAttribute(
      'transform',
      `translate(${n1(SP.x - SP.wordW / 2)} ${n1(SP.wordTop + 28 * (1 - w))}) scale(${n3(ws * 1000) / 1000}) translate(${-WM.x0} ${-WM.y0})`,
    )
    word.setAttribute('opacity', n3(w))
  })
})
