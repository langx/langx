// Venus 2D vector rig.
//
// A copy of the polished rig (style 1, "cilalı") that draws Venus in the streak story videos, so the
// launch film can be rendered from this repo. The drawing is unchanged; what differs is the export
// at the bottom (the reel's page is a classic script, so the rig hangs itself on `window.Venus`),
// the repo's formatting, and one unused local the lint refuses. When the rig changes upstream, copy
// it over again and redo those three. 2D vector only: flat fills, one shade and one highlight per
// region, one warm outline.
//
//   const svg = Venus.svg(pose, { width, height, cx, cy, scale, bg });   // full <svg> string
//   const g   = Venus.draw(pose, opts);                                    // <g> markup only
//   const p   = Venus.pose({ expr: 'squint', head: { roll: 12 } });       // defaults + preset + overrides
//
// Why it is built like this. A flat cartoon that only exists in a front view can't turn round, walk
// in profile or do a 3/4 "model turn", and those are half of her acting. So the rig is 2D in its
// drawing (flat fills, one shade + one highlight per region, one warm outline) but places its parts
// in a tiny 3D space: the face features sit on a sphere that yaws, and the body is a handful of
// capsules and ellipsoids that are projected and painter-sorted. Every drawn shape is still a named
// SVG group, so a pose is just a set of numbers and the output stays crisp at any size.
//
// Units: H = 200 = head height (crown to chin, no ears). World origin = ground under her centre,
// SVG y down, so "up" is negative y.
;(function (root) {
  'use strict'
  const PAL = {
    coat: '#C8703A',
    shade: '#9A4C22',
    light: '#E59E64',
    tick: '#5A2B14',
    tip: '#341A0D',
    muzzle: '#F8E6CF',
    earIn: '#EE9E8C',
    earRim: '#F4C6A2',
    earBack: '#93542B',
    nose: '#B4584E',
    beans: '#E8A08A',
    pawDark: '#6E3E28',
    iris: '#BCC24E',
    irisOut: '#5F7F2A',
    irisGlow: '#EAD46A',
    liner: '#3B2414',
    lid: '#D9874E',
    rim: '#F6DDB0',
    tongue: '#E88AA0',
    ink: '#14161B',
    mouth: '#5A2A2A',
    whisker: '#FFFFFF',
  }
  const D2R = Math.PI / 180
  const lerp = (a, b, t) => a + (b - a) * t
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const n1 = (v) => (Math.round(v * 10) / 10).toString()
  const pt = (p) => n1(p[0]) + ' ' + n1(p[1])
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o)
  function merge(a, b) {
    if (b === undefined) return a
    if (!isObj(b) || !isObj(a)) return b
    const o = Object.assign({}, a)
    for (const k of Object.keys(b)) o[k] = merge(a[k], b[k])
    return o
  }
  const clone = (o) => JSON.parse(JSON.stringify(o))

  // ------------------------------------------------------------------ pose
  const eyeDef = () => ({
    lid: 0.22,
    low: 0.06,
    tilt: 0,
    pupil: 0.42,
    round: 0,
    px: 0,
    py: 0,
    happy: 0,
    s: 1,
  })
  const earDef = () => ({ rot: 0, fold: 0, swivel: 0 })
  const DEFAULT = {
    x: 0,
    y: 0,
    s: 1,
    flip: 1,
    mode: 'sit', // sit | stand | loaf | sprawl | stretch; v2: crouch | leap | belly | startle
    yaw: 0, // body yaw, degrees: 0 front, 90 facing screen-right, 180 back
    persp: 0, // focal length in px for a close camera (0 = orthographic)
    sx: 1,
    sy: 1, // squash / stretch about the ground point
    lean: 0, // whole-figure rotation about the ground point, degrees
    rise: 0, // lift off the ground (hops), px
    crouch: 0, // 0..1 sinks the body (anticipation)
    walk: { phase: 0, amt: 0 },
    paw: { lift: 0, reach: 0 }, // her right fore paw raised (0..1), reach toward camera (0..1)
    head: { yaw: 0, roll: 0, pitch: 0, dx: 0, dy: 0, s: 1 },
    ears: { L: earDef(), R: earDef() }, // L = screen-left ear
    eyes: { L: eyeDef(), R: eyeDef() },
    mouth: { open: 0, smile: 0.15, tongue: 0, smirk: 0, wide: 1 },
    whisk: { ang: 0, droop: 0 },
    tail: { pitch: 0, yaw: 80, curl: 0, hook: 0, side: 230, wave: 0, phase: 0, len: 1.2 },
    bag: 0,
    outfit: null,
    shadow: 1,
  }

  // Expressions are partial poses. Lids: 0 open .. 1 closed. Pupil: width as a fraction of the iris
  // (0.12 slit, 0.35 oval, 0.75 round). Ear rot: + = splay outward, - = up and forward.
  const EXPR = {
    neutral: {},
    happy: {
      eyes: {
        L: { lid: 0.08, low: 0.32, pupil: 0.5, round: 0.4 },
        R: { lid: 0.08, low: 0.32, pupil: 0.5, round: 0.4 },
      },
      mouth: { smile: 0.9, open: 0.22 },
      ears: { L: { rot: -6 }, R: { rot: -6 } },
      whisk: { ang: 8 },
    },
    squint: {
      head: { roll: 12, pitch: -6 },
      eyes: {
        L: { lid: 0.56, low: 0.2, tilt: 0.12, pupil: 0.12 },
        R: { lid: 0.56, low: 0.2, tilt: 0.12, pupil: 0.12 },
      },
      mouth: { smile: -0.08 },
      ears: { R: { swivel: 0.55, rot: 6 } },
      whisk: { ang: -6 },
    },
    slowblink: {
      head: { pitch: 7 },
      eyes: { L: { lid: 1, low: 0.15 }, R: { lid: 1, low: 0.15 } },
      mouth: { smile: 0.3 },
      ears: { L: { rot: 8 }, R: { rot: 8 } },
    },
    blep: {
      eyes: {
        L: { lid: 0.12, pupil: 0.46, round: 0.3 },
        R: { lid: 0.12, pupil: 0.46, round: 0.3 },
      },
      mouth: { smile: 0, tongue: 1 },
    },
    shocked: {
      eyes: {
        L: { lid: 0, low: 0, pupil: 0.2, round: 1, s: 1.12 },
        R: { lid: 0, low: 0, pupil: 0.2, round: 1, s: 1.12 },
      },
      mouth: { open: 0.45, wide: 0.45, smile: 0 },
      ears: { L: { rot: -12 }, R: { rot: -12 } },
      whisk: { ang: 16 },
    },
    smug: {
      head: { roll: -7, pitch: -8 },
      eyes: {
        L: { lid: 0.46, low: 0.18, tilt: 0.1, pupil: 0.14, px: 0.55 },
        R: { lid: 0.46, low: 0.18, tilt: 0.1, pupil: 0.14, px: 0.55 },
      },
      mouth: { smile: 0.35, smirk: 0.9 },
      ears: { L: { rot: 4 }, R: { rot: 4 } },
      whisk: { ang: 6 },
    },
    laughing: {
      head: { roll: 8, pitch: -6 },
      eyes: { L: { happy: 1 }, R: { happy: 1 } },
      mouth: { open: 0.85, smile: 1, wide: 1.1 },
      ears: { L: { rot: 10 }, R: { rot: 10 } },
      whisk: { ang: 10 },
    },
    sad: {
      head: { pitch: 9 },
      eyes: {
        L: { lid: 0.3, tilt: -0.45, pupil: 0.62, round: 0.7, py: 0.25 },
        R: { lid: 0.3, tilt: -0.45, pupil: 0.62, round: 0.7, py: 0.25 },
      },
      mouth: { smile: -0.75 },
      ears: { L: { rot: 30, fold: 0.3 }, R: { rot: 30, fold: 0.3 } },
      whisk: { droop: 1 },
    },
    sleepy: {
      head: { pitch: 10, roll: 7 },
      eyes: { L: { lid: 0.78, low: 0.12 }, R: { lid: 0.72, low: 0.12 } },
      mouth: { smile: 0.05 },
      ears: { L: { rot: 22, fold: 0.15 }, R: { rot: 18, fold: 0.15 } },
      whisk: { droop: 0.7 },
    },
    curious: {
      head: { roll: -16 },
      eyes: {
        L: { lid: 0, low: 0, pupil: 0.62, round: 0.6 },
        R: { lid: 0, low: 0, pupil: 0.62, round: 0.6 },
      },
      mouth: { smile: 0 },
      ears: { L: { rot: -10 }, R: { rot: -10 } },
      whisk: { ang: 14 },
    },
    annoyed: {
      eyes: { L: { lid: 0.42, tilt: 0.32, pupil: 0.2 }, R: { lid: 0.42, tilt: 0.32, pupil: 0.2 } },
      mouth: { smile: -0.35 },
      ears: { L: { fold: 0.95 }, R: { fold: 0.95 } },
      whisk: { ang: -10 },
    },
    proud: {
      head: { pitch: -9, roll: -3 },
      eyes: { L: { lid: 0.36, low: 0.12, pupil: 0.28 }, R: { lid: 0.36, low: 0.12, pupil: 0.28 } },
      mouth: { smile: 0.55 },
      ears: { L: { rot: -5 }, R: { rot: -5 } },
      whisk: { ang: 8 },
    },
    innocent: {
      eyes: {
        L: { lid: 0, low: 0, pupil: 0.8, round: 1 },
        R: { lid: 0, low: 0, pupil: 0.8, round: 1 },
      },
      mouth: { smile: 0.05 },
      ears: { L: { rot: -6 }, R: { rot: -6 } },
    },
    loving: {
      head: { roll: 9, pitch: 4 },
      eyes: { L: { lid: 0.55, low: 0.3 }, R: { lid: 0.55, low: 0.3 } },
      mouth: { smile: 0.45 },
      ears: { L: { rot: 10 }, R: { rot: 10 } },
    },
  }
  function pose(o) {
    let p = clone(DEFAULT)
    if (o && o.expr) p = merge(p, clone(EXPR[o.expr] || {}))
    p = merge(p, o ? clone(o) : undefined)
    p._full = true // a complete pose: draw() uses it as is
    return p
  }

  // ------------------------------------------------------------------ geometry helpers
  // tapered capsule = hull of two circles
  function capsule(a, ra, b, rb) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      d = Math.hypot(dx, dy)
    if (d <= Math.abs(ra - rb) + 0.01) {
      const c = ra >= rb ? a : b,
        r = Math.max(ra, rb)
      return circle(c, r)
    }
    const th = Math.atan2(dy, dx),
      al = Math.acos(clamp((ra - rb) / d, -1, 1))
    const A1 = [a[0] + ra * Math.cos(th + al), a[1] + ra * Math.sin(th + al)],
      A2 = [a[0] + ra * Math.cos(th - al), a[1] + ra * Math.sin(th - al)]
    const B1 = [b[0] + rb * Math.cos(th + al), b[1] + rb * Math.sin(th + al)],
      B2 = [b[0] + rb * Math.cos(th - al), b[1] + rb * Math.sin(th - al)]
    const bigB = 2 * al > Math.PI ? 1 : 0,
      bigA = 2 * al > Math.PI ? 0 : 1
    return `M${pt(A1)}L${pt(B1)}A${n1(rb)} ${n1(rb)} 0 ${bigB} 0 ${pt(B2)}L${pt(A2)}A${n1(ra)} ${n1(ra)} 0 ${bigA} 0 ${pt(A1)}Z`
  }
  const circle = (c, r) =>
    `M${n1(c[0] - r)} ${n1(c[1])}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`
  function ellipse(c, rx, ry, rotDeg) {
    const k = 0.5523,
      r = (rotDeg || 0) * D2R,
      cs = Math.cos(r),
      sn = Math.sin(r)
    const T = (x, y) => [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]
    const P = [
      T(rx, 0),
      T(rx, ry * k),
      T(rx * k, ry),
      T(0, ry),
      T(-rx * k, ry),
      T(-rx, ry * k),
      T(-rx, 0),
      T(-rx, -ry * k),
      T(-rx * k, -ry),
      T(0, -ry),
      T(rx * k, -ry),
      T(rx, -ry * k),
    ]
    return `M${pt(P[0])}C${pt(P[1])} ${pt(P[2])} ${pt(P[3])}C${pt(P[4])} ${pt(P[5])} ${pt(P[6])}C${pt(P[7])} ${pt(P[8])} ${pt(P[9])}C${pt(P[10])} ${pt(P[11])} ${pt(P[0])}Z`
  }
  // closed Catmull-Rom through points
  function smoothClosed(P) {
    const n = P.length
    let d = `M${pt(P[0])}`
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n],
        p1 = P[i],
        p2 = P[(i + 1) % n],
        p3 = P[(i + 2) % n]
      d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`
    }
    return d + 'Z'
  }
  // a variable-width ribbon along a polyline (tail, stripes)
  function ribbon(P, R, capEnd) {
    const n = P.length,
      Lf = [],
      Rt = []
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)],
        b = P[Math.min(n - 1, i + 1)]
      let tx = b[0] - a[0],
        ty = b[1] - a[1]
      const l = Math.hypot(tx, ty) || 1
      tx /= l
      ty /= l
      Lf.push([P[i][0] - ty * R[i], P[i][1] + tx * R[i]])
      Rt.push([P[i][0] + ty * R[i], P[i][1] - tx * R[i]])
    }
    // both edges as smooth curves (no facets), round caps at the ends
    const Rr = Rt.slice().reverse()
    const re = R[n - 1],
      r0 = R[0]
    let d = smoothOpen(Lf)
    d += capEnd !== false && re > 0.5 ? `A${n1(re)} ${n1(re)} 0 0 0 ${pt(Rr[0])}` : `L${pt(Rr[0])}`
    d += smoothOpen(Rr).replace(/^M[^C]*/, '')
    d += r0 > 0.5 ? `A${n1(r0)} ${n1(r0)} 0 0 0 ${pt(Lf[0])}` : ''
    return d + 'Z'
  }
  // smooth open path through points (for strokes)
  function smoothOpen(P) {
    let d = `M${pt(P[0])}`
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)],
        p1 = P[i],
        p2 = P[i + 1],
        p3 = P[Math.min(P.length - 1, i + 2)]
      d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`
    }
    return d
  }

  // ------------------------------------------------------------------ head
  // Head-local: eye line y = 0, crown -94, chin +106. Features live on a sphere of radius HR and are
  // rotated by the head yaw; the silhouette morphs between a front and a profile outline.
  const HR = 112
  // polished: a domed crown (no flat lid, no square temples) that widens to the cheekbones at eye
  // level and then tapers in a soft wedge to the chin, the Aby head shape rather than a rounded box
  const HEAD_FRONT = [
    [0, -99],
    [44, -95],
    [79, -80],
    [104, -53],
    [118, -16],
    [114, 22],
    [90, 55],
    [52, 85],
    [0, 103],
    [-52, 85],
    [-90, 55],
    [-114, 22],
    [-118, -16],
    [-104, -53],
    [-79, -80],
    [-44, -95],
  ]
  const HEAD_SIDE = [
    [-4, -94],
    [46, -88],
    [84, -64],
    [106, -32],
    [118, -6],
    [132, 18],
    [148, 38],
    [146, 60],
    [126, 82],
    [70, 100],
    [-12, 102],
    [-62, 88],
    [-92, 54],
    [-104, 8],
    [-98, -42],
    [-62, -80],
  ]
  const PIV = 80 // head-local point that sits on the neck anchor

  function headDraw(P, phiDeg, o, uid) {
    const phi = phiDeg * D2R,
      c = Math.cos(phi),
      s = Math.sin(phi)
    const pitch = P.head.pitch || 0
    const ol = o.ol
    // rotate a head-local 3D point; pitch slides front-facing features up/down
    const hp = (x, y, z) => {
      const xr = x * c + z * s,
        zr = -x * s + z * c
      return [xr, y + (pitch * 0.85 * Math.max(0, zr)) / HR, zr]
    }
    const sph = (x, y) => Math.sqrt(Math.max(0, HR * HR - x * x - y * y * 0.55))
    const w = Math.abs(s),
      sg = s >= 0 ? 1 : -1
    // turned to screen-left the profile is mirrored, which reverses its winding: pair front point i with
    // mirrored side point n-i, or the outline crosses itself (the head folded on any negative yaw)
    const nH = HEAD_SIDE.length
    const outlinePts = HEAD_FRONT.map((f, i) => {
      const q = HEAD_SIDE[sg > 0 ? i : (nH - i) % nH]
      return [lerp(f[0], q[0] * sg, Math.pow(w, 1.3)), lerp(f[1], q[1], Math.pow(w, 1.3))]
    })
    const headD = smoothClosed(outlinePts)
    const back = c < -0.15
    let out = ''
    // ---- ears (behind the head)
    const ears = []
    for (const side of [-1, 1]) {
      const E = side < 0 ? P.ears.L : P.ears.R
      const cE = Math.sign(c || 1) * Math.max(Math.abs(c), 0.3),
        b0 = [side * 66 * cE - 6 * s, -70 + pitch * -0.25, -side * 66 * s - 6 * c],
        b = [
          b0[0] - side * clamp(P.ears[side < 0 ? 'L' : 'R'].fold, 0, 1) * 6,
          b0[1] + clamp(P.ears[side < 0 ? 'L' : 'R'].fold, 0, 1) * 16,
          b0[2],
        ]
      const ax = side * 0.62 * c - 0.3 * s,
        ang = Math.atan2(ax, 0.79) / D2R
      const face = Math.cos(phi + side * 25 * D2R)
      const fold = clamp(E.fold, 0, 1),
        sw = clamp(E.swivel, 0, 1)
      const rot = ang + side * (E.rot + fold * 52)
      const wsc = Math.max(0.46, Math.abs(face)) * (1 - 0.5 * sw),
        lsc = (1 - 0.4 * fold) * (1 - 0.08 * sw)
      const showBack = face < 0 || sw > 0.62 || back
      ears.push({
        z: b[2],
        d: `<g transform="translate(${pt(b)}) rotate(${n1(rot)}) scale(${n1(wsc * 100) / 100} ${n1(lsc * 100) / 100})">${earShape(side, showBack, o)}</g>`,
      })
    }
    ears.sort((a, b) => a.z - b.z)
    out += ears.map((e) => e.d).join('')
    // ---- skull
    out += `<path d="${headD}" fill="${PAL.coat}" stroke="${PAL.liner}" stroke-width="${2 * ol}" paint-order="stroke" stroke-linejoin="round"/>`
    out += `<clipPath id="${uid}h"><path d="${headD}"/></clipPath><clipPath id="${uid}hs"><path d="${headD}" transform="translate(-9 -14)"/></clipPath>`
    out += `<g clip-path="url(#${uid}h)">`
    // one shade (lower-right crescent) + one highlight (upper-left rim)
    out += `<path d="${headD}" fill="${PAL.light}"/><path d="${headD}" transform="translate(5 6)" fill="${PAL.shade}"/>`
    out += `<g clip-path="url(#${uid}hs)"><path d="${headD}" transform="translate(5 6)" fill="${PAL.coat}"/></g>`
    if (back) {
      // back of the head: the spine stripe starts between the ears
      out += `<path d="${ribbon(
        [
          [0, -100],
          [0, -40],
          [0, 40],
        ].map((q) => [q[0] + 0, q[1]]),
        [22, 18, 10],
      )}" fill="${PAL.tick}" opacity="${n1(0.55 * clamp(-c, 0, 1) * 10) / 10}" filter="url(#${uid}soft)"/>`
    } else {
      // the tabby M
      const strokes = [
        {
          pts: [
            [0, -26],
            [0, -58],
            [0, -92],
          ],
          r: [5.5, 4.2, 2.2],
        },
        {
          pts: [
            [-20, -30],
            [-25, -56],
            [-31, -82],
          ],
          r: [5, 3.8, 1.8],
        },
        {
          pts: [
            [20, -30],
            [25, -56],
            [31, -82],
          ],
          r: [5, 3.8, 1.8],
        },
        {
          pts: [
            [-20, -30],
            [-10, -40],
            [0, -32],
          ],
          r: [4.4, 3.2, 3.6],
        },
        {
          pts: [
            [20, -30],
            [10, -40],
            [0, -32],
          ],
          r: [4.4, 3.2, 3.6],
        },
      ]
      for (const st of strokes) {
        const q = st.pts.map((p) => hp(p[0], p[1], sph(p[0], p[1])))
        if (q.every((v) => v[2] < 5)) continue
        out += `<path d="${ribbon(
          q.map((v) => [v[0], v[1]]),
          st.r,
        )}" fill="${PAL.tick}"/>`
      }
      // eyes
      for (const side of [-1, 1]) {
        const ex = side * 57,
          ez = 72,
          q = hp(ex, 2, ez)
        const f = Math.cos(Math.atan2(ex, ez) + phi)
        if (f < 0.1) continue
        const E = side < 0 ? P.eyes.L : P.eyes.R
        const sc = (E.s || 1) * 1.27
        out += `<g transform="translate(${pt(q)}) scale(${n1(f * sc * 100) / 100} ${n1(sc * 100) / 100})">${eyeDraw(E, side, uid + (side < 0 ? 'l' : 'r'), o)}</g>`
      }
      // muzzle cream (whisker pads + chin)
      const mz = hp(0, 66, 120),
        mf = Math.max(0.32, Math.cos(phi))
      out += `<g transform="translate(${pt([mz[0], mz[1]])}) scale(${n1(mf * 100) / 100} 1)"><path d="M-22 -18C-40 -16 -45 9 -31 20C-19 35 19 35 31 20C45 9 40 -16 22 -18C10 -22 -10 -22 -22 -18Z" fill="${PAL.muzzle}"/></g>`
    }
    out += `</g>` // end clip
    if (!back) {
      // nose, mouth (not clipped: in profile they sit on the outline)
      const nz = hp(0, 44, 136),
        nf = Math.max(0.45, Math.cos(phi))
      const mz = hp(0, 62, 128),
        mf = Math.max(0.42, Math.cos(phi))
      out += `<g transform="translate(${pt([mz[0], mz[1]])}) scale(${n1(mf * 100) / 100} 1)">${mouthDraw(P.mouth, o)}</g>`
      out += `<g transform="translate(${pt([nz[0], nz[1]])}) scale(${n1(nf * 100) / 100} 1)"><path d="M-14 -7Q0 -11 14 -7Q15 -3 3 7Q0 10 -3 7Q-15 -3 -14 -7Z" fill="${PAL.nose}" stroke="${PAL.liner}" stroke-width="2.6" stroke-linejoin="round"/><path d="M-6 -6Q0 -8 6 -6" stroke="#D99485" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`
      // whiskers
      if (o.detail > 0 && o.whiskers !== false) {
        const nW = o.detail >= 2 ? 3 : 2
        for (const side of [-1, 1]) {
          const q = hp(side * 22, 64, sph(22, 64) - 4)
          if (q[2] < 20) continue
          const sideFace = Math.max(0.35, Math.abs(Math.cos(phi + side * 50 * D2R)))
          for (let i = 0; i < nW; i++) {
            const base =
              (nW === 3 ? [-14, 0, 13][i] : [-8, 9][i]) - P.whisk.ang + P.whisk.droop * 14
            const a = base * D2R,
              L = (nW === 3 ? [126, 136, 118][i] : [128, 120][i]) * sideFace * (o.whiskerLen || 1)
            const sx = q[0] + side * 8,
              sy = q[1] + (i - 1) * 5
            const ex = sx + side * Math.cos(a) * L,
              ey = sy + Math.sin(a) * L
            const mx = sx + side * Math.cos(a) * L * 0.55,
              my = sy + Math.sin(a) * L * 0.55 + 6 + P.whisk.droop * 10
            out += `<path d="M${pt([sx, sy])}Q${pt([mx, my])} ${pt([ex, ey + 4 + P.whisk.droop * 8])}" stroke="${PAL.whisker}" stroke-width="${o.detail >= 2 ? 2.6 : 4}" fill="none" stroke-linecap="round" opacity="0.95"/>`
          }
        }
      }
    }
    return out
  }

  function earShape(side, showBack, o) {
    const s = side
    // the base runs on down into the skull, so a rotated or folded ear never shows a cut edge
    const outer = `M${-s * 70} 34C${-s * 74} -26 ${-s * 44} -102 ${-s * 18} -136C${-s * 4} -153 ${s * 17} -153 ${s * 25} -131C${s * 43} -86 ${s * 66} -34 ${s * 72} 34C${s * 70} 56 ${s * 34} 70 0 70C${-s * 34} 70 ${-s * 70} 56 ${-s * 70} 34Z`
    let d = `<path d="${outer}" fill="${showBack ? PAL.earBack : PAL.coat}" stroke="${PAL.liner}" stroke-width="${2 * o.ol}" paint-order="stroke" stroke-linejoin="round"/>`
    if (showBack) {
      d += `<path d="M${-s * 22} -110Q${-s * 4} -168 ${s * 12} -150Q${s * 34} -100 ${s * 40} -70Z" fill="${PAL.tick}" opacity="0.35"/>`
      return d
    }
    d += `<path d="M${-s * 56} 28C${-s * 60} -24 ${-s * 36} -90 ${-s * 14} -119C${-s * 3} -133 ${s * 14} -133 ${s * 20} -116C${s * 35} -78 ${s * 53} -30 ${s * 57} 28Z" fill="${PAL.earRim}"/>`
    d += `<path d="M${-s * 45} 28C${-s * 47} -22 ${-s * 29} -80 ${-s * 11} -105C${-s * 2} -116 ${s * 11} -116 ${s * 16} -101C${s * 29} -68 ${s * 43} -26 ${s * 45} 28Z" fill="${PAL.earIn}"/>`
    if (o.detail >= 2) {
      for (const [x, h, bend] of [
        [-18, 46, 10],
        [-4, 56, 6],
        [10, 42, 2],
      ]) {
        d += `<path d="M${s * x} 12Q${s * (x + bend)} ${12 - h * 0.6} ${s * (x + bend * 1.6)} ${12 - h}" stroke="${PAL.muzzle}" stroke-width="3.2" fill="none" stroke-linecap="round" opacity="0.9"/>`
      }
    }
    return d
  }

  // almond eye: side -1 = screen-left. Outer corner is on the outside and raised (the 8 degree tilt).
  function eyeDraw(E, s, uid, o) {
    const I = [-s * 32, 4],
      O = [s * 34, -6]
    const up = [
      [-s * 23, -35],
      [s * 17, -41],
    ] // upper lid controls, from I to O
    const lo = [
      [-s * 18, 29],
      [s * 21, 23],
    ] // lower lid controls, from I to O
    const low = clamp(E.low || 0, 0, 1) * 0.7
    const maxU = 1 - low
    const uIn = clamp((E.lid || 0) + (E.tilt || 0) * 0.5, 0, maxU),
      uOut = clamp((E.lid || 0) - (E.tilt || 0) * 0.5, 0, maxU)
    const U = [
      [lerp(up[0][0], lo[0][0], uIn), lerp(up[0][1], lo[0][1], uIn)],
      [lerp(up[1][0], lo[1][0], uOut), lerp(up[1][1], lo[1][1], uOut)],
    ]
    const Lw = [
      [lerp(lo[0][0], up[0][0], low), lerp(lo[0][1], up[0][1], low)],
      [lerp(lo[1][0], up[1][0], low), lerp(lo[1][1], up[1][1], low)],
    ]
    const full = `M${pt(I)}C${pt(up[0])} ${pt(up[1])} ${pt(O)}C${pt(lo[1])} ${pt(lo[0])} ${pt(I)}Z`
    const vis = `M${pt(I)}C${pt(U[0])} ${pt(U[1])} ${pt(O)}C${pt(Lw[1])} ${pt(Lw[0])} ${pt(I)}Z`
    const upperLine = `M${pt(I)}C${pt(U[0])} ${pt(U[1])} ${pt(O)}`
    let d = ''
    // cream "spectacles"
    d += `<path d="${full}" fill="${PAL.lid}" stroke="${PAL.rim}" stroke-width="${o.detail > 0 ? 8 : 7}" stroke-linejoin="round"/>`
    // liner flick: out from the outer corner, back toward the ear
    d += `<path d="M${pt([O[0] - s * 4, O[1] - 2])}Q${pt([O[0] + s * 12, O[1] - 3])} ${pt([O[0] + s * 24, O[1] - 9])}Q${pt([O[0] + s * 12, O[1] + 3])} ${pt([O[0] - s * 2, O[1] + 6])}Z" fill="${PAL.liner}"/>`
    if ((E.happy || 0) > 0.5) {
      d += `<path d="M${pt([I[0], I[1] + 4])}Q${pt([0, -26])} ${pt([O[0], O[1] + 4])}" stroke="${PAL.liner}" stroke-width="7" fill="none" stroke-linecap="round"/>`
      return d
    }
    // v2: squeezed shut, a "> <" pair with the point toward the nose (delight, the dramatic sob).
    // Read at phone size where happy arcs and closed lids look alike.
    if ((E.squeeze || 0) > 0.5) {
      d += `<path d="M${pt([s * 26, -19])}Q${pt([-s * 2, -9])} ${pt([-s * 18, 0])}Q${pt([-s * 2, 9])} ${pt([s * 26, 17])}" stroke="${PAL.liner}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      return d
    }
    const closed = uIn + uOut > 2 * maxU - 0.04
    if (!closed) {
      const px = clamp(E.px || 0, -1, 1) * 11,
        py = clamp(E.py || 0, -1, 1) * 7
      const pw = clamp(E.pupil, 0.08, 0.95),
        irisR = 30
      const rx = irisR * pw,
        ry = lerp(28, Math.max(rx, 10), clamp(E.round || 0, 0, 1))
      d += `<clipPath id="${uid}"><path d="${vis}"/></clipPath><g clip-path="url(#${uid})">`
      d += `<path d="${full}" fill="${PAL.irisOut}"/>`
      d += `<path d="${circle([px, py], irisR)}" fill="${PAL.iris}"/>`
      d += `<path d="${circle([px, py + 2], irisR * 0.62)}" fill="${PAL.irisGlow}"/>`
      d += `<path d="${ellipse([px, py], rx, ry, 0)}" fill="${PAL.ink}"/>`
      // catchlights: always upper-left / lower-right, whichever way she looks
      d += `<path d="${circle([px * 0.5 - 9, py * 0.5 - 10], 6.5)}" fill="#fff"/>`
      if (o.detail >= 1) d += `<path d="${circle([px * 0.5 + 9, py * 0.5 + 9], 3)}" fill="#fff"/>`
      // lid shadow: the upper lid casts a thin band on the eye
      d += `<path d="${upperLine}" stroke="${PAL.irisOut}" stroke-width="9" fill="none" opacity="0.55"/>`
      d += `</g>`
      d += `<path d="${vis}" fill="none" stroke="${PAL.liner}" stroke-width="3.6" stroke-linejoin="round"/>`
      d += `<path d="${upperLine}" fill="none" stroke="${PAL.liner}" stroke-width="6" stroke-linecap="round"/>`
    } else {
      // closed: the lid line, a soft smile shape
      d += `<path d="M${pt(I)}C${pt(Lw[0])} ${pt(Lw[1])} ${pt(O)}" fill="none" stroke="${PAL.liner}" stroke-width="6" stroke-linecap="round"/>`
    }
    return d
  }

  // mouth, local origin = mouth centre (head-local 0, 62). No teeth, ever.
  function mouthDraw(M, o) {
    const w = 19 * (M.wide ?? 1),
      sm = M.smile || 0,
      sk = M.smirk || 0
    const cl = sm * 6 - sk * 5,
      cr = sm * 6 + sk * 5,
      op = clamp(M.open || 0, 0, 1)
    let d = ''
    d += `<path d="M0 -10L0 -2" stroke="${PAL.liner}" stroke-width="2.6" stroke-linecap="round"/>`
    if (op > 0.02) {
      const h = 6 + op * 30,
        ww = w * (0.75 + op * 0.25)
      const shape = `M${-ww} ${n1(1 - cl * 0.6)}Q${n1(-ww * 0.95)} ${n1(h)} 0 ${n1(h + 2)}Q${n1(ww * 0.95)} ${n1(h)} ${ww} ${n1(1 - cr * 0.6)}Q${n1(ww * 0.4)} 3 0 0Q${n1(-ww * 0.4)} 3 ${-ww} ${n1(1 - cl * 0.6)}Z`
      d += `<clipPath id="mo${o.uid}"><path d="${shape}"/></clipPath>`
      d += `<path d="${shape}" fill="${PAL.mouth}"/>`
      d += `<g clip-path="url(#mo${o.uid})"><path d="${ellipse([0, h + 2], ww * 0.7, h * 0.45, 0)}" fill="${PAL.tongue}"/></g>`
      d += `<path d="${shape}" fill="none" stroke="${PAL.liner}" stroke-width="2.8" stroke-linejoin="round"/>`
    }
    const tg = clamp(M.tongue || 0, 0, 1)
    if (tg > 0.02 && op < 0.3) {
      const tl = 3 + tg * 11
      d += `<path d="M-7 1Q-8 ${n1(2 + tl)} 0 ${n1(3 + tl)}Q8 ${n1(2 + tl)} 7 1Z" fill="${PAL.tongue}" stroke="${PAL.liner}" stroke-width="2.4" stroke-linejoin="round"/>`
      d += `<path d="M0 3L0 ${n1(1 + tl * 0.6)}" stroke="#C9667E" stroke-width="1.8" stroke-linecap="round"/>`
    }
    // the "w": two little arcs from the philtrum
    d += `<path d="M${-w} ${n1(-2 - cl)}Q${n1(-w * 0.5)} ${n1(8 - cl * 0.3)} 0 -1Q${n1(w * 0.5)} ${n1(8 - cr * 0.3)} ${w} ${n1(-2 - cr)}" stroke="${PAL.liner}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    return d
  }

  // ------------------------------------------------------------------ body
  // Each builder returns pieces in cat-local 3D: x = her left-right, y = up (negative), z = toward
  // the camera when yaw = 0. Groups: 'body' pieces are drawn as one outlined union; every other
  // piece is outlined on its own and painter-sorted.
  function legIK(top, foot, l1, l2, bend) {
    // bend in the y-z plane; +1 = mid joint toward +z
    const dy = foot[1] - top[1],
      dz = foot[2] - top[2]
    let d = Math.hypot(dy, dz)
    const dd = clamp(d, 1, l1 + l2 - 0.5)
    const a = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1))
    const base = Math.atan2(dz, dy) // angle from +y axis toward +z
    const ang = base - bend * a
    return [
      top[0] + (foot[0] - top[0]) * (l1 / (l1 + l2)),
      top[1] + l1 * Math.cos(ang),
      top[2] + l1 * Math.sin(ang),
    ]
  }

  function buildBody(P) {
    const pcs = []
    const cr = clamp(P.crouch || 0, 0, 1)
    const add = (o) => pcs.push(o)
    let neck,
      tailBase,
      deco = []
    const leg = (name, a, ra, b, rb, extra) =>
      add(Object.assign({ kind: 'cap', a, ra, b, rb, name, grp: name }, extra || {}))
    const paw = (name, c, rx, ry, rz, extra) =>
      add(Object.assign({ kind: 'ell', c, rx, ry, rz, name, grp: name }, extra || {}))
    if (P.mode === 'sit') {
      const dy = cr * 26
      // polished: a pear, not a tube. Wide round haunches at the floor, a waist above them, the
      // chest narrowing up into a slimmer neck, so the silhouette tapers like her model pose
      add({ kind: 'ell', c: [0, -64 + dy * 0.3, -46], rx: 70, ry: 64, rz: 66, grp: 'body' })
      add({ kind: 'ell', c: [-60, -54 + dy * 0.2, -22], rx: 50, ry: 54, rz: 64, grp: 'body' })
      add({ kind: 'ell', c: [60, -54 + dy * 0.2, -22], rx: 50, ry: 54, rz: 64, grp: 'body' })
      add({
        kind: 'cap',
        a: [0, -100 + dy * 0.4, -30],
        ra: 58,
        b: [0, -178 + dy, 14],
        rb: 48,
        grp: 'body',
      })
      // chest bulges forward over the fore legs (the "pigeon chest" of her model pose)
      add({ kind: 'ell', c: [0, -194 + dy, 34], rx: 52, ry: 56, rz: 50, grp: 'body' })
      add({
        kind: 'cap',
        a: [0, -222 + dy, 30],
        ra: 48,
        b: [0, -266 + dy, 38],
        rb: 40,
        grp: 'body',
      })
      neck = [0, -272 + dy, 40]
      deco.push({ kind: 'bib', a: [0, -266 + dy, 72], b: [0, -220 + dy, 84], ra: 28, rb: 6 })
      // hind feet, peeking out beside the fore paws
      paw('footL', [-76, -11, 14], 18, 11, 34, { col: 'coat' })
      paw('footR', [76, -11, 14], 18, 11, 34, { col: 'coat' })
      // fore legs: part of the body silhouette (a seated cat's chest flows into them), separated by
      // a shade line. A lifted paw becomes its own outlined limb.
      const lift = clamp(P.paw.lift || 0, 0, 1),
        reach = clamp(P.paw.reach || 0, 0, 1)
      // v2 paw parameters, all 0 by default: `left` lifts her left fore paw (screen-right) the way
      // `lift` lifts the right; `knead` (cycles) + `kamt` (0..1) press both in turns (making
      // biscuits, the scrabble); `side` swings the lifted right paw out sideways and low (the
      // knock-off tap, the swat); `groom` brings it up to her mouth, drawn over the chin.
      const kamt = clamp(P.paw.kamt || 0, 0, 1),
        kph = P.paw.knead || 0
      for (const sd of [-1, 1]) {
        const sh = [sd * 22, -170 + dy, 50]
        let wr = [sd * 23, -26, 58],
          pw = [sd * 24, -13, 68]
        let lf = sd < 0 ? lift : clamp(P.paw.left || 0, 0, 1)
        if (kamt > 0)
          lf = Math.max(
            lf,
            kamt * (0.05 + 0.3 * Math.max(0, Math.sin((kph + (sd < 0 ? 0 : 0.5)) * Math.PI * 2))),
          )
        const rc = sd < 0 ? reach : 0,
          side = sd < 0 ? clamp(P.paw.side || 0, 0, 1) : 0,
          groom = sd < 0 ? clamp(P.paw.groom || 0, 0, 1) : 0
        const lifted = lf > 0.02 || groom > 0.02
        if (lifted) {
          wr = [lerp(wr[0], sd * 44, lf), lerp(wr[1], -150, lf), lerp(wr[2], 110 + rc * 120, lf)]
          pw = [lerp(pw[0], sd * 46, lf), lerp(pw[1], -164, lf), lerp(pw[2], 130 + rc * 160, lf)]
          if (side > 0) {
            wr = [wr[0] - side * 70, wr[1] + side * 60, wr[2] - side * 20]
            pw = [pw[0] - side * 130, pw[1] + side * 92, pw[2] - side * 40]
          }
          if (groom > 0) {
            wr = [lerp(wr[0], -34, groom), lerp(wr[1], -226 + dy, groom), lerp(wr[2], 120, groom)]
            pw = [lerp(pw[0], -18, groom), lerp(pw[1], -268 + dy, groom), lerp(pw[2], 150, groom)]
          }
        }
        const over = groom > 0.45 ? { overHead: true } : {}
        if (lifted) leg(sd < 0 ? 'legR' : 'legL', sh, 17, wr, 14, over)
        else {
          add({ kind: 'cap', a: sh, ra: 18, b: wr, rb: 14, grp: 'body' })
          deco.push({
            kind: 'legline',
            a: [sd * 21 - sd * 17, -150 + dy, 58],
            b: [sd * 24 - sd * 13, -22, 62],
          })
        }
        paw(
          sd < 0 ? 'pawR' : 'pawL',
          pw,
          21,
          13,
          22,
          Object.assign(
            {
              beans: lifted && lf > 0.5 && !groom ? lf : 0,
              tilt: lifted ? lf * -50 - groom * 40 : 0,
            },
            over,
          ),
        )
      }
      // the haunch curve: one shade arc per side that separates thigh from chest, so the sitting
      // body reads as folded legs and not as one column
      for (const sd of [-1, 1])
        deco.push({
          kind: 'arc',
          pts: [
            [sd * 44, -118 + dy * 0.3, 30],
            [sd * 82, -100 + dy * 0.2, 22],
            [sd * 102, -64, 16],
            [sd * 100, -24, 14],
          ],
        })
      tailBase = { p: [0, -24, -96], dirPitch: 0 }
    } else if (P.mode === 'loaf') {
      // polished: a bread loaf, not a cushion. A low wide base, two shoulder lobes that the head
      // sinks between, one haunch bulging out at the back, the fore paws tucked under a chest fold
      add({ kind: 'ell', c: [0, -66, -34], rx: 172, ry: 66, rz: 140, grp: 'body' })
      add({ kind: 'ell', c: [-86, -96, 34], rx: 76, ry: 66, rz: 70, grp: 'body' })
      add({ kind: 'ell', c: [86, -96, 34], rx: 76, ry: 66, rz: 70, grp: 'body' })
      add({ kind: 'ell', c: [112, -86, -84], rx: 76, ry: 72, rz: 76, grp: 'body' })
      add({ kind: 'ell', c: [0, -98, 0], rx: 130, ry: 66, rz: 110, grp: 'body' })
      add({ kind: 'ell', c: [0, -70, 82], rx: 120, ry: 62, rz: 46, grp: 'body' })
      neck = [0, -92, 96]
      deco.push({ kind: 'bib', a: [0, -104, 128], b: [0, -64, 130], ra: 36, rb: 12 })
      // the tucked paws: just the chest fold over them, and two toe tips peeking out
      deco.push({
        kind: 'arc',
        pts: [
          [-112, -24, 110],
          [-40, -14, 128],
          [40, -14, 128],
          [112, -24, 110],
        ],
      })
      deco.push({
        kind: 'arc',
        pts: [
          [170, -110, -40],
          [188, -76, -50],
          [180, -30, -60],
        ],
      })
      paw('pawR', [-42, -5, 126], 19, 8, 10)
      paw('pawL', [42, -5, 126], 19, 8, 10)
      tailBase = { p: [0, -30, -130], dirPitch: 0 }
    } else if (P.mode === 'stand' || P.mode === 'stretch') {
      const st = P.mode === 'stretch'
      const W = P.walk || { phase: 0, amt: 0 },
        A = clamp(W.amt || 0, 0, 1.5)
      const bob = -Math.abs(Math.sin(W.phase * Math.PI * 2)) * 6 * A
      const chestY = st ? -92 : -182 + bob + cr * 40,
        rumpY = st ? -200 : -180 + bob + cr * 46
      const chestZ = st ? 118 : 104,
        rumpZ = st ? -110 : -112
      add({ kind: 'ell', c: [0, rumpY, rumpZ], rx: 50, ry: 58, rz: 62, grp: 'body' })
      add({
        kind: 'cap',
        a: [0, rumpY - 4, rumpZ + 20],
        ra: 54,
        b: [0, lerp(rumpY, chestY, 0.5) - 10, lerp(rumpZ, chestZ, 0.5)],
        rb: 46,
        grp: 'body',
      })
      add({
        kind: 'cap',
        a: [0, lerp(rumpY, chestY, 0.5) - 10, lerp(rumpZ, chestZ, 0.5)],
        ra: 46,
        b: [0, chestY, chestZ],
        rb: 58,
        grp: 'body',
      })
      const nt = st ? [0, chestY - 56, chestZ + 66] : [0, chestY - 104, chestZ + 44]
      add({ kind: 'cap', a: [0, chestY - 10, chestZ + 6], ra: 42, b: nt, rb: 30, grp: 'body' })
      neck = nt
      deco.push({
        kind: 'bib',
        a: [nt[0], nt[1] + 14, nt[2] + 26],
        b: [0, chestY + 16, chestZ + 44],
        ra: 20,
        rb: 5,
      })
      // legs: lateral-sequence walk (LH, LF, RH, RF a quarter apart)
      const legs = [
        { n: 'FR', x: -22, top: [-22, chestY + 10, chestZ + 4], off: 0.25, front: true },
        { n: 'FL', x: 22, top: [22, chestY + 10, chestZ + 4], off: 0.75, front: true },
        { n: 'HR', x: -24, top: [-24, rumpY + 6, rumpZ + 6], off: 0.0, front: false },
        { n: 'HL', x: 24, top: [24, rumpY + 6, rumpZ + 6], off: 0.5, front: false },
      ]
      for (const L of legs) {
        const ph = ((((W.phase || 0) + L.off) % 1) + 1) % 1,
          S = 110 * A,
          duty = 0.62
        let fz, fy
        if (ph < duty) {
          fz = lerp(S / 2, -S / 2, ph / duty)
          fy = 0
        } else {
          const u = (ph - duty) / (1 - duty),
            e = u * u * (3 - 2 * u)
          fz = lerp(-S / 2, S / 2, e)
          fy = -Math.sin(Math.PI * u) * 34 * Math.min(1, A)
        }
        let foot = [L.x * 1.05, fy - 12, L.top[2] + fz + (L.front ? 6 : 10)]
        if (st && L.front) foot = [L.x, -12, chestZ + 128]
        if (P.rise > 0) {
          const tuck = clamp(P.rise / 60, 0, 1)
          foot = [
            foot[0],
            lerp(foot[1], L.top[1] + 120, tuck * 0.55),
            foot[2] + (L.front ? 30 : -30) * tuck,
          ]
        }
        const l1 = L.front ? 92 : 96,
          l2 = L.front ? 82 : 86
        const mid = st && L.front ? [L.x, -40, chestZ + 50] : legIK(L.top, foot, l1, l2, 1)
        leg('leg' + L.n, L.top, L.front ? 24 : 34, mid, 15, { mid: true, hind: !L.front })
        leg('low' + L.n, mid, 15, [foot[0], foot[1], foot[2]], 13, {
          grp: 'leg' + L.n,
          hind: !L.front,
        })
        paw('paw' + L.n, [foot[0], foot[1] + 1, foot[2] + 9], 17, 12, 24, { grp: 'leg' + L.n })
      }
      tailBase = { p: [0, rumpY - 18, rumpZ - 46], dirPitch: 0 }
    } else if (P.mode === 'sprawl') {
      // photo 18: lying on her belly, body trailing off to screen-left, head up, both fore legs
      // stretched toward the lens and the near paw shown sole-first. Use with persp ~650, pcy ~ -40.
      const reach = clamp(P.paw.reach ?? 1, 0, 1)
      add({ kind: 'ell', c: [-200, -58, -40], rx: 66, ry: 58, rz: 66, grp: 'body' })
      add({ kind: 'cap', a: [-200, -60, -40], ra: 58, b: [-40, -74, -6], rb: 62, grp: 'body' })
      add({ kind: 'ell', c: [0, -80, 6], rx: 64, ry: 66, rz: 60, grp: 'body' })
      add({ kind: 'cap', a: [6, -110, 10], ra: 48, b: [18, -186, 24], rb: 38, grp: 'body' })
      neck = [20, -192, 26]
      deco.push({ kind: 'bib', a: [24, -184, 60], b: [16, -120, 70], ra: 24, rb: 6 })
      leg('legHR', [-236, -40, 0], 30, [-330, -18, 50], 14, { hind: true })
      paw('pawHR', [-350, -14, 60], 22, 12, 22, { grp: 'legHR' })
      leg('legFL', [-30, -50, 40], 20, [-60, -18, 190], 15)
      paw('pawFL', [-64, -14, 214], 22, 13, 24, { grp: 'legFL' })
      leg(
        'legFR',
        [40, -60, 46],
        21,
        [lerp(70, 96, reach), lerp(-24, -40, reach), lerp(170, 300, reach)],
        16,
      )
      paw(
        'pawFR',
        [lerp(74, 100, reach), lerp(-20, -44, reach), lerp(196, 330, reach)],
        lerp(22, 34, reach),
        lerp(13, 34, reach),
        16,
        { grp: 'legFR', beans: reach, face: true },
      )
      tailBase = { p: [-250, -30, -60], dirPitch: 0 }
    } else if (P.mode === 'crouch') {
      // v2, the hunt crouch before a pounce (and the butt wiggle): chest and chin low over folded
      // fore legs, the rump high behind. `wiggle` (-1..1) sways the rump sideways; read it at yaw
      // 20-60 so the sway shows. The haunches stay bunched under her, ready to fire.
      const wg = clamp(P.wiggle || 0, -1.2, 1.2) * 34
      add({ kind: 'ell', c: [wg, -168, -104], rx: 58, ry: 60, rz: 62, grp: 'body' })
      add({
        kind: 'cap',
        a: [wg * 0.8, -160, -84],
        ra: 54,
        b: [wg * 0.2, -92, 24],
        rb: 50,
        grp: 'body',
      })
      add({ kind: 'ell', c: [0, -66, 60], rx: 56, ry: 44, rz: 54, grp: 'body' })
      add({ kind: 'cap', a: [0, -78, 80], ra: 40, b: [0, -98, 132], rb: 30, grp: 'body' })
      neck = [0, -100, 138]
      deco.push({ kind: 'bib', a: [0, -92, 158], b: [0, -56, 116], ra: 20, rb: 6 })
      for (const sd of [-1, 1]) {
        leg(sd < 0 ? 'legFR' : 'legFL', [sd * 26, -60, 80], 18, [sd * 30, -18, 150], 14)
        paw(sd < 0 ? 'pawFR' : 'pawFL', [sd * 30, -12, 168], 18, 11, 24, {
          grp: sd < 0 ? 'legFR' : 'legFL',
        })
        leg(
          sd < 0 ? 'legHR' : 'legHL',
          [sd * 40 + wg, -150, -100],
          34,
          [sd * 46 + wg * 0.5, -40, -56],
          17,
          { hind: true, mid: true },
        )
        leg(
          'low' + (sd < 0 ? 'HR' : 'HL'),
          [sd * 46 + wg * 0.5, -40, -56],
          17,
          [sd * 42 + wg * 0.3, -14, -20],
          14,
          { grp: sd < 0 ? 'legHR' : 'legHL', hind: true },
        )
        paw(sd < 0 ? 'pawHR' : 'pawHL', [sd * 42 + wg * 0.3, -11, -6], 17, 11, 26, {
          grp: sd < 0 ? 'legHR' : 'legHL',
        })
      }
      tailBase = { p: [wg, -186, -156], dirPitch: 0 }
    } else if (P.mode === 'leap') {
      // v2, mid-pounce: one long airborne line, fore legs flung forward with the pads out, hind legs
      // trailing. Profile (yaw 90); the move supplies the height with `rise`.
      add({ kind: 'ell', c: [0, -150, -110], rx: 52, ry: 60, rz: 62, grp: 'body' })
      add({ kind: 'cap', a: [0, -152, -96], ra: 56, b: [0, -162, -10], rb: 54, grp: 'body' })
      add({ kind: 'cap', a: [0, -162, -10], ra: 54, b: [0, -170, 84], rb: 56, grp: 'body' })
      add({ kind: 'ell', c: [0, -174, 96], rx: 50, ry: 50, rz: 54, grp: 'body' })
      add({ kind: 'cap', a: [0, -180, 110], ra: 40, b: [0, -214, 158], rb: 30, grp: 'body' })
      neck = [0, -216, 162]
      deco.push({ kind: 'bib', a: [0, -206, 186], b: [0, -168, 150], ra: 18, rb: 5 })
      for (const sd of [-1, 1]) {
        leg(
          sd < 0 ? 'legFR' : 'legFL',
          [sd * 20, -160, 120],
          20,
          [sd * 22, -122, 254 - (sd > 0 ? 16 : 0)],
          14,
        )
        paw(sd < 0 ? 'pawFR' : 'pawFL', [sd * 22, -118, 276 - (sd > 0 ? 16 : 0)], 18, 13, 22, {
          grp: sd < 0 ? 'legFR' : 'legFL',
        })
        leg(sd < 0 ? 'legHR' : 'legHL', [sd * 26, -146, -116], 30, [sd * 26, -112, -206], 15, {
          hind: true,
          mid: true,
        })
        leg(
          'low' + (sd < 0 ? 'HR' : 'HL'),
          [sd * 26, -112, -206],
          15,
          [sd * 24, -104, -296 + (sd > 0 ? 18 : 0)],
          13,
          { grp: sd < 0 ? 'legHR' : 'legHL', hind: true },
        )
        paw(sd < 0 ? 'pawHR' : 'pawHL', [sd * 24, -102, -312 + (sd > 0 ? 18 : 0)], 16, 11, 22, {
          grp: sd < 0 ? 'legHR' : 'legHL',
        })
      }
      tailBase = { p: [0, -166, -160], dirPitch: 0 }
    } else if (P.mode === 'belly') {
      // v2, the belly-up trap: on her back across the frame, head end at screen-left, cream belly up,
      // all four paws folded in the air. The move rolls the head (head.roll about -100) so she looks
      // at the lens upside down. `kamt` pulls the paws in (the trap closing).
      const tr = clamp(P.paw.kamt || 0, 0, 1)
      add({ kind: 'ell', c: [24, -68, 0], rx: 150, ry: 62, rz: 72, grp: 'body' })
      add({ kind: 'ell', c: [-92, -76, 8], rx: 72, ry: 66, rz: 70, grp: 'body' })
      add({ kind: 'ell', c: [118, -70, 0], rx: 72, ry: 64, rz: 74, grp: 'body' })
      add({ kind: 'cap', a: [-120, -78, 14], ra: 52, b: [-166, -80, 26], rb: 40, grp: 'body' })
      neck = [-172, -82, 28]
      deco.push({ kind: 'bib', a: [-96, -104, 80], b: [96, -98, 80], ra: 36, rb: 30 })
      deco.push({
        kind: 'arc',
        pts: [
          [56, -128, 70],
          [96, -132, 64],
          [140, -118, 56],
        ],
      })
      const L = [
        ['FR', -98, 40, -1],
        ['FL', -66, -36, -1],
        ['HR', 112, 40, 1],
        ['HL', 140, -36, 1],
      ]
      for (const [n, x, z, e] of L) {
        const top = [x, -112, z],
          wrist = [x + e * 14 - tr * e * 34, -204 + tr * 40, z + 8],
          pw = [x + e * 34 - tr * e * 50, -212 + tr * 46, z + 10]
        leg('leg' + n, top, n[0] === 'H' ? 26 : 20, wrist, 14, { hind: n[0] === 'H' })
        paw('paw' + n, pw, 20, 14, 20, {
          grp: 'leg' + n,
          tilt: e * 30,
          beans: z > 0 ? 0.7 : 0,
          face: true,
        })
      }
      tailBase = { p: [200, -40, -10], dirPitch: 0 }
    } else if (P.mode === 'startle') {
      // v2, the startle-hop and the scrabble: an upright bean with all four legs flung out straight.
      // Front view. `knead`/`kamt` make the fore paws scrabble in turns (sliding down a ledge).
      const kamt = clamp(P.paw.kamt || 0, 0, 1),
        kph = P.paw.knead || 0
      add({ kind: 'ell', c: [0, -178, -6], rx: 66, ry: 84, rz: 60, grp: 'body' })
      add({ kind: 'ell', c: [0, -226, 22], rx: 54, ry: 52, rz: 48, grp: 'body' })
      add({ kind: 'cap', a: [0, -236, 26], ra: 44, b: [0, -270, 34], rb: 38, grp: 'body' })
      neck = [0, -276, 36]
      deco.push({ kind: 'bib', a: [0, -268, 70], b: [0, -214, 80], ra: 26, rb: 6 })
      for (const sd of [-1, 1]) {
        const up = kamt * 70 * Math.max(0, Math.sin((kph + (sd < 0 ? 0 : 0.5)) * Math.PI * 2))
        leg(sd < 0 ? 'legFR' : 'legFL', [sd * 30, -206, 42], 21, [sd * 70, -54 - up * 1.6, 70], 13)
        paw(sd < 0 ? 'pawFR' : 'pawFL', [sd * 74, -42 - up * 1.6, 74], 18, 12, 20, {
          grp: sd < 0 ? 'legFR' : 'legFL',
          tilt: sd * 26,
        })
        leg(sd < 0 ? 'legHR' : 'legHL', [sd * 42, -138, -20], 32, [sd * 104, -44, -30], 16, {
          hind: true,
        })
        paw(sd < 0 ? 'pawHR' : 'pawHL', [sd * 110, -32, -30], 18, 12, 22, {
          grp: sd < 0 ? 'legHR' : 'legHL',
          tilt: sd * 36,
        })
      }
      tailBase = { p: [0, -120, -66], dirPitch: 0 }
    }
    return { pcs, neck, tailBase, deco }
  }

  function tailPoints(P, base) {
    const T = P.tail,
      N = 15,
      L = (330 * (T.len ?? 1)) / (N - 1)
    const pts = [base.p.slice()],
      rad = []
    let p = base.p.slice()
    for (let i = 0; i < N - 1; i++) {
      const u = i / (N - 2)
      const e = ((T.pitch || 0) + (T.curl || 0) * u + (T.hook || 0) * Math.pow(u, 3.2)) * D2R
      const a =
        ((T.yaw || 0) +
          (T.side || 0) * u +
          (T.wave || 0) * Math.sin((T.phase || 0) * Math.PI * 2 - u * 3.2) * u) *
        D2R
      const dir = [Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)]
      p = [p[0] + dir[0] * L, p[1] + dir[1] * L, p[2] + dir[2] * L]
      // keep a lying tail on the floor
      if (p[1] > -10) p[1] = -10
      pts.push(p)
    }
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      rad.push(lerp(15, 7.5, Math.pow(u, 0.8)))
    }
    return { pts, rad }
  }

  // ------------------------------------------------------------------ draw
  let UID = 0
  function draw(Pin, opts) {
    const P = Pin && Pin._full ? Pin : pose(Pin)
    const o = Object.assign({ detail: 2, ol: 4.2, bg: null }, opts || {})
    const uid = 'v' + (UID++).toString(36)
    o.uid = uid
    const ol = o.ol
    const phi = P.yaw * D2R,
      c = Math.cos(phi),
      s = Math.sin(phi)
    const F = P.persp > 0 ? P.persp : 0,
      YC = P.pcy ?? -120,
      ce = Math.cos((P.elev ?? 10) * D2R),
      se = Math.sin((P.elev ?? 10) * D2R)
    const proj = (p) => {
      const x = p[0] * c + p[2] * s,
        z = -p[0] * s + p[2] * c
      const k = F ? F / Math.max(F * 0.25, F - z) : 1
      // the camera looks slightly down (elev), so nearer points sit lower and floor loops open up
      const y = p[1] * ce + z * se
      return [x * k, YC + (y - YC) * k, z, k]
    }
    const B = buildBody(P)
    // body union
    const bodyPaths = []
    let bodyZ = 0,
      nb = 0
    const pieceD = (q) => {
      if (q.kind === 'cap') {
        const A = proj(q.a),
          Bp = proj(q.b)
        return { d: capsule(A, q.ra * A[3], Bp, q.rb * Bp[3]), z: (A[2] + Bp[2]) / 2 }
      }
      const C = proj(q.c),
        rx = Math.sqrt(Math.pow(q.rx * c, 2) + Math.pow(q.rz * s, 2)) * C[3]
      return { d: ellipse(C, rx, q.ry * C[3], q.tilt || 0), z: C[2], C, rx, ry: q.ry * C[3] }
    }
    for (const q of B.pcs)
      if (q.grp === 'body') {
        const r = pieceD(q)
        bodyPaths.push(r.d)
        bodyZ += r.z
        nb++
      }
    bodyZ /= Math.max(1, nb)
    // limbs grouped by name
    const groups = {}
    for (const q of B.pcs)
      if (q.grp !== 'body') {
        ;(groups[q.grp] = groups[q.grp] || []).push(q)
      }
    // tail, split by depth around the body plane
    const tp = tailPoints(P, B.tailBase)
    const tproj = tp.pts.map(proj)
    let svgOut = ''
    svgOut += `<defs><filter id="${uid}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>`
    // ground shadow
    if (P.shadow) {
      const sw =
        P.mode === 'sprawl'
          ? 300
          : P.mode === 'stand' || P.mode === 'stretch'
            ? 170 * Math.max(0.5, Math.abs(s)) + 80 * Math.abs(c)
            : P.mode === 'belly'
              ? 250
              : P.mode === 'crouch' || P.mode === 'leap'
                ? 150 * Math.max(0.5, Math.abs(s)) + 80 * Math.abs(c)
                : 140
      const k = 1 / (1 + Math.max(0, P.rise) / 120)
      svgOut += `<ellipse cx="${P.mode === 'sprawl' ? -80 : 0}" cy="2" rx="${n1(sw * k)}" ry="${n1(16 * k)}" fill="${PAL.ink}" opacity="${n1(0.16 * k * 100) / 100}"/>`
    }
    const fig = []
    const tailItem = (from, to, z) => {
      const pts = tproj.slice(from, to + 1).map((v) => [v[0], v[1]]),
        rr = tp.rad.slice(from, to + 1).map((r, i) => r * tproj[from + i][3])
      if (pts.length < 2) return
      const N = tp.pts.length,
        tipStart = Math.floor(N * 0.8)
      let d = `<path d="${ribbon(pts, rr)}" fill="${PAL.coat}" stroke="${PAL.liner}" stroke-width="${2 * ol}" paint-order="stroke" stroke-linejoin="round"/>`
      if (to >= tipStart) {
        const a = Math.max(from, tipStart)
        const tpts = tproj.slice(a, to + 1).map((v) => [v[0], v[1]]),
          tr = tp.rad.slice(a, to + 1).map((r, i) => r * tproj[a + i][3])
        if (tpts.length >= 2) d += `<path d="${ribbon(tpts, tr)}" fill="${PAL.tip}"/>`
      }
      fig.push({ z, d })
    }
    // split the tail where it crosses the body's depth plane
    let segStart = 0
    const front = (i) => tproj[i][2] > bodyZ + 20
    for (let i = 1; i <= tproj.length; i++) {
      if (i === tproj.length || front(i) !== front(segStart)) {
        const zz = front(segStart) ? 1000 + i : -1000 + i
        tailItem(Math.max(0, segStart - (segStart > 0 ? 1 : 0)), i - 1, zz)
        segStart = i
      }
    }
    // body union: outline pass, fill pass, shade + highlight inside the union, decorations
    let bodyG = ''
    bodyG += bodyPaths
      .map(
        (d) =>
          `<path d="${d}" fill="${PAL.liner}" stroke="${PAL.liner}" stroke-width="${2 * ol}" stroke-linejoin="round"/>`,
      )
      .join('')
    bodyG += bodyPaths.map((d) => `<path d="${d}" fill="${PAL.coat}"/>`).join('')
    bodyG += `<clipPath id="${uid}b">${bodyPaths.map((d) => `<path d="${d}"/>`).join('')}</clipPath>`
    bodyG += `<clipPath id="${uid}bs">${bodyPaths.map((d) => `<path d="${d}" transform="translate(-12 -16)"/>`).join('')}</clipPath>`
    bodyG += `<g clip-path="url(#${uid}b)">`
    bodyG += bodyPaths.map((d) => `<path d="${d}" fill="${PAL.light}"/>`).join('')
    bodyG += `<g transform="translate(5 6)">${bodyPaths.map((d) => `<path d="${d}" fill="${PAL.shade}"/>`).join('')}</g>`
    bodyG += `<g clip-path="url(#${uid}bs)"><g transform="translate(5 6)">${bodyPaths.map((d) => `<path d="${d}" fill="${PAL.coat}"/>`).join('')}</g></g>`
    // spine stripe (feathered ticking), seen from the side and back only
    const spineVis = clamp(1 - c, 0, 1) * (P.mode === 'sit' ? 0.9 : 1)
    if (spineVis > 0.05) {
      let sp
      if (P.mode === 'sit')
        sp = [
          [0, -300, -10],
          [0, -240, -38],
          [0, -160, -78],
          [0, -90, -106],
        ]
      else if (P.mode === 'sprawl')
        sp = [
          [30, -160, -10],
          [-60, -125, -50],
          [-210, -110, -60],
        ]
      else if (P.mode === 'loaf')
        sp = [
          [0, -140, 10],
          [0, -128, -60],
          [0, -110, -120],
        ]
      else if (P.mode === 'crouch')
        sp = [
          [0, -128, 120],
          [0, -150, 0],
          [0, -184, -100],
        ]
      else if (P.mode === 'leap')
        sp = [
          [0, -222, 140],
          [0, -212, 0],
          [0, -198, -110],
        ]
      else if (P.mode === 'belly' || P.mode === 'startle') sp = null
      else {
        const bb = B.pcs.filter((q) => q.grp === 'body')
        const r = bb[0].c
        const ch = bb[2].b
        sp = [
          [0, B.neck[1] - 4, B.neck[2] - 18],
          [0, ch[1] - 52, ch[2] - 10],
          [0, r[1] - 50, r[2] + 30],
          [0, r[1] - 48, r[2] - 20],
        ]
      }
      const q = sp ? sp.map(proj) : null
      if (q)
        bodyG += `<path d="${ribbon(
          q.map((v) => [v[0], v[1]]),
          q.map(() => 20),
        )}" fill="${PAL.tick}" opacity="${n1(0.5 * spineVis * 100) / 100}" filter="url(#${uid}soft)"/>`
    }
    for (const dc of B.deco) {
      if (dc.kind === 'bib') {
        const A = proj(dc.a),
          Bp = proj(dc.b)
        const vis = clamp(c * 1.2 + 0.25, 0, 1)
        if (vis > 0.05)
          bodyG += `<path d="${capsule(A, dc.ra * Math.max(0.45, Math.abs(c)), Bp, dc.rb)}" fill="${PAL.muzzle}" opacity="${n1(vis * 100) / 100}"/>`
      }
    }
    for (const dc of B.deco) {
      if (dc.kind === 'arc') {
        const q = dc.pts.map(proj)
        bodyG += `<path d="${smoothOpen(q.map((v) => [v[0], v[1]]))}" stroke="${PAL.shade}" stroke-width="5" fill="none" stroke-linecap="round" opacity="${n1(clamp(Math.abs(c) * 1.2, 0, 1) * 100) / 100}"/>`
      }
      if (dc.kind === 'legline') {
        const A = proj(dc.a),
          Bp = proj(dc.b)
        if (Math.abs(c) > 0.25)
          bodyG += `<path d="M${pt(A)}L${pt(Bp)}" stroke="${PAL.shade}" stroke-width="5" stroke-linecap="round" opacity="${n1(Math.abs(c) * 100) / 100}"/>`
      }
    }
    // outfits: recolour the torso, legs stay bare
    if (P.outfit) {
      const OF =
        P.outfit === 'hoodie'
          ? { base: '#D7262E', shade: '#A9161F', print: '#FFFFFF' }
          : { base: '#F4A3B4', shade: '#E08197', print: '#FFFFFF' }
      const ySplit = P.mode === 'sit' ? -282 : -9999
      bodyG += `<g><clipPath id="${uid}of"><rect x="-400" y="${ySplit}" width="800" height="${P.mode === 'sit' ? 178 : 1200}"/></clipPath><g clip-path="url(#${uid}of)">`
      bodyG += bodyPaths.map((d) => `<path d="${d}" fill="${OF.base}"/>`).join('')
      bodyG += `<g transform="translate(5 6)">${bodyPaths.map((d) => `<path d="${d}" fill="${OF.shade}" opacity="0.6"/>`).join('')}</g>`
      bodyG += `<g clip-path="url(#${uid}bs)"><g transform="translate(5 6)">${bodyPaths.map((d) => `<path d="${d}" fill="${OF.base}"/>`).join('')}</g></g>`
      // print: tiny elephants (onesie) or snowflakes (hoodie)
      for (let i = 0; i < 14; i++) {
        const px = -90 + (i % 4) * 58 + (Math.floor(i / 4) % 2) * 28,
          py = -250 + Math.floor(i / 4) * 52
        const q = proj([px, py, 60])
        bodyG +=
          P.outfit === 'hoodie'
            ? `<g transform="translate(${pt(q)})" stroke="${OF.print}" stroke-width="3" stroke-linecap="round"><path d="M-8 0H8M0 -8V8M-6 -6L6 6M-6 6L6 -6"/></g>`
            : `<g transform="translate(${pt(q)})" fill="${OF.print}" opacity="0.9"><ellipse cx="0" cy="0" rx="9" ry="7"/><circle cx="-9" cy="-3" r="5"/><path d="M-13 -1Q-18 6 -14 9" stroke="${OF.print}" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="-6" y="4" width="3" height="6" rx="1.5"/><rect x="3" y="4" width="3" height="6" rx="1.5"/></g>`
      }
      bodyG += `</g></g>`
      // collar line
      if (P.mode === 'sit') {
        // a rolled hood (hoodie) or a soft collar (onesie) round the neck, and sleeve cuffs on the
        // fore legs, so the outfit reads as clothes and not as a vest painted on the torso
        const nc = proj([0, -250, 40]),
          wN = 74 * Math.max(0.6, Math.abs(c)) + 20 * Math.abs(s)
        const roll = `M${n1(nc[0] - wN)} ${n1(nc[1] - 6)}Q${n1(nc[0])} ${n1(nc[1] + (P.outfit === 'hoodie' ? 40 : 26))} ${n1(nc[0] + wN)} ${n1(nc[1] - 6)}`
        bodyG += `<path d="${roll}" stroke="${PAL.liner}" stroke-width="${(P.outfit === 'hoodie' ? 30 : 18) + 2 * ol}" fill="none" stroke-linecap="round"/><path d="${roll}" stroke="${OF.base}" stroke-width="${P.outfit === 'hoodie' ? 30 : 18}" fill="none" stroke-linecap="round"/><path d="${roll}" stroke="${OF.shade}" stroke-width="6" fill="none" stroke-linecap="round" transform="translate(0 ${P.outfit === 'hoodie' ? 8 : 5})"/>`
        for (const sd of [-1, 1]) {
          const q = proj([sd * 23, -110, 56])
          bodyG += `<path d="M${n1(q[0] - 22)} ${n1(q[1])}Q${n1(q[0])} ${n1(q[1] + 8)} ${n1(q[0] + 22)} ${n1(q[1])}" stroke="${P.outfit === 'hoodie' ? '#FFFFFF' : OF.shade}" stroke-width="10" fill="none" stroke-linecap="round"/>`
        }
      }
    }
    bodyG += `</g>`
    fig.push({ z: bodyZ, d: bodyG })
    // limbs
    const overHead = []
    for (const name of Object.keys(groups)) {
      const g = groups[name]
      let z = 0,
        d = ''
      const parts = g.map((q) => {
        const r = pieceD(q)
        z = Math.max(z, r.z)
        return { q, r }
      })
      const isFar = parts.every((p) => p.r.z < bodyZ - 8) && P.mode !== 'sit'
      const col = isFar ? PAL.shade : PAL.coat
      // outline pass then fill pass so a leg's own pieces merge
      d += parts
        .map(
          (p) =>
            `<path d="${p.r.d}" fill="${PAL.liner}" stroke="${PAL.liner}" stroke-width="${2 * ol}" stroke-linejoin="round"/>`,
        )
        .join('')
      d += parts.map((p) => `<path d="${p.r.d}" fill="${p.q.beans ? PAL.pawDark : col}"/>`).join('')
      // hind paw backs are dark: a real Aby trait
      for (const p of parts)
        if (p.q.hind && p.q.kind === 'cap' && !p.q.mid && Math.abs(s) > 0.3)
          d += `<path d="${p.r.d}" fill="${PAL.pawDark}" opacity="0.35" transform="translate(${n1(-s * 4)} 0) scale(1)"/>`
      for (const p of parts)
        if (p.q.beans > 0.3 && p.r.C) d += beansDraw(p.r.C, p.r.rx, p.r.ry, p.q.face)
      // a near limb grows out of the body: paint over its top cap's outline where it lies inside the body
      if (!isFar)
        for (const p of parts)
          if (p.q.kind === 'cap' && p.q.grp === p.q.name) {
            const A = proj(p.q.a)
            d += `<g clip-path="url(#${uid}b)"><path d="${circle(A, p.q.ra * A[3] + ol * 1.3)}" fill="${PAL.coat}"/></g>`
          }
      // lead with depth of the nearest piece, but keep limbs on the near side in front of the body
      // (v2: a paw brought up to the mouth is drawn over the head)
      if (parts.some((p) => p.q.overHead)) overHead.push(d)
      else fig.push({ z: isFar ? z - 400 : z + 1, d })
    }
    fig.sort((a, b) => a.z - b.z)
    // bag (behind + in front)
    let bagBack = '',
      bagFront = ''
    if (P.bag > 0) {
      const bg = bagDraw(P.bag, ol)
      bagBack = bg.back
      bagFront = bg.front
    }
    svgOut += bagBack
    svgOut += fig.map((f) => f.d).join('')
    svgOut += bagFront
    // head
    const nk = proj(B.neck)
    const H = P.head
    const hs = H.s || 1
    const headPhi = P.yaw + (H.yaw || 0)
    svgOut +=
      `<g transform="translate(${pt([nk[0] + (H.dx || 0), nk[1] + (H.dy || 0)])}) rotate(${n1(H.roll || 0)}) scale(${n1(hs * nk[3] * 1000) / 1000}) translate(0 ${-PIV})">${headDraw(P, headPhi, o, uid)}</g>` +
      overHead.join('')
    const tr = `translate(${n1(P.x)} ${n1(P.y - Math.max(0, P.rise || 0))}) rotate(${n1(P.lean || 0)}) scale(${n1(P.s * P.flip * P.sx * 1000) / 1000} ${n1(P.s * P.sy * 1000) / 1000})`
    return `<g transform="${tr}">${svgOut}</g>`
  }

  function beansDraw(C, rx, ry, face) {
    // main pad (soft heart) + four toe beans, scaled to the paw
    const k = Math.min(rx, ry) / 30,
      cx = C[0],
      cy = C[1] + (face ? 4 * k : 0)
    let d = `<g transform="translate(${n1(cx)} ${n1(cy)}) scale(${n1(k * 100) / 100})">`
    d += `<path d="M0 22C-14 22 -20 10 -14 2C-9 -4 -4 -2 0 2C4 -2 9 -4 14 2C20 10 14 22 0 22Z" fill="${PAL.beans}"/>`
    for (const [x, y, r] of [
      [-19, -10, 6.5],
      [-7, -20, 7],
      [7, -20, 7],
      [19, -10, 6.5],
    ])
      d += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="${PAL.beans}"/>`
    return d + '</g>'
  }

  // The bag throne: a thin, crumpled yellow market bag (photos 15 and 16). What makes it read as a
  // plastic shopping bag and not a sack: a handle loop slipped over her shoulder like a shawl, the
  // other handle knotted at the side, translucent creases with white sheen, and a chunk of bold blue
  // print (polka dots, deliberately nothing that reads as letters or any shop's mark).
  function bagDraw(amt, ol) {
    const k = clamp(amt, 0, 1)
    const Y = '#FFCF1F',
      YD = '#E9AE00',
      YL = '#FFF1A6',
      BL = '#2F55B8'
    const y = (v) => n1(v * k)
    const st = `stroke="${PAL.liner}" stroke-width="${2 * ol}" stroke-linejoin="round"`
    // back wall, slumped higher behind her left side
    let back = `<path d="M-162 ${y(-150)}C-128 ${y(-196)} -70 ${y(-186)} -16 ${y(-170)}C44 ${y(-196)} 118 ${y(-240)} 166 ${y(-206)}C186 -120 178 -40 150 0L-150 0C-178 -40 -186 -100 -162 ${y(-150)}Z" fill="${YD}" ${st}/>`
    back += `<path d="M-120 ${y(-176)}L-104 ${y(-150)}M96 ${y(-224)}L84 ${y(-180)}M130 ${y(-214)}L140 ${y(-170)}" stroke="#C99300" stroke-width="5" stroke-linecap="round" fill="none"/>`
    // front: crumpled rim, a soft belly
    const xs = [-178, -152, -128, -100, -74, -46, -20, 8, 36, 62, 90, 116, 146, 178]
    const rp = xs.map((x, i) => [
      x,
      ((i % 2 ? -150 : -128) + Math.sin(i * 2.3) * 9 - (Math.abs(x) > 150 ? 16 : 0)) * k,
    ])
    const frontD = `${smoothOpen(rp)}C198 -60 180 -10 150 8Q0 26 -150 8C-182 -10 -200 -60 -178 ${y(-128)}Z`
    let front = `<path d="${frontD}" fill="${Y}" ${st}/>`
    front += `<clipPath id="bagc${Math.round(k * 100)}"><path d="${frontD}"/></clipPath><g clip-path="url(#bagc${Math.round(k * 100)})">`
    // the print: chunky blue shapes on the right belly, cut off by the folds like the photo
    // polished: loose polka dots of mixed sizes, scattered so they make no face either, a pattern with no letterforms in it (the v2
    // block print could be read as "iP")
    front += `<g transform="translate(94 ${y(-82)}) rotate(-8)" fill="${BL}"><circle cx="-24" cy="-34" r="13"/><circle cx="14" cy="-44" r="8"/><circle cx="28" cy="-8" r="14"/><circle cx="-8" cy="4" r="9"/><circle cx="-34" cy="30" r="12"/><circle cx="10" cy="40" r="8"/><circle cx="46" cy="30" r="10"/></g>`
    // creases: short angular folds, darker inside, white sheen beside them
    front += `<path d="M-128 ${y(-124)}L-110 -78L-126 -6M-46 ${y(-134)}L-26 -86L-44 4M40 ${y(-136)}L58 -96L48 -40M150 ${y(-118)}L138 -66L150 -10" stroke="${YD}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    front += `<path d="M-146 ${y(-112)}Q-160 -60 -144 -24M-92 ${y(-120)}L-84 -92M-8 -74L4 -40M14 ${y(-130)}L22 -110" stroke="${YL}" stroke-width="10" fill="none" stroke-linecap="round"/>`
    front += `<path d="M-160 -10Q0 14 160 -10" stroke="${YD}" stroke-width="10" fill="none" opacity="0.7"/>`
    front += `</g>`
    // handle slipped over her left shoulder (screen-right), like a shawl
    const hd = `M156 ${y(-130)}C150 -196 96 -236 52 -236C20 -236 0 -210 -4 ${y(-150)}`
    front += `<path d="${hd}" fill="none" stroke="${PAL.liner}" stroke-width="${22 + 2 * ol}" stroke-linecap="round"/><path d="${hd}" fill="none" stroke="${Y}" stroke-width="22" stroke-linecap="round"/><path d="M146 ${y(-176)}C134 -206 96 -228 60 -230" fill="none" stroke="${YL}" stroke-width="6" stroke-linecap="round"/>`
    // the other handle, knotted at the bottom-left: two crumpled ears and a knot
    front += `<g transform="translate(-154 ${y(-34)}) rotate(-10)"><path d="M0 0C-30 -14 -62 -4 -66 18C-62 36 -40 44 -26 30L-14 34C-6 22 -2 12 0 0Z" fill="${Y}" ${st} paint-order="stroke"/><path d="M0 0C-8 -30 6 -58 30 -54C40 -36 34 -20 22 -14L26 -4C14 0 6 0 0 0Z" fill="${Y}" ${st} paint-order="stroke"/><path d="M-34 8L-48 20M14 -30L20 -42" stroke="${YD}" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="3" rx="14" ry="12" fill="${YD}" stroke="${PAL.liner}" stroke-width="${ol * 1.6}"/></g>`
    return { back, front }
  }

  // v2: where a head-local point (eye line y 0, the mouth near [0, 66, 124]) lands in world units,
  // through the same body projection, neck anchor, head roll and pose transform draw() uses. For
  // props held in the mouth or brought to it (the toy mouse, the treat tube).
  function headPoint(Pin, q) {
    const P = Pin && Pin._full ? Pin : pose(Pin)
    const phi = P.yaw * D2R,
      c = Math.cos(phi),
      s = Math.sin(phi)
    const F = P.persp > 0 ? P.persp : 0,
      YC = P.pcy ?? -120,
      ce = Math.cos((P.elev ?? 10) * D2R),
      se = Math.sin((P.elev ?? 10) * D2R)
    const nkp = buildBody(P).neck,
      x0 = nkp[0] * c + nkp[2] * s,
      z0 = -nkp[0] * s + nkp[2] * c
    const k = F ? F / Math.max(F * 0.25, F - z0) : 1,
      y0 = nkp[1] * ce + z0 * se
    const nk = [x0 * k, YC + (y0 - YC) * k]
    const hphi = (P.yaw + (P.head.yaw || 0)) * D2R,
      hc = Math.cos(hphi),
      hs = Math.sin(hphi)
    const xr = q[0] * hc + q[2] * hs,
      zr = -q[0] * hs + q[2] * hc
    let hx = xr,
      hy = q[1] + ((P.head.pitch || 0) * 0.85 * Math.max(0, zr)) / HR - PIV
    const sc = (P.head.s || 1) * k,
      r = (P.head.roll || 0) * D2R
    let X = nk[0] + (P.head.dx || 0) + (hx * Math.cos(r) - hy * Math.sin(r)) * sc,
      Y = nk[1] + (P.head.dy || 0) + (hx * Math.sin(r) + hy * Math.cos(r)) * sc
    const L = (P.lean || 0) * D2R,
      ax = X * P.s * P.flip * P.sx,
      ay = Y * P.s * P.sy
    return {
      x: P.x + ax * Math.cos(L) - ay * Math.sin(L),
      y: P.y - Math.max(0, P.rise || 0) + ax * Math.sin(L) + ay * Math.cos(L),
      z: zr,
      roll: (P.head.roll || 0) + (P.lean || 0),
    }
  }

  function svg(Pin, opts) {
    const o = Object.assign(
      { width: 1080, height: 1080, cx: 540, cy: 900, scale: 1.6, bg: null },
      opts || {},
    )
    const bg = o.bg ? `<rect width="100%" height="100%" fill="${o.bg}"/>` : ''
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">${bg}${o.under || ''}<g transform="translate(${o.cx} ${o.cy}) scale(${o.scale})">${draw(Pin, o)}</g>${o.over || ''}</svg>`
  }

  const Venus = { PAL, DEFAULT, EXPR, pose, merge, clone, draw, svg, lerp, clamp, headPoint }
  root.Venus = Venus
})(window)
