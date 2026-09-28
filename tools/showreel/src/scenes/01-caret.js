/*
 * S1 — Caret. The reel's first frame is 'Hello|'. The caret steps back like an
 * arrow key, one letter swap makes Hallo, an 'a' and an 'o' trade places (the
 * Turn in two letters) while the dropped 'l' dents the baseline, the H is
 * flicked away and an accent falls onto the 'a': Olá. Then the caret turns 57°
 * and stretches into the Cut, the frame S2 slices open.
 *
 * Every glyph is its own absolutely placed box at the position a canvas
 * measure of the whole word gives it, so kerning survives the split and every
 * rearrangement is a tween between two measured layouts rather than a reflow.
 */
REEL.scene('01-caret', (ctx) => {
  const { tl, b, E, C, F } = ctx

  /* ------------------------------------------------------------ numbers */

  const BASE = 646
  const SIZE = 300
  const TRACK = -0.02 * SIZE
  const FONT = `800 ${SIZE}px ${F.display}`
  // A glyph's mask: tall enough for a cap, an 'l' and the acute above the
  // baseline, so a roll leaves through the box's edge and never through ink.
  const MH = 460
  const PADX = 60
  const MW = 300 + 2 * PADX

  const A_SIZE = 24
  const A_TRACK = 0.12 * A_SIZE
  const A_FONT = `800 ${A_SIZE}px ${F.display}`
  const A_LEFT = 120
  const A_BASE = 134
  const A_MH = 34
  const A_PAD = 4

  const CARET_W = 12
  const CARET_H = 190
  const CARET_GAP = 16
  const CARET_Y = 540 // 445-635

  const GUIDE_X0 = 120
  const GUIDE_X1 = 1800
  const DIP = 16
  const DIP_REACH = 120

  /* ---------------------------------------------------------- measuring */

  const meter = document.createElement('canvas').getContext('2d')
  meter.fontKerning = 'normal'

  /** Pen positions (kerned, tracked), advance and per-glyph ink, from the word's left. */
  function measure(text, font, track) {
    meter.font = font
    meter.letterSpacing = `${track}px`
    const chars = Array.from(text)
    const xs = chars.map((_, i) => meter.measureText(chars.slice(0, i).join('')).width)
    // Canvas adds the tracking after the last letter too; the advance does not.
    const adv = meter.measureText(text).width - track
    const ink = chars.map((ch, i) => {
      const m = meter.measureText(ch)
      return { l: xs[i] - m.actualBoundingBoxLeft, r: xs[i] + m.actualBoundingBoxRight }
    })
    return { xs, adv, ink }
  }

  function ascent(ch, font) {
    meter.font = font
    meter.letterSpacing = '0px'
    return meter.measureText(ch).actualBoundingBoxAscent
  }

  /** Where the baseline falls inside a line box of `lineH` — read from layout, not guessed. */
  function baselineIn(font, lineH) {
    const probe = ctx.el('div', {
      style: { position: 'absolute', left: '0', top: '0', font, lineHeight: `${lineH}px` },
      html: 'H<span style="display:inline-block;width:0;height:0"></span>',
    })
    const y = probe.lastChild.offsetTop
    probe.remove()
    return y
  }

  const bOff = baselineIn(FONT, MH)
  const aOff = baselineIn(A_FONT, A_MH)
  const XH = ascent('x', FONT)
  const ACC_TOP = ascent('á', FONT)
  // How far the round letters overshoot below the baseline.
  meter.font = FONT
  meter.letterSpacing = '0px'
  const DESC = Math.max(
    ...['e', 'a', 'o', 'O'].map((ch) => meter.measureText(ch).actualBoundingBoxDescent),
  )

  const hello = measure('Hello', FONT, TRACK)
  const hallo = measure('Hallo', FONT, TRACK)
  const hola = measure('Hola', FONT, TRACK)
  const ola = measure('Olá', FONT, TRACK)
  // Hallo keeps Hello's left edge: only the letters right of the swap move.
  const L_HELLO = 960 - hello.adv / 2
  const L_HOLA = 960 - hola.adv / 2
  const L_OLA = 960 - ola.adv / 2
  const at = (m, left) => m.xs.map((x) => left + x)
  const P_HELLO = at(hello, L_HELLO)
  const P_HALLO = at(hallo, L_HELLO)
  const P_HOLA = at(hola, L_HOLA)
  const P_OLA = at(ola, L_OLA)
  const inkMid = (m, left, i) => left + (m.ink[i].l + m.ink[i].r) / 2
  const gap = (m, left, i) => left + (m.ink[i].r + m.ink[i + 1].l) / 2

  /* ------------------------------------------------------------- layers */

  const box = (w, h, left = 0, top = 0) => ({
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${w}px`,
    height: `${h}px`,
  })

  // The guide sits behind the letters: a type-specimen rule, not a strike.
  const guideLayer = ctx.svgLayer()
  const guide = ctx.svg(
    'path',
    { d: '', fill: 'none', stroke: C.nightBorder, 'stroke-width': 1 },
    guideLayer,
  )

  const word = ctx.el('div', { style: box(1920, 1080) })
  const glyphStyle = {
    position: 'absolute',
    left: `${PADX}px`,
    top: '0',
    font: FONT,
    lineHeight: `${MH}px`,
    color: C.white,
    whiteSpace: 'pre',
  }

  /**
   * slot (layout x, lifts) > orbit (closed-form Turn offset) > up (rotations)
   * > mask (the glyph box) > one span per letter the slot will ever show.
   */
  function glyph(texts, x) {
    const slot = ctx.el('div', { style: box(MW, MH, 0, BASE - bOff) }, word)
    const orbit = ctx.el('div', { style: box(MW, MH) }, slot)
    const up = ctx.el('div', { style: box(MW, MH) }, orbit)
    const mask = ctx.el('div', { style: { ...box(MW, MH), overflow: 'hidden' } }, up)
    const spans = texts.map((t) => ctx.el('div', { text: t, style: glyphStyle }, mask))
    gsap.set(slot, { x: x - PADX, force3D: false })
    spans.forEach((s, i) => gsap.set(s, { yPercent: i === 0 ? 0 : -110, force3D: false }))
    return { slot, orbit, up, mask, spans }
  }

  const gH = glyph(['H'], P_HELLO[0])
  // The 'a' is an 'á' clipped below the x-height line, and the falling
  // accent is the same glyph clipped above it. Nunito's 'á' does not put its
  // bowl exactly where 'a' does, so only two halves of one glyph swap for
  // the whole glyph without a pixel changing.
  const gA = glyph(['e', 'á', 'á'], P_HELLO[1])
  const gL1 = glyph(['l'], P_HELLO[2])
  const gL2 = glyph(['l'], P_HELLO[3])
  const gO = glyph(['o', 'O'], P_HELLO[4])
  // The real 'á' waits in place, unseen, for the accent to land.
  gsap.set(gA.spans[2], { yPercent: 0, autoAlpha: 0 })

  // A roll happens in a window as tall as the letters it trades, from just
  // above the taller one to just under the baseline: the outgoing letter
  // sinks through the baseline rule, the incoming one drops in past the top
  // edge, and neither is ever seen as a slice hanging in the 460 px box. The
  // window reaches far enough below the baseline for the incoming letter's
  // 'pop' overshoot (10% of the travel) to show whole, not flattened.
  const rollWindow = (topInk) => {
    const top = bOff - topInk - 2
    const inner = topInk + 2 + DESC + 2
    const bottom = bOff + DESC + 2 + Math.ceil(inner / 8)
    return { clip: `inset(${top}px 0px ${MH - bottom}px 0px)`, pct: ((bottom - top) / MH) * 100 }
  }
  const FULL = 'inset(0px 0px 0px 0px)'
  // e -> a: the 'a' shows only below the x-height line + 4 (see the accent).
  const winA = rollWindow(Math.max(ascent('e', FONT), XH + 4))
  // o -> O: the capital's height.
  const winO = rollWindow(ascent('O', FONT))
  gsap.set(gA.mask, { clipPath: winA.clip })
  gsap.set(gA.spans[1], { yPercent: -winA.pct })
  gsap.set(gO.mask, { clipPath: winO.clip })
  gsap.set(gO.spans[1], { yPercent: -winO.pct })

  // The falling accent: what lies 4 px above the x-height; the letter keeps
  // the rest. No ink crosses the line, so the halves meet without a seam.
  const clipY = bOff - XH - 4
  gA.spans[1].style.clipPath = `inset(${clipY}px 0 0 0)`
  const accent = ctx.el(
    'div',
    { style: { ...box(MW, MH), clipPath: `inset(0 0 ${MH - clipY}px 0)` } },
    gA.up,
  )
  ctx.el('div', { text: 'á', style: glyphStyle }, accent)
  const accMid = (ola.ink[2].l - ola.xs[2] + (ola.ink[2].r - ola.xs[2])) / 2
  const accTopStage = BASE - ACC_TOP
  const ACC_FROM = -200 - accTopStage
  gsap.set(accent, {
    transformOrigin: `${PADX + accMid}px ${bOff - (ACC_TOP + XH + 4) / 2}px`,
    y: ACC_FROM,
    scale: 1.3,
    autoAlpha: 0,
    force3D: false,
  })

  /* --- the annotation: two rolling code letters, a fixed tail, an arrow */

  const CODES = ['EN', 'DE', 'ES', 'PT']
  const TAIL = ' · LATIN'
  const annot = CODES.map((code) => {
    const m = measure(code + TAIL + ' ', A_FONT, A_TRACK)
    return { c1: A_LEFT + m.xs[1], tail: A_LEFT + m.xs[2], arrow: A_LEFT + m.adv + A_TRACK }
  })
  const aStyle = {
    position: 'absolute',
    left: `${A_PAD}px`,
    top: '0',
    font: A_FONT,
    lineHeight: `${A_MH}px`,
    letterSpacing: `${A_TRACK}px`,
    color: C.faint,
    whiteSpace: 'pre',
  }
  const A_TOP = A_BASE - aOff
  const cellW = 24 + 2 * A_PAD
  const cells = [0, 1].map((k) => {
    const el = ctx.el('div', { style: { ...box(cellW, A_MH, 0, A_TOP), overflow: 'hidden' } })
    const spans = CODES.map((code, i) => {
      const s = ctx.el('div', { text: code[k], style: aStyle }, el)
      gsap.set(s, { yPercent: i === 0 ? 0 : -110, force3D: false })
      return s
    })
    gsap.set(el, { x: (k === 0 ? A_LEFT : annot[0].c1) - A_PAD, force3D: false })
    return { el, spans }
  })
  const tail = ctx.el('div', {
    text: TAIL,
    style: { ...aStyle, left: '0', top: `${A_TOP}px` },
  })
  gsap.set(tail, { x: annot[0].tail, force3D: false })

  // The arrow is drawn, never a glyph: 2 px stroke, 18 px shaft, 6 px head.
  const arrowLayer = ctx.svgLayer()
  const AY = Math.round(A_BASE - ascent('H', A_FONT) / 2)
  const arrow = ctx.svg(
    'path',
    {
      d: `M0 ${AY}h18M12 ${AY - 6}L18 ${AY}L12 ${AY + 6}`,
      fill: 'none',
      stroke: C.faint,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    arrowLayer,
  )
  gsap.set(arrow, { x: annot[0].arrow })

  /* ------------------------------------------------------------- caret */

  // A 100 px square scaled to size, so one element can be the caret and,
  // turned and stretched, the Cut.
  const caret = ctx.el('div', {
    style: { ...box(100, 100, -50, -50), background: C.white },
  })
  const caretAt = (x) => Math.round(x - CARET_W / 2) + CARET_W / 2
  const CX = {
    end: caretAt(L_HELLO + hello.ink[4].r + CARET_GAP + CARET_W / 2),
    lo: caretAt(gap(hello, L_HELLO, 3)),
    ll: caretAt(gap(hello, L_HELLO, 2)),
    el: caretAt(gap(hello, L_HELLO, 1)),
    al: caretAt(gap(hallo, L_HELLO, 1)),
    ola: caretAt(L_OLA + ola.ink[2].r + CARET_GAP + CARET_W / 2),
  }
  gsap.set(caret, {
    x: CX.end,
    y: CARET_Y,
    scaleX: CARET_W / 100,
    scaleY: CARET_H / 100,
    rotation: 0,
    force3D: false,
  })

  /* ---------------------------------------------------------- timeline */

  const d = { force3D: false }

  // 0-2 COUNT-IN: hard blinks on the beat grid; the word does not move.
  tl.set(caret, { autoAlpha: 0 }, b(0.5))
  tl.set(caret, { autoAlpha: 1 }, b(1))
  tl.set(caret, { autoAlpha: 0 }, b(1.5))

  // 2 / 2.25 / 2.5 ARROW KEYS: jumps, not tweens.
  tl.set(caret, { autoAlpha: 1, x: CX.lo }, b(2))
  tl.set(caret, { x: CX.ll }, b(2.25))
  tl.set(caret, { x: CX.el }, b(2.5))

  // 3 HELLO -> HALLO: one letter swapped inside its own box. The 'e' sinks
  // 'cut', so its end is the hit: it leaves on the beat, the way a backspace
  // lands, and the 'a' pops in from it. Started together, the pop outruns
  // the cut and the two letters pile up in the window.
  tl.to(gA.spans[0], { yPercent: winA.pct, ease: E.cut, duration: 0.12, ...d }, b(3) - 0.12)
  tl.to(gA.spans[1], { yPercent: 0, ease: E.pop, duration: 0.2, ...d }, b(3))
  // The window gives way to the whole box before the real 'á' needs it, and
  // the spent 'e', which the taller box would show again, goes below it.
  tl.set(gA.spans[0], { yPercent: 110 }, b(3.5))
  tl.set(gA.mask, { clipPath: FULL }, b(3.5))
  ;[gL1, gL2, gO].forEach((g, i) => {
    tl.to(g.slot, { x: P_HALLO[i + 2] - PADX, ease: E.snap, duration: 0.2, ...d }, b(3))
  })
  tl.set(caret, { x: CX.al }, b(3))
  tl.set(caret, { autoAlpha: 0 }, b(3.5))

  // 3.75 ANTICIPATION: the pair about to trade places rises.
  tl.to([gA.slot, gO.slot], { y: -10, ease: E.lift, duration: b(0.25), ...d }, b(3.75))

  // 4-5 THE TURN IN MINIATURE. The orbit itself is closed-form, in draw()
  // below; here only its landing: down into the beat, 4 px past, and settle.
  const aMid = inkMid(hallo, L_HELLO, 1)
  const oMid = inkMid(hallo, L_HELLO, 4)
  const RX = (oMid - aMid) / 2
  // Taller than wide, so the 'a' clears the two ascenders it passes over and
  // the 'o' passes under the falling 'l' rather than through it.
  const RY = RX * 1.3
  const SWAP = oMid - aMid
  tl.to([gA.slot, gO.slot], { y: 4, ease: E.cut, duration: b(0.25), ...d }, b(4.75))
  tl.to([gA.slot, gO.slot], { y: 0, ease: E.spring, duration: 0.2, ...d }, b(5))

  // 4.25 THE DROP, with an eighth-beat crouch upward first.
  const L2_MID = inkMid(hallo, L_HELLO, 3)
  gsap.set(gL2.up, {
    transformOrigin: `${PADX + (hallo.ink[3].l + hallo.ink[3].r) / 2 - hallo.xs[3]}px ${bOff - ascent('l', FONT) / 2}px`,
  })
  tl.to(gL2.slot, { y: -8, ease: E.lift, duration: b(0.125), ...d }, b(4.125))
  tl.to(gL2.slot, { y: 700, ease: E.cut, duration: 0.35, ...d }, b(4.25))
  tl.to(gL2.up, { rotation: 18, ease: E.cut, duration: 0.35, ...d }, b(4.25))

  // Close up and re-centre as Hola, locking on 5. The orbiting pair's slots
  // carry the orbit's end offset, so they land on Hola's pen positions. It
  // starts on 4.75 rather than 4.5: before that the falling 'l' is still in
  // the row, and a snap that early slides its neighbour into it.
  const close = { ease: E.snap, duration: b(0.25), ...d }
  tl.to(gH.slot, { x: P_HOLA[0] - PADX, ...close }, b(4.75))
  tl.to(gO.slot, { x: P_HOLA[1] - PADX + SWAP, ...close }, b(4.75))
  tl.to(gL1.slot, { x: P_HOLA[2] - PADX, ...close }, b(4.75))
  tl.to(gA.slot, { x: P_HOLA[3] - PADX - SWAP, ...close }, b(4.75))

  // 5.5 HOLA -> OLÁ: the H leans into the flick, then leaves stretched.
  meter.font = FONT
  meter.letterSpacing = '0px'
  const hInk = meter.measureText('H')
  gsap.set(gH.up, {
    transformOrigin: `${PADX + (hInk.actualBoundingBoxRight - hInk.actualBoundingBoxLeft) / 2}px ${bOff}px`,
  })
  tl.to(gH.up, { rotation: 6, ease: E.lift, duration: 0.06, ...d }, b(5.5))
  tl.to(gH.slot, { x: P_HOLA[0] - PADX - 1100, ease: E.cut, duration: 0.2, ...d }, b(5.625))
  tl.to(gH.up, { rotation: -40, scaleX: 1.2, ease: E.cut, duration: 0.2, ...d }, b(5.625))

  // o rolls to O as O, l, a close up on Olá's measured pen positions,
  // landing 6.25. Both wait until 5.875, an eighth later than 5.75: the flick
  // accelerates, so an earlier snap slides the O into the H that is still
  // there, and an O rolled in place (64 px wider than the o) overlaps the l.
  // As with the e, the 'o' sinks 'cut' into that beat — it goes as the H is
  // flicked — and the capital pops in from it.
  tl.to(gO.spans[0], { yPercent: winO.pct, ease: E.cut, duration: 0.12, ...d }, b(5.875) - 0.12)
  tl.to(gO.spans[1], { yPercent: 0, ease: E.pop, duration: 0.12, ...d }, b(5.875))
  const olaClose = { ease: E.snap, duration: b(0.375), ...d }
  tl.to(gO.slot, { x: P_OLA[0] - PADX + SWAP, ...olaClose }, b(5.875))
  tl.to(gL1.slot, { x: P_OLA[1] - PADX, ...olaClose }, b(5.875))
  tl.to(gA.slot, { x: P_OLA[2] - PADX - SWAP, ...olaClose }, b(5.875))

  // The accent falls from above the frame, shrinking from 1.3x as it comes
  // down, lands on 6.25 and hops twice (18 px, 6 px). Its fall starts out of
  // sight at 5.35 so that it crosses into the frame near 5.9 and lands at
  // about 4000 px/s, the tracked-object cap; dropped over the 0.175 s from
  // 5.9 it covered 600 px in three frames and hit at 10000 px/s.
  tl.set(accent, { autoAlpha: 1 }, b(5.35))
  tl.to(accent, { y: 0, scale: 1, ease: E.cut, duration: b(6.25 - 5.35), ...d }, b(5.35))
  const hop = (h, from) => {
    tl.to(accent, { y: -h, ease: E.lift, duration: b(0.0625), ...d }, b(from))
    tl.to(accent, { y: 0, ease: E.cut, duration: b(0.0625), ...d }, b(from + 0.0625))
  }
  hop(18, 6.25)
  hop(6, 6.375)
  // 6.5 the two halves become the real glyph, pixel for pixel.
  tl.set(accent, { autoAlpha: 0 }, b(6.5))
  tl.set(gA.spans[1], { autoAlpha: 0 }, b(6.5))
  tl.set(gA.spans[2], { autoAlpha: 1 }, b(6.5))

  // The annotation: only the changed letters roll, 32nd apart, and the rest
  // slides by whatever the new letters' widths change.
  function roll(i, beat) {
    cells.forEach((cell, k) => {
      const t0 = b(beat + k * 0.125)
      tl.to(cell.spans[i - 1], { yPercent: 110, ease: E.pop, duration: 0.06, ...d }, t0)
      tl.to(cell.spans[i], { yPercent: 0, ease: E.pop, duration: 0.06, ...d }, t0)
    })
    const s = annot[i]
    tl.to(cells[1].el, { x: s.c1 - A_PAD, ease: E.snap, duration: 0.2, ...d }, b(beat))
    tl.to(tail, { x: s.tail, ease: E.snap, duration: 0.2, ...d }, b(beat))
    tl.to(arrow, { x: s.arrow, ease: E.snap, duration: 0.2 }, b(beat))
  }
  roll(1, 3)
  roll(2, 5)
  roll(3, 6.5)

  // 6.75 the caret is back after Olá, counter-turns, and becomes the Cut:
  // turned +57° (90° -> 147°), 2600 px long, 3 px thin, centred on the stage.
  tl.set(caret, { autoAlpha: 1, x: CX.ola, y: CARET_Y, rotation: 0 }, b(6.75))
  tl.to(caret, { rotation: -6, ease: E.lift, duration: b(0.125), ...d }, b(6.75))
  // The turn leads and the stretch follows an eighth later, on the swell's
  // downbeat: the eye sees the caret itself swing to the Cut's angle, then
  // shoot out along it. Started together, 'snap' had a 900 px line most of the
  // way round in two frames and the caret never read as turning. Both land 7.5.
  tl.to(caret, { rotation: 57, ease: E.snap, duration: b(0.625), ...d }, b(6.875))
  tl.to(
    caret,
    { scaleX: 3 / 100, scaleY: 2600 / 100, x: 960, y: 540, ease: E.snap, duration: b(0.5), ...d },
    b(7),
  )
  // 7.5-8: nothing moves. S2 replicates this frame.

  /* -------------------------------------------------- closed-form draws */

  const eSnap = gsap.parseEase(E.snap)
  const eCut = gsap.parseEase(E.cut)
  const eGlide = gsap.parseEase(E.glide)
  const eSpring = gsap.parseEase(E.spring)
  const prog = (t, from, dur) => Math.max(0, Math.min(1, (t - from) / dur))
  const GY = BASE + 0.5

  ctx.draw((t) => {
    // The Turn: 'a' over the top, 'o' under the baseline, glyphs upright.
    const phi = Math.PI * eGlide(prog(t, b(4), b(1)))
    const ox = RX * (1 - Math.cos(phi))
    const oy = RY * Math.sin(phi)
    gA.orbit.style.transform = `translate(${ox}px, ${-oy}px)`
    gO.orbit.style.transform = `translate(${-ox}px, ${oy}px)`

    // The guide: drawn in from the left, dented by the falling 'l',
    // retracted to the right.
    const x1 = GUIDE_X0 + (GUIDE_X1 - GUIDE_X0) * eSnap(prog(t, b(3), b(0.5)))
    const x0 = GUIDE_X0 + (GUIDE_X1 - GUIDE_X0) * eCut(prog(t, b(6.5), b(0.25)))
    if (x1 - x0 < 0.5) {
      guide.setAttribute('d', '')
      return
    }
    let depth = 0
    if (t >= b(4.3) && t < b(4.6)) depth = DIP * eCut(prog(t, b(4.3), b(0.3)))
    else if (t >= b(4.6)) depth = DIP * (1 - eSpring(prog(t, b(4.6), 0.4)))
    if (Math.abs(depth) < 0.01) {
      guide.setAttribute('d', `M${x0} ${GY}H${x1}`)
      return
    }
    let path = `M${x0} ${GY}H${L2_MID - DIP_REACH}`
    for (let dx = -DIP_REACH + 6; dx <= DIP_REACH; dx += 6) {
      const w = 0.5 * (1 + Math.cos((Math.PI * dx) / DIP_REACH))
      path += `L${(L2_MID + dx).toFixed(2)} ${(GY + depth * w).toFixed(2)}`
    }
    guide.setAttribute('d', `${path}H${x1}`)
  })

  /* -------------------------------------------------------------- sound */

  ctx.cue(0, 'tick', { gain: 0.8 })
  ctx.cue(b(1), 'tick', { gain: 0.8 })
  ;[2, 2.25, 2.5].forEach((beat) => ctx.cue(b(beat), 'tick', { note: 'A6', gain: 0.45 }))
  ctx.cue(b(3), 'pluck', { note: 'E5' })
  ctx.cue(b(4), 'swish', { note: 'A5', pan: -0.6, dur: b(1) })
  ctx.cue(b(4), 'swish', { note: 'D5', pan: 0.6, dur: b(1) })
  ctx.cue(b(4.4), 'thunk', { note: 'D3', gain: 0.6 })
  ctx.cue(b(4.6), 'pop', { note: 'D4', gain: 0.6 })
  ctx.cue(b(5), 'pluck', { note: 'F#5' })
  ctx.cue(b(5.625), 'whoosh', { pan: -0.7, dur: 0.2 })
  ctx.cue(b(6.25), 'pop', { note: 'D6', gain: 0.7 })
  ctx.cue(b(6.375), 'pop', { note: 'D6', gain: 0.35 })
  ctx.cue(b(6.5), 'pop', { note: 'D6', gain: 0.18 })
  ctx.cue(b(6.5), 'pluck', { note: 'A5' })
  ctx.cue(b(6.75), 'tick', { gain: 0.7 })
  ctx.cue(b(6.875), 'swish', { dur: b(0.625) })
  ctx.cue(b(7), 'reverse', { dur: b(1) })
})
