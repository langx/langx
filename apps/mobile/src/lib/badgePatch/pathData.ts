/**
 * SVG path data without elliptical arcs, and the two measurements the patch
 * art needs from a path: how long its outline is and where a point along it
 * sits.
 *
 * Why no arcs. The badge master sheet writes circles, round corners and
 * bubbles with `A` commands, and those are the one command known to draw
 * wrong somewhere we ship: `expo-image` on iOS renders arcs from a bundled SVG
 * with the sweep inverted. `BadgePatch` draws through react-native-svg, which
 * handles arcs, but the patch geometry is also the thing a share card or a
 * widget will want to rasterise one day, so it is kept to commands every
 * renderer agrees on: each arc becomes the cubic Béziers that approximate it
 * (one per quarter turn or less, which is under 0.03% off a true circle).
 *
 * Pure functions over strings, so the mobile vitest reaches them.
 */

type Pt = readonly [number, number]

const round = (n: number) => +n.toFixed(3)

/** Tokenises path data into command letters and numbers. */
function tokens(d: string): (string | number)[] {
  const out: (string | number)[] = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    if (m[1]) out.push(m[1])
    else out.push(Number(m[2]))
  }
  return out
}

const ARGS: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
}

/**
 * The cubics for one arc, endpoint-parameterised as SVG writes it (F.6 of the
 * SVG spec), each as `[c1x, c1y, c2x, c2y, x, y]`.
 */
export function arcToCubics(
  from: Pt,
  rxIn: number,
  ryIn: number,
  angle: number,
  largeArc: boolean,
  sweep: boolean,
  to: Pt,
): number[][] {
  const [x1, y1] = from
  const [x2, y2] = to
  if (x1 === x2 && y1 === y2) return []
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]]

  const phi = (angle * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy

  // Radii too small for the chord are scaled up, as the spec says.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }

  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * rx * y1p) / ry
  const cyp = (-coef * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2

  const vecAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return a
  }
  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let delta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  if (sweep && delta < 0) delta += 2 * Math.PI

  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9))
  const step = delta / segments
  const k = (4 / 3) * Math.tan(step / 4)
  const point = (t: number): Pt => [
    cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  ]
  const deriv = (t: number): Pt => [
    -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  ]

  const out: number[][] = []
  for (let i = 0; i < segments; i++) {
    const a = theta1 + i * step
    const b = a + step
    const p0 = point(a)
    const p3 = i === segments - 1 ? to : point(b)
    const d0 = deriv(a)
    const d3 = deriv(b)
    out.push([
      p0[0] + k * d0[0],
      p0[1] + k * d0[1],
      p3[0] - k * d3[0],
      p3[1] - k * d3[1],
      p3[0],
      p3[1],
    ])
  }
  return out
}

/**
 * The same path with every `A`/`a` replaced by absolute `C` segments. Every
 * other command is passed through as written; the current point is tracked
 * through all of them, relative ones included, so an arc after `h` or `q`
 * starts where the pen really is.
 */
export function withoutArcs(d: string): string {
  if (!/[Aa]/.test(d)) return d
  const toks = tokens(d)
  const parts: string[] = []
  let i = 0
  let cmd = ''
  let cur: [number, number] = [0, 0]
  let start: [number, number] = [0, 0]
  // The last control point, for `S` and `T`.
  let lastCubic: [number, number] | null = null
  let lastQuad: [number, number] | null = null

  while (i < toks.length) {
    const tok = toks[i]
    if (typeof tok === 'string') {
      cmd = tok
      i++
      if (cmd === 'z' || cmd === 'Z') {
        parts.push('Z')
        cur = [start[0], start[1]]
        lastCubic = null
        lastQuad = null
        continue
      }
    }
    const lower = cmd.toLowerCase()
    const rel = cmd === lower
    const n = ARGS[lower] ?? 0
    const a = toks.slice(i, i + n) as number[]
    i += n
    const ox = rel ? cur[0] : 0
    const oy = rel ? cur[1] : 0

    switch (lower) {
      case 'm': {
        cur = [ox + a[0]!, oy + a[1]!]
        start = [cur[0], cur[1]]
        parts.push(`M${round(cur[0])} ${round(cur[1])}`)
        // Pairs after a moveto are linetos.
        cmd = rel ? 'l' : 'L'
        lastCubic = lastQuad = null
        break
      }
      case 'l':
        cur = [ox + a[0]!, oy + a[1]!]
        parts.push(`L${round(cur[0])} ${round(cur[1])}`)
        lastCubic = lastQuad = null
        break
      case 'h':
        cur = [(rel ? cur[0] : 0) + a[0]!, cur[1]]
        parts.push(`L${round(cur[0])} ${round(cur[1])}`)
        lastCubic = lastQuad = null
        break
      case 'v':
        cur = [cur[0], (rel ? cur[1] : 0) + a[0]!]
        parts.push(`L${round(cur[0])} ${round(cur[1])}`)
        lastCubic = lastQuad = null
        break
      case 'c': {
        const c2: [number, number] = [ox + a[2]!, oy + a[3]!]
        const end: [number, number] = [ox + a[4]!, oy + a[5]!]
        parts.push(
          `C${round(ox + a[0]!)} ${round(oy + a[1]!)} ${round(c2[0])} ${round(c2[1])} ${round(end[0])} ${round(end[1])}`,
        )
        cur = end
        lastCubic = c2
        lastQuad = null
        break
      }
      case 's': {
        const c1: [number, number] = lastCubic
          ? [2 * cur[0] - lastCubic[0], 2 * cur[1] - lastCubic[1]]
          : [cur[0], cur[1]]
        const c2: [number, number] = [ox + a[0]!, oy + a[1]!]
        const end: [number, number] = [ox + a[2]!, oy + a[3]!]
        parts.push(
          `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(end[0])} ${round(end[1])}`,
        )
        cur = end
        lastCubic = c2
        lastQuad = null
        break
      }
      case 'q': {
        const q: [number, number] = [ox + a[0]!, oy + a[1]!]
        const end: [number, number] = [ox + a[2]!, oy + a[3]!]
        parts.push(`Q${round(q[0])} ${round(q[1])} ${round(end[0])} ${round(end[1])}`)
        cur = end
        lastQuad = q
        lastCubic = null
        break
      }
      case 't': {
        const q: [number, number] = lastQuad
          ? [2 * cur[0] - lastQuad[0], 2 * cur[1] - lastQuad[1]]
          : [cur[0], cur[1]]
        const end: [number, number] = [ox + a[0]!, oy + a[1]!]
        parts.push(`Q${round(q[0])} ${round(q[1])} ${round(end[0])} ${round(end[1])}`)
        cur = end
        lastQuad = q
        lastCubic = null
        break
      }
      case 'a': {
        const end: [number, number] = [ox + a[5]!, oy + a[6]!]
        for (const c of arcToCubics(cur, a[0]!, a[1]!, a[2]!, a[3] !== 0, a[4] !== 0, end)) {
          parts.push(`C${c.map(round).join(' ')}`)
        }
        cur = end
        lastCubic = lastQuad = null
        break
      }
      default:
        // Unknown input: stop rather than loop.
        return parts.join('')
    }
  }
  return parts.join('')
}

