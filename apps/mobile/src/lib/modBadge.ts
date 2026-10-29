/**
 * The v3 MOD badge's geometry: a shield and MOD on PRO's pill. Pure numbers,
 * as `proBadge.ts` is, and from its measures — the same box, capitals, stroke
 * and O — so beside PRO the two read as one set rather than a badge and a tag.
 */
import {
  badgeO,
  badgeStroke,
  CAP_BOTTOM,
  CAP_TOP,
  INSET,
  LEAD,
  O_WIDTH,
  PRO_BADGE_ART_HEIGHT,
  r2,
  TAIL,
  TRACK,
} from './proBadge'

export interface ModBadgeArt {
  /** Units wide, on the 24-unit-high box. */
  width: number
  stroke: number
  /** The shield, filled; its corners are rounded by a stroke of `shieldRound`. */
  shield: string
  shieldRound: number
  /** M and D, stroked with round caps. */
  letters: string
  /** O, stroked and closed — PRO's. */
  o: string
}

/**
 * The shield is Settings' Moderation glyph, Feather's, at half its 20-unit
 * height: shoulders three twentieths of the way down, the sides curving into the
 * point from its middle. About the star's size, so the pills match.
 */
const SHIELD_HALF_WIDTH = 4.2
const SHIELD_HALF_HEIGHT = 5
const SHIELD_ROUND = 1.2
/** Shield ink to M's ink, as PRO's star to its P. */
const SHIELD_GAP = 2.6
/** M's centreline width, and how far down its middle comes. */
const M_WIDTH = 7.4
const M_VERTEX_AT = 0.62
/** D's straight run along the top and bottom before its bowl turns. */
const D_RUN = 1.4

/**
 * A shield around (`cx`, `cy`), written as M, C and L to points only — no
 * H or V — so every number pairs up as an x and a y.
 */
function shieldPath(cx: number, cy: number): string {
  const w = SHIELD_HALF_WIDTH
  const top = cy - SHIELD_HALF_HEIGHT
  const tip = cy + SHIELD_HALF_HEIGHT
  const shoulder = top + SHIELD_HALF_HEIGHT * 0.3
  const pull = cy + SHIELD_HALF_HEIGHT * 0.6
  const p = (x: number, y: number) => `${r2(x)} ${r2(y)}`
  return (
    `M${p(cx, tip)}C${p(cx, tip)} ${p(cx + w, pull)} ${p(cx + w, cy)}` +
    `L${p(cx + w, shoulder)}L${p(cx, top)}L${p(cx - w, shoulder)}L${p(cx - w, cy)}` +
    `C${p(cx - w, pull)} ${p(cx, tip)} ${p(cx, tip)}Z`
  )
}

/** The pill's shield and word, for a badge `height` points high. */
export function modBadgeArt(height: number): ModBadgeArt {
  const sw = badgeStroke(height)
  const top = CAP_TOP
  const bottom = CAP_BOTTOM
  const r = (bottom - top) / 2

  const cx = INSET + LEAD + SHIELD_ROUND / 2 + SHIELD_HALF_WIDTH
  const shield = shieldPath(cx, PRO_BADGE_ART_HEIGHT / 2)

  const m = cx + SHIELD_HALF_WIDTH + SHIELD_ROUND / 2 + SHIELD_GAP + sw / 2
  const vertex = top + (bottom - top) * M_VERTEX_AT
  const mPath =
    `M${r2(m)} ${r2(bottom)}V${r2(top)}L${r2(m + M_WIDTH / 2)} ${r2(vertex)}` +
    `L${r2(m + M_WIDTH)} ${r2(top)}V${r2(bottom)}`

  const ox = m + M_WIDTH + sw + TRACK
  const dx = ox + O_WIDTH + sw + TRACK
  const dPath =
    `M${r2(dx)} ${r2(top)}H${r2(dx + D_RUN)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(dx + D_RUN)} ${r2(bottom)}H${r2(dx)}Z`
  const end = dx + D_RUN + r + sw / 2

  return {
    width: r2(end + TAIL + INSET),
    stroke: sw,
    shield,
    shieldRound: SHIELD_ROUND,
    letters: mPath + dPath,
    o: badgeO(ox),
  }
}
