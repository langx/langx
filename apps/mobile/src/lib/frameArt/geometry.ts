import { ART_PALETTES, GLASS_HUES, type ArtKey, type ArtPalette } from './palettes'

/**
 * The sixteen frames' geometry, ported from the generator behind the v3 frame
 * art master sheet so the app draws what the sheet was judged on.
 *
 * Units: the avatar's radius is 48, so one unit is one pixel on a 96 px
 * avatar, and the whole drawing sits in a `-72 -72 144 144` box centred on the
 * avatar. The band runs from 48 to 63.5 (65 for the Legendary); one break-out
 * per frame reaches 71 at most.
 *
 * Three cuts, because detail that reads at 96 px is noise at 36: `full` for 64
 * px and up, `s40` for 40 to 63 (at most six shapes, no text), `s28` under 40
 * (a silhouette and one accent). Their stroke widths are in units, so the thick
 * ones at the small cuts are thick on purpose — 4.8 units at 40 px is 2 px.
 *
 * Pure data and no React, so the mobile vitest can reach it: what is drawn is
 * a list of nodes, and `FrameArt` turns each one into its react-native-svg
 * element. `angle 0` is twelve o'clock and angles run clockwise, as on the
 * sheet.
 */

export type ArtCut = 'full' | 's40' | 's28'
export type ArtScheme = 'light' | 'dark'

/** react-native-svg prop names, so a node spreads straight onto its element. */
export type Attrs = Readonly<Record<string, string | number | readonly number[]>>

export type ArtNode =
  | {
      readonly el: 'path' | 'circle' | 'rect'
      readonly a: Attrs
      /** Aurora Glass's highlight: the one thing that moves (see `FrameArt`). */
      readonly sweep?: true
    }
  | { readonly el: 'g'; readonly a: Attrs; readonly kids: readonly ArtNode[] }
  /**
   * The ring of "hello" on Aurora Glass. Its own node because a text path needs
   * an id, and ids have to be unique per mounted drawing — the renderer owns
   * that, not this module.
   */
  | {
      readonly el: 'hello'
      readonly r: number
      readonly fontSize: number
      readonly fill: string
      readonly length: number
    }

// ---------- primitives, as on the sheet ----------

const f = (n: number) => +n.toFixed(2)

/** The point at radius `r`, `deg` clockwise from twelve o'clock. */
export function P(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [f(r * Math.sin(a)), f(-r * Math.cos(a))]
}
const pt = (r: number, d: number) => P(r, d).join(' ')
const poly = (pts: readonly (readonly number[])[]) =>
  'M' + pts.map((p) => p.join(' ')).join(' L') + ' Z'
const cpath = (r: number, cx = 0, cy = 0) =>
  `M${f(cx)} ${f(cy - r)} A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy + r)} A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy - r)} Z`
const path = (d: string, a: Attrs = {}): ArtNode => ({ el: 'path', a: { d, ...a } })
const ann = (r1: number, r2: number, fill: string) =>
  path(`${cpath(r2)} ${cpath(r1)}`, { fill, fillRule: 'evenodd' })
const ring = (r: number, stroke: string, sw: number, more: Attrs = {}): ArtNode => ({
  el: 'circle',
  a: { cx: 0, cy: 0, r: f(r), fill: 'none', stroke, strokeWidth: f(sw), ...more },
})
const g = (transform: string, kids: readonly ArtNode[]): ArtNode => ({
  el: 'g',
  a: { transform },
  kids,
})
const arc = (r: number, a1: number, a2: number) => {
  const large = (((a2 - a1) % 360) + 360) % 360 > 180 ? 1 : 0
  return `M${pt(r, a1)} A${f(r)} ${f(r)} 0 ${large} 1 ${pt(r, a2)}`
}
const sector = (r1: number, r2: number, a1: number, a2: number) => {
  const large = a2 - a1 > 180 ? 1 : 0
  return `M${pt(r2, a1)} A${f(r2)} ${f(r2)} 0 ${large} 1 ${pt(r2, a2)} L${pt(r1, a2)} A${f(r1)} ${f(r1)} 0 ${large} 0 ${pt(r1, a1)} Z`
}
const scallop = (r: number, n: number, rot = 0) => {
  const s = 360 / n
  const rb = r / (1 + Math.sin(Math.PI / n))
  const ar = f(rb * Math.sin(Math.PI / n))
  let d = `M${pt(rb, rot)}`
  for (let i = 0; i < n; i++) d += ` A${ar} ${ar} 0 0 1 ${pt(rb, rot + (i + 1) * s)}`
  return d + ' Z'
}
/** A lozenge centred on (r, a): `h` radial half-height, `w` tangential half-width. */
const lozenge = (r: number, a: number, h: number, w: number) => {
  const dw = ((w / r) * 180) / Math.PI
  return poly([P(r + h, a), P(r, a + dw), P(r - h, a), P(r, a - dw)])
}
const star4 = (x: number, y: number, k: number) =>
  `M${f(x)} ${f(y - k)} Q${f(x + k * 0.2)} ${f(y - k * 0.2)} ${f(x + k)} ${f(y)} Q${f(x + k * 0.2)} ${f(y + k * 0.2)} ${f(x)} ${f(y + k)} Q${f(x - k * 0.2)} ${f(y + k * 0.2)} ${f(x - k)} ${f(y)} Q${f(x - k * 0.2)} ${f(y - k * 0.2)} ${f(x)} ${f(y - k)} Z`
