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
 * **A name this build does not know draws nothing, and keeps its space.** The
 * only way to get one is a server that is ahead of the app or behind it — the
 * picture is named by the catalogue and `badgeArt.test.ts` holds the two
 * together, so in-repo it cannot happen. A gap for the minutes a deploy takes
 * beats a fallback picture: every badge would fall back to the same one, and a
 * shelf of identical marks is what this whole change set out to end.
 *
 * **Locked is the same picture at a third of its opacity.** Not greyscale,
 * which is a filter, and Android decodes SVG through `androidsvg`, which has
 * none. Colour is still what earning it buys — there is simply no longer a
 * circle to drain, now that the picture is the mark.
 */
export function BadgeMark({
  icon,
  size,
  locked = false,
}: {
  icon: string | null
  size: number
  locked?: boolean
}) {
  const art = icon ? BADGE_ART[icon] : undefined
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
