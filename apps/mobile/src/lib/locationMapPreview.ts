import { LOCATION_PRECISION_DECIMALS, type SharedLocationPrecision } from '@langx/shared'

/**
 * The map above a shared location: whether this binary can draw one, and what
 * it draws.
 *
 * Pure on purpose — no `react-native`, no `expo-maps` — so the vitest run can
 * reach it. `LocationMapPreview.tsx` reads the native facts and passes them in.
 */

export interface MapPreviewEnvironment {
  os: string
  /**
   * Whether expo-maps' native modules are in this binary. An over-the-air
   * update carries the JS to every install on the same runtime version, and a
   * development client or Expo Go built before the module was added has the
   * JS without the native half — importing `expo-maps` there throws.
   */
  hasNativeMaps: boolean
  /**
   * iOS only: `ExpoAppleMaps.isMapsAvailable`. The view is SwiftUI's `Map`,
   * which needs iOS 17; below that it mounts and draws nothing, which is a
   * blank rectangle in the bubble rather than a map.
   */
  appleMapsUsable: boolean
  /**
   * Android only: whether the build was given a Google Maps key
   * (`extra.googleMapsAndroid`, set by `app.config.ts`). Without one the Maps
   * SDK throws the moment a map view initialises, which takes the app down.
   */
  androidKeyConfigured: boolean
}

/** Whether to draw a map, or keep the card this build had before it. */
export function canShowMapPreview(env: MapPreviewEnvironment): boolean {
  if (!env.hasNativeMaps) return false
  if (env.os === 'ios') return env.appleMapsUsable
  if (env.os === 'android') return env.androidKeyConfigured
  // The web, and anything else: there is no native map to draw.
  return false
}

/** Metres in one degree of latitude — close enough everywhere for a drawing. */
const METRES_PER_DEGREE = 111_320

/**
 * One step of discovery's grid, north-south, in metres: about 1.1 km at two
 * decimals. An approximate point is the grid point the server rounded to, and
 * the real one lies within half a step of it in each direction, so a circle
 * this wide contains it wherever it was — and says "about a kilometre" the way
 * the card's kicker does.
 */
export const APPROXIMATE_RADIUS_METRES = METRES_PER_DEGREE * 10 ** -LOCATION_PRECISION_DECIMALS

export interface MapPreviewShape {
  zoom: number
  /** A pin at the point. Exact only: a pin says "here", which approximate is not. */
  pin: boolean
  /** A translucent circle around the point. Approximate only. */
  radiusMetres?: number
}

/**
 * What the preview draws. Exact is a pin at street level. Approximate is the
 * circle with no pin, zoomed out far enough that the whole circle fits the
 * bubble — a pin in its middle would point at a grid point the sender may be
 * half a kilometre from, which is the precision the rounding took away.
 */
export function mapPreviewShape(precision: SharedLocationPrecision): MapPreviewShape {
  return precision === 'approximate'
    ? { zoom: 12, pin: false, radiusMetres: APPROXIMATE_RADIUS_METRES }
    : { zoom: 15, pin: true }
}