const dots = (list: readonly (readonly [number, number])[], r: number) =>
  list.map(([x, y]) => cpath(r, x, y)).join(' ')
const range = (n: number) => [...Array(n).keys()]
const glaze = (r: number, a1: number, a2: number, sw = 1.5) =>
  path(arc(r, a1, a2), {
    fill: 'none',
    stroke: '#ffffff',
    strokeOpacity: 0.85,
    strokeWidth: sw,
    strokeLinecap: 'round',
  })

const R0 = 48
const R1 = 63.5

type Draw<K extends ArtKey> = (cut: ArtCut, c: ArtPalette<K>, bg: string) => ArtNode[]

// ---------- Common: paper, tape, felt, print, reed ----------

const papel: Draw<'papel'> = (cut, c) => {
  if (cut === 'full') {
    const n = 24
    const s = 15
    let holes = ''
    range(12).forEach((i) => (holes += ' ' + lozenge(52.6, i * 30 + 7.5, 2.6, 2.2)))
    range(n).forEach((i) => (holes += ' ' + cpath(1.5, ...P(59.6, i * s + s))))
    return [
      path(scallop(R1, n, s / 2), { fill: c.outer }),
      path(scallop(61.6, n) + holes, { fill: c.inner, fillRule: 'evenodd' }),
      ann(R0, 49.8, c.paper),
    ]
  }
  if (cut === 's40') {
    let holes = ''
    range(6).forEach((i) => (holes += ' ' + lozenge(53.4, i * 60, 3.6, 3.4)))
    return [
      path(scallop(R1, 14, 360 / 28), { fill: c.outer }),
      path(scallop(60.8, 14) + holes, { fill: c.inner, fillRule: 'evenodd' }),
      ann(R0, 50.4, c.paper),
    ]
  }
  let d = ''
  range(4).forEach((i) => (d += ' ' + lozenge(55.2, i * 90 + 45, 5.6, 5.6)))
  return [path(scallop(R1, 12), { fill: c.outer }), path(d, { fill: c.paper })]
}

const washi: Draw<'washi'> = (cut, c) => {
  const strip = (a: number, half: number, torn: boolean) => {
    const r1 = 49.2
    const r2 = 62.8
    if (!torn) return sector(r1, r2, a - half, a + half)
    // Torn ends: a zigzag along each radial edge.
    const edge = (ang: number, dir: number) =>
      range(6).map((k) => P(r1 + ((r2 - r1) * k) / 5, ang + (k % 2 ? 1.3 : -0.4) * dir))
    const e1 = edge(a - half, 1)
    const e2 = edge(a + half, -1).reverse()
    return `M${e1.map((p) => p.join(' ')).join(' L')} A${r2} ${r2} 0 0 1 ${e2[0]!.join(' ')} L${e2
      .slice(1)
      .map((p) => p.join(' '))
      .join(' L')} A${r1} ${r1} 0 0 0 ${e1[0]!.join(' ')} Z`
  }
  if (cut === 'full') {
    let odd = ''
    let even = ''
    const dts: [number, number][] = []
    range(4).forEach((i) => {
      odd += ' ' + strip(i * 90 + 45, 27, true)
      even += ' ' + strip(i * 90, 27, true)
      ;[-14, -4, 6, 16].forEach((o, k) => dts.push(P(k % 2 ? 58.6 : 53.4, i * 90 + 45 + o)))
    })
    return [
      path(odd, { fill: c.deep }),
      path(dots(dts, 1.5), { fill: c.paper }),
      path(even, { fill: c.tape }),
      ...range(4).map((i) =>
        path(arc(56, i * 90 - 18, i * 90 + 18), {
          fill: 'none',
          stroke: c.paper,
          strokeWidth: 1.2,
          strokeDasharray: [1, 3.2],
          strokeLinecap: 'round',
        }),
      ),
    ]
  }
  if (cut === 's40') {
    let odd = ''
    let even = ''
    range(4).forEach((i) => {
      odd += ' ' + strip(i * 90 + 45, 28, false)
      even += ' ' + strip(i * 90, 26, false)
    })
    return [path(odd, { fill: c.deep }), path(even, { fill: c.tape })]
  }
  let d = ''
  range(4).forEach((i) => (d += ' ' + sector(R0, R1, i * 90 + 30, i * 90 + 60)))
  return [ann(R0, R1, c.tape), path(d, { fill: c.deep })]
}

const stitch: Draw<'stitch'> = (cut, c) => {
  if (cut === 'full') {
    let ticks = ''
    let crosses = ''
    range(36).forEach((i) => (ticks += `M${pt(62.2, i * 10)} L${pt(58.6, i * 10)} `))
    range(8).forEach((i) => {
      const [x, y] = P(55.2, i * 45 + 22.5)
      const k = 2.3
      crosses += `M${f(x - k)} ${f(y - k)} L${f(x + k)} ${f(y + k)} M${f(x + k)} ${f(y - k)} L${f(x - k)} ${f(y + k)} `
    })
    return [
      ann(R0, R1, c.felt),
      ring(62.2, c.thread, 1.2),
      path(ticks, { stroke: c.thread, strokeWidth: 1.3, strokeLinecap: 'round' }),
      ring(51.2, c.thread, 1.5, { strokeDasharray: [4, 3], strokeLinecap: 'round' }),
      path(crosses, { stroke: c.cross, strokeWidth: 1.4, strokeLinecap: 'round' }),
    ]
  }
  if (cut === 's40') {
    return [
      ann(R0, R1, c.felt),
      ring(55.75, c.thread, 4.8, { strokeDasharray: [9, 7.6], strokeLinecap: 'round' }),
    ]
  }
  return [ann(R0, R1, c.felt), ring(55.75, c.thread, 8.6, { strokeDasharray: [13, 11] })]
}

