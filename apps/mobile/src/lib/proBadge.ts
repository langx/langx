/**
 * The v3 PRO badge's geometry: how big it is beside a given text, and the
 * paths of its star and its word. Pure numbers, no React Native, so both are
 * tested on their own; `ProBadge` only paints what this returns.
 *
 * The badge is a pill with a star and PRO in a heavy monoline stroke — drawn,
 * not set in a font, so it is the same shape on iOS, Android and the web and
 * does not depend on Nunito having loaded inside an SVG.
 */

/** The art is drawn on a box this many units high, at any size. */
export const PRO_BADGE_ART_HEIGHT = 24

/**
 * Badge height per em of the text beside it. Nunito's capitals stand 0.705 em
 * above the baseline; a flat-topped pill beside round-topped letters reads
 * short at exactly that, so it is a touch taller and sits on the baseline —
 * which keeps its top level with the name's capitals however the name wraps.
 */
export const PRO_BADGE_EM = 0.75

/** Below this the word stops reading, whatever text it stands beside. */
export const PRO_BADGE_MIN = 10

/** At or under this height the strokes thicken, so the counters do not fill in. */
export const PRO_BADGE_SMALL = 12

/** Points high for a badge beside text of `fontSize` points. */
export function proBadgeHeight(fontSize: number): number {
  return Math.max(PRO_BADGE_MIN, Math.round(fontSize * PRO_BADGE_EM))
}

/** The space between a name and its badge: a quarter of the name's em. */
export function proBadgeGap(fontSize: number): number {
  return Math.round(fontSize * 0.25)
}

export interface ProBadgeArt {
  /** Units wide, on the 24-unit-high box. */
  width: number
  stroke: number
  /** The star, filled; its points are rounded by a stroke of `starRound`. */
  star: string
  starRound: number
  /** P and R, stroked with round caps. */
  letters: string
  /** O, stroked and closed. */
  o: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** The pill's own inset from the box: it is 22 units high, its ends half-circles. */
const INSET = 1
/** Pill edge to the star's tip; the O's side, being round, takes more. */
const LEAD = 5.6
const TAIL = 6
/** The star: points and waist from its centre, and the stroke that rounds it. */
const STAR_OUTER = 5.4
const STAR_INNER = 2.7
const STAR_ROUND = 1.2
/** Star ink to P's ink. */
const STAR_GAP = 2.6
/** Letter ink to letter ink. */
const TRACK = 1.7
/** The letters' stroke centrelines at the top and bottom of the capitals. */
const CAP_TOP = 7.6
const CAP_BOTTOM = 16.4
/** Where P's and R's bowls close, as a share of the capital's height. */
const BOWL_AT = 0.58
/** The straight run of P's and R's bowls before they turn. */
const BOWL_RUN = 2.2
/** O's centreline width. */
const O_WIDTH = 6

/**
 * A five-point star around (`cx`, `cy`). Its lower points stand nearer the
 * centre than its top one, so it is moved down by half the difference to sit
 * level with the word rather than above it.
 */
function starPath(cx: number, cy: number): string {
  const drop = (STAR_OUTER * (1 - Math.cos(Math.PI / 5))) / 2
  const points: string[] = []
  for (let k = 0; k < 10; k++) {
    const angle = -Math.PI / 2 + (k * Math.PI) / 5
    const radius = k % 2 === 0 ? STAR_OUTER : STAR_INNER
    points.push(`${r2(cx + radius * Math.cos(angle))} ${r2(cy + drop + radius * Math.sin(angle))}`)
  }
  return `M${points.join('L')}Z`
}

/**
 * The pill's star and word, for a badge `height` points high. Paths are on
 * stroke centrelines, so the stroke width moves them: the word is laid out
 * again for the thicker small cut rather than scaled.
 */
export function proBadgeArt(height: number): ProBadgeArt {
  const sw = height <= PRO_BADGE_SMALL ? 3.3 : 2.9
  const top = CAP_TOP
  const bottom = CAP_BOTTOM
  const mid = top + (bottom - top) * BOWL_AT
  const r = (mid - top) / 2

  // The star's side points lie at 18° below its centre's level, cos 18° out.
  const half = STAR_OUTER * Math.cos(Math.PI / 10)
  const cx = INSET + LEAD + STAR_ROUND / 2 + half
  const star = starPath(cx, PRO_BADGE_ART_HEIGHT / 2)

  const bowl = (x: number) =>
    `M${r2(x)} ${r2(bottom)}V${r2(top)}H${r2(x + BOWL_RUN)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + BOWL_RUN)} ${r2(mid)}H${r2(x)}`

  const p = cx + half + STAR_ROUND / 2 + STAR_GAP + sw / 2
  const rx = p + BOWL_RUN + r + sw + TRACK
  const leg = `M${r2(rx + BOWL_RUN - 0.2)} ${r2(mid)}L${r2(rx + BOWL_RUN + r + 0.3)} ${r2(bottom)}`
  const ox = rx + BOWL_RUN + r + 0.3 + sw + TRACK
  const oc = ox + O_WIDTH / 2
  const ory = (bottom - top) / 2
  const o =
    `M${r2(oc)} ${r2(top)}A${r2(O_WIDTH / 2)} ${r2(ory)} 0 0 1 ${r2(oc)} ${r2(bottom)}` +
    `A${r2(O_WIDTH / 2)} ${r2(ory)} 0 0 1 ${r2(oc)} ${r2(top)}Z`
  const end = ox + O_WIDTH + sw / 2

  return {
    width: r2(end + TAIL + INSET),
    stroke: sw,
    star,
    starRound: STAR_ROUND,
    letters: bowl(p) + bowl(rx) + leg,
    o,
  }
}

/** Points wide, for `art` drawn `height` points high. */
export function proBadgeWidth(art: ProBadgeArt, height: number): number {
  return r2((art.width * height) / PRO_BADGE_ART_HEIGHT)
}
