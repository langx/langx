/*
 * 03 — Specimen Grid. THE DROP.
 *
 * S2's last frame, 你好 on ink, turns out to have been one cell of a 4×4 grid
 * of greetings seen at zoom 4. The camera pulls back on the downbeat, the
 * other fifteen reels stop in rings around it, and a single yellow cursor
 * cell hops through the grid on the beat while a row and a column
 * conveyor-slide. On b20 the grid splits into 8×8; the 63 reels stop along a
 * front that travels along the Cut's normal, the cursor carries 'Hola' three
 * cells, everything else flips blank in rings closing on it, and the yellow
 * cell becomes Sofia's chat bubble.
 *
 * Everything is one Canvas2D layer. The greetings come from an atlas
 * rasterised once after the fonts load, at the stage's own pixel density:
 * canvas fillText shapes Arabic, Devanagari and Thai properly, and 64 reels
 * of blits are cheap where 64 reels of shaping would not be. While the
 * camera is still zoomed in the atlas would be upscaled, so those few frames
 * set the type directly instead.
 *
 * Every per-cell motion — reel positions, flips, conveyors, ring timings — is
 * closed-form in the beat, built from the style bible's eases; the few
 * whole-scene scalars (zoom, rule growth, the bubble morph) are tweened on
 * the timeline and read by the draw.
 *
 * On the 9:16 stage the grid is the same 4×4 and 8×8, built of portrait
 * cells (270×480, then 135×240), so it still fills the frame. The story is
 * re-staged for the phone rather than rotated: the cursor's path stays in the
 * middle of the frame, clear of the feed's chrome, the conveyors run along
 * the bottom row and the right-hand column where that chrome sits, and Han,
 * kana and Hangul stand as vertical columns, which the tall cells are shaped
 * for. The sound is always scheduled from the wide story, so both cuts share
 * one score.
 */