/**
 * The outline as points, a polyline close enough to measure: lines as they
 * are, curves in sixteen steps each. Only `M L C Q Z` are read, which is
 * everything `withoutArcs` writes.
 */
export function flatten(d: string): Pt[][] {
  const toks = tokens(withoutArcs(d))
  const runs: Pt[][] = []
  let run: Pt[] = []
  let i = 0
  let cmd = ''
  let cur: Pt = [0, 0]
  while (i < toks.length) {
    const tok = toks[i]
    if (typeof tok === 'string') {
      cmd = tok
      i++
      if (cmd === 'Z' || cmd === 'z') {
        if (run.length > 0) {
          run.push(run[0]!)
          cur = run[0]!
        }
        continue
      }
    }
    const n = ARGS[cmd.toLowerCase()] ?? 0
    const a = toks.slice(i, i + n) as number[]
    i += n
    if (n === 0) break
    if (cmd === 'M') {
      if (run.length > 1) runs.push(run)
      cur = [a[0]!, a[1]!]
      run = [cur]
      cmd = 'L'
    } else if (cmd === 'L') {
      cur = [a[0]!, a[1]!]
      run.push(cur)
    } else if (cmd === 'C' || cmd === 'Q') {
      const p0 = cur
      const pts: Pt[] =
        cmd === 'C'
          ? [
              [a[0]!, a[1]!],
              [a[2]!, a[3]!],
              [a[4]!, a[5]!],
            ]
          : [
              [a[0]!, a[1]!],
              [a[2]!, a[3]!],
            ]
      for (let s = 1; s <= 16; s++) {
        const t = s / 16
        const u = 1 - t
        if (cmd === 'C') {
          const [p1, p2, p3] = pts as [Pt, Pt, Pt]
          run.push([
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
          ])
        } else {
          const [p1, p2] = pts as [Pt, Pt]
          run.push([
            u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
          ])
        }
      }
      cur = pts[pts.length - 1]!
    } else {
      // Anything else was not written by `withoutArcs`.
      break
    }
  }
  if (run.length > 1) runs.push(run)
  return runs
}

/** The length of a path's first subpath — the outline of a container. */
export function outlineLength(d: string): number {
  const run = flatten(d)[0] ?? []
  let length = 0
  for (let i = 1; i < run.length; i++) {
    length += Math.hypot(run[i]![0] - run[i - 1]![0], run[i]![1] - run[i - 1]![1])
  }
  return length
}

/**
 * The point `fraction` of the way along a path's first subpath, and the
 * direction the pen is travelling there (a unit vector).
 */
export function pointAlong(d: string, fraction: number): { at: Pt; heading: Pt } {
  const run = flatten(d)[0] ?? [[0, 0] as Pt]
  const total = outlineLength(d)
  let left = Math.max(0, Math.min(1, fraction)) * total
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1]!
    const b = run[i]!
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (seg === 0) continue
    if (left <= seg) {
      const t = left / seg
      return {
        at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading: [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg],
      }
    }
    left -= seg
  }
  const last = run[run.length - 1]!
  return { at: last, heading: [1, 0] }
}
