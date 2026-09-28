/*
 * The reel's runtime: one master GSAP timeline, a 1920x1080 stage scaled to
 * fit, and the player around it. Each file in `scenes/` registers a builder
 * with `REEL.scene(id, build)`; the builder fills a child timeline that the
 * master places at the scene's start from `PLAN` below.
 *
 * Every visual has to be a pure function of the playhead. The same page is
 * scrubbed by hand, played in real time against a synthesized score, and
 * rendered to MP4 one seeked frame at a time. Anything with a clock of its own
 * — a CSS animation, a stepped physics loop, `Math.random()`, a tween started
 * outside the timeline — looks right in one of those three and wrong in the
 * other two, so the builders get seeded randomness and closed-form motion only.
 */
;(function () {
  'use strict'

  const W = 1920
  const H = 1080
  const BPM = 120
  const BEAT = 60 / BPM
  const BAR = BEAT * 4

  /* The v3 palette, copied from apps/mobile/src/lib/theme/tokens.ts. */
  const C = {
    yellow: '#ffc409',
    yellowShade: '#e0ac08',
    onYellow: '#201900',
    ink: '#17191c',
    deep: '#121318',
    night: '#1c1f24',
    nightFill: '#23272d',
    nightBorder: '#2c3036',
    white: '#ffffff',
    snow: '#f2f3f5',
    fill: '#f4f5f7',
    border: '#e8eaec',
    muted: '#62676d',
    faint: '#9aa1a7',
    blue: '#3b6cf6',
    blueTint: '#e9f0fe',
    blueDark: '#7c9cf9',
    blueDeepTint: '#202b45',
    green: '#009f70',
    greenTint: '#e2f6ee',
    greenDark: '#34c796',
    streak: '#f79009',
    pro: '#7a5af8',
    danger: '#e5484d',
  }

  const F = {
    display: '"Nunito", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif',
    ui: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  }
  const noto = (family) => `"${family}", ${F.display}`
  const rad = (deg) => (deg * Math.PI) / 180

  /*
   * `split: false` marks scripts whose letters are shaped together: Arabic
   * joins, Devanagari and Thai stack marks and build conjuncts. Cut into
   * per-character spans they fall apart into isolated forms, so those move as
   * whole words (or behind a mask), never letter by letter. Hebrew is on the
   * list for its right-to-left order rather than for shaping.
   */
  const G = [
    { lang: 'en', text: 'Hello', font: F.display },
    { lang: 'tr', text: 'Merhaba', font: F.display },
    { lang: 'es', text: 'Hola', font: F.display },
    { lang: 'de', text: 'Hallo', font: F.display },
    { lang: 'fr', text: 'Bonjour', font: F.display },
    { lang: 'ru', text: 'Привет', font: F.display },
    { lang: 'ar', text: 'مرحبا', font: noto('Noto Sans Arabic'), dir: 'rtl', split: false },
    { lang: 'pt', text: 'Olá', font: F.display },
    { lang: 'it', text: 'Ciao', font: F.display },
    { lang: 'ja', text: 'こんにちは', font: noto('Noto Sans JP') },
    { lang: 'ko', text: '안녕하세요', font: noto('Noto Sans KR') },
    { lang: 'zh', text: '你好', font: noto('Noto Sans SC') },
    { lang: 'hi', text: 'नमस्ते', font: noto('Noto Sans Devanagari'), split: false },
    { lang: 'th', text: 'สวัสดี', font: noto('Noto Sans Thai'), split: false },
    { lang: 'he', text: 'שלום', font: noto('Noto Sans Hebrew'), dir: 'rtl', split: false },
    { lang: 'el', text: 'Γειά σου', font: noto('Noto Sans') },
  ]
  const T = [
    { lang: 'en', text: 'Thank you', font: F.display },
    { lang: 'tr', text: 'Teşekkürler', font: F.display },
    { lang: 'es', text: 'Gracias', font: F.display },
    { lang: 'de', text: 'Danke', font: F.display },
    { lang: 'fr', text: 'Merci', font: F.display },
    { lang: 'ru', text: 'Спасибо', font: F.display },
    { lang: 'ar', text: 'شكرا', font: noto('Noto Sans Arabic'), dir: 'rtl', split: false },
    { lang: 'pt', text: 'Obrigado', font: F.display },
    { lang: 'it', text: 'Grazie', font: F.display },
    { lang: 'ja', text: 'ありがとう', font: noto('Noto Sans JP') },
    { lang: 'ko', text: '감사합니다', font: noto('Noto Sans KR') },
    { lang: 'zh', text: '谢谢', font: noto('Noto Sans SC') },
  ]
  const byLang = (list) => Object.fromEntries(list.map((g) => [g.lang, g]))

  /*
   * The mark, from branding/brand/logo/mark.svg: two half-annuli on a 1024
   * canvas, outer radius 235.3 and inner 151.5, their flat ends cut on one
   * shared line so the pair reads as an S. Angles below are screen angles
   * (y down, clockwise), which is how the brand guide states them.
   */
  const MARK = {
    size: 1024,
    ro: 235.3,
    ri: 151.5,
    rm: (235.3 + 151.5) / 2,
    stroke: 235.3 - 151.5,
    black: { cx: 591, cy: 463.5, a0: 147, a1: 327 },
    white: { cx: 433, cy: 560.5, a0: 327, a1: 507 },
    /* The hard drop shadow: 20px along 57 degrees, in the ground's shade. */
    shadow: { dx: 10.893, dy: 16.773 },
    d: {
      black:
        'M393.661 591.654A235.3 235.3 0 0 1 462.846 266.161A235.3 235.3 0 0 1 788.339 335.346L718.059 380.987A151.5 151.5 0 0 0 508.487 336.441A151.5 151.5 0 0 0 463.941 546.013Z',
      white:
        'M630.339 432.346A235.3 235.3 0 0 1 561.154 757.839A235.3 235.3 0 0 1 235.661 688.654L305.941 643.013A151.5 151.5 0 0 0 515.513 687.559A151.5 151.5 0 0 0 560.059 477.987Z',
    },
  }

  /*
   * THE CUT: the straight line the mark's flat ends are cut on, running at
   * 147 degrees through the mark's canvas centre — the reel's signature line.
   * `dUp` runs along it rising to the right (33 degrees up), `n` is its normal
   * at 57 degrees, which is also the direction of the mark's hard shadow.
   */
  const CUT = {
    deg: 147,
    dUp: [Math.cos(rad(-33)), Math.sin(rad(-33))],
    n: [Math.cos(rad(57)), Math.sin(rad(57))],
  }

  /*
   * Timing and grounds for every scene, in beats. Owned here rather than by
   * the scene files so that no builder can drift a boundary its neighbour is
   * cutting against. Filled from the storyboard.
   */
  const PLAN = [
    /* PLAN:BEGIN */
    {
      id: '01-caret',
      title: 'Caret — the cursor edits, then becomes the knife',
      start: 0,
      dur: 8,
      ground: '#121318',
    },
    {
      id: '02-scripts',
      title: 'Relay — every script moves the way it is read',
      start: 8,
      dur: 8,
      ground: '#ffffff',
    },
    {
      id: '03-grid',
      title: 'Specimen Grid — the frame was one cell',
      start: 16,
      dur: 8,
      ground: '#ffffff',
    },
    {
      id: '04-chat',
      title: 'Chat — Sofia asks, the learner hesitates',
      start: 24,
      dur: 8,
      ground: '#ffffff',
    },
    {
      id: '05-echo',
      title: 'Green pen — the corrected line climbs the ladder',
      start: 32,
      dur: 16,
      ground: '#17191c',
    },
    {
      id: '06-breath',
      title: 'Breath — one line writes Merhaba, then writes it back',
      start: 48,
      dur: 8,
      ground: '#1c1f24',
    },
    {
      id: '07-eight',
      title: 'The Eight — manifesto, and thank you in every interface language',
      start: 56,
      dur: 12,
      ground: '#121318',
    },
    {
      id: '08-exchange',
      title: 'Exchange — the hellos bend into the mark',
      start: 68,
      dur: 20,
      ground: '#ffc409',
    },
    /* PLAN:END */
  ]

  /* The style bible's eases, registered once at boot. Filled from the storyboard. */
  const EASES = {
    /* EASES:BEGIN */
    /* Decisive arrivals with no overshoot: masked rises, reveals, the camera landing, the bubble and card morphs, the hairline draw-in, the shadow snap at the lock. 0.2-0.45 s. */
    snap: 'expo.out',
    /* Arrivals with about 10% overshoot: glyph pops, bubble pops, reel stops, odometer digit locks, dots, speaker glyph. Up to 0.25 s. */
    pop: 'back.out(1.7)',
    /* Heavy-in, heavy-out travel: push-ins, card flights, the world-to-card contraction, conveyor slides, the tab bar becoming the Cut. Use it at least 0.5 s for large distances to respect the speed cap. */
    whip: 'M0,0 C0.7,0 0.2,1 1,1',
    /* Accelerating INTO a beat or off the frame: exits, the slice halves parting, collapses, the green strike landing on the beat, stamps (a dead stop, no overshoot), anything whose end is the hit. */
    cut: 'power3.in',
    /* Controlled rotation and slow travel: every Turn (letter orbits, the 540° finale spin), the S6 hairline walks, the staircase draw, the finale camera. It is never used for idle drift. */
    glide: 'sine.inOut',
    /* Closed-form damped spring with about 22% overshoot, then -6% and +2%, then settled. Used for landing squash releases, baseline dips, sags, the accent bounce and the 'tengo' hop. 0.25-0.5 s. */
    spring:
      'M0,0 C0.08,0.6 0.14,1.25 0.22,1.22 0.3,1.19 0.34,0.93 0.44,0.94 0.54,0.95 0.58,1.03 0.68,1.02 0.78,1.01 0.84,1 1,1',
    /* Anticipations and the up-half of hops: lifts, crouches, counter-turns, wind-ups, squashes before a release. 1/8 to 1/4 beat. */
    lift: 'power2.out',
    /* EASES:END */
  }

  const REEL = {
    W,
    H,
    BPM,
    BEAT,
    BAR,
    C,
    F,
    G,
    T,
    GL: byLang(G),
    TL: byLang(T),
    MARK,
    CUT,
    PLAN,
    EASES,
    E: {},
    cues: [],
    errors: [],
    builders: {},
    scenes: [],
    master: null,
    duration: 0,
    audio: null,
  }
  window.REEL = REEL

  REEL.scene = function (id, build) {
    REEL.builders[id] = build
  }

  /* mulberry32: small, fast, and the same numbers on every run. */
  function rng(seed) {
    let a = seed >>> 0
    return function () {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const SVG_NS = 'http://www.w3.org/2000/svg'

  function el(tag, props, parent) {
    const node = document.createElement(tag)
    applyProps(node, props)
    if (parent) parent.appendChild(node)
    return node
  }

  function svg(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag)
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        if (key === 'text') node.textContent = attrs[key]
        else if (key === 'style' && typeof attrs[key] === 'object')
          Object.assign(node.style, attrs[key])
        else node.setAttribute(key, attrs[key])
      }
    }
    if (parent) parent.appendChild(node)
    return node
  }

  function applyProps(node, props) {
    if (!props) return
    if (props.class) node.className = props.class
    if (props.style) {
      if (typeof props.style === 'string') node.style.cssText = props.style
      else Object.assign(node.style, props.style)
    }
    if (props.text != null) node.textContent = props.text
    if (props.html != null) node.innerHTML = props.html
    if (props.attrs)
      for (const key of Object.keys(props.attrs)) node.setAttribute(key, props.attrs[key])
  }

  /** A full-stage SVG layer in stage pixels. */
  function svgLayer(parent) {
    return svg(
      'svg',
      {
        viewBox: `0 0 ${W} ${H}`,
        width: W,
        height: H,
        style: { position: 'absolute', left: '0', top: '0', overflow: 'visible' },
      },
      parent,
    )
  }

  const pt = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]
  const f3 = (n) => Math.round(n * 1000) / 1000

  /** Arc commands from a0 to a1 (clockwise, degrees), in chunks of at most 90 degrees. */
  function arcCommands(cx, cy, r, a0, a1) {
    const span = a1 - a0
    const n = Math.max(1, Math.ceil(Math.abs(span) / 90))
    const sweep = span >= 0 ? 1 : 0
    let out = ''
    for (let i = 1; i <= n; i++) {
      const [x, y] = pt(cx, cy, r, a0 + (span * i) / n)
      out += `A${f3(r)} ${f3(r)} 0 0 ${sweep} ${f3(x)} ${f3(y)}`
    }
    return out
  }

  /**
   * A filled annular sector: outer edge from a0 to a1, inner edge back. With
   * the MARK numbers and a 180 degree span it is one of the two arcs, so it is
   * also a morph target on the way to or from the mark.
   */
  function arcPath(cx, cy, ro, ri, a0, a1) {
    const [x0, y0] = pt(cx, cy, ro, a0)
    const [x1, y1] = pt(cx, cy, ri, a1)
    return (
      `M${f3(x0)} ${f3(y0)}` +
      arcCommands(cx, cy, ro, a0, a1) +
      `L${f3(x1)} ${f3(y1)}` +
      arcCommands(cx, cy, ri, a1, a0) +
      'Z'
    )
  }

  /** The centre line of an arc, for a butt-capped stroke that DrawSVG can draw on. */
  function arcStroke(cx, cy, r, a0, a1) {
    const [x0, y0] = pt(cx, cy, r, a0)
    return `M${f3(x0)} ${f3(y0)}` + arcCommands(cx, cy, r, a0, a1)
  }

  /**
   * The mark as live SVG. Centred on (x, y) at `size` px (1024 = the canvas).
   * The group's transform is GSAP's, with svgOrigin at the canvas centre, so
   * `x`/`y`/`scale`/`rotation` on `g` move the whole mark about its middle.
   * Each arc sits with its shadow: tween `[black, blackShadow]` together with
   * `svgOrigin: '591 463.5'` (white: '433 560.5') to turn an arc on its own
   * centre; the shadows' parent carries the offset, so it stays in screen
   * space whichever way the arcs turn.
   */
  function mark(parent, opts) {
    const o = Object.assign(
      { x: W / 2, y: H / 2, size: 360, shadow: true, shade: C.yellowShade },
      opts,
    )
    const g = svg('g', { class: 'mark' }, parent)
    const shadows = svg(
      'g',
      { transform: `translate(${MARK.shadow.dx} ${MARK.shadow.dy})`, fill: o.shade },
      g,
    )
    const blackShadow = svg('path', { d: MARK.d.black }, shadows)
    const whiteShadow = svg('path', { d: MARK.d.white }, shadows)
    const black = svg('path', { d: MARK.d.black, fill: '#000000' }, g)
    const white = svg('path', { d: MARK.d.white, fill: '#ffffff' }, g)
    if (!o.shadow) shadows.style.display = 'none'
    gsap.set(g, { x: o.x - 512, y: o.y - 512, scale: o.size / 1024, svgOrigin: '512 512' })
    return { g, shadows, black, white, blackShadow, whiteShadow }
  }

  /* ---------------------------------------------------------------- stage */

  const params = new URLSearchParams(location.search)
  const MODE = {
    capture: params.has('capture'),
    tc: params.has('tc'),
    solo: params.get('scene'),
    at: params.has('t') ? Number(params.get('t')) : null,
  }
  REEL.mode = MODE

  let viewport,
    stage,
    fitScale = 1
  const draws = []
  const grounds = {}
  const boxes = {}

  function fit() {
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    fitScale = Math.min(vw / W, vh / H)
    const x = (vw - W * fitScale) / 2
    const y = (vh - H * fitScale) / 2
    stage.style.transform = `translate(${x}px, ${y}px) scale(${fitScale})`
  }

  function canvasScale() {
    return Math.max(0.5, Math.min(2, fitScale * (window.devicePixelRatio || 1)))
  }

  /* ---------------------------------------------------------------- build */

  function makeContext(plan, index, root, tl) {
    const start = plan.start * BEAT
    const dur = plan.dur * BEAT
    const ctx = {
      id: plan.id,
      title: plan.title,
      index,
      root,
      tl,
      start,
      dur,
      beats: plan.dur,
      W,
      H,
      C,
      F,
      G,
      T,
      GL: REEL.GL,
      TL: REEL.TL,
      E: REEL.E,
      MARK,
      CUT,
      BEAT,
      BAR,
      b: (n) => n * BEAT,
      /** Local seconds to reel seconds, for anything phased to the global beat grid. */
      abs: (t) => start + t,
      bar: (n) => n * BAR,
      rng,
      el: (tag, props, parent) => el(tag, props, parent === undefined ? root : parent),
      svg: (tag, attrs, parent) => svg(tag, attrs, parent),
      svgLayer: (parent) => svgLayer(parent || root),
      mark: (parent, opts) => mark(parent, opts),
      arcPath,
      arcStroke,
      split: (target, vars) =>
        SplitText.create(target, Object.assign({}, vars, { autoSplit: false })),
      canvas(opts) {
        const k = (opts && opts.scale) || canvasScale()
        const cv = el(
          'canvas',
          {
            style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' },
          },
          (opts && opts.parent) || root,
        )
        cv.width = Math.round(W * k)
        cv.height = Math.round(H * k)
        const g = cv.getContext('2d')
        return {
          el: cv,
          g,
          k,
          clear() {
            g.setTransform(k, 0, 0, k, 0, 0)
            g.clearRect(0, 0, W, H)
          },
        }
      },
      draw(fn) {
        draws.push({ start, end: start + dur, fn, id: plan.id })
      },
      cue(t, name, opts) {
        REEL.cues.push({ t: start + t, name, opts: opts || {}, scene: plan.id })
      },
      /**
       * Change this scene's ground (and the letterbox around the stage) at
       * local time `t`, over `d` seconds. Worked out in `render` rather than
       * tweened, so a ground change can never be left half-applied by a seek.
       */
      ground(color, t, d, ease) {
        grounds[plan.id].push({ t0: t || 0, t1: (t || 0) + (d || 0), to: color, ease })
        grounds[plan.id].sort((a, b) => a.t0 - b.t0)
      },
      /**
       * Hold the letterbox — the bars around the stage when the window is not
       * 16:9 — at `color` over local [from, to), whatever the ground is. For a
       * scene whose ground is covered at first by something it draws: without
       * it, 08's bars turn yellow on the frame the ink plates start to part,
       * a beat before the yellow they frame is on screen.
       */
      letterbox(color, from, to) {
        boxes[plan.id].push({ from, to, color })
      },
    }
    return ctx
  }

  function placeholder(ctx, message) {
    const box = el(
      'div',
      {
        style: {
          position: 'absolute',
          inset: '0',
          display: 'grid',
          placeItems: 'center',
          font: `800 64px ${F.display}`,
          color: 'rgba(0,0,0,.35)',
          textAlign: 'center',
          whiteSpace: 'pre-line',
        },
        text: message,
      },
      ctx.root,
    )
    return box
  }

  function build() {
    for (const [name, def] of Object.entries(EASES)) {
      REEL.E[name] =
        /^[-\d.\s,]+$/.test(def) || def.startsWith('M') ? CustomEase.create(name, def) : def
    }

    const master = gsap.timeline({ paused: true })
    REEL.master = master

    PLAN.forEach((plan, index) => {
      grounds[plan.id] = []
      boxes[plan.id] = []
      const root = el(
        'div',
        {
          class: 'scene',
          attrs: { 'data-scene': plan.id },
          style: { background: plan.ground, zIndex: String(index + 1), visibility: 'hidden' },
        },
        stage,
      )
      const tl = gsap.timeline()
      const start = plan.start * BEAT
      const dur = plan.dur * BEAT
      master.add(tl, start)
      const ctx = makeContext(plan, index, root, tl)
      const builder = REEL.builders[plan.id]
      if (!builder) {
        placeholder(ctx, `${plan.id}\n${plan.title}`)
      } else {
        try {
          builder(ctx)
        } catch (error) {
          console.error(`[reel] ${plan.id} failed to build`, error)
          REEL.errors.push(`${plan.id}: ${error && error.message}`)
          placeholder(ctx, `${plan.id} failed\n${error && error.message}`)
        }
      }
      if (tl.duration() > dur + 1e-3) {
        const over = (tl.duration() - dur).toFixed(2)
        console.warn(`[reel] ${plan.id} runs ${over}s past its slot`)
        REEL.errors.push(`${plan.id}: timeline runs ${over}s past its ${dur}s slot`)
      }
      REEL.scenes.push({ id: plan.id, title: plan.title, start, dur, root, ground: plan.ground })
    })

    // The last scene's last frame is the resting frame; nothing plays past it.
    const last = PLAN[PLAN.length - 1]
    REEL.duration = (last.start + last.dur) * BEAT
    master.set({}, {}, REEL.duration)
  }

  /* --------------------------------------------------------------- render */

  /*
   * The master never renders exactly on 0 or on a scene's first frame: GSAP
   * treats a zero-duration `set` sitting on the playhead as not yet applied
   * when the playhead arrives there backwards, so a seek back to a scene's
   * start would show its pre-`set` state. A tenth of a millisecond past is
   * invisible and removes the case.
   */
  const EPS = 1e-4

  function groundAt(scene, local) {
    let color = scene.ground
    for (const seg of grounds[scene.id]) {
      if (local < seg.t0) break
      if (local >= seg.t1) {
        color = seg.to
      } else {
        let p = (local - seg.t0) / (seg.t1 - seg.t0)
        if (seg.ease) p = gsap.parseEase(seg.ease)(p)
        color = gsap.utils.interpolate(color, seg.to, p)
      }
    }
    return color
  }

  function render(t) {
    REEL.master.time(t + EPS)
    let top = null
    for (const s of REEL.scenes) {
      const on = t >= s.start && t < s.start + s.dur
      if (on !== s.on) {
        s.root.style.visibility = on ? 'visible' : 'hidden'
        s.on = on
      }
      if (on) {
        top = s
        if (grounds[s.id].length) s.root.style.background = groundAt(s, t - s.start)
      }
    }
    if (top) {
      const local = t - top.start
      let g = grounds[top.id].length ? groundAt(top, local) : top.ground
      for (const box of boxes[top.id]) if (local >= box.from && local < box.to) g = box.color
      document.documentElement.style.setProperty('--ground', g)
    }
    for (const d of draws) {
      if (t >= d.start && t < d.end) {
        try {
          d.fn(t - d.start)
        } catch (error) {
          if (!d.failed) console.error(`[reel] ${d.id} draw failed`, error)
          d.failed = true
        }
      }
    }
    if (MODE.tc) updateTimecode(t)
    if (hud) hud.update(t)
  }

  /** Seek and draw synchronously — what the frame renderer calls. */
  REEL.seek = function (t) {
    pause()
    render(clamp(t))
    return REEL.master.time()
  }

  const clamp = (t) => Math.max(0, Math.min(REEL.duration - 2 * EPS, t))

  /* ------------------------------------------------------------- playback */

  const state = { playing: false, from: 0, t0: 0, sound: false, ac: null }
  const range = { from: 0, to: 0, loop: false }

  function clockNow() {
    return state.sound && state.ac ? state.ac.currentTime : performance.now() / 1000
  }

  function play() {
    if (state.playing) return
    let from = REEL.master.time()
    if (from >= range.to - 0.02) from = range.from
    state.from = from
    state.t0 = clockNow() + (state.sound ? 0.06 : 0)
    if (state.sound && REEL.audio) REEL.audio.start(from, state.t0)
    state.playing = true
    if (hud) hud.sync()
  }

  function pause() {
    if (!state.playing) return
    state.playing = false
    if (REEL.audio && state.ac) REEL.audio.stop()
    if (hud) hud.sync()
  }

  function toggle() {
    if (state.playing) pause()
    else play()
  }

  function seekTo(t) {
    const was = state.playing
    pause()
    render(clamp(t))
    if (was) play()
  }

  function tick() {
    if (!state.playing) return
    let t = state.from + Math.max(0, clockNow() - state.t0)
    if (t >= range.to) {
      if (range.loop) {
        state.playing = false
        render(range.from)
        play()
        return
      }
      t = range.to - 1e-4
      render(t)
      pause()
      if (hud) hud.reveal(true)
      return
    }
    render(t)
  }

  async function setSound(on) {
    if (on && !state.ac) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC || !REEL.audio) return
      state.ac = new AC()
      REEL.audio.attach(state.ac)
    }
    const was = state.playing
    pause()
    state.sound = on
    if (on && state.ac.state === 'suspended') await state.ac.resume()
    if (was) play()
    if (hud) hud.sync()
  }

  REEL.play = play
  REEL.pause = pause
  REEL.toggle = toggle
  REEL.seekTo = seekTo
  REEL.setSound = setSound
  REEL.state = state

  /* ----------------------------------------------------------- timecode */

  let tcNode
  function updateTimecode(t) {
    if (!tcNode) {
      tcNode = el('div', { class: 'tc' }, viewport)
    }
    const scene = REEL.scenes.find((s) => t >= s.start && t < s.start + s.dur)
    const local = scene ? t - scene.start : 0
    tcNode.textContent =
      `${scene ? scene.id : '—'}  +${local.toFixed(2)}s  beat ${(local / BEAT).toFixed(2)}` +
      `   |   ${t.toFixed(2)}s  beat ${(t / BEAT).toFixed(2)}`
  }

  /* ----------------------------------------------------------------- HUD */

  let hud = null

  function smpte(t) {
    const fps = 30
    const total = Math.floor(t * fps + 1e-6)
    const f = total % fps
    const s = Math.floor(total / fps) % 60
    const m = Math.floor(total / fps / 60)
    const two = (n) => String(n).padStart(2, '0')
    return `${two(m)}:${two(s)}:${two(f)}`
  }

  function buildHud() {
    const root = el('div', { class: 'hud', attrs: { 'data-visible': 'true' } }, viewport)
    const bar = el('div', { class: 'hud-bar' }, root)

    const playBtn = el(
      'button',
      { class: 'hud-btn', attrs: { type: 'button', id: 'reel-play' } },
      bar,
    )
    const time = el('div', { class: 'hud-time' }, bar)
    const track = el(
      'div',
      {
        class: 'hud-track',
        attrs: { role: 'slider', tabindex: '0', 'aria-label': 'Reel position', id: 'reel-track' },
      },
      bar,
    )
    const fillNode = el('div', { class: 'hud-fill' }, track)
    const chapters = el('div', { class: 'hud-chapters' }, track)
    for (const s of REEL.scenes) {
      const tickNode = el('div', { class: 'hud-chapter', attrs: { title: s.title } }, chapters)
      tickNode.style.left = `${(s.start / REEL.duration) * 100}%`
      tickNode.style.width = `${(s.dur / REEL.duration) * 100}%`
    }
    const soundBtn = el(
      'button',
      { class: 'hud-btn hud-sound', attrs: { type: 'button', id: 'reel-sound' } },
      bar,
    )
    const replayBtn = el(
      'button',
      { class: 'hud-btn', attrs: { type: 'button', id: 'reel-replay', 'aria-label': 'Replay' } },
      bar,
    )
    replayBtn.innerHTML = ICONS.replay
    if (!REEL.audio) soundBtn.hidden = true

    const hint = el(
      'button',
      { class: 'sound-hint', attrs: { type: 'button', id: 'reel-hint' } },
      viewport,
    )
    hint.innerHTML = `${ICONS.soundOn}<span>Play with sound</span>`
    if (!REEL.audio) hint.hidden = true

    playBtn.addEventListener('click', () => {
      toggle()
    })
    replayBtn.addEventListener('click', () => {
      seekTo(0)
      play()
    })
    soundBtn.addEventListener('click', () => {
      setSound(!state.sound)
      hint.hidden = true
    })
    hint.addEventListener('click', () => {
      hint.hidden = true
      setSound(true).then(() => {
        if (!state.playing) play()
      })
    })

    let dragging = false
    const toTime = (clientX) => {
      const r = track.getBoundingClientRect()
      return ((clientX - r.left) / r.width) * REEL.duration
    }
    let resume = false
    track.addEventListener('pointerdown', (e) => {
      dragging = true
      resume = state.playing
      pause()
      track.setPointerCapture(e.pointerId)
      render(clamp(toTime(e.clientX)))
    })
    track.addEventListener('pointermove', (e) => {
      if (dragging) render(clamp(toTime(e.clientX)))
    })
    const end = () => {
      if (!dragging) return
      dragging = false
      if (resume) play()
    }
    track.addEventListener('pointerup', end)
    track.addEventListener('pointercancel', end)

    let idle
    const reveal = (stay) => {
      root.dataset.visible = 'true'
      clearTimeout(idle)
      if (!stay)
        idle = setTimeout(() => {
          if (state.playing && !dragging) root.dataset.visible = 'false'
        }, 2200)
    }
    viewport.addEventListener('pointermove', () => reveal(false))
    viewport.addEventListener('pointerdown', () => reveal(false))

    const sceneAt = (t) => {
      let i = 0
      REEL.scenes.forEach((s, j) => {
        if (t >= s.start - 1e-3) i = j
      })
      return i
    }
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return
      const t = REEL.master.time()
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        const next = REEL.scenes[Math.min(REEL.scenes.length - 1, sceneAt(t) + 1)]
        seekTo(next.start)
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        const i = sceneAt(t)
        const s = REEL.scenes[i]
        seekTo(t - s.start > 0.6 || i === 0 ? s.start : REEL.scenes[i - 1].start)
      } else if (e.key === 'm') {
        setSound(!state.sound)
        hint.hidden = true
      } else if (e.key === 'r') {
        seekTo(0)
        play()
      } else return
      reveal(false)
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause()
    })

    const api = {
      update(t) {
        fillNode.style.transform = `scaleX(${t / REEL.duration})`
        time.textContent = `${smpte(t)} / ${smpte(REEL.duration)}`
        track.setAttribute('aria-valuenow', t.toFixed(1))
      },
      sync() {
        playBtn.innerHTML = state.playing ? ICONS.pause : ICONS.play
        playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play')
        soundBtn.innerHTML = state.sound ? ICONS.soundOn : ICONS.soundOff
        soundBtn.setAttribute('aria-label', state.sound ? 'Mute' : 'Sound on')
        soundBtn.setAttribute('aria-pressed', String(state.sound))
        if (!state.playing) reveal(true)
      },
      reveal,
      hint,
    }
    track.setAttribute('aria-valuemin', '0')
    track.setAttribute('aria-valuemax', REEL.duration.toFixed(1))
    return api
  }

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    pause:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    replay:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4.2 4.5v5.2h5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    soundOn:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    soundOff:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  }

  /* ---------------------------------------------------------------- boot */

  const FONT_PROBES = [
    ['800 100px Nunito', 'Hello Привет Teşekkürler Спасибо'],
    ['900 100px Nunito', 'LangX'],
    ['400 100px Nunito', 'Hello'],
    ['700 100px Nunito', 'Hello'],
    ['800 100px "Noto Sans Arabic"', 'مرحبا شكرا'],
    ['800 100px "Noto Sans JP"', 'こんにちはありがとう'],
    ['800 100px "Noto Sans KR"', '안녕하세요감사합니다'],
    ['800 100px "Noto Sans SC"', '你好谢谢'],
    ['800 100px "Noto Sans Devanagari"', 'नमस्ते'],
    ['800 100px "Noto Sans Thai"', 'สวัสดี'],
    ['800 100px "Noto Sans Hebrew"', 'שלום'],
    ['800 100px "Noto Sans"', 'Γειά σου'],
  ]

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  REEL.boot = async function () {
    gsap.registerPlugin(CustomEase, SplitText, MorphSVGPlugin, DrawSVGPlugin)
    viewport = document.getElementById('viewport')
    stage = document.getElementById('stage')
    fit()
    window.addEventListener('resize', fit)

    // Offline, the fonts never arrive; the reel still plays in the fallbacks.
    await Promise.race([
      Promise.all(
        FONT_PROBES.map(([font, text]) => document.fonts.load(font, text).catch(() => null)),
      ),
      wait(5000),
    ])
    await Promise.race([document.fonts.ready, wait(1000)])

    build()

    range.from = 0
    range.to = REEL.duration
    if (MODE.solo) {
      const s = REEL.scenes.find((x) => x.id === MODE.solo)
      if (s) {
        range.from = s.start
        range.to = s.start + s.dur
        range.loop = true
      }
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!MODE.capture) {
      hud = buildHud()
      gsap.ticker.add(tick)
    }

    document.documentElement.dataset.ready = 'true'

    if (MODE.capture) {
      render(clamp(MODE.at != null ? MODE.at : 0))
    } else if (reduce && !MODE.solo) {
      // The resting frame is the lockup: show it, and play only when asked.
      render(clamp(REEL.duration))
      hud.sync()
    } else {
      render(clamp(MODE.at != null ? MODE.at : range.from))
      state.from = REEL.master.time()
      play()
    }
    fit()
  }
})()