const lino: Draw<'lino'> = (cut, c) => {
  const wedge = (a: number, rEdge: number, len: number, base: number, slant: number) => {
    const tip = rEdge > 55 ? rEdge - len : rEdge + len
    const dw = ((base / 2 / rEdge) * 180) / Math.PI
    return poly([P(rEdge, a - dw), P(rEdge, a + dw), P(tip, a + slant)])
  }
  if (cut === 'full') {
    let d = ''
    range(28).forEach(
      (i) =>
        (d +=
          ' ' +
          (i % 2
            ? wedge(i * (360 / 28), 63.6, 6.4, 2.6, 4)
            : wedge(i * (360 / 28), 47.9, 4.4, 2.4, -3))),
    )
    let w = ''
    range(121).forEach((i) => {
      const t = i * 3
      w += (i ? ' L' : 'M') + pt(55.6 + 1.5 * Math.sin((t * 14 * Math.PI) / 180), t)
    })
    return [
      ann(R0, R1, c.ink),
      path(d, { fill: c.paper }),
      path(w, { fill: 'none', stroke: c.paper, strokeWidth: 1.3 }),
    ]
  }
  if (cut === 's40') {
    let d = ''
    range(12).forEach((i) => (d += ' ' + wedge(i * 30, 63.6, 8, 6, 5)))
    return [ann(R0, R1, c.ink), path(d, { fill: c.paper })]
  }
  let d = ''
  range(8).forEach((i) => (d += ' ' + wedge(i * 45, 63.6, 9, 11, 6)))
  return [ann(R0, R1, c.ink), path(d, { fill: c.paper })]
}

const woven: Draw<'woven'> = (cut, c) => {
  const bands = (n: number, gap: number) => {
    let sky = ''
    let reed = ''
    ;(
      [
        [48.6, 55.6, 0],
        [55.9, 62.9, 1],
      ] as const
    ).forEach(([r1, r2, k]) => {
      const st = 360 / n
      const off = k ? st / 2 : 0
      range(n).forEach((i) => {
        const a1 = i * st + off
        const d = ' ' + sector(r1, r2, a1 + gap, a1 + st - gap)
        if ((i + k) % 2 === 0) sky += d
        else reed += d
      })
    })
    return [sky, reed] as const
  }
  if (cut === 'full') {
    const [sky, reed] = bands(24, 0.7)
    return [
      ann(R0, R1, c.dark),
      path(reed, { fill: c.reed }),
      path(sky, { fill: c.sky }),
      ring(62.9, c.dark, 1.2),
    ]
  }
  if (cut === 's40') {
    const [sky, reed] = bands(12, 2.6)
    return [ann(R0, R1, c.dark), path(reed, { fill: c.reed }), path(sky, { fill: c.sky })]
  }
  let d = ''
  range(8).forEach((i) => (d += ' ' + sector(R0, R1, i * 45 + 4, i * 45 + 26)))
  return [ann(R0, R1, c.dark), path(d, { fill: c.sky })]
}

// ---------- Rare: fold, dye, enamel, tesserae, glaze ----------

const origami: Draw<'origami'> = (cut, c) => {
  const n = cut === 'full' ? 12 : 8
  const st = 360 / n
  const rv = cut === 'full' ? 56.4 : 55
  let L = ''
  let Rr = ''
  const star: [number, number][] = []
  range(n).forEach((i) => {
    const a = i * st
    star.push(P(R1, a), P(rv, a + st / 2))
    L += ' ' + poly([P(R0 - 0.5, a), P(R1, a), P(rv, a - st / 2), P(R0 - 0.5, a - st / 2)])
    Rr += ' ' + poly([P(R0 - 0.5, a), P(rv, a + st / 2), P(R1, a)])
  })
  // A Kyoto branch: one asymmetric sweep across the upper left.
  const leaf = (a: number, r: number, s: number, rot: number) => {
    const [x, y] = P(r, a)
    return g(`translate(${x} ${y}) rotate(${f(a + rot)}) scale(${s})`, [
      path('M0 -4.6 L2.6 0 L0 4.6 L-2.6 0 Z', { fill: c.leaf }),
      ...(cut === 'full' ? [path('M0 -4.6 L0 4.6', { stroke: c.leafDk, strokeWidth: 1 })] : []),
    ])
  }
  if (cut === 'full') {
    return [
      path(L, { fill: c.paper }),
      path(Rr, { fill: c.silver }),
      path(poly(star), { fill: 'none', stroke: c.edge, strokeWidth: 1.2, strokeLinejoin: 'round' }),
      path(arc(52.6, 214, 334), {
        fill: 'none',
        stroke: c.branch,
        strokeWidth: 1.6,
        strokeLinecap: 'round',
      }),
      path(`M${pt(52.6, 258)} L${pt(56.4, 266)} M${pt(52.6, 300)} L${pt(56.2, 306)}`, {
        stroke: c.branch,
        strokeWidth: 1.1,
        strokeLinecap: 'round',
      }),
      leaf(228, 55.6, 0.95, 35),
      leaf(250, 50.6, 0.75, -35),
      leaf(268, 57.6, 0.95, 15),
      leaf(286, 50.6, 0.75, -30),
      leaf(309, 57.4, 0.95, 25),
      leaf(328, 55.4, 0.85, 40),
      glaze(60, 22, 44),
    ]
  }
  if (cut === 's40') {
    return [
      path(L, { fill: c.paper }),
      path(Rr, { fill: c.silver }),
      path(poly(star), { fill: 'none', stroke: c.edge, strokeWidth: 4.2, strokeLinejoin: 'round' }),
      path(arc(52.8, 222, 328), {
        fill: 'none',
        stroke: c.branch,
        strokeWidth: 4.8,
        strokeLinecap: 'round',
      }),
      path(lozenge(57.4, 252, 5.6, 4.2) + ' ' + lozenge(57.4, 298, 5.6, 4.2), { fill: c.leaf }),
    ]
  }
  return [
    path(poly(star), { fill: c.edge }),
    path(lozenge(56, 240, 7.4, 5.6) + ' ' + lozenge(56, 300, 7.4, 5.6), { fill: c.leaf }),
  ]
}

