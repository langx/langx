/*
 * 06 — Breath. The one quiet moment of the reel.
 *
 * The ember S5 leaves at (960,540) blooms into a white world. A 2 px ink
 * hairline, parallel to the Cut, walks right and leaves 'Merhaba' behind it;
 * it waits, then walks back, and behind it the same greeting comes back as
 * مرحبا, written from the right the way Arabic is — while ahead of it the
 * Latin is erased from its last letter.
 *
 * Everything is one Canvas2D layer redrawn from a proxy the timeline tweens:
 * the hairline is a moving clip boundary for two words at once, and doing the
 * clip, the measuring and the drawing in the same canvas means the ink boxes
 * we measure are exactly the ink we draw. The push-in is applied in the
 * canvas transform, so the type is re-rasterised at 1.03 rather than a
 * bitmap scaled up.
 */
REEL.scene('06-breath', (ctx) => {
  const { tl, b, E, C, CUT, GL } = ctx
  const CX = 960
  const CY = 540
  const INK = C.ink

  /* ------------------------------------------------------------ measuring */

  const cv = ctx.canvas()
  const g = cv.g

  const LATIN = 'Merhaba'
  const LATIN_PX = 240
  const LATIN_TRACK = -0.02 * LATIN_PX
  const latinFont = `800 ${LATIN_PX}px ${ctx.F.display}`
  const ar = GL.ar

  function measure(text, font, track, dir) {
    g.save()
    g.font = font
    g.letterSpacing = `${track}px`
    g.direction = dir
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    const m = g.measureText(text)
    g.restore()
    return m
  }

  // Merhaba's advance: the glyph advances plus the tracking between its
  // letters (not after the last one, which CSS and canvas both add).
  const latinPlain = measure(LATIN, latinFont, 0, 'ltr')
  const advance = latinPlain.width + LATIN_TRACK * (LATIN.length - 1)
  const latinM = measure(LATIN, latinFont, LATIN_TRACK, 'ltr')

  // The Arabic is sized so its advance equals Merhaba's: one whole word, no
  // tracking (tracking would break its joins).
  const probe = measure(ar.text, `800 100px ${ar.font}`, 0, 'rtl')
  const arabicPx = (100 * advance) / probe.width
  const arabicFont = `800 ${arabicPx.toFixed(2)}px ${ar.font}`
  const arabicM = measure(ar.text, arabicFont, 0, 'rtl')

  // Anchor each word (textAlign centre, alphabetic baseline) so its INK box is
  // centred on (960,540).
  const anchor = (m) => ({
    x: CX - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
    y: CY - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2,
  })
  const latinAt = anchor(latinM)
  const arabicAt = anchor(arabicM)

  /* ------------------------------------------------------------- timeline */

  // Everything the canvas reads. `off` is the hairline's horizontal offset
  // from (960,540); `half` its drawn half-length; `ar` switches layer B on.
  const P = { push: 1, r: 12, half: 0, off: -700, ar: 0 }

  // The only continuous motion: a linear 1.00 -> 1.03 creep over the slot.
  tl.fromTo(P, { push: 1 }, { push: 1.03, duration: ctx.dur, ease: 'none' }, 0)

  // 0-0.75 WHITE BLOOM out of the ember. It inhales first: the dot crouches
  // 8% over a 32nd on 'lift', then blooms on 'snap'. The crouch is also what
  // keeps frame 0 identical to S5's last: expo.out starting on b0 is already
  // r 14 a tenth of a millisecond in, where the runtime samples the first
  // frame, so the dot visibly jumped from 24 to 28 px on the cut.
  tl.fromTo(P, { r: 12 }, { r: 11, duration: b(0.125), ease: E.lift }, b(0))
  tl.fromTo(
    P,
    { r: 11 },
    { r: 1110, duration: b(0.625), ease: E.snap, immediateRender: false },
    b(0.125),
  )
  ctx.ground(C.white, b(0.75))

  // 0.75-1.25 the hairline draws out from its centre, both ways at once.
  // Its half-length goes only as far as the stage needs, not the spec's 1300:
  // at 33 degrees 1010 px already clears the top and bottom edges by 10 px
  // (991.5 reaches them) at every offset the line visits, and on expo.out the
  // visible tip then decelerates into the frame edge over about eight frames.
  // Drawn to 1300, the tip crossed the frame in two frames and read as a pop.
  const HALF = 1010
  tl.fromTo(
    P,
    { half: 0 },
    { half: HALF, duration: b(0.5), ease: E.snap, immediateRender: false },
    b(0.75),
  )

  // 1.25-2.75 it walks right and writes Merhaba in its reading direction.
  tl.fromTo(
    P,
    { off: -700 },
    { off: 700, duration: b(1.5), ease: E.glide, immediateRender: false },
    b(1.25),
  )

  // 4.0 layer B is on; the line sits clear of both words, so nothing shows.
  tl.set(P, { ar: 1 }, b(4))

  // 4.0-6.0 the rewrite, right to left. The spec's -700 mirrors the +700 rest,
  // which is clear of both words, but the advance-matched Arabic stands 410 px
  // tall and at -700 the line still crosses the top of the alif: the word sat
  // unfinished, notched at 33 degrees, through the glide's slow landing on b6.
  // So the rewrite comes to rest where the line clears the Arabic ink box's
  // top-left corner by 8 px (about -800), and the word is whole on the beat.
  const [dux, duy] = CUT.dUp
  const arInkLeft = arabicAt.x - arabicM.actualBoundingBoxLeft
  const arInkTop = arabicAt.y - arabicM.actualBoundingBoxAscent
  const REST = Math.min(-700, arInkLeft - 8 - CX - ((arInkTop - CY) / duy) * dux)
  // The wind-up: in the last 16th of the stillness the line leans back 5% of
  // the walk to come, to the right, on 'lift', and the glide leaves from
  // there. Both ends are at rest, so the lean and the walk join without a
  // kink; leaning right only hides more of the Arabic and none of the Latin.
  const LEAN = 0.05 * (700 - REST)
  tl.fromTo(
    P,
    { off: 700 },
    { off: 700 + LEAN, duration: b(0.25), ease: E.lift, immediateRender: false },
    b(3.75),
  )
  tl.fromTo(
    P,
    { off: 700 + LEAN },
    { off: REST, duration: b(2), ease: E.glide, immediateRender: false },
    b(4),
  )

  // 6.0-6.5 it accelerates out. The spec's -1600 still leaves the line across
  // the top-left corner (at 33 degrees it needs x < 0 at y = 0), so it goes
  // on to -1800, where every point of it is off the stage scaled to 1.03.
  tl.fromTo(
    P,
    { off: REST },
    { off: -1800, duration: b(0.5), ease: E.cut, immediateRender: false },
    b(6),
  )

  /* ---------------------------------------------------------------- sound */

  ctx.cue(b(0.75), 'shimmer', { note: 'A6', gain: 0.45, dur: b(0.75) })
  // The sweeps travel with the line: left to right as it writes, right to
  // left as it rewrites, and out past the left edge as it leaves.
  ctx.cue(b(1.25), 'whoosh', { gain: 0.35, pan: -0.7, panTo: 0.7, dur: b(1.5) })
  ctx.cue(b(4), 'reverse', { gain: 0.5, pan: 0.7, panTo: -0.7, dur: b(2) })
  ctx.cue(b(6), 'swish', { gain: 0.5, pan: -0.6, panTo: -1 })

  /* ----------------------------------------------------------------- draw */

  const [ux, uy] = CUT.dUp
  const [nx, ny] = CUT.n
  const FAR = 4000

  // The half-plane on one side of the hairline: side -1 is left of it (the
  // side the Cut's normal points away from), +1 is right.
  function halfPlane(px, side) {
    const ax = px + FAR * ux
    const ay = CY + FAR * uy
    const bx = px - FAR * ux
    const by = CY - FAR * uy
    g.beginPath()
    g.moveTo(ax, ay)
    g.lineTo(bx, by)
    g.lineTo(bx + side * FAR * nx, by + side * FAR * ny)
    g.lineTo(ax + side * FAR * nx, ay + side * FAR * ny)
    g.closePath()
  }

  function word(text, font, track, dir, at, px, side) {
    g.save()
    halfPlane(px, side)
    g.clip()
    g.font = font
    g.letterSpacing = `${track}px`
    g.direction = dir
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.fillStyle = INK
    g.fillText(text, at.x, at.y)
    g.restore()
  }

  ctx.draw((t) => {
    cv.clear()
    const s = P.push
    g.translate(CX, CY)
    g.scale(s, s)
    g.translate(-CX, -CY)

    if (t < b(0.75)) {
      g.fillStyle = C.white
      g.beginPath()
      g.arc(CX, CY, P.r, 0, Math.PI * 2)
      g.fill()
      return
    }

    const px = CX + P.off
    word(LATIN, latinFont, LATIN_TRACK, 'ltr', latinAt, px, -1)
    if (P.ar) word(ar.text, arabicFont, 0, 'rtl', arabicAt, px, 1)

    if (P.half > 0) {
      g.strokeStyle = INK
      g.lineWidth = 2
      g.lineCap = 'butt'
      g.beginPath()
      g.moveTo(px - P.half * ux, CY - P.half * uy)
      g.lineTo(px + P.half * ux, CY + P.half * uy)
      g.stroke()
    }
  })
})
