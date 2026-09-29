/*
 * Launch — the app's opening, cut from 08's finale. The app hands over on a
 * uniform yellow screen; two rails of hellos stream in along the Cut, bend at
 * constant length into the two arc bands, turn 540° while the camera pulls
 * back, ink into solid arcs and lock into the mark with its hard shadow. No
 * hairline, no wordmark, no tagline: the owner asked for the hellos alone to
 * make the logo.
 *
 * The geometry — the rail as an arc of fixed length, its square-cut window,
 * the turn group's transform, the ink strokes — is copied from
 * `scenes/08-exchange.js` rather than shared with it, so the reel can change
 * without moving the app's launch, which only changes when a new video ships.
 *
 * Frame 0 must be the bare ground and nothing else: it is the frame the app's
 * own yellow disc hands over to, and anything on it would pop in at the seam.
 *
 * Times below are in seconds, not beats; the scene is 2.7 s long and there is
 * no score to phase against.
 */
REEL.scene('splash', (ctx) => {
  const { tl, E, C, F, CUT, MARK } = ctx

  const ease = (e) => (typeof e === 'function' ? e : gsap.parseEase(e))
  const eGlide = ease(E.glide)
  const eLift = ease(E.lift)
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
  const f3 = (v) => Math.round(v * 1000) / 1000

  /*
   * The night cut (`?theme=dark`), for a phone in dark mode: a full yellow
   * screen at night is a glare. The ground is the app's dark `bg`, the black
   * arc and its Latin rail turn yellow (black on it would vanish), and the
   * hard shadow is black instead of the ground's shade.
   */
  const DARK = new URLSearchParams(location.search).get('theme') === 'dark'
  const INK_A = DARK ? C.yellow : '#000000'
  const SHADE = DARK ? '#000000' : C.yellowShade

  const [nx, ny] = CUT.n
  const [ux, uy] = CUT.dUp
  /* The rails run along 147° in canvas units, which the 180° start turns into dUp on stage. */
  const dx = -ux
  const dy = -uy

  const RM = MARK.rm
  const LEN = Math.PI * RM // a rail is exactly one half-circumference long
  const INK = MARK.stroke

  /*
   * The mark ends centred, its ink (235.7 to 788.3 on the 1024 canvas) 40% of
   * the frame's width. The rails start large enough that, on the 9:16 frame,
   * each runs off both side edges: a rail whose square-cut end sits inside the
   * picture reads as a label, not as a stream.
   */
  const INK_W = 788.339 - 235.661
  const END_S = (0.4 * Math.min(ctx.W, ctx.H)) / INK_W
  const START_S = ctx.portrait ? 2.2 : 1.4

  /* The beats of it, in seconds. */
  const T = {
    bend: [0.35, 0.95],
    camera: [0.4, 2.05],
    turn: [0.45, 2.05],
    counter: 0.08, // the wind-up before the turn, 6° the other way
    inkBlack: [1.0, 1.5],
    inkWhite: [1.15, 1.65],
    lock: 2.05,
    shadow: 0.25,
  }

  /* --------------------------------------------------------------- layers */

  const layer = ctx.svgLayer()
  const defs = ctx.svg('defs', {}, layer)

  const inkBlackD = ctx.arcStroke(MARK.black.cx, MARK.black.cy, RM, 327, 147)
  const inkWhiteD = ctx.arcStroke(MARK.white.cx, MARK.white.cy, RM, 507, 327)
  const strokeAttrs = (color) => ({
    fill: 'none',
    stroke: color,
    'stroke-width': INK,
    'stroke-linecap': 'butt',
  })
  // Echo ghosts of the two solid strokes, oldest first so the nearest sits on top.
  const GHOSTS = [
    { lag: 3 / 60, alpha: 0.06 },
    { lag: 2 / 60, alpha: 0.15 },
    { lag: 1 / 60, alpha: 0.3 },
  ].map((spec) => {
    const g = ctx.svg('g', { opacity: spec.alpha, visibility: 'hidden' }, layer)
    ctx.svg('path', Object.assign({ d: inkBlackD }, strokeAttrs(INK_A)), g)
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
    const path = ctx.svg('path', { id: `sp-rail-${id}`, d: shape.d }, defs)
    const clip = ctx.svg(
      'clipPath',
      { id: `sp-window-${id}`, clipPathUnits: 'userSpaceOnUse' },
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
        'clip-path': `url(#sp-window-${id})`,
        'dominant-baseline': 'central',
        style: { whiteSpace: 'pre', fontKerning: 'normal' },
      },
      rails,
    )

  // Latin in black, as in 08. Ends on 'Hello', which is therefore the first word in.
  const textB = railText(INK_A, 'black')
  const tpB = ctx.svg('textPath', { href: '#sp-rail-black' }, textB)
  const BLACK_RUN = 'Merhaba · Hola · Hallo · Bonjour · Привет · Olá · Ciao · Hello · '
  tpB.textContent = BLACK_RUN.repeat(3)
  Object.assign(textB.style, { fontFamily: F.display, fontWeight: '900' })

  // Every other script in white, each word in its own face.
  const textW = railText('#ffffff', 'white')
  const tpW = ctx.svg('textPath', { href: '#sp-rail-white' }, textW)
  Object.assign(textW.style, { fontFamily: F.display, fontWeight: '800' })
  const WHITE_RUN = ['ja', 'ko', 'zh', 'hi', 'th', 'he', 'ar', 'el'].map((lang) => ctx.GL[lang])
  for (let r = 0; r < 3; r++) {
    for (const g of WHITE_RUN) {
      const word = ctx.svg('tspan', { text: g.text }, tpW)
      word.style.fontFamily = g.font
      word.style.fontWeight = '800'
      // Right-to-left words are isolated, so each keeps its own order inside the left-to-right run.
      if (g.dir === 'rtl') Object.assign(word.style, { direction: 'rtl', unicodeBidi: 'isolate' })
      ctx.svg('tspan', { text: ' · ' }, tpW)
    }
  }

  /*
   * Where each run starts: wholly off its rail, so frame 0 is bare yellow.
   * The black run flows forward along its path, so it waits behind the start
   * by its own length; the white one flows backward and waits past the end.
   * Measured, not estimated: the fonts are loaded before any builder runs.
   */
  const LEN_B = textB.getComputedTextLength()
  const OFF_B = -LEN_B
  const OFF_W = LEN

  // Ink-in: butt-capped strokes as wide as the band, drawn along each rail's stream.
  const inkB = ctx.svg('path', Object.assign({ d: inkBlackD }, strokeAttrs(INK_A)), turn)
  const inkW = ctx.svg('path', Object.assign({ d: inkWhiteD }, strokeAttrs('#ffffff')), turn)

  // The mark itself, which replaces the turn group on the lock frame.
  const m = ctx.mark(layer, { x: ctx.CX, y: ctx.CY, size: 1024 * END_S, shade: SHADE })
  m.black.setAttribute('fill', INK_A)

  /* ------------------------------------------------------ the state of it */

  const phase = (t, [t0, t1]) => clamp01((t - t0) / (t1 - t0))

  /*
   * The turn group at local time t. The camera never travels: the mark's
   * canvas centre is also the middle of its ink, and it ends centred. The
   * scale is interpolated in log space, so the pull-back reads as a steady
   * zoom rather than one that slows as the picture gets smaller.
   */
  function turnState(t) {
    const [t0, t1] = T.turn
    let rho = 180
    if (t >= t1) rho = 720
    else if (t >= t0 + T.counter)
      rho = 174 + 546 * eGlide((t - t0 - T.counter) / (t1 - t0 - T.counter))
    else if (t >= t0) rho = 180 - 6 * eLift((t - t0) / T.counter)
    const c = eGlide(phase(t, T.camera))
    return { px: ctx.CX, py: ctx.CY, S: START_S * (END_S / START_S) ** c, rho }
  }
  const transformOf = (s) =>
    `translate(${f3(s.px)} ${f3(s.py)}) rotate(${f3(s.rho)}) scale(${f3(s.S)}) translate(-512 -512)`

  /*
   * How far each run has travelled, in canvas units. It comes in fast — the
   * rails have to be full before the bend shows their ends — and settles to
   * 08's cruising speed: v(t) = V1 → V2 over DECAY, quadratically, integrated
   * here in closed form so a seek lands on the same frame as playback.
   */
  const V1 = 1500
  const V2 = 250
  const DECAY = 1
  function travelled(t) {
    const p = Math.min(t, DECAY) / DECAY
    const burst = ((V1 - V2) * DECAY * (1 - (1 - p) ** 3)) / 3
    return V2 * t + burst
  }

  let lastK = -1
  ctx.draw((t) => {
    const s = turnState(t)
    turn.setAttribute('transform', transformOf(s))

    if (t < T.inkWhite[1]) {
      const k = eGlide(phase(t, T.bend)) / RM
      // Rebuilt only when the curvature changes; a seek from anywhere lands on the right shape.
      if (k !== lastK) {
        for (const part of [partsB, partsW]) {
          const shape = railShape(part.R, k)
          part.path.setAttribute('d', shape.d)
          part.win.setAttribute('points', shape.points)
        }
        lastK = k
      }
      const v = travelled(t)
      tpB.setAttribute('startOffset', f3(OFF_B + v))
      tpW.setAttribute('startOffset', f3(OFF_W - v))
    }

    // The trail only once both arcs are solid, and folding back into them by the lock.
    const from = T.inkWhite[1]
    const trails = t >= from && t < T.lock
    const spread = eGlide(clamp01((t - from) / 0.1)) * eGlide(clamp01((T.lock - t) / 0.15))
    for (const ghost of GHOSTS) {
      ghost.g.setAttribute('visibility', trails ? 'visible' : 'hidden')
      // Only the angle lags; a lag in scale stacks the ghosts down-right of the
      // arcs, where they read as the hard shadow, which must first appear at the lock.
      if (trails) {
        const past = turnState(t - ghost.lag * spread)
        ghost.g.setAttribute('transform', transformOf(Object.assign({}, s, { rho: past.rho })))
      }
    }
  })

  /* ------------------------------------------------------------ timeline */

  tl.fromTo(
    inkB,
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: T.inkBlack[1] - T.inkBlack[0], ease: E.whip },
    T.inkBlack[0],
  )
  tl.fromTo(
    inkW,
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: T.inkWhite[1] - T.inkWhite[0], ease: E.whip },
    T.inkWhite[0],
  )
  tl.set(rails, { visibility: 'hidden' }, T.inkWhite[1])

  // The lock: the mark takes over from the turn group and its shadow snaps out.
  tl.set(m.g, { visibility: 'hidden' }, 0)
  tl.set(turn, { visibility: 'hidden' }, T.lock)
  tl.set(m.g, { visibility: 'visible' }, T.lock)
  tl.fromTo(
    m.shadows,
    { x: 0, y: 0 },
    { x: MARK.shadow.dx, y: MARK.shadow.dy, duration: T.shadow, ease: E.snap },
    T.lock,
  )
})