const indigo: Draw<'indigo'> = (cut, c) => {
  if (cut === 'full') {
    const ctr = range(12).map((i) => P(55.75, i * 30))
    let dia = ''
    range(12).forEach((i) => (dia += ' ' + lozenge(55.75, i * 30 + 15, 2.2, 1.8)))
    return [
      ann(R0, R1, c.cloth),
      ...ctr.flatMap(([cx, cy]): ArtNode[] => [
        { el: 'circle', a: { cx, cy, r: 5, fill: 'none', stroke: c.bleed, strokeWidth: 1 } },
        { el: 'circle', a: { cx, cy, r: 3.6, fill: 'none', stroke: c.resist, strokeWidth: 1.5 } },
        { el: 'circle', a: { cx, cy, r: 1.1, fill: c.resist } },
      ]),
      path(dia, { fill: c.resist }),
      ring(49.4, c.deep, 1.2),
      glaze(61.6, 296, 330),
    ]
  }
  if (cut === 's40') {
    return [
      ann(R0, R1, c.cloth),
      path(
        dots(
          range(8).map((i) => P(55.75, i * 45)),
          3.6,
        ),
        { fill: 'none', stroke: c.resist, strokeWidth: 4.8 },
      ),
    ]
  }
  let d = ''
  range(4).forEach((i) => (d += ' ' + lozenge(55.75, i * 90 + 45, 5.8, 5.6)))
  return [ann(R0, R1, c.cloth), path(d, { fill: c.resist })]
}

const enamel: Draw<'enamel'> = (cut, c) => {
  const leaves = (n: number, len: number, wid: number, off: number) =>
    range(n).map((i) => {
      const a = (i * 360) / n
      const out = i % 2 ? off : -off
      const [x, y] = P(55.9 + out, a + 3)
      return g(`translate(${x} ${y}) rotate(${f(a + (out > 0 ? 40 : 140))})`, [
        path(`M0 ${-len} Q${wid} 0 0 ${len} Q${-wid} 0 0 ${-len} Z`, {
          fill: c.deep,
          ...(cut === 'full' ? { stroke: c.gold, strokeWidth: 1 } : {}),
        }),
      ])
    })
  if (cut === 'full') {
    return [
      ann(R0, R1, c.rim),
      ann(50, 61.8, c.enamel),
      ring(55.9, c.gold, 1.2),
      ...leaves(16, 3.6, 3.2, 2.6),
      ...[45, 135, 225, 315].map((a) => path(cpath(1.6, ...P(55.9, a)), { fill: c.gold })),
      glaze(59.6, 290, 330),
    ]
  }
  if (cut === 's40') {
    return [
      ann(R0, R1, c.rim),
      ann(50.6, 61, c.enamel),
      path(
        range(8)
          .map((i) => lozenge(55.8, i * 45 + 22.5, 4.4, 2.6))
          .join(' '),
        {
          fill: c.deep,
        },
      ),
      glaze(58.4, 300, 330, 4.8),
    ]
  }
  return [ann(R0, R1, c.rim), ann(51, 60.4, c.enamel)]
}