REEL.scene('03-grid', (ctx) => {
  const { tl, b, E, C, G, F, CUT, W, H, CX, CY } = ctx
  const PORTRAIT = ctx.portrait
  const BEAT = ctx.BEAT

  const cv = ctx.canvas()
  const g = cv.g
  const K = cv.k

  const ease = (name) => (typeof E[name] === 'function' ? E[name] : gsap.parseEase(E[name]))
  const POP = ease('pop')
  const CUTE = ease('cut')
  const LIFT = ease('lift')
  const WHIP = ease('whip')
  const lerp = (a, z, p) => a + (z - a) * p

  /* ------------------------------------------------------------ constants */

  // 480×270 and 240×135 wide; 270×480 and 135×240 on the 9:16 stage.
  const CW4 = W / 4
  const CH4 = H / 4
  const CW8 = W / 8
  const CH8 = H / 8
  // The pull-back's fixed point: cell (1,1) fills the stage at zoom 4.
  const ZX = PORTRAIT ? 360 : 640
  const ZY = PORTRAIT ? 640 : 360

  // A reel runs one cell per 16th. It stops on back.out(1.7): starting that
  // ease with the reel's own speed means covering v·D/4.7 cells in it, and
  // the ease first reaches its target 37% of the way in — that crossing is
  // the moment the reel lands on its beat; the 8% overshoot comes after.
  const V = 16
  const STOP = 0.25
  const CROSS = 1 - 1.7 / 2.7
  const POP_V0 = 4.7

  // A card flip is 0.18 s: a 'cut' into edge-on, then a 'pop' out of it. The
  // ground and the ink swap on the edge-on frame, which sits on the beat.
  const HALF = 0.18

  const GROUND = {
    d: { fill: C.deep, text: C.white, label: C.faint, ck: 'D' },
    f: { fill: C.fill, text: C.ink, label: C.muted, ck: 'L' },
    w: { fill: C.white, text: C.ink, label: C.muted, ck: 'L' },
    y: { fill: C.yellow, text: C.onYellow, label: C.onYellow, ck: 'Y' },
  }
  const INKS = {
    D: [C.white, C.faint],
    L: [C.ink, C.muted],
    Y: [C.onYellow, C.onYellow],
  }
  // A portrait cell is 270 wide: 56 px is the largest size that sets Merhaba
  // and Γειά σου inside it with a margin, and the 8×8 halves it.
  const SIZE = {
    4: { word: PORTRAIT ? 56 : 72, label: 14, lx: 16, ly: 28, step: 22 },
    8: { word: PORTRAIT ? 28 : 40, label: 10, lx: 10, ly: 19, step: 16 },
  }
  // In a tall cell Han, kana and Hangul are set as a vertical column, the way
  // all three are traditionally read: a five-syllable greeting stands in the
  // cell's height instead of overrunning its width.
  const COLUMN = PORTRAIT ? new Set(['zh', 'ja', 'ko']) : new Set()

  const WI = Object.fromEntries(G.map((x, i) => [x.lang, i]))
  const CODE = G.map((x) => x.lang.toUpperCase())
  const NUNITO = (i) => G[i].font === F.display

  /* ------------------------------------------------------------ measuring */

  const scratch = document.createElement('canvas').getContext('2d')
  const metricsCache = new Map()
  function metrics(text, font, ls) {
    const key = `${text}|${font}|${ls}`
    let m = metricsCache.get(key)
    if (!m) {
      scratch.font = font
      scratch.letterSpacing = `${ls}px`
      scratch.direction = 'ltr'
      const r = scratch.measureText(text)
      m = {
        L: r.actualBoundingBoxLeft,
        R: r.actualBoundingBoxRight,
        A: r.actualBoundingBoxAscent,
        D: r.actualBoundingBoxDescent,
        adv: r.width,
      }
      metricsCache.set(key, m)
    }
    return m
  }

  // Latin, Cyrillic and Greek take the display tracking; the other scripts
  // are set solid (tracking would pull Arabic's joins apart).
  const wordFont = (i, px) => `800 ${px}px ${G[i].font}`
  const wordTrack = (i, px) => (NUNITO(i) || G[i].lang === 'el' ? -0.02 * px : 0)
  const labelFont = (px) => `800 ${px}px ${F.display}`
  const labelTrack = (px) => 0.14 * px

  // A vertical column, set solid: each character centred on the column's
  // axis by its advance, one em apart. Runs are relative to the ink centre.
  const columnCache = new Map()
  function column(i, px) {
    const key = `${i}|${px}`
    let col = columnCache.get(key)
    if (!col) {
      const font = wordFont(i, px)
      let l = Infinity
      let r = -Infinity
      let t = Infinity
      let bt = -Infinity
      const runs = [...G[i].text].map((ch, j) => {
        const m = metrics(ch, font, 0)
        const x = -m.adv / 2
        const y = j * px
        l = Math.min(l, x - m.L)
        r = Math.max(r, x + m.R)
        t = Math.min(t, y - m.A)
        bt = Math.max(bt, y + m.D)
        return { ch, x, y }
      })
      const cx = (l + r) / 2
      const cy = (t + bt) / 2
      col = {
        font,
        runs: runs.map((q) => ({ ch: q.ch, x: q.x - cx, y: q.y - cy })),
        hw: (r - l) / 2,
        hh: (bt - t) / 2,
      }
      columnCache.set(key, col)
    }
    return col
  }
  const isColumn = (i) => COLUMN.has(G[i].lang)

  // Half the ink box of a greeting, around its centre.
  function inkHalf(i, px) {
    if (isColumn(i)) {
      const col = column(i, px)
      return [col.hw, col.hh]
    }
    const k = metrics(G[i].text, wordFont(i, px), wordTrack(i, px))
    return [(k.L + k.R) / 2, (k.A + k.D) / 2]
  }

  /* -------------------------------------------------------------- atlas */

  function makeColumnSprite(i, px, color) {
    const col = column(i, px)
    const pad = 3
    const c = document.createElement('canvas')
    c.width = Math.ceil((2 * col.hw + 2 * pad) * K)
    c.height = Math.ceil((2 * col.hh + 2 * pad) * K)
    const x = c.getContext('2d')
    x.scale(K, K)
    x.font = col.font
    x.direction = 'ltr'
    x.fillStyle = color
    for (const q of col.runs) x.fillText(q.ch, pad + col.hw + q.x, pad + col.hh + q.y)
    return { c, w: c.width / K, h: c.height / K, ix: pad + col.hw, iy: pad + col.hh }
  }

  function makeSprite(text, font, ls, color) {
    const m = metrics(text, font, ls)
    const pad = 3
    const w = m.L + m.R + 2 * pad
    const h = m.A + m.D + 2 * pad
    const c = document.createElement('canvas')
    c.width = Math.ceil(w * K)
    c.height = Math.ceil(h * K)
    const x = c.getContext('2d')
    x.scale(K, K)
    x.font = font
    x.letterSpacing = `${ls}px`
    x.direction = 'ltr'
    x.fillStyle = color
    x.fillText(text, pad + m.L, pad + m.A)
    return {
      c,
      w: c.width / K,
      h: c.height / K,
      ix: pad + (m.L + m.R) / 2, // ink centre inside the sprite
      iy: pad + (m.A + m.D) / 2,
      ox: pad + m.L, // text origin inside the sprite (left, baseline)
      oy: pad + m.A,
    }
  }

  const atlas = new Map()
  for (const mode of [4, 8]) {
    const s = SIZE[mode]
    for (const ck of Object.keys(INKS)) {
      G.forEach((gr, i) => {
        atlas.set(
          `w${i}|${mode}|${ck}`,
          isColumn(i)
            ? makeColumnSprite(i, s.word, INKS[ck][0])
            : makeSprite(gr.text, wordFont(i, s.word), wordTrack(i, s.word), INKS[ck][0]),
        )
        atlas.set(
          `l${i}|${mode}|${ck}`,
          makeSprite(CODE[i], labelFont(s.label), labelTrack(s.label), INKS[ck][1]),
        )
      })
    }
  }

  function blit(sp, cx, cy, sx, sy, snapPx) {
    let x = cx - sp.ix * sx
    let y = cy - sp.iy * sy
    if (snapPx) {
      x = Math.round(x * K) / K
      y = Math.round(y * K) / K
    }
    g.drawImage(sp.c, x, y, sp.w * sx, sp.h * sy)
  }

  function blitOrigin(sp, x0, y0, snapPx) {
    let x = x0 - sp.ox
    let y = y0 - sp.oy
    if (snapPx) {
      x = Math.round(x * K) / K
      y = Math.round(y * K) / K
    }
    g.drawImage(sp.c, x, y, sp.w, sp.h)
  }

  // Direct setting, for the frames where the camera is still zoomed in.
  function wordDirect(i, px, color, cx, cy, sx, sy) {
    if (isColumn(i)) {
      const col = column(i, px)
      g.save()
      g.font = col.font
      g.letterSpacing = '0px'
      g.fillStyle = color
      g.translate(cx, cy)
      g.scale(sx, sy)
      for (const q of col.runs) g.fillText(q.ch, q.x, q.y)
      g.restore()
      return
    }
    const font = wordFont(i, px)
    const ls = wordTrack(i, px)
    const m = metrics(G[i].text, font, ls)
    g.save()
    g.font = font
    g.letterSpacing = `${ls}px`
    g.fillStyle = color
    g.translate(cx, cy)
    g.scale(sx, sy)
    g.fillText(G[i].text, -(m.R - m.L) / 2, (m.A - m.D) / 2)
    g.restore()
  }

  function labelDirect(i, px, color, x, y) {
    g.save()
    g.font = labelFont(px)
    g.letterSpacing = `${labelTrack(px)}px`
    g.fillStyle = color
    g.fillText(CODE[i], x, y)
    g.restore()
  }

  /* ------------------------------------------- S2's frame, as cell (1,1) */

  // Drawn in S2's own stage coordinates and scaled into the cell, so at zoom
  // 4 the transform is the identity and the frame is S2's last one. S2 centres
  // by the pixels a canvas actually inks, so this measures the same way.
  function scanInk(str, font, px, ls) {
    const pad = Math.ceil(px * 0.5)
    const c = document.createElement('canvas')
    const x = c.getContext('2d', { willReadFrequently: true })
    x.font = font
    x.letterSpacing = `${ls}px`
    const w = Math.ceil(x.measureText(str).width + Math.abs(ls) * str.length + pad * 2)
    const h = Math.ceil(px * 2.4)
    const base = Math.round(px * 1.6)
    c.width = w
    c.height = h
    x.font = font
    x.letterSpacing = `${ls}px`
    x.fillText(str, pad, base)
    const data = x.getImageData(0, 0, w, h).data
    let l = w
    let r = -1
    let t = h
    let bt = -1
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (data[(yy * w + xx) * 4 + 3] < 128) continue
        if (xx < l) l = xx
        if (xx > r) r = xx
        if (yy < t) t = yy
        bt = yy
      }
    }
    return { l: l - pad, r: r + 1 - pad, t: t - base, b: bt + 1 - base }
  }
  const ZH = G[WI.zh]
  // Wide: 480 px, annotation at (120, baseline 134). Portrait: 400 px, (96, 284).
  const zhPx = PORTRAIT ? 400 : 480
  const annL = PORTRAIT ? 96 : 120
  const annB = PORTRAIT ? 284 : 134
  const zhFont = `800 ${zhPx}px ${ZH.font}`
  const zhInk = scanInk(ZH.text, zhFont, zhPx, 0)
  const zhX = CX - (zhInk.l + zhInk.r) / 2
  // S2 sets it in the DOM, which puts a text baseline on a whole pixel.
  const zhY = Math.round(CY - (zhInk.t + zhInk.b) / 2)
  const annFont = `800 24px ${F.display}`
  const annTrack = 0.12 * 24
  const annText = 'ZH · HAN'
  // S2's arrow is a 30 px <svg> box placed at (cx - 15, cy - 15), which the
  // browser paints on whole pixels, then slid by a GSAP x from its 'PT ·
  // LATIN' home to here. Reproduce that snapping, or the arrow sits half a
  // pixel off S2's on the handoff frame.
  const arrowHome = annL + metrics('PT · LATIN ', annFont, annTrack).adv
  const arrowX =
    annL +
    metrics(`${annText} `, annFont, annTrack).adv +
    (Math.round(arrowHome - 6) - (arrowHome - 6))
  const capMid = annB + scanInk('PTLATIN', annFont, 24, annTrack).t / 2 // mid cap height
  const arrowY = Math.round(capMid - 15) + 15

  function drawComposition(x, y, sc) {
    g.save()
    g.translate(x, y)
    g.scale(sc, sc)
    g.font = zhFont
    g.letterSpacing = '0px'
    g.fillStyle = C.white
    g.fillText(ZH.text, zhX, zhY)
    g.font = annFont
    g.letterSpacing = `${annTrack}px`
    g.fillStyle = C.faint
    g.fillText(annText, annL, annB)
    // The arrow is drawn, never a glyph: 2 px stroke, 18 px shaft, 6 px head.
    g.strokeStyle = C.faint
    g.lineWidth = 2
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(arrowX, arrowY)
    g.lineTo(arrowX + 18, arrowY)
    g.moveTo(arrowX + 12, arrowY - 6)
    g.lineTo(arrowX + 18, arrowY)
    g.lineTo(arrowX + 12, arrowY + 6)
    g.stroke()
    g.restore()
  }

  /* ------------------------------------------------------------ staging */

  // Where things happen, per stage. Cells are (column, row). The cursor
  // starts on `start`, hops on 1, 2 and 3, and its last 4×4 cell is where
  // Hola trades in on 2 (from `hola`); on 4 it keeps that cell's top-left
  // quarter and hops on 5, 5.5 and 6, ending on the cell that becomes the
  // bubble. `row` slides right on 1.3-2, `col` slides down on 2.3-3.
  // prettier-ignore
  const STAGES = {
    wide: {
      W: 1920,
      H: 1080,
      // [word, ground] by row; the cursor starts on Hello, whose own ground is white.
      INIT: [
        ['es', 'f'], ['fr', 'd'], ['hi', 'w'], ['ru', 'f'],
        ['ar', 'w'], ['zh', 'd'], ['ko', 'f'], ['pt', 'd'],
        ['he', 'd'], ['it', 'f'], ['ja', 'w'], ['de', 'd'],
        ['tr', 'w'], ['th', 'd'], ['en', 'w'], ['el', 'f'],
      ],
      start: [2, 3],
      hops: [[3, 1], [3, 0], [1, 0]],
      hola: [0, 0],
      row: 2,
      col: 0,
      hops8: [[3, 1], [2, 1], [1, 1]],
    },
    // The phone: the cursor never leaves the middle of the frame (rows 0-2,
    // columns 0-2, away from the caption band and the button rail), and the
    // conveyors are the bottom row and the right-hand column — texture under
    // the chrome. The grounds are a proper three-colouring: no two cells of
    // one ground share an edge.
    vertical: {
      W: 1080,
      H: 1920,
      INIT: [
        ['es', 'f'], ['ar', 'w'], ['he', 'd'], ['tr', 'f'],
        ['fr', 'w'], ['zh', 'd'], ['it', 'f'], ['th', 'd'],
        ['hi', 'd'], ['ko', 'f'], ['en', 'd'], ['ja', 'f'],
        ['ru', 'w'], ['pt', 'd'], ['de', 'f'], ['el', 'w'],
      ],
      start: [2, 2],
      hops: [[0, 1], [2, 0], [1, 1]],
      hola: [0, 0],
      row: 3,
      col: 3,
      hops8: [[3, 3], [2, 3], [1, 2]],
    },
  }

  /*
   * The whole story — every reel, flip, conveyor and ring — for one staging,
   * as data. Each call draws from its own seeded sources, so the wide story
   * is the same wherever it is built: the picture uses this stage's, the
   * sound always the wide one's.
   */
  function story(L) {
    const CW4s = L.W / 4
    const CW8s = L.W / 8
    const CH8s = L.H / 8

    /* ------------------------------------------------------------- reels */

    const RS = ctx.rng(3002)
    const randWord = (avoid) => {
      for (;;) {
        const w = Math.floor(RS() * G.length)
        if (!avoid.includes(w)) return w
      }
    }

    /**
     * A reel's position P (in cells; items move down as it grows) as a pure
     * function of the beat. Either already spinning since T0, or starting from
     * rest at tA with a 'lift' counter-nudge and a 'cut' spin-up. Speed is
     * trimmed so the landing item is a whole number of cells away and the
     * velocity is continuous into the 'pop' stop.
     */
    function makeReel(o) {
      const tE = o.tStop - CROSS * STOP
      let P
      let Kf
      let kMin
      if (o.tA == null) {
        const d = (V * STOP) / POP_V0
        Kf = Math.ceil(d + V * (tE - o.T0)) + 1
        P = (t) =>
          t < tE ? Kf - d - V * (tE - t) : t < tE + STOP ? Kf - d + d * POP((t - tE) / STOP) : Kf
        kMin = Math.floor(P(o.T0)) - 1
      } else {
        const a = 0.125
        const acc = 0.125
        const back = 0.06
        const t1 = o.tA + a + acc
        const span = acc / 3 + (tE - t1) + STOP / POP_V0
        Kf = Math.max(2, Math.round(V * span))
        const v = (Kf + back) / span
        const d = (v * STOP) / POP_V0
        const x1 = (v * acc) / 3
        P = (t) => {
          if (t < o.tA) return 0
          if (t < o.tA + a) return -back * LIFT((t - o.tA) / a)
          if (t < t1) return -back + x1 * CUTE((t - o.tA - a) / acc)
          if (t < tE) return -back + x1 + v * (t - t1)
          if (t < tE + STOP) return Kf - d + d * POP((t - tE) / STOP)
          return Kf
        }
        kMin = -2
      }
      const strip = []
      for (let k = kMin; k <= Kf + 1; k++) {
        if (k === Kf) strip.push(o.to)
        else if (k === 0 && o.tA != null) strip.push(o.from)
        else strip.push(randWord([strip[strip.length - 1], o.to, o.from]))
      }
      const at = (k) => strip[Math.max(0, Math.min(strip.length - 1, k - kMin))]
      return {
        P,
        at,
        to: o.to,
        tA: o.tA == null ? -Infinity : o.tA,
        tStop: o.tStop,
        end: tE + STOP,
      }
    }
    const still = (word) => ({
      P: () => 0,
      at: () => word,
      to: word,
      tA: -Infinity,
      end: -Infinity,
    })

    /* ---------------------------------------------------- the 4×4 story */

    const ID = (c, r) => r * 4 + c
    const START = ID(...L.start)
    const [H1, H2, H3] = L.hops.map((h) => ID(...h))
    const HOLA = ID(...L.hola)
    const cards = L.INIT.map(([lang, base], id) => ({
      id,
      c0: id % 4,
      r0: Math.floor(id / 4),
      word: WI[lang],
      base,
      yellow0: id === START,
      reels: [],
      flips: [],
      labelRolls: [],
    }))

    // Conveyors: a 1/8-beat 'lift' counter-nudge, then one cell on 'whip'.
    const ROW = { row: L.row, t0: 1.175, t1: 1.3, t2: 2.0 }
    const COL = { col: L.col, t0: 2.175, t1: 2.3, t2: 3.0 }
    function convOff(tb, M) {
      if (tb < M.t0) return 0
      if (tb < M.t1) return -0.06 * LIFT((tb - M.t0) / (M.t1 - M.t0))
      if (tb < M.t2) return -0.06 + 1.06 * WHIP((tb - M.t1) / (M.t2 - M.t1))
      return 1
    }
    function posAt(card, tb) {
      let c = card.c0
      let r = card.r0
      let ox = 0
      let oy = 0
      let axis = null
      if (r === ROW.row) {
        const o = convOff(tb, ROW)
        if (tb >= ROW.t2) c = (c + 1) % 4
        else if (o !== 0) {
          ox = o
          axis = ROW
        }
      }
      if (c === COL.col && !axis) {
        const o = convOff(tb, COL)
        if (tb >= COL.t2) r = (r + 1) % 4
        else if (o !== 0) {
          oy = o
          axis = COL
        }
      }
      return { c, r, ox, oy, axis }
    }
    const cardAt = (c, r, tb) =>
      cards.find((k) => {
        const p = posAt(k, tb)
        return p.c === c && p.r === r && !p.axis
      })
    const reelAt = (card, tb) => {
      let cur = card.reels[0]
      for (const r of card.reels) if (r.tA <= tb) cur = r
      return cur
    }
    const wordAt = (card, tb) => reelAt(card, tb).to

    // The pull-back: every cell but (1,1) is mid-spin and stops in Chebyshev
    // rings around it. From (1,1) a 4×4 grid only has rings 1 and 2.
    const R1 = ctx.rng(3001)
    const pick = (list) => list[Math.floor(R1() * list.length)]
    const RING_STOP = { 1: 0.5, 2: 0.625 }
    const carried = []
    {
      const pool = cards.filter((k) => ![ID(1, 1), START, H1].includes(k.id))
      while (carried.length < 2) {
        const k = pick(pool)
        if (!carried.includes(k)) carried.push(k)
      }
    }
    for (const card of cards) {
      if (card.id === ID(1, 1)) {
        card.reels.push(still(-1))
        card.reels.push(makeReel({ tA: 0.5, tStop: 1.0, from: -1, to: card.word }))
        continue
      }
      const ring = Math.max(Math.abs(card.c0 - 1), Math.abs(card.r0 - 1))
      const tStop = carried.includes(card) ? 1.0 : RING_STOP[ring]
      card.reels.push(makeReel({ tA: null, T0: 0, tStop, to: card.word }))
    }

    // Beat rolls: three non-cursor cells slot-roll and land on the beat.
    function roll(card, tStop, to) {
      const from = wordAt(card, tStop - 0.5)
      card.reels.push(makeReel({ tA: tStop - 0.5, tStop, from, to }))
    }
    function freshWord(card, tStop) {
      const p = posAt(card, tStop)
      const avoid = [wordAt(card, tStop - 0.5)]
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = cardAt((p.c + dc + 4) % 4, (p.r + dr + 4) % 4, tStop)
        if (n) avoid.push(wordAt(n, tStop - 0.5))
      }
      for (;;) {
        const w = Math.floor(R1() * G.length)
        if (!avoid.includes(w)) return w
      }
    }
    // 2.0: Hola trades cells with the cursor's last 4×4 stop, so the third
    // hop lands on Hola.
    roll(cards[H3], 2.0, WI.es)
    roll(cards[HOLA], 2.0, cards[H3].word)
    {
      const skip = [H3, HOLA, H1, H2]
      const pool = cards.filter((k) => k.r0 !== ROW.row && !skip.includes(k.id))
      const k = pick(pool)
      roll(k, 2.0, freshWord(k, 2.0))
    }
    {
      const inCol = (k) => posAt(k, 2.5).c === COL.col
      const skip = [H2, H3]
      const pool = cards.filter((k) => !inCol(k) && !skip.includes(k.id))
      const chosen = []
      while (chosen.length < 3) {
        const k = pick(pool)
        if (!chosen.includes(k)) chosen.push(k)
      }
      for (const k of chosen) roll(k, 3.0, freshWord(k, 3.0))
    }

    // The cursor hops on 1, 2 and 3: the old and the new cell flip together.
    const HOPS4 = [
      [1.0, START, H1],
      [2.0, H1, H2],
      [3.0, H2, H3],
    ]
    for (const [tc, from, to] of HOPS4) {
      cards[from].flips.push({ tc, from: 'y', to: cards[from].base })
      cards[to].flips.push({ tc, from: cards[to].base, to: 'y' })
    }
    const isYellow = (card, tb) => {
      let y = card.yellow0
      for (const f of card.flips) if (tb >= f.tc) y = f.to === 'y'
      return y
    }

    // On every 16th one cell's code label rolls (through two others, back to its own).
    {
      let prev = null
      for (let i = 0; i < 12; i++) {
        const t0 = 1 + i * 0.25
        const t1 = t0 + 0.25
        const pool = cards.filter((k) => {
          if (k === prev || isYellow(k, t0) || isYellow(k, t1)) return false
          if (k.flips.some((f) => f.tc + HALF > t0 && f.tc - HALF < t1)) return false
          if (k.reels.some((r) => r.tA < t1 && r.end > t0)) return false
          const a = posAt(k, t0)
          const z = posAt(k, t1)
          return !a.axis && !z.axis && a.c === z.c && a.r === z.r
        })
        const k = pick(pool)
        const own = wordAt(k, t0)
        k.labelRolls.push({
          t0,
          codes: [own, randWord([own]), randWord([own]), own],
        })
        prev = k
      }
    }

    /* ---------------------------------------------------- the 8×8 story */

    // Each 8×8 cell keeps the ground of the 4×4 cell it was cut from; the
    // cursor keeps only its top-left quarter.
    const R3 = ctx.rng(3003)
    const Q = [2 * L.hops[2][0], 2 * L.hops[2][1]]
    const FIN = L.hops8[2]
    // The stage's half-extent along n: 975.7 wide.
    const HN = (L.W / 2) * CUT.n[0] + (L.H / 2) * CUT.n[1]
    const cells = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const parent = cardAt(c >> 1, r >> 1, 3.75)
        const cx = c * CW8s + CW8s / 2
        const cy = r * CH8s + CH8s / 2
        const p = (cx - L.W / 2) * CUT.n[0] + (cy - L.H / 2) * CUT.n[1]
        const avoid = [WI.es]
        if (c > 0) avoid.push(cells[cells.length - 1].word)
        if (r > 0) avoid.push(cells[cells.length - 8].word)
        let word
        do word = Math.floor(R3() * G.length)
        while (avoid.includes(word))
        const cell = {
          c,
          r,
          base: parent.base,
          word,
          ring: Math.max(Math.abs(c - FIN[0]), Math.abs(r - FIN[1])),
          yellow0: c === Q[0] && r === Q[1],
          flips: [],
          reel: null,
        }
        if (!cell.yellow0)
          cell.reel = makeReel({ tA: null, T0: 4, tStop: 4 + (p + HN) / (2 * HN), to: word })
        cells.push(cell)
      }
    }
    const cell8 = (c, r) => cells[r * 8 + c]
    const HOPS8 = [
      [5.0, Q, L.hops8[0]],
      [5.5, L.hops8[0], L.hops8[1]],
      [6.0, L.hops8[1], L.hops8[2]],
    ]
    for (const [tc, a, z] of HOPS8) {
      cell8(a[0], a[1]).flips.push({ tc, toY: false })
      cell8(z[0], z[1]).flips.push({ tc, toY: true })
    }

    return {
      CW4: CW4s,
      CW8: CW8s,
      ID,
      cards,
      ROW,
      COL,
      convOff,
      posAt,
      reelAt,
      carried,
      RING_STOP,
      HOPS4,
      cells,
      HOPS8,
      CUR: cell8(...FIN),
    }
  }

  const ST = story(PORTRAIT ? STAGES.vertical : STAGES.wide)
  const { cards, ROW, convOff, posAt, reelAt, cells, CUR } = ST
  // Both stagings end on a cursor whose farthest ring is 6.
  const ringStart = (k) => 6.25 + 0.1875 * (6 - k)

  /* ------------------------------------------------------ Hola, the bubble */

  const holaFont = `700 52px ${F.display}`
  const holaM = metrics('Hola', holaFont, 0)
  // Wide, where S4's chat opens; portrait, on the phone's chat column (x 96-984).
  const BUB = PORTRAIT
    ? { x: 96, y: 700, w: holaM.adv + 72, h: 128, tx: 132, ty: 782 }
    : { x: 400, y: 260, w: holaM.adv + 72, h: 128, tx: 436, ty: 342 }
  // Wide, the cursor's Hola is set like every other 8×8 greeting. A portrait
  // 8×8 cell is too narrow for that to read on a phone, and this one word is
  // what the eye follows into the chat, so there it stands a size up.
  const HOLA_S = (PORTRAIT ? 36 : SIZE[8].word) / 52

  function drawHola(x0, y0, s, color) {
    g.save()
    g.font = holaFont
    g.letterSpacing = '0px'
    g.fillStyle = color
    g.translate(x0, y0)
    g.scale(s, s)
    g.fillText('Hola', 0, 0)
    g.restore()
  }
  // The origin that centres Hola's ink on (cx, cy) at scale s.
  const holaOrigin = (cx, cy, s) => [
    cx - (s * (holaM.R - holaM.L)) / 2,
    cy - (s * (holaM.D - holaM.A)) / 2,
  ]

  /* -------------------------------------------------- timeline scalars */

  const S = { zoom: 4, rules: 0, mid: 0, crouch: 0, morph: 0, tint: 0 }
  tl.fromTo(S, { zoom: 4 }, { zoom: 1, duration: b(0.75), ease: E.snap }, b(0))
  tl.fromTo(S, { rules: 0 }, { rules: 1, duration: b(0.5), ease: E.snap }, b(0.25))
  tl.fromTo(S, { mid: 0 }, { mid: 1, duration: b(0.25), ease: E.snap }, b(3.75))
  tl.fromTo(S, { crouch: 0 }, { crouch: 1, duration: b(0.125), ease: E.lift }, b(7.375))
  tl.fromTo(S, { morph: 0 }, { morph: 1, duration: b(0.5), ease: E.snap }, b(7.5))
  tl.fromTo(S, { tint: 0 }, { tint: 1, duration: b(0.4), ease: 'none' }, b(7.5))

  // The ground under the canvas, and the letterbox: ink while cell (1,1)
  // still fills the frame, white once the grid has landed.
  ctx.ground(C.deep, 0)
  ctx.ground(C.white, b(0.5))

  /* ---------------------------------------------------------- drawing */

  /*
   * Grid rules are every cell's own border, so a rule slides with its
   * conveyor, flips with its card and leaves with it in the clear-out; no
   * rule is ever left hanging over empty ground. A #121318 rule vanishes on a
   * #121318 cell, so deep cells' borders go down first in the dark-guide
   * #2c3036 and every other cell's go over them in #121318: a deep-to-light
   * edge reads as one rule, and the grid reads across the deep cells too.
   * Sides on the stage's edge are left off (the grid is full-bleed).
   */
  const borders = []
  const border = (x, y, w, h, gk) => borders.push(x, y, w, h, gk === 'd' ? 1 : 0)
  function strokeBorders(q, lw) {
    if (q > 0) {
      const side = (ax, ay, bx, by) => {
        if (q >= 1) {
          g.moveTo(ax, ay)
          g.lineTo(bx, by)
          return
        }
        // Growing out of both corners, meeting in the middle.
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2
        g.moveTo(ax, ay)
        g.lineTo(lerp(ax, mx, q), lerp(ay, my, q))
        g.moveTo(bx, by)
        g.lineTo(lerp(bx, mx, q), lerp(by, my, q))
      }
      g.lineWidth = lw
      g.lineCap = 'butt'
      for (const deep of [1, 0]) {
        g.strokeStyle = deep ? C.nightBorder : C.deep
        g.beginPath()
        for (let i = 0; i < borders.length; i += 5) {
          if (borders[i + 4] !== deep) continue
          const x = borders[i]
          const y = borders[i + 1]
          const x1 = x + borders[i + 2]
          const y1 = y + borders[i + 3]
          if (y > 0.5) side(x, y, x1, y)
          if (y1 < H - 0.5) side(x, y1, x1, y1)
          if (x > 0.5) side(x, y, x, y1)
          if (x1 < W - 0.5) side(x1, y, x1, y1)
        }
        g.stroke()
      }
    }
    borders.length = 0
  }

  // SUBDIVIDE: a midline grows across a 4×4 cell from its centre. It is
  // born behind the word and breaks around its ink, so it never strikes a
  // greeting through; it only shows once it clears the word.
  function midline(x, y, gk, z, wi) {
    const m = S.mid
    const cx = x + CW4 / 2
    const cy = y + CH4 / 2
    const [kx, ky] = inkHalf(wi, SIZE[4].word)
    const gap = 16
    const hx = kx + gap
    const hy = ky + gap
    const ex = (CW4 / 2) * m
    const ey = (CH4 / 2) * m
    g.strokeStyle = gk === 'd' ? C.nightBorder : C.deep
    g.lineWidth = 2 / z
    g.lineCap = 'butt'
    g.beginPath()
    if (ex > hx) {
      g.moveTo(cx - ex, cy)
      g.lineTo(cx - hx, cy)
      g.moveTo(cx + hx, cy)
      g.lineTo(cx + ex, cy)
    }
    if (ey > hy) {
      g.moveTo(cx, cy - ey)
      g.lineTo(cx, cy - hy)
      g.moveTo(cx, cy + hy)
      g.lineTo(cx, cy + ey)
    }
    g.stroke()
  }

  function flipScale(d) {
    const th = d < 0 ? 90 * CUTE((d + HALF) / HALF) : 90 + 90 * POP(d / HALF)
    return Math.abs(Math.cos((th * Math.PI) / 180))
  }

  // `pad` bleeds a moving cell into its neighbours: two antialiased edges
  // meeting on a fractional pixel each cover it only partly, and the white
  // under them shows through as a flickering hairline seam.
  function drawCell(x, y, w, h, gk, sy, content, pad = 0) {
    const cy = y + h / 2
    const top = cy - (h * sy) / 2
    g.save()
    g.beginPath()
    g.rect(x - pad, top - pad, w + 2 * pad, h * sy + 2 * pad)
    g.clip()
    g.fillStyle = GROUND[gk].fill
    g.fillRect(x - pad, top - pad, w + 2 * pad, h * sy + 2 * pad)
    if (sy !== 1) {
      g.translate(0, cy)
      g.scale(1, sy)
      g.translate(0, -cy)
    }
    content()
    g.restore()
  }

  function drawItem(wi, x, y, w, h, gk, mode, sx, sy, snapPx, direct, labelRoll) {
    if (wi < 0) {
      drawComposition(x, y, w / W)
      return
    }
    const s = SIZE[mode]
    const gd = GROUND[gk]
    if (direct) wordDirect(wi, s.word, gd.text, x + w / 2, y + h / 2, sx, sy)
    else blit(atlas.get(`w${wi}|${mode}|${gd.ck}`), x + w / 2, y + h / 2, sx, sy, snapPx)
    if (labelRoll) labelRoll(x, y)
    else if (direct) labelDirect(wi, s.label, gd.label, x + s.lx, y + s.ly)
    else blitOrigin(atlas.get(`l${wi}|${mode}|${gd.ck}`), x + s.lx, y + s.ly, snapPx)
  }

  function drawReel(reel, tb, x, y, w, h, gk, mode, sx, stretchY, snapPx, direct, labelRoll) {
    const P = reel.P(tb)
    // SPEED-STRETCH in place of blur: up to 1.2 along the reel at full speed.
    const vel = (P - reel.P(tb - 0.02)) / 0.02
    const sy = stretchY * (1 + 0.2 * Math.min(1, Math.abs(vel) / V))
    const k0 = Math.floor(P)
    for (let k = k0; k <= k0 + 1; k++) {
      const dy = (P - k) * h
      if (dy <= -h || dy >= h) continue
      const rest = dy === 0 && sy === 1 && sx === 1
      drawItem(
        reel.at(k),
        x,
        y + dy,
        w,
        h,
        gk,
        mode,
        sx,
        sy,
        snapPx && rest,
        direct,
        rest ? labelRoll : null,
      )
    }
  }

  function labelRollAt(card, tb, gk, snapPx) {
    for (const lr of card.labelRolls) {
      const u = (tb - lr.t0) / 0.25
      if (u < 0 || u >= 1) continue
      const Q = 3 * POP(u)
      const s = SIZE[4]
      const ck = GROUND[gk].ck
      return (x, y) => {
        g.save()
        g.beginPath()
        g.rect(x + s.lx - 6, y + s.ly - s.label - 3, 90, s.label + 8)
        g.clip()
        for (let i = 0; i < 4; i++) {
          const dy = (Q - i) * s.step
          if (Math.abs(dy) >= s.step) continue
          blitOrigin(
            atlas.get(`l${lr.codes[i]}|4|${ck}`),
            x + s.lx,
            y + s.ly + dy,
            snapPx && dy === 0,
          )
        }
        g.restore()
      }
    }
    return null
  }

  function drawCard4(card, x, y, tb, z, direct, snapPx) {
    let gk = card.yellow0 ? 'y' : card.base
    let sy = 1
    for (const f of card.flips) {
      const d = tb - f.tc
      if (d >= 0) gk = f.to
      if (d > -HALF && d < HALF) sy = flipScale(d)
    }
    const p = posAt(card, tb)
    let sx = 1
    let stY = 1
    if (p.axis) {
      // The conveyor's own speed-stretch, along its travel.
      const v = Math.abs(convOff(tb, p.axis) - convOff(tb - 0.02, p.axis)) / 0.02
      const st = 1 + 0.15 * Math.min(1, v / 4)
      if (p.axis === ROW) sx = st
      else stY = st
    }
    const reel = reelAt(card, tb)
    const lr = labelRollAt(card, tb, gk, snapPx)
    // Not on frame 0 (zoom exactly 4): there it would bleed the neighbours
    // half a pixel into S2's frame.
    const pad = (z !== 1 && z !== 4) || p.axis ? 0.5 / z : 0
    drawCell(
      x,
      y,
      CW4,
      CH4,
      gk,
      sy,
      () => {
        if (S.mid > 0) midline(x, y, gk, z, reel.to)
        drawReel(reel, tb, x, y, CW4, CH4, gk, 4, sx, stY, snapPx && sy === 1, direct, lr)
      },
      pad,
    )
    border(x, y + (CH4 * (1 - sy)) / 2, CW4, CH4 * sy, gk)
  }

  function draw4(tb) {
    // The runtime renders a hair past the scene's first frame, and expo.out
    // is steep enough there to open a sub-pixel seam onto the neighbours.
    // Frame 0 is S2's frame, so it is drawn at exactly zoom 4.
    const z = tb < 0.002 ? 4 : S.zoom
    g.setTransform(K * z, 0, 0, K * z, K * ZX * (1 - z), K * ZY * (1 - z))
    const direct = z > 1.02
    const snapPx = z === 1
    for (const card of cards) {
      const p = posAt(card, tb)
      const x = (p.c + p.ox) * CW4
      const y = (p.r + p.oy) * CH4
      drawCard4(card, x, y, tb, z, direct, snapPx)
      // Conveyors wrap: whatever leaves one edge enters at the other.
      if (x + CW4 > W) drawCard4(card, x - W, y, tb, z, direct, snapPx)
      if (x < 0) drawCard4(card, x + W, y, tb, z, direct, snapPx)
      if (y + CH4 > H) drawCard4(card, x, y - H, tb, z, direct, snapPx)
      if (y < 0) drawCard4(card, x, y + H, tb, z, direct, snapPx)
    }
    // Rules grow out of every intersection and meet in the middle of each edge.
    strokeBorders(S.rules, 2 / z)
  }

  function draw8(tb) {
    g.setTransform(K, 0, 0, K, 0, 0)
    const bubble = tb >= 7.375
    for (const cell of cells) {
      if (cell === CUR && bubble) continue
      const x = cell.c * CW8
      const y = cell.r * CH8
      let sy = 1
      // CLEAR-OUT: ring k flips to blank white; past edge-on it is the ground.
      if (cell.ring >= 1) {
        const s = ringStart(cell.ring)
        if (tb >= s + 0.15) continue
        if (tb >= s) sy = Math.cos((Math.PI / 2) * CUTE((tb - s) / 0.15))
      }
      let yellow = cell.yellow0
      for (const f of cell.flips) {
        const d = tb - f.tc
        if (d >= 0) yellow = f.toY
        if (d > -HALF && d < HALF) sy = flipScale(d)
      }
      if (yellow) {
        drawCell(x, y, CW8, CH8, 'y', sy, () => {
          const [hx, hy] = holaOrigin(x + CW8 / 2, y + CH8 / 2, HOLA_S)
          drawHola(hx, hy, HOLA_S, C.onYellow)
        })
        // The cursor carries no border of its own, so once the last ring has
        // gone it stands alone on white.
        continue
      } else if (cell.reel) {
        drawCell(x, y, CW8, CH8, cell.base, sy, () =>
          drawReel(cell.reel, tb, x, y, CW8, CH8, cell.base, 8, 1, 1, sy === 1, false, null),
        )
      } else {
        drawCell(x, y, CW8, CH8, cell.base, sy, () =>
          drawItem(cell.word, x, y, CW8, CH8, cell.base, 8, 1, 1, sy === 1, false, null),
        )
      }
      border(x, y + (CH8 * (1 - sy)) / 2, CW8, CH8 * sy, cell.base)
    }
    // The rules close in on the cursor with the rings, because each one
    // leaves with the cell it belongs to.
    strokeBorders(1, 2)

    if (bubble) drawBubble()
  }

  // CELL TO BUBBLE: a 'lift' crouch to 94%, then 'snap' onto Sofia's bubble.
  function drawBubble() {
    const x0 = CUR.c * CW8
    const y0 = CUR.r * CH8
    const ccx = x0 + CW8 / 2
    const ccy = y0 + CH8 / 2
    const k = 1 - 0.06 * S.crouch
    const m = S.morph
    const rw = lerp(CW8 * k, BUB.w, m)
    const rh = lerp(CH8 * k, BUB.h, m)
    const rx = lerp(ccx - (CW8 * k) / 2, BUB.x, m)
    const ry = lerp(ccy - (CH8 * k) / 2, BUB.y, m)
    const rad = 36 * m
    g.fillStyle = gsap.utils.interpolate(C.yellow, C.fill, S.tint)
    g.beginPath()
    g.roundRect(rx, ry, rw, rh, [rad, rad, rad, 8 * m])
    g.fill()
    const [hx, hy] = holaOrigin(ccx, ccy, HOLA_S)
    const s = lerp(HOLA_S * k, 1, m)
    const tx = lerp(ccx + (hx - ccx) * k, BUB.tx, m)
    const ty = lerp(ccy + (hy - ccy) * k, BUB.ty, m)
    drawHola(tx, ty, s, gsap.utils.interpolate(C.onYellow, C.ink, S.tint))
  }

  ctx.draw((t) => {
    const tb = t / BEAT
    cv.clear()
    g.fillStyle = C.white
    g.fillRect(0, 0, W, H)
    g.imageSmoothingQuality = 'high'
    g.direction = 'ltr'
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    if (tb < 4) draw4(tb)
    else draw8(tb)
  })

  /* --------------------------------------------------------------- sound */

  // Scheduled from the wide story whatever the stage, so both cuts have one
  // score: the same reel stops, the same clacks, panned by the same columns.
  const WS = PORTRAIT ? story(STAGES.wide) : ST
  const panX = (x) => Math.max(-1, Math.min(1, ((x - 960) / 960) * 0.85))
  ctx.cue(b(0), 'impact', { gain: 1 })
  // Reel-stop clicks per ring, one per column, panned by it.
  for (const ring of [1, 2]) {
    const cols = new Set(
      WS.cards
        .filter((k) => !WS.carried.includes(k) && k.id !== WS.ID(1, 1))
        .filter((k) => Math.max(Math.abs(k.c0 - 1), Math.abs(k.r0 - 1)) === ring)
        .map((k) => k.c0),
    )
    for (const c of cols)
      ctx.cue(b(WS.RING_STOP[ring]), 'tick', { gain: 0.35, pan: panX(c * WS.CW4 + WS.CW4 / 2) })
  }
  // Cursor blips (two notes, bright) and the slot clacks of the rolling cells.
  for (const [tc] of WS.HOPS4) {
    ctx.cue(b(tc), 'pop', { note: 'A5', gain: 0.55 })
    ctx.cue(b(tc + 0.125), 'pop', { note: 'D6', gain: 0.45 })
  }
  for (const card of WS.cards) {
    for (const r of card.reels) {
      if (r.tStop >= 1 && r.tStop <= 3)
        ctx.cue(b(r.tStop), 'clack', {
          gain: 0.4,
          pan: panX(WS.posAt(card, r.tStop).c * WS.CW4 + WS.CW4 / 2),
        })
    }
  }
  ctx.cue(b(WS.ROW.t1), 'swish', { gain: 0.5, pan: 0.3, dur: b(WS.ROW.t2 - WS.ROW.t1) })
  ctx.cue(b(WS.COL.t1), 'swish', { gain: 0.5, pan: -0.65, dur: b(WS.COL.t2 - WS.COL.t1) })
  ctx.cue(b(3.75), 'whoosh', { gain: 0.5, dur: b(0.25) })
  // ZIPPER: the wave front, one grain per reel stop.
  ctx.cue(b(4), 'glitch', { gain: 0.35, dur: b(1) })
  for (const cell of WS.cells) {
    if (cell.reel)
      ctx.cue(b(cell.reel.tStop), 'tick', { gain: 0.16, pan: panX(cell.c * WS.CW8 + WS.CW8 / 2) })
  }
  for (const [tc] of WS.HOPS8) ctx.cue(b(tc), 'pop', { note: 'A5', gain: 0.5 })
  // Paper flicks, denser as the rings close.
  for (let k = 6; k >= 1; k--) {
    const n = 7 - k
    for (let j = 0; j < n; j++) ctx.cue(b(ringStart(k) + (0.15 * j) / n), 'flick', { gain: 0.22 })
  }
  ctx.cue(b(7.5), 'pop', { note: 'D5', gain: 0.6 })
})
