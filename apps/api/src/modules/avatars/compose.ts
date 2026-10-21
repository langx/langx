import { DEFAULT_AVATAR_GROUNDS, defaultAvatarCutFor, type DefaultAvatarCut } from '@langx/shared'
import {
  AVATAR_SHAPES,
  AVATAR_TEXTURES,
  type AvatarLibrary,
  type Face,
  type FaceLayer,
} from './library'

/**
 * How much larger the figure is drawn in the `small` cut, pivoting on the
 * face. In a chat row at 40pt the shoulders are what you see least and the
 * eyes are what you need; the extra scale spends the shoulders' pixels on the
 * face.
 */
const SMALL_SCALE = 1.15

const ATTRS = ['fill', 'color', 'stroke', 'opacity', 'stroke-width', 'stroke-linecap'] as const

function part(lib: AvatarLibrary, name: string): string {
  const svg = lib.parts.get(name)
  if (svg === undefined) throw new Error(`Unknown avatar part: ${name}`)
  return svg
}

function drawLayer(lib: AvatarLibrary, layer: FaceLayer): string {
  if ('layers' in layer) {
    return `<g color="${layer.color}">${layer.layers.map((inner) => part(lib, inner.part)).join('')}</g>`
  }
  const attrs = ATTRS.filter((name) => layer[name] !== undefined)
    .map((name) => ` ${name}="${layer[name]}"`)
    .join('')
  // A part without attributes is drawn as it is; wrapping it in a bare <g>
  // would only grow every SVG for nothing.
  return attrs ? `<g${attrs}>${part(lib, layer.part)}</g>` : part(lib, layer.part)
}

/** 0-based position in its pool on the sheet (W01 → 0), which fixes shape and texture. */
function positionOf(face: Face): number {
  return Number(face.id.slice(1)) - 1
}

export interface ComposeInput {
  face: Face
  /** Index into `DEFAULT_AVATAR_GROUNDS`. */
  ground: number
  /** The pixel size the SVG is written for. */
  size: number
  /**
   * Which of the three cuts to draw. Defaults to the cut for `size` taken as
   * points, which is right for a 1x consumer such as an email; the app passes
   * the cut for the size it *displays*, since a 40pt row on a 3x screen asks
   * for 160 pixels and still wants the small cut.
   */
  cut?: DefaultAvatarCut
}

/**
 * One face on one ground, as an SVG string, clipped to a disc.
 *
 * Pure: the same input is the same bytes, which is what lets the PNG behind
 * it be cached on the URL alone. Three cuts from one drawing — textured,
 * flat, and flat with a larger figure (see `defaultAvatarCutFor`) — because
 * what reads at 160pt is noise at 40.
 */
export function composeSvg(
  lib: AvatarLibrary,
  { face, ground, size, cut = defaultAvatarCutFor(size) }: ComposeInput,
): string {
  const fill = DEFAULT_AVATAR_GROUNDS[ground]
  if (fill === undefined) throw new Error(`Unknown avatar ground: ${ground}`)
  const position = positionOf(face)
  // Shape and texture belong to the face, not the viewer, so a face looks the
  // same on every ground; consecutive faces differ, as on the sheet.
  const shape = part(lib, AVATAR_SHAPES[position % AVATAR_SHAPES.length] ?? 's-sun')
  const texture =
    cut === 'full' ? part(lib, AVATAR_TEXTURES[position % AVATAR_TEXTURES.length] ?? 't-lino') : ''
  const figure = face.layers.map((layer) => drawLayer(lib, layer)).join('')
  const scaled =
    cut === 'small'
      ? `<g transform="translate(60 54) scale(${SMALL_SCALE}) translate(-60 -54)">${figure}</g>`
      : figure
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">` +
    `<defs><clipPath id="disc"><circle cx="60" cy="60" r="60"/></clipPath></defs>` +
    `<g clip-path="url(#disc)"><rect width="120" height="120" fill="${fill}"/>${shape}${texture}${scaled}</g>` +
    `</svg>`
  )
}

/** The face at `index` (1-based) in `pool`, or undefined. */
export function findFace(lib: AvatarLibrary, pool: string, index: number): Face | undefined {
  return lib.faces.find((face) => face.id === `${pool}${String(index).padStart(2, '0')}`)
}