const mosaic: Draw<'mosaic'> = (cut, c) => {
  type Tile = 'plum' | 'cream' | 'gold'
  const row = (
    r1: number,
    r2: number,
    n: number,
    off: number,
    gap: number,
    pick: (i: number) => Tile,
  ) => {
    const out: Partial<Record<Tile, string>> = {}
    range(n).forEach((i) => {
      const st = 360 / n
      const a1 = i * st + off
      const col = pick(i)
      out[col] = (out[col] ?? '') + ' ' + sector(r1, r2, a1 + gap, a1 + st - gap)
    })
    return out
  }
  const merge = (...rows: Partial<Record<Tile, string>>[]) =>
    rows.reduce<Partial<Record<Tile, string>>>((m, r) => {
      for (const k of Object.keys(r) as Tile[]) m[k] = (m[k] ?? '') + r[k]
      return m
    }, {})
  const tiles = (m: Partial<Record<Tile, string>>) =>
    (['plum', 'cream', 'gold'] as const).map((k) => path(m[k] ?? '', { fill: c[k] }))
  if (cut === 'full') {
    const m = merge(
      row(56.2, 62.9, 28, 0, 0.8, (i) => (i % 4 === 0 ? 'gold' : 'plum')),
      row(48.8, 55.6, 22, 4, 1, (i) => (i % 3 === 0 ? 'plum' : 'cream')),
    )
    return [ann(R0, R1, c.grout), ...tiles(m), ring(63, c.edge, 1), glaze(60.4, 300, 328, 1.3)]
  }
  if (cut === 's40') {
    const m = merge(
      row(56, 63.5, 12, 0, 2.6, (i) => (i % 3 === 0 ? 'gold' : 'plum')),
      row(48, 55, 10, 9, 3.2, () => 'cream'),
    )
    return [ann(R0, R1, c.grout), ...tiles(m)]
  }
  let d = ''
  range(8).forEach((i) => (d += ' ' + sector(48.5, 57.5, i * 45 + 6, i * 45 + 39)))
  return [ann(R0, R1, c.plum), path(d, { fill: c.cream })]
}

const iznik: Draw<'iznik'> = (cut, c) => {
  if (cut === 'full') {
    const tulip = [
      path('M0 -50.6 L0 -54.2', { stroke: c.jade, strokeWidth: 1.1, strokeLinecap: 'round' }),
      path(
        'M0 -51.4 C-3.6 -52 -5.6 -54.4 -5.4 -57.2 C-3.4 -56 -1.6 -54.6 0 -52.8 Z M0 -51.4 C3.6 -52 5.6 -54.4 5.4 -57.2 C3.4 -56 1.6 -54.6 0 -52.8 Z',
        { fill: c.jade },
      ),
      path(
        'M-3.4 -54.4 C-4.2 -57.6 -3.2 -60 -1.7 -61.2 L0 -58.8 L1.7 -61.2 C3.2 -60 4.2 -57.6 3.4 -54.4 C1.8 -53.3 -1.8 -53.3 -3.4 -54.4 Z',
        { fill: c.ember, stroke: c.cobalt, strokeWidth: 1 },
      ),
    ]
    return [
      ann(R0, R1, c.ground),
      ring(62.6, c.cobalt, 1.8),
      ring(48.9, c.cobalt, 1.8),
      ...range(8).map((i) => g(`rotate(${i * 45})`, tulip)),
      path(
        range(8)
          .map((i) => lozenge(56, i * 45 + 22.5, 3.4, 1.7))
          .join(' '),
        {
          fill: c.cobalt,
        },
      ),
      glaze(59.4, 300, 332, 1.3),
    ]
  }
  if (cut === 's40') {
    let t = ''
    range(6).forEach((i) => (t += ' ' + lozenge(53.6, i * 60, 5, 3.4)))
    return [
      ann(R0, R1, c.ground),
      ring(61.1, c.cobalt, 4.8),
      path(t, { fill: c.ember }),
      path(
        dots(
          range(6).map((i) => P(53.6, i * 60 + 30)),
          2.6,
        ),
        { fill: c.jade },
      ),
    ]
  }
  let t = ''
  range(4).forEach((i) => (t += ' ' + lozenge(55.75, i * 90, 6.4, 5.4)))
  return [ann(R0, R1, c.cobalt), path(t, { fill: c.ember })]
}

// ---------- Epic: lacquer, seal, reed pen, inlay, hoop ----------

const khokhloma: Draw<'khokhloma'> = (cut, c) => {
  const wave = (r0: number, amp: number, k: number, step = 3) => {
    let d = ''
    for (let t = 0, i = 0; t <= 360; t += step, i++)
      d += (i ? ' L' : 'M') + pt(r0 + amp * Math.sin((t * k * Math.PI) / 180), t)
    return d
  }
  if (cut === 'full') {
    const lv = range(12).map((i) => {
      const t = i * 30 + 8
      const up = i % 2 === 0
      const [x, y] = P(up ? 59.4 : 52.4, t)
      return g(`translate(${x} ${y}) rotate(${f(t + (up ? 25 : 205))})`, [
        path('M0 3.4 C-3 0.8 -2.4 -3 0 -4.8 C2.4 -3 3 0.8 0 3.4 Z', { fill: c.gold }),
      ])
    })
    let b = ''
    let hi = ''
    range(6).forEach((k) => {
      const t = k * 60 + 15
      const [x, y] = P(55.9 + 3 * Math.sin((t * 6 * Math.PI) / 180), t)
      ;(
        [
          [-2.1, 1.1],
          [2.1, 1.1],
          [0, -2.2],
        ] as const
      ).forEach(([dx, dy]) => {
        b += ' ' + cpath(2, x + dx, y + dy)
        hi += ' ' + cpath(0.6, x + dx - 0.7, y + dy - 0.7)
      })
    })
    return [
      ann(R0, R1, c.lacquer),
      ring(62.6, c.gold, 1.5),
      ring(49.2, c.gold, 1.2),
      path(wave(55.9, 3, 6), { fill: 'none', stroke: c.gold, strokeWidth: 1.4 }),
      ...lv,
      path(b, { fill: c.berry }),
      path(hi, { fill: c.berryHi }),
    ]
  }
  if (cut === 's40') {
    const b = range(6).map((k) =>
      P(53.5 + 2 * Math.sin(((k * 60 + 15) * 6 * Math.PI) / 180), k * 60 + 15),
    )
    return [
      ann(R0, R1, c.lacquer),
      path(wave(53.5, 2, 6, 4), { fill: 'none', stroke: c.gold, strokeWidth: 4.8 }),
      ring(61.1, c.gold, 4.8),
      path(dots(b, 3.2), { fill: c.berry }),
    ]
  }
  return [
    ann(R0, R1, c.lacquer),
    path(wave(56, 3.2, 4, 6), { fill: 'none', stroke: c.gold, strokeWidth: 8.6 }),
  ]
}

