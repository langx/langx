/**
 * The chat camera's filters, as numbers only: no React Native, no Skia, so
 * the mobile vitest can load it (see `cameraZoom.ts`, the same split).
 *
 * Each filter is a 4×5 colour matrix in Skia's layout — row-major, one row
 * per output channel (R, G, B, A), four input weights then an offset, with
 * channels and offsets both in 0…1. The same matrix draws the preview and
 * bakes the photo that is sent, so what the person saw is what goes.
 *
 * The live viewfinder cannot use it: `expo-camera` hands no frames to
 * JavaScript, so a matrix has nothing to run on there. It gets `tint`
 * instead, a translucent colour laid over the picture — an approximation that
 * says which way the filter leans, never the transform itself.
 */

export type ColorMatrix = readonly number[]

export const CAMERA_FILTER_IDS = ['original', 'warm', 'cool', 'mono', 'vivid', 'film'] as const
export type CameraFilterId = (typeof CAMERA_FILTER_IDS)[number]

export const DEFAULT_CAMERA_FILTER: CameraFilterId = 'original'

/** Rec. 709 luma, the weights a grey made from colour is seen by. */
const LUMA = [0.2126, 0.7152, 0.0722] as const

// prettier-ignore
export const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
]

/**
 * `outer` applied after `inner`, as one matrix. Each is read as the top four
 * rows of a 5×5 whose last row is [0 0 0 0 1].
 */
export function concat(outer: ColorMatrix, inner: ColorMatrix): number[] {
  const out: number[] = []
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += (outer[row * 5 + k] ?? 0) * (inner[k * 5 + col] ?? 0)
      // The implicit fifth row of `inner` carries `outer`'s offset through.
      if (col === 4) sum += outer[row * 5 + 4] ?? 0
      out.push(sum)
    }
  }
  return out
}

/** 1 leaves colour alone, 0 is grey, above 1 is stronger colour. */
export function saturation(amount: number): number[] {
  const [r, g, b] = LUMA
  const rest = 1 - amount
  // prettier-ignore
  return [
    r * rest + amount, g * rest, b * rest, 0, 0,
    r * rest, g * rest + amount, b * rest, 0, 0,
    r * rest, g * rest, b * rest + amount, 0, 0,
    0, 0, 0, 1, 0,
  ]
}

/** Stretches (above 1) or squeezes (below 1) every channel about mid-grey. */
export function contrast(amount: number): number[] {
  const offset = (1 - amount) / 2
  // prettier-ignore
  return [
    amount, 0, 0, 0, offset,
    0, amount, 0, 0, offset,
    0, 0, amount, 0, offset,
    0, 0, 0, 1, 0,
  ]
}

/** Per-channel gain and lift: how a colour cast is put on. */
export function channels(
  gain: readonly [number, number, number],
  lift: readonly [number, number, number] = [0, 0, 0],
): number[] {
  // prettier-ignore
  return [
    gain[0], 0, 0, 0, lift[0],
    0, gain[1], 0, 0, lift[1],
    0, 0, gain[2], 0, lift[2],
    0, 0, 0, 1, 0,
  ]
}

export interface CameraFilter {
  id: CameraFilterId
  matrix: ColorMatrix
  /** Laid over the live viewfinder; null for none. */
  tint: string | null
}

export const CAMERA_FILTERS: readonly CameraFilter[] = [
  { id: 'original', matrix: IDENTITY, tint: null },
  {
    id: 'warm',
    matrix: concat(channels([1.08, 1.01, 0.86], [0.03, 0.01, -0.01]), saturation(1.05)),
    tint: 'rgba(255, 150, 50, 0.16)',
  },
  {
    id: 'cool',
    matrix: channels([0.9, 1, 1.08], [-0.01, 0.01, 0.05]),
    tint: 'rgba(60, 140, 255, 0.16)',
  },
  {
    id: 'mono',
    matrix: concat(contrast(1.1), saturation(0)),
    // A plain overlay cannot take colour out, only wash it; grey is the nearest.
    tint: 'rgba(128, 128, 128, 0.45)',
  },
  {
    id: 'vivid',
    matrix: concat(contrast(1.08), saturation(1.45)),
    // Nor can one add colour: a faint warm pink only says "more", not how much.
    tint: 'rgba(255, 70, 130, 0.08)',
  },
  {
    id: 'film',
    // Faded: the blacks lifted, the colour eased off, a little warmth on top.
    matrix: concat(
      channels([1, 1, 1], [0.03, 0.015, -0.01]),
      concat(contrast(0.82), saturation(0.75)),
    ),
    tint: 'rgba(240, 225, 200, 0.24)',
  },
]

export function cameraFilter(id: CameraFilterId): CameraFilter {
  return CAMERA_FILTERS.find((filter) => filter.id === id) ?? CAMERA_FILTERS[0]!
}

/** Nothing to bake: the photo goes as it was shot. */
export function isOriginal(id: CameraFilterId): boolean {
  return id === 'original'
}

/** Lighter than this and a swipe is a touch that wandered, unless it was flung. */
export const SWIPE_DISTANCE = 48
export const SWIPE_VELOCITY = 600

/**
 * `step` places on from `index` in a ring of `count`: past the last is the
 * first again, before the first is the last. The filters are a loop, as
 * Instagram's are, so no swipe ever meets an end that does nothing.
 */
export function wrapIndex(index: number, step: number, count: number): number {
  if (count <= 0) return 0
  // `%` keeps the sign of the left side in JavaScript; adding `count` first
  // turns -1 into the last place rather than -1.
  return (((index + step) % count) + count) % count
}

/**
 * Where a sideways swipe on the picture lands, as Instagram's: a swipe
 * towards the reading start (left, in English) is the next filter, the other
 * way the one before. One step per swipe, however long, and round the ends
 * (`wrapIndex`): after Film comes Original, before Original comes Film. In a
 * right-to-left language the strip runs the other way, and so does the swipe.
 */
export function filterIndexAfterSwipe({
  index,
  count,
  translationX,
  velocityX,
  rtl = false,
}: {
  index: number
  count: number
  translationX: number
  velocityX: number
  rtl?: boolean
}): number {
  const towardsEnd = rtl ? 1 : -1
  let direction = 0
  if (Math.abs(translationX) >= SWIPE_DISTANCE) direction = Math.sign(translationX)
  else if (Math.abs(velocityX) >= SWIPE_VELOCITY) direction = Math.sign(velocityX)
  if (direction === 0) return index
  return wrapIndex(index, direction === towardsEnd ? 1 : -1, count)
}
