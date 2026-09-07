import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import googleG from '../../assets/brand/google-g.svg'
import { useTheme } from '../lib/theme'

export type MarkProvider = 'google' | 'apple'

/**
 * A sign-in provider's own mark, 20px, in one place.
 *
 * Google's is the real four-path "G" from their branding guidelines, shipped
 * as an SVG asset rather than drawn: what stood here was four coloured squares
 * in a clipped circle, which is not Google's mark and does not read as one.
 * `expo-image` renders SVG on all three platforms and Metro already treats
 * `.svg` as an asset, so this costs no new native module — which matters,
 * because a native module could not reach a device over an OTA update.
 *
 * The file has no filters or gradients on purpose. Android decodes SVG through
 * `androidsvg`, which supports neither.
 *
 * Both marks are the providers' brand colours and stay fixed in both schemes —
 * only Apple's glyph follows `colors.text`, because Apple's guidance is that
 * the logo takes the label's colour.
 */
export function ProviderMark({ provider }: { provider: MarkProvider }) {
  const { colors } = useTheme()
  if (provider === 'apple') {
    return <Ionicons name="logo-apple" size={20} color={colors.text} />
  }
  return (
    <Image
      source={googleG}
      style={{ height: 20, width: 20 }}
      contentFit="contain"
      accessibilityElementsHidden
    />
  )
}