/** The corner seal: the one element of Seal and Fret allowed outside the ring. */
const sealStamp = (cut: ArtCut, c: ArtPalette<'seal'>, bg: string): ArtNode => {
  const s = cut === 's40' ? 22 : 20
  const [x, y] = P(cut === 'full' ? 57 : 56, 135)
  const h = s / 2
  const kids: ArtNode[] = [
    {
      el: 'rect',
      a: {
        x: -h,
        y: -h,
        width: s,
        height: s,
        rx: cut === 'full' ? 1.4 : 2.4,
        fill: c.ver,
        stroke: bg,
        strokeWidth: cut === 'full' ? 2 : 4,
      },
    },
  ]
  if (cut === 'full') {
    kids.push(
      {
        el: 'rect',
        a: {
          x: -h + 2.6,
          y: -h + 2.6,
          width: s - 5.2,
          height: s - 5.2,
          fill: 'none',
          stroke: c.paper,
          strokeWidth: 1,
        },
      },
      g('scale(.58)', [
        path('M0 -11 V-8 M-9 -6 H9 M-6 -4 C-3 4 2 9 10 12 M6 -4 C3 4 -2 9 -10 12', {
          fill: 'none',
          stroke: c.paper,
          strokeWidth: 2.4,
          strokeLinecap: 'round',
        }),
      ]),
    )
  }
  return g(`translate(${x} ${y}) rotate(-6)`, kids)
}

const seal: Draw<'seal'> = (cut, c, bg) => {
  if (cut === 'full') {
    const key = path('M-5.6 -52 V-59.6 H5.6 V-52 H-1.4 V-56 H2', {
      fill: 'none',
      stroke: c.ver,
      strokeWidth: 1.5,
      strokeLinejoin: 'miter',
    })
    return [
      ann(R0, R1, c.lacquer),
      ring(62.6, c.gold, 1.5),
      ring(49.1, c.gold, 1.2),
      ...range(14).map((i) => g(`rotate(${f((i * 360) / 14)})`, [key])),
      sealStamp(cut, c, bg),
    ]
  }
  if (cut === 's40') {
    let d = ''
    const n = 16
    const st = 360 / n
    range(n).forEach((i) => {
      const a = i * st
      d += `${i ? ' L' : 'M'}${pt(51.2, a)} L${pt(51.2, a + st / 2)} L${pt(56.6, a + st / 2)} L${pt(56.6, a + st)}`
    })
    return [
      ann(R0, R1, c.lacquer),
      path(d + ' Z', { fill: 'none', stroke: c.ver, strokeWidth: 4.8, strokeLinejoin: 'miter' }),
      ring(61.1, c.gold, 4.8),
      sealStamp(cut, c, bg),
    ]
  }
  return [ann(R0, R1, c.lacquer), ring(61.4, c.gold, 4.2), sealStamp(cut, c, bg)]
}

const qalam: Draw<'qalam'> = (cut, c) => {
  // A reed-pen stroke: thick quickly, then a long taper; the gap holds the dots.
  const stroke = (rOut: number, wMax: number, wMin: number, a1 = 178, a2 = 470) => {
    const N = 90
    const outer: [number, number][] = []
    const inner: [number, number][] = []
    for (let i = 0; i <= N; i++) {
      const p = i / N
      const t = a1 + (a2 - a1) * p
      const k = p < 0.28 ? Math.pow(p / 0.28, 0.7) : Math.pow((1 - p) / 0.72, 1.1)
      const w = wMin + (wMax - wMin) * k
      outer.push(P(rOut, t))
      inner.push(P(rOut - w, t))
    }
    return (
      'M' +
      outer.map((q) => q.join(' ')).join(' L') +
      ' L' +
      inner
        .reverse()
        .map((q) => q.join(' '))
        .join(' L') +
      ' Z'
    )
  }
  if (cut === 'full') {
    const dd = (
      [
        [57, 128],
        [57, 148],
        [52, 138],
      ] as const
    )
      .map(([r, a]) => lozenge(r, a, 2.6, 2.6))
      .join(' ')
    return [
      ann(R0, R1, c.lacquer),
      ring(62.7, c.gold, 1.4),
      ring(49, c.gold, 1),
      path(stroke(60.8, 9.4, 1.1), { fill: c.ink }),
      path(arc(60, 200, 262), {
        fill: 'none',
        stroke: c.inkHi,
        strokeWidth: 1,
        strokeLinecap: 'round',
      }),
      path(dd, { fill: c.gold }),
    ]
  }
  if (cut === 's40') {
    const dd = (
      [
        [54, 128],
        [54, 150],
      ] as const
    )
      .map(([r, a]) => lozenge(r, a, 3.4, 3.4))
      .join(' ')
    return [
      ann(R0, R1, c.lacquer),
      ring(61.1, c.gold, 4.8),
      path(stroke(58.7, 9.6, 4.8), { fill: c.ink }),
      path(dd, { fill: c.gold }),
    ]
  }
  return [
    ann(R0, R1, c.lacquer),
    path(arc(56.2, 178, 470 - 360), {
      fill: 'none',
      stroke: c.ink,
      strokeWidth: 10,
      strokeLinecap: 'round',
    }),
  ]
}

