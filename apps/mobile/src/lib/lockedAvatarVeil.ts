/**
 * How a locked viewer's face is hidden on each platform (`ViewersScreenV3`).
 *
 * The face on a locked row is never the viewer's — the server sends no avatar
 * and keys the row by its own id — but a drawn face drawn sharp still reads as
 * a person you could recognise, so it must look withheld everywhere.
 *
 * - `ios`: expo-blur's `BlurView` over the face. UIKit blurs what is behind it.
 * - `android`: the picture itself is blurred (expo-image's `blurRadius`).
 *   expo-blur on Android only blurs a `BlurTargetView` it is pointed at; over
 *   a plain row it draws its tint and nothing else, which is how the faces
 *   went out sharp. expo-image's Android blur is a Glide transform capped at
 *   radius 25 on a 4× downsample, so 25 is its strongest, and on a 48pt face
 *   that is a smear of colour.
 * - `web`: a flat scrim; see `viewers.tsx` for why `backdrop-filter` is not
 *   trusted there.
 *
 * Pure, with the platform passed in, so vitest can run it.
 */
export type LockedAvatarVeil =
  | { kind: 'none' }
  | { kind: 'blurView' }
  | { kind: 'blurImage'; blurRadius: number }
  | { kind: 'flat' }

export const ANDROID_LOCKED_BLUR_RADIUS = 25

export function lockedAvatarVeil(platform: string, locked: boolean): LockedAvatarVeil {
  if (!locked) return { kind: 'none' }
  if (platform === 'web') return { kind: 'flat' }
  if (platform === 'ios') return { kind: 'blurView' }
  // Android, and anything else that is not known to blur behind a view.
  return { kind: 'blurImage', blurRadius: ANDROID_LOCKED_BLUR_RADIUS }
}
