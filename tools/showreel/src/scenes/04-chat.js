/*
 * 04-chat — Sofia asks, the learner hesitates. b24–32.
 *
 * A typographic chat in one SVG layer. The chat is authored at the size the
 * push-in ends on (world = stage × 5, so bubble text is 260 px) inside a group
 * scaled by 1/5: on the last frame the camera's 5 and that 1/5 cancel, and
 * 'estoy' is drawn at exactly the 260 px S5 cuts against.
 *
 * Every position comes from canvas measurement of the loaded Nunito, prefixes
 * included, so a word split into per-character <text> nodes sits exactly where
 * the kerned whole string would — which is what makes the ink bbox of 'estoy'
 * here the same box S5 measures on its own unsplit copy.
 */
REEL.scene('04-chat', (ctx) => {
  const { tl, b, E, C, F } = ctx
  const K = 5
  const u = (v) => v * K
  const TAU = Math.PI * 2

  const FONT = `700 ${u(52)}px ${F.display}`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = FONT
  const adv = (s) => probe.measureText(s).width
  const ink = (s) => {
    const m = probe.measureText(s)
    return {
      l: -m.actualBoundingBoxLeft,
      r: m.actualBoundingBoxRight,
      t: -m.actualBoundingBoxAscent,
      b: m.actualBoundingBoxDescent,
    }
  }
  const inkCentre = (s, x, y) => {
    const i = ink(s)
    return `${x + (i.l + i.r) / 2} ${y + (i.t + i.b) / 2}`
  }

  const layer = ctx.svgLayer()
  const defs = ctx.svg('defs', {}, layer)
  const cam = ctx.svg('g', {}, layer)
  const world = ctx.svg('g', { transform: `scale(${1 / K})` }, cam)

  const text = (str, x, y, parent, style) =>
    ctx.svg('text', { x, y, text: str, fill: C.ink, style: style || { font: FONT } }, parent)

  /* A rounded rect with one tight tail corner: the r36 body and an r8 square
     over the tail corner, same fill, so the union is the bubble. */
  function bubble(parent, { x, y, w, h, fill, tail }) {
    const g = ctx.svg('g', {}, parent)
    const body = ctx.svg('rect', { x, y, width: w, height: h, rx: u(36), fill }, g)
    const px = tail === 'bl' ? x : x + w - u(72)
    ctx.svg('rect', { x: px, y: y + h - u(72), width: u(72), height: u(72), rx: u(8), fill }, g)
    return { g, body }
  }

  let clipN = 0
  function clipped(parent, x, y, w, h) {
    const id = `s04-clip-${clipN++}`
    const cp = ctx.svg('clipPath', { id }, defs)
    const rect = ctx.svg('rect', { x, y, width: w, height: h }, cp)
    const g = ctx.svg('g', { 'clip-path': `url(#${id})` }, parent)
    g.rect = rect
    return g
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v))

  /*
   * One tween from t0 to t1 whose progress is any pure function of local time.
   * Two live tweens on the same property resolve by render order, which flips
   * when the playhead runs backwards, so a scrub would disagree with playback;
   * a property that changes in several overlapping steps is one of these.
   */
  function track(target, fromVars, toVars, t0, t1, progressAt) {
    const ease = (p) => progressAt(t0 + p * (t1 - t0))
    tl.fromTo(
      target,
      fromVars,
      Object.assign({}, toVars, { duration: t1 - t0, ease, immediateRender: false }),
      t0,
    )
  }

  /* Overlapping eased steps [{ t, d, w }] (w = the step's share) as progress. */
  function steps(list, ease) {
    const f = gsap.parseEase(ease)
    const total = list.reduce((a, s) => a + s.w, 0)
    return {
      t0: Math.min(...list.map((s) => s.t)),
      t1: Math.max(...list.map((s) => s.t + s.d)),
      at: (tau) => list.reduce((a, s) => a + s.w * f(clamp01((tau - s.t) / s.d)), 0) / total,
    }
  }

  function chain(target, fromVars, toVars, list, ease) {
    const s = steps(list, ease)
    track(target, fromVars, toVars, s.t0, s.t1, s.at)
  }

  /* ------------------------------------------------ B1: Sofia's question */

  const B1 = { x: u(400), top: u(260), h: u(128), tx: u(436), base: u(342) }
  const b1Text = '¡Hola! ¿Tienes hambre?'
  const b1W = (s) => adv(s) + u(72)
  const b1 = bubble(world, {
    x: B1.x,
    y: B1.top,
    w: b1W('Hola'),
    h: B1.h,
    fill: C.fill,
    tail: 'bl',
  })

  const at1 = (prefix) => B1.tx + adv(prefix)
  const inv = text('¡', B1.tx, B1.base, world)
  const hola = text('Hola', B1.tx, B1.base, world)
  const bang = text('!', at1('¡Hola'), B1.base, world)
  /* One line mask for the two words that rise into the bubble. Its right edge
     is the bubble's, so a word the lagging bubble has not reached yet is not
     drawn on the white beside it: the bubble's growth uncovers the rise. */
  const line1 = clipped(world, B1.x, B1.base - u(62), b1W('Hola'), u(80))
  const tienes = text('¿Tienes', at1('¡Hola! '), B1.base, line1)
  const hambreQ = text('hambre?', at1('¡Hola! ¿Tienes '), B1.base, line1)

  const LABEL = `800 ${u(26)}px ${F.display}`
  const labelMask = clipped(world, u(396), u(240 - 30), u(160), u(40))
  const label = text('Sofia', u(404), u(240), labelMask, { font: LABEL })
  label.setAttribute('fill', C.muted)

  // b0: '¡' and '!' pop in around 'Hola', which steps right to make room.
  gsap.set(inv, { svgOrigin: inkCentre('¡', B1.tx, B1.base) })
  gsap.set(bang, { svgOrigin: inkCentre('!', at1('¡Hola'), B1.base) })
  tl.fromTo(inv, { scale: 0 }, { scale: 1, duration: 0.15, ease: E.pop }, b(0))
  tl.fromTo(bang, { scale: 0 }, { scale: 1, duration: 0.15, ease: E.pop }, b(0))
  tl.fromTo(hola, { x: 0 }, { x: adv('¡'), duration: 0.2, ease: E.snap }, b(0))

  // b0.25 '¿Tienes' and b0.5 'hambre?' rise from the line mask; so does the name.
  const RISE = u(84)
  tl.fromTo(tienes, { y: RISE }, { y: 0, duration: 0.25, ease: E.snap }, b(0.25))
  tl.fromTo(hambreQ, { y: RISE }, { y: 0, duration: 0.25, ease: E.snap }, b(0.5))
  tl.fromTo(label, { y: u(44) }, { y: 0, duration: 0.25, ease: E.snap }, b(0.25))

  // The bubble follows the measured text, a 16th behind each word.
  chain(
    [b1.body, line1.rect],
    { attr: { width: b1W('Hola') } },
    { attr: { width: b1W(b1Text) } },
    [
      [b(0), 'Hola', '¡Hola!'],
      [b(0.25), '¡Hola!', '¡Hola! ¿Tienes'],
      [b(0.5), '¡Hola! ¿Tienes', b1Text],
    ].map(([t, from, to]) => ({ t: t + b(1 / 16), d: 0.25, w: adv(to) - adv(from) })),
    E.snap,
  )

  /* ------------------------------------------------- B2: the learner */

  const B2 = { right: u(1520), top: u(440), h: u(128), end: u(1484), base: u(522) }
  const full = 'Sí, estoy hambre.'
  const X0 = B2.end - adv(full)
  const b2 = ctx.svg('g', {}, world)
  const b2Body = bubble(b2, {
    x: B2.right - u(120),
    y: B2.top,
    w: u(120),
    h: B2.h,
    fill: C.blueTint,
    tail: 'br',
  }).body
  // The line is placed so the typed prefix always ends at x=1484.
  const line2 = ctx.svg('g', {}, b2)
  gsap.set(line2, { x: adv(full) })

  // One <text> per character, each at its kerned prefix advance. The prefix
  // runs through the character, minus its own advance, so the kerning pair in
  // front of it counts: 'estoy' then has the ink box S5's unsplit copy has.
  const chars = []
  for (let i = 0; i < full.length; i++) {
    if (full[i] === ' ') continue
    const x = X0 + adv(full.slice(0, i + 1)) - adv(full[i])
    const node = text(full[i], x, B2.base, line2)
    node.style.visibility = 'hidden'
    gsap.set(node, { svgOrigin: `${x + adv(full[i]) / 2} ${B2.base}` })
    chars.push({ i, node })
  }
  // The caret never moves: the typed text is right-anchored against it.
  const caret = ctx.svg(
    'rect',
    { x: B2.end, y: u(480), width: u(4), height: u(60), fill: C.ink },
    b2,
  )

  gsap.set(b2, { svgOrigin: `${B2.right} ${B2.top + B2.h}` })
  tl.fromTo(b2, { scale: 0 }, { scale: 1, duration: 0.2, ease: E.pop }, b(1))

  /*
   * Types full.slice(from, to) starting at t. Each character appears where the
   * kerned string puts it, 14 px low at 0.8, and pops up. The line steps left
   * by that character's advance on the same frame, the way a right-aligned
   * field does, so the text's right edge is 1484 on every frame and nothing
   * ever overshoots the bubble's fixed right side. The bubble's left edge
   * follows each word a 16th later.
   */
  const keys = [] // { t, end }: when the typed prefix reaches `end` advance
  const bodySteps = []
  let widthPrev = u(120)
  function type(from, to, t, stagger, dur) {
    chars
      .filter((c) => c.i >= from && c.i < to)
      .forEach((c, k) => {
        const tc = t + k * stagger
        keys.push({ t: tc, end: adv(full.slice(0, c.i + 1)) })
        tl.set(c.node, { visibility: 'visible' }, tc)
        tl.fromTo(
          c.node,
          { y: u(14), scale: 0.8 },
          { y: 0, scale: 1, duration: dur, ease: E.pop, immediateRender: false },
          tc,
        )
      })
    const w = adv(full.slice(0, to)) + u(72)
    bodySteps.push({ t: t + b(1 / 16), d: 0.25, w: w - widthPrev })
    widthPrev = w
  }

  // b1.5 'Sí,' — quick.
  type(0, 3, b(1.5), 0.02, 0.2)

  // b2–3: the hesitation. Two blinks, nothing else moves.
  tl.set(caret, { visibility: 'hidden' }, b(2))
  tl.set(caret, { visibility: 'visible' }, b(2.25))
  tl.set(caret, { visibility: 'hidden' }, b(2.5))
  tl.set(caret, { visibility: 'visible' }, b(2.75))

  // b3 'estoy', b3.25 'hambre.' rushed out.
  type(3, 9, b(3), 0.02, 0.2)
  type(9, full.length, b(3.25), 0.013, 0.16)

  tl.set(caret, { visibility: 'hidden' }, b(3.75))

  // The advance typed so far, a step function of local time.
  const typedAt = (tau) => keys.reduce((a, k) => (tau >= k.t - 1e-6 ? k.end : a), 0)
  const kA = keys[0].t
  const kB = keys[keys.length - 1].t
  track(line2, { x: adv(full) }, { x: 0 }, kA, kB, (tau) => typedAt(tau) / adv(full))

  /*
   * The bubble's width lags the words, but the text may not run into less than
   * 12 px of its padding: when the rushed words outrun the lag, the text pushes
   * the edge out and the lag takes over again once it catches up. Without the
   * floor, 'Sí,' sat outside the bubble, on white, for a frame of 'hambre.'.
   */
  const w0 = u(120)
  const wEnd = widthPrev
  const lag = steps(bodySteps, E.snap)
  const widthAt = (tau) => Math.max(w0 + (wEnd - w0) * lag.at(tau), typedAt(tau) + u(36) + u(12))
  track(
    b2Body,
    { attr: { width: w0, x: B2.right - w0 } },
    { attr: { width: wEnd, x: B2.right - wEnd } },
    kA,
    lag.t1,
    (tau) => (widthAt(tau) - w0) / (wEnd - w0),
  )

  // b4 SEND: a small hop, lifted then sprung.
  tl.fromTo(b2, { y: 0 }, { y: -u(8), duration: b(1 / 8), ease: E.lift }, b(4))
  tl.fromTo(
    b2,
    { y: -u(8) },
    { y: 0, duration: 0.3, ease: E.spring, immediateRender: false },
    b(4.125),
  )

  /* ------------------------------------------ Sofia typing, b4.5–5.5 */

  const typing = ctx.svg('g', {}, world)
  bubble(typing, { x: u(400), y: u(620), w: u(176), h: u(128), fill: C.fill, tail: 'bl' })
  gsap.set(typing, { svgOrigin: `${u(400)} ${u(748)}` })
  ;[452, 488, 524].forEach((cx, i) => {
    const dot = ctx.svg('circle', { cx: u(cx), cy: u(684), r: u(8), fill: C.muted }, typing)
    // y = -12·max(0, sin(2π(2t − i/3))), t in beats: the ease IS the formula.
    tl.fromTo(
      dot,
      { y: 0 },
      {
        y: -u(12),
        duration: b(1),
        ease: (p) => Math.max(0, Math.sin(TAU * (2 * (4.5 + p) - i / 3))),
        immediateRender: false,
      },
      b(4.5),
    )
  })
  tl.fromTo(typing, { scale: 0 }, { scale: 1, duration: 0.2, ease: E.pop }, b(4.5))
  tl.fromTo(
    typing,
    { scaleY: 1 },
    { scaleY: 0, duration: 0.1, ease: E.cut, immediateRender: false },
    b(5.5) - 0.1,
  )

  /* ---------------------------------------------- the push-in on 'estoy' */

  const estoyInk = ink('estoy')
  const estoyX = X0 + adv('Sí, ')
  const Ex = (estoyX + (estoyInk.l + estoyInk.r) / 2) / K
  const Ey = (B2.base + (estoyInk.t + estoyInk.b) / 2) / K
  gsap.set(cam, { svgOrigin: `${Ex} ${Ey}` })

  const S0 = 0.98
  const S1 = K
  const whipF = gsap.parseEase(E.whip)
  // Zoom reads as even when it is even in log scale; the whip shapes that.
  const zoomEase = (p) => (S0 * Math.pow(S1 / S0, whipF(p)) - S0) / (S1 - S0)

  tl.fromTo(cam, { scale: 1 }, { scale: S0, duration: b(0.25), ease: E.lift }, b(5.25))
  tl.fromTo(
    cam,
    { scale: S0 },
    { scale: S1, duration: b(2), ease: zoomEase, immediateRender: false },
    b(5.5),
  )
  tl.fromTo(cam, { x: 0, y: 0 }, { x: 960 - Ex, y: 540 - Ey, duration: b(2), ease: E.whip }, b(5.5))

  /*
   * B2 becomes the band. At scale 5, with 'estoy' centred, the bubble's r36
   * left end would still sit inside the frame (its left edge only 175 px of
   * stage left of the 'estoy' centre). Over the push-in its left edge runs out
   * past the frame, far enough that the r180 rounding is off-screen too, so the
   * last frame is a full-bleed band. It is an exit, so it runs on 'cut': the
   * bubble keeps its shape while the eye can read it and the end leaves the
   * frame late, landing with the camera on b7.5. Final screen x of a world x is
   * 960 + (x - Ex·K), because the camera's 5 and the world's 1/5 cancel.
   */
  const bandLeft = 960 + (B2.right - wEnd - Ex * K)
  const EXT = Math.max(0, bandLeft + u(36) + 40)
  tl.fromTo(
    b2Body,
    { attr: { width: wEnd, x: B2.right - wEnd } },
    {
      attr: { width: wEnd + EXT, x: B2.right - wEnd - EXT },
      duration: b(2),
      ease: E.cut,
      immediateRender: false,
    },
    b(5.5),
  )

  /* ------------------------------------------------------------- sound */

  ctx.cue(b(0), 'pluck', { note: 'G5', gain: 0.5, pan: -0.35 })
  ctx.cue(b(0.25), 'pluck', { note: 'A5', gain: 0.5, pan: -0.25 })
  ctx.cue(b(0.5), 'pluck', { note: 'B5', gain: 0.5, pan: -0.15 })
  ctx.cue(b(1), 'pop', { note: 'D5', gain: 0.6, pan: 0.4 })
  ctx.cue(b(1.5), 'tick', { gain: 0.5, pan: 0.4 })
  ctx.cue(b(2), 'tick', { gain: 0.35, pan: 0.4 })
  ctx.cue(b(2.5), 'tick', { gain: 0.35, pan: 0.4 })
  ctx.cue(b(3), 'tick', { gain: 0.5, pan: 0.4 })
  ctx.cue(b(3.25), 'tick', { gain: 0.5, pan: 0.4 })
  ctx.cue(b(4), 'pop', { note: 'A5', gain: 0.7, pan: 0.4 })
  ctx.cue(b(5.5), 'riser', { dur: b(2.25), gain: 0.7 })
})