const marquetry: Draw<'marquetry'> = (cut, c) => {
  const slats = (n: number, r1: number, r2: number, slant: number, gap: number) => {
    let m = ''
    let ch = ''
    const st = 360 / n
    range(n).forEach((i) => {
      const a = i * st
      const d =
        ' ' +
        poly([
          P(r1, a + gap / 2),
          P(r1, a + st - gap / 2),
          P(r2, a + st - gap / 2 + slant),
          P(r2, a + gap / 2 + slant),
        ])
      if (i % 2) ch += d
      else m += d
    })
    return [m, ch] as const
  }
  if (cut === 'full') {
    const [m, ch] = slats(24, 50.8, 61.2, 8, 0.9)
    return [
      ann(R0, R1, c.wood),
      path(m, { fill: c.maple }),
      path(ch, { fill: c.cherry }),
      ring(62.6, c.gold, 1.5),
      ring(49.4, c.gold, 1),
      path(
        dots(
          [0, 90, 180, 270].map((a) => P(49.4, a + 7.5)),
          1.4,
        ),
        { fill: c.gold },
      ),
    ]
  }
  if (cut === 's40') {
    const [m, ch] = slats(12, 49.4, 58.4, 10, 2.8)
    return [
      ann(R0, R1, c.wood),
      path(m, { fill: c.maple }),
      path(ch, { fill: c.cherry }),
      ring(61.1, c.gold, 4.8),
    ]
  }
  const [m] = slats(16, 48.4, 57.4, 12, 3)
  return [ann(R0, R1, c.wood), path(m, { fill: c.maple }), ring(61.4, c.maple, 4.2)]
}

const hoop: Draw<'hoop'> = (cut, c) => {
  if (cut === 'full') {
    const st = [
      [300, 53.6, 3.2],
      [326, 54.6, 2],
      [58, 53.8, 3],
      [92, 52.4, 2],
      [148, 54, 2.6],
      [204, 53.2, 3.2],
      [234, 54.6, 1.8],
    ] as const
    const [mx, my] = P(53.4, 264)
    return [
      ann(R0, 58.6, c.fabric),
      ring(57.1, '#ffffff', 0.9, { strokeOpacity: 0.28, strokeDasharray: [1.4, 2.2] }),
      path(
        `M${pt(53.6, 300)} L${pt(54.6, 326)} M${pt(53.8, 58)} L${pt(52.4, 92)} L${pt(54, 148)}`,
        {
          fill: 'none',
          stroke: c.line,
          strokeWidth: 1,
          strokeDasharray: [1.6, 2],
        },
      ),
      path(st.map(([a, r, k]) => star4(...P(r, a), k)).join(' '), { fill: c.star }),
      path(cpath(3.8, mx, my), { fill: c.moon }),
      path(cpath(3.3, mx + 2.1, my - 1.3), { fill: c.fabric }),
      ring(61.05, c.wood, 4.9),
      ring(59.2, c.woodHi, 1),
      path(arc(61.8, 30, 130) + ' ' + arc(60.6, 175, 290), {
        fill: 'none',
        stroke: c.woodDk,
        strokeWidth: 1,
      }),
      ring(63.4, c.woodDk, 1),
      {
        el: 'rect',
        a: {
          x: -6,
          y: -70.4,
          width: 12,
          height: 8.2,
          rx: 2,
          fill: c.clamp,
          stroke: c.clampDk,
          strokeWidth: 1,
        },
      },
      path(cpath(1.9, 0, -66.3), { fill: c.clampDk }),
    ]
  }
  if (cut === 's40') {
    const st = [
      [300, 53.8, 5.4],
      [60, 53.8, 4.6],
      [190, 53.8, 5],
    ] as const
    return [
      ann(R0, 58.4, c.fabric),
      path(st.map(([a, r, k]) => star4(...P(r, a), k)).join(' '), { fill: c.star }),
      ring(61.1, c.wood, 4.8),
      { el: 'rect', a: { x: -8, y: -70, width: 16, height: 9.6, rx: 2.6, fill: c.clamp } },
    ]
  }
  return [
    ann(R0, R1, c.fabric),
    ring(59.2, c.wood, 8.6),
    { el: 'rect', a: { x: -9, y: -70.4, width: 18, height: 10.4, rx: 3, fill: c.wood } },
  ]
}

// ---------- Legendary ----------

/**
 * The only text any frame carries, at the full cut only. Not localised: it is
 * "hello" in nine languages on purpose, and it is decoration, not a sentence —
 * which is why it is not in the message catalogues.
 */
export const HELLO_RING =
  'hola · hello · привет · merhaba · こんにちは · مرحبا · नमस्ते · 你好 · olá · '

