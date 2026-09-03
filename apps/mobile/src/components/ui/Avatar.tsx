import { generatedAvatarUrl } from '@langx/shared'
import { Image } from 'expo-image'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { API_URL } from '../../lib/apiUrl'
// `layout` stays a direct import: it is scheme-independent, and a default
// parameter value is evaluated before any hook could have run.
import { frameColors, layout, makeStyles, useTheme, type ThemeColors } from '../../lib/theme'
import type { CosmeticTone } from '@langx/shared'

interface AvatarProps {
  url?: string | undefined
  name: string
  /**
   * The account's id. With it, an account that has uploaded nothing gets a
   * drawn face from the API rather than its initials — the same face on every
   * screen, because it is generated from this and nothing else.
   */
  seed?: string | undefined
  size?: number
  online?: boolean
  /** A cosmetic tone from `COSMETICS`. Omitted means no frame. */
  frame?: CosmeticTone | undefined
}

/**
 * Which of the three fills an avatar without a photo gets.
 *
 * Derived from the name so it is stable — the same person is the same colour on
 * every screen and across restarts — and deliberately decorative: these carry
 * no meaning, which is why they have no token of their own. v3 trims the cycle
 * to blue, green and ink; three fills break up a list without confetti.
 */
function avatarFill(colors: ThemeColors, name: string): string {
  const cycle = [colors.accent, colors.success, colors.ink]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return cycle[Math.abs(hash) % cycle.length] as string
}

/**
 * "Lucía M." → "LM": v3 initials are two letters, one per word. A single word
 * gives one letter rather than its first two — "Deniz" is D, not DE.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase())
  return letters.join('') || '?'
}

/**
 * A photo, or a face drawn for the account, or its initials — in that order.
 *
 * The initials used to be what a photoless account looked like, which in a
 * discovery list is a column of coloured squares with letters on them. They
 * are now only the fallback's fallback: no id to generate from, or a picture
 * that failed to load. Everything about that path — the three fills, the two
 * letters — is kept for exactly those cases.
 *
 * `expo-image` rather than react-native's `Image`, because the generated face
 * is an SVG and RN's own cannot draw one on iOS or Android.
 */
export function Avatar({
  url,
  name,
  seed,
  size = layout.avatar,
  online = false,
  frame,
}: AvatarProps) {
  const { colors, scheme } = useTheme()
  const styles = useStyles()
  const [failed, setFailed] = useState(false)
  const dimension = { borderRadius: size / 2, height: size, width: size }
  const fill = avatarFill(colors, name)

  /*
   * The uploaded photo wins. Below it the generated face, and only if both are
   * missing — or the image never arrived, which is what `failed` records — the
   * initials.
   */
  const source = url ?? (seed ? generatedAvatarUrl(API_URL, seed) : undefined)

  /*
   * The ring is a *wrapper*, not a border on the avatar itself.
   *
   * A `borderWidth` here would shrink the photo inside the same box and push
   * the online dot — which is positioned against this view at `bottom/end: 0` —
   * inwards by the ring's width. Wrapping keeps the inner view exactly `size`,
   * so every one of the fourteen call sites keeps the avatar it asked for and
   * the dot stays on the edge of the face rather than of the jewellery.
   *
   * Width scales with the avatar, floored at 2: leaderboard rows draw at 36px,
   * where a proportional ring would be a hairline nobody could name.
   */
  const ringWidth = frame ? Math.max(2, Math.round(size * 0.055)) : 0
  const inner = (
    // Sized rather than left to stretch: the online dot is positioned
    // absolutely against this view, and a parent with no dimensions of its own
    // fills the row instead, dropping the dot wherever that ends up.
    <View style={dimension}>
      {source && !failed ? (
        <Image
          source={{ uri: source }}
          style={[styles.image, dimension]}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.fallback, dimension, { backgroundColor: fill }]}>
          <Text
            style={[
              styles.initial,
              // The ink fill's contrast partner is the ground itself.
              { color: fill === colors.ink ? colors.bg : colors.textInverse },
              { fontSize: size * 0.34 },
            ]}
          >
            {initialsOf(name)}
          </Text>
        </View>
      )}
      {online ? <View style={styles.dot} /> : null}
    </View>
  )

  if (!frame) return inner
  return (
    <View
      style={{
        alignItems: 'center',
        borderColor: frameColors[scheme][frame],
        borderRadius: (size + ringWidth * 4) / 2,
        borderWidth: ringWidth,
        height: size + ringWidth * 4,
        justifyContent: 'center',
        width: size + ringWidth * 4,
      }}
    >
      {inner}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  image: { backgroundColor: colors.surface },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: font.heading.fontFamily, fontWeight: '800' },
  dot: {
    backgroundColor: colors.success,
    borderColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: 'absolute',
    end: 0,
    width: 12,
  },
}))
