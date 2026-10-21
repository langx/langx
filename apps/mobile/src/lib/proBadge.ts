/**
 * The v3 PRO badge's geometry: how big it is beside a given text, and the
 * paths of its word. Pure numbers, no React Native, so both are tested on
 * their own; `ProBadge` only paints what this returns.
 *
 * The badge is an ink tablet with PRO drawn in a monoline stroke — drawn, not
 * set in a font, so it is the same shape on iOS, Android and the web and does
 * not depend on Nunito having loaded inside an SVG.
 */

/** The art is drawn on a box this many units high, at any size. */
export const PRO_BADGE_ART_HEIGHT = 24

/**
 * Badge height per em of the text beside it. Nunito's capitals stand 0.705 em
 * above the baseline; a flat-topped tablet beside round-topped letters reads
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
  /** P and R, stroked with round caps. */
  letters: string
  /** O, stroked and closed. */
  o: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Tablet edge to letter ink, both sides. */
const PAD = 4.6
/** Letter ink to letter ink. */
const TRACK = 1.5
/** The letters' stroke centrelines at the top and bottom of the capitals. */
const CAP_TOP = 8.2
const CAP_BOTTOM = 15.8
/** The straight run of P's and R's bowls before they turn. */
const BOWL_RUN = 1.9
/** O's centreline width. */
const O_WIDTH = 5

/**
 * The tablet and its word, for a badge `height` points high. Paths are on
 * stroke centrelines, so the stroke width moves them: the word is laid out
 * again for the thicker small cut rather than scaled.
 */
export function proBadgeArt(height: number): ProBadgeArt {
  const sw = height <= PRO_BADGE_SMALL ? 3.4 : 3.1
  const top = CAP_TOP
  const bottom = CAP_BOTTOM
  const mid = top + (bottom - top) * 0.56
  const r = (mid - top) / 2

  const bowl = (x: number) =>
    `M${r2(x)} ${r2(bottom)}V${r2(top)}H${r2(x + BOWL_RUN)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + BOWL_RUN)} ${r2(mid)}H${r2(x)}`

  const p = 1 + PAD + sw / 2
  const rx = p + BOWL_RUN + r + sw + TRACK
  const leg = `M${r2(rx + BOWL_RUN - 0.2)} ${r2(mid)}L${r2(rx + BOWL_RUN + r + 0.2)} ${r2(bottom)}`
  const ox = rx + BOWL_RUN + r + 0.2 + sw + TRACK
  const oc = ox + O_WIDTH / 2
  const ory = (bottom - top) / 2
  const o =
    `M${r2(oc)} ${r2(top)}A${r2(O_WIDTH / 2)} ${r2(ory)} 0 0 1 ${r2(oc)} ${r2(bottom)}` +
    `A${r2(O_WIDTH / 2)} ${r2(ory)} 0 0 1 ${r2(oc)} ${r2(top)}Z`
  const end = ox + O_WIDTH + sw / 2

  return { width: r2(end + PAD + 1), stroke: sw, letters: bowl(p) + bowl(rx) + leg, o }
}

/** Points wide, for `art` drawn `height` points high. */
export function proBadgeWidth(art: ProBadgeArt, height: number): number {
  return r2((art.width * height) / PRO_BADGE_ART_HEIGHT)
}
