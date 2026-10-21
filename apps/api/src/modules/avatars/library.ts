import type { DefaultAvatarPool } from '@langx/shared'
import { loadAsset } from '../../lib/assets'

/**
 * One step in drawing a face: a part, painted with the attributes the master
 * sheet gave it (a hair colour, a skin tone, a beard's opacity), or a group
 * that sets `color` for the eyes, brows and mouth inside it.
 */
export type FaceLayer =
  | {
      part: string
      fill?: string
      color?: string
      stroke?: string
      opacity?: string
      'stroke-width'?: string
      'stroke-linecap'?: string
    }
  | { color: string; layers: { part: string }[] }

export interface Face {
  /** W01…N48, as on the master sheet. */
  id: string
  pool: DefaultAvatarPool
  /** S1 (porcelain) … S6 (cocoa); counted by the tests, not used to draw. */
  skin: string
  layers: FaceLayer[]
}

export interface AvatarLibrary {
  faces: Face[]
  /** Part name → its inner SVG, every `<use>` already inlined. */
  parts: Map<string, string>
}

const PARTS_DIR = 'avatars/parts'

/** The soft shape behind the head; one per face, in sheet order. */
export const AVATAR_SHAPES = ['s-sun', 's-wave', 's-hill', 's-leaf'] as const

/** The ground textures, drawn at 96px and up only. */
export const AVATAR_TEXTURES = ['t-lino', 't-felt', 't-stitch'] as const

/** The wrapper every part file carries so it opens on its own in a viewer. */
const WRAPPER = /^<svg[^>]*>([\s\S]*)<\/svg>\s*$/

/** Every part a face names, plus the shapes and textures behind them. */
export function partNames(faces: Face[]): string[] {
  const names = new Set<string>([...AVATAR_SHAPES, ...AVATAR_TEXTURES])
  for (const face of faces) {
    for (const layer of face.layers) {
      if ('layers' in layer) for (const inner of layer.layers) names.add(inner.part)
      else names.add(layer.part)
    }
  }
  return [...names].sort()
}

let library: Promise<AvatarLibrary> | null = null

/**
 * Read once per process: about a hundred small files and one manifest,
 * ~120KB in all. Kept as a promise so two first requests arriving together
 * read it once, and dropped on failure so a missing file is retried rather
 * than cached as an error for the life of the process.
 */
export function loadAvatarLibrary(): Promise<AvatarLibrary> {
  library ??= readLibrary().catch((error: unknown) => {
    library = null
    throw error
  })
  return library
}

async function readLibrary(): Promise<AvatarLibrary> {
  const faces = JSON.parse(
    (await loadAsset('avatars/faces.json', 'Avatar faces')).toString(),
  ) as Face[]
  const parts = new Map<string, string>()
  await Promise.all(
    partNames(faces).map(async (name) => {
      const svg = (await loadAsset(`${PARTS_DIR}/${name}.svg`, 'Avatar part')).toString()
      const inner = WRAPPER.exec(svg)?.[1]
      if (inner === undefined) throw new Error(`Avatar part is not a bare <svg>: ${name}`)
      parts.set(name, inner)
    }),
  )
  return { faces, parts }
}