const glass = (cut: ArtCut, c: ArtPalette<'glass'>, hues: readonly string[]): ArtNode[] => {
  const halo =
    cut === 'full'
      ? [
          ring(68.4, c.halo, 6, { strokeOpacity: 0.12 }),
          ring(66.4, c.halo, 3, { strokeOpacity: 0.22 }),
        ]
      : [ring(67.6, c.halo, cut === 's40' ? 6 : 8, { strokeOpacity: 0.26 })]
  const gems = (r: number, gr: number, stroke: number) =>
    path(
      dots(
        [0, 90, 180, 270].map((a) => P(r, a)),
        gr,
      ),
      { fill: c.gem, ...(stroke ? { stroke: c.goldHi, strokeWidth: stroke } : {}) },
    )
  if (cut === 'full') {
    const band = (r1: number, r2: number, cuts: readonly number[], shift: number, op: number) =>
      cuts.map((a1, i) => {
        const a2 = i + 1 < cuts.length ? cuts[i + 1]! : cuts[0]! + 360
        return path(sector(r1, r2, a1, a2), {
          fill: hues[(i + shift) % hues.length]!,
          fillOpacity: op,
          stroke: c.gold,
          strokeWidth: 1.1,
          strokeLinejoin: 'round',
        })
      })
    return [
      ...halo,
      ann(R0, 65, c.lead),
      ann(56.2, 64.4, c.back),
      ...band(
        56.2,
        64.4,
        [0, 22, 48, 70, 95, 120, 142, 168, 192, 216, 240, 266, 290, 316, 338],
        0,
        0.8,
      ),
      ...band(58.6, 64.4, [10, 46, 80, 112, 150, 186, 220, 252, 288, 324], 3, 0.5),
      ring(64.6, c.goldHi, 1.4),
      ring(56, c.gold, 1.2),
      ring(48.7, c.gold, 1),
      { el: 'hello', r: 50.4, fontSize: 5.4, fill: c.text, length: 315 },
      gems(60.3, 4.4, 1.3),
      ...[0, 90, 180, 270].map((a) =>
        path(cpath(1.2, P(60.3, a)[0] - 1.4, P(60.3, a)[1] - 1.4), {
          fill: '#ffffff',
          fillOpacity: 0.85,
        }),
      ),
      // The highlight at 30°. Still, it is the drawing; moving, it is the sweep.
      {
        el: 'path',
        a: { d: sector(56.4, 64.2, 26, 34), fill: '#ffffff', fillOpacity: 0.42 },
        sweep: true,
      },
    ]
  }
  if (cut === 's40') {
    const cuts = [0, 45, 90, 135, 180, 225, 270, 315]
    const cols = [hues[0]!, hues[1]!, hues[3]!]
    const m = ['', '', '']
    cuts.forEach((a, i) => (m[i % 3] += ' ' + sector(49.4, 63.6, a + 2.6, a + 45 - 2.6)))
    return [
      ...halo,
      ann(R0, 65, c.lead),
      ...m.map((d, i) => path(d, { fill: cols[i]!, fillOpacity: 0.9 })),
      gems(56.5, 6.2, 0),
    ]
  }
  return [...halo, ann(R0, 65, hues[0]!), gems(56.5, 5.6, 0)]
}

/** The drawing for one frame, cut and scheme. Pure and deterministic. */
export function frameArtNodes(key: ArtKey, cut: ArtCut, scheme: ArtScheme): ArtNode[] {
  const pal = ART_PALETTES[key]
  const c = scheme === 'light' ? pal.light : pal.dark
  // The seal's stamp is outlined in the ground's colour, as on the sheet, so it
  // reads as pressed onto the page rather than floating over the ring.
  const bg = scheme === 'light' ? '#ffffff' : '#1a1c21'
  switch (key) {
    case 'papel':
      return papel(cut, c as ArtPalette<'papel'>, bg)
    case 'washi':
      return washi(cut, c as ArtPalette<'washi'>, bg)
    case 'stitch':
      return stitch(cut, c as ArtPalette<'stitch'>, bg)
    case 'lino':
      return lino(cut, c as ArtPalette<'lino'>, bg)
    case 'woven':
      return woven(cut, c as ArtPalette<'woven'>, bg)
    case 'origami':
      return origami(cut, c as ArtPalette<'origami'>, bg)
    case 'indigo':
      return indigo(cut, c as ArtPalette<'indigo'>, bg)
    case 'enamel':
      return enamel(cut, c as ArtPalette<'enamel'>, bg)
    case 'mosaic':
      return mosaic(cut, c as ArtPalette<'mosaic'>, bg)
    case 'iznik':
      return iznik(cut, c as ArtPalette<'iznik'>, bg)
    case 'khokhloma':
      return khokhloma(cut, c as ArtPalette<'khokhloma'>, bg)
    case 'seal':
      return seal(cut, c as ArtPalette<'seal'>, bg)
    case 'qalam':
      return qalam(cut, c as ArtPalette<'qalam'>, bg)
    case 'marquetry':
      return marquetry(cut, c as ArtPalette<'marquetry'>, bg)
    case 'hoop':
      return hoop(cut, c as ArtPalette<'hoop'>, bg)
    case 'glass':
      return glass(cut, c as ArtPalette<'glass'>, GLASS_HUES[scheme])
  }
}

/** 64 px and up draws the full cut; 40 to 63 the middle one; under 40 the silhouette. */
export function cutFor(size: number): ArtCut {
  if (size >= 64) return 'full'
  if (size >= 40) return 's40'
  return 's28'
}
