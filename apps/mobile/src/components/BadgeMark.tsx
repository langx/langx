import { Image } from 'expo-image'
import { View } from 'react-native'
import { BADGE_ART } from '../lib/badgeArt'

/**
 * A badge's picture, at the size the screen asks for.
 *
 * `expo-image` renders SVG on all three platforms and Metro already treats
 * `.svg` as an asset, so this costs no new native module — the same reasoning
 * that put Google's mark on the sign-in screen, and the reason
 * `react-native-svg` is not here: a native module cannot reach a device over
 * an OTA update. See `docs/decisions.md`.
 *
 * **Found by `id`, never by anything the server chose.** The DTO also carries
 * an `icon`, and drawing from it is what put question marks on live profiles
 * the day these pictures shipped: an app older than the server was handed a
 * name its vector font had never heard of. An id is the badge's own name and
 * does not move, so what this build draws depends only on this build.
 *
 * **An id this build does not know draws nothing, and keeps its space.** That
 * is a badge added after this version shipped, and the honest answer is a gap:
 * a fallback picture would give every unknown badge the same face, which is
 * the thing the drawings were introduced to end.
 *
 * **Locked is the same picture at a third of its opacity.** Not greyscale,
 * which is a filter, and Android decodes SVG through `androidsvg`, which has
 * none. Colour is still what earning it buys — there is simply no longer a
 * circle to drain, now that the picture is the mark.
 */
export function BadgeMark({
  id,
  size,
  locked = false,
}: {
  id: string
  size: number
  locked?: boolean
}) {
  const art = BADGE_ART[id]
  if (!art) return <View style={{ height: size, width: size }} />

  return (
    <Image
      source={art}
      style={{ height: size, opacity: locked ? 0.3 : 1, width: size }}
      contentFit="contain"
      accessibilityElementsHidden
    />
  )
}
