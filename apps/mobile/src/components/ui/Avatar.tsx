import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { PixelRatio, Text, View } from 'react-native'
import { useV3Home } from '../../hooks/useV3Home'
import { API_URL } from '../../lib/apiUrl'
import { avatarSource } from '../../lib/defaultAvatar'
import { v3HomeLatched } from '../../lib/v3Home'
import { artForTone } from '../../lib/frameArt/palettes'
// `layout` stays a direct import: it is scheme-independent, and a default
// parameter value is evaluated before any hook could have run.
import { frameColor, layout, makeStyles, useTheme, type ThemeColors } from '../../lib/theme'
import { FrameArt, frameArtBox, type FrameSweepComponent } from './FrameArt'

interface AvatarProps {
  url?: string | undefined
  name: string
  /**
   * The account's id. With it, an account that has uploaded nothing gets a
   * drawn face from the API rather than its initials — the same face on every
   * screen, because it is generated from this and nothing else.
   */
  seed?: string | undefined
  /**
   * Names the drawn face (`defaultAvatarRev` on the DTOs), so the v3 picture
   * is cached for good and a list can keep two equal faces apart — see
   * `dedupeGrounds`. Without it the server looks the face up from `seed`.
   * Ignored with the flag off and whenever there is a photo.
   */
  defaultAvatarRev?: string | undefined
  /** Caps the drawn face's pixels; see `avatarSource`. For grids of many faces. */
  maxPixels?: number | undefined
  size?: number
  online?: boolean
  /**
   * A cosmetic tone from `COSMETICS`. Omitted means no frame. A plain string
   * because a tone can come from the API, and one this build does not know
   * draws an ink ring — see `frameColor`.
   */
  frame?: string | undefined
  /**
   * Aurora Glass's light sweep (`FrameSweep`), passed only where you look at
   * your own profile (the Me hero, and the profile screen as yourself). Ignored by every other frame, at the small cuts
   * and with the flag off.
   */
  sweep?: FrameSweepComponent | undefined
  /**
   * Where a frame may draw outside the face's box instead of growing it.
   * `vertical` keeps a framed avatar's height at `size`, so a band or a card
   * is as tall framed as not, while the frame still takes its room beside
   * the face; `all` keeps the whole layout at `size`, for a slot whose
   * neighbours leave the room. Omitted, the frame grows the box.
   */
  frameOverflow?: 'all' | 'vertical' | undefined
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
 * is an SVG and RN's own cannot draw one on iOS or Android. (The v3 face is a
 * PNG, which either could; expo-image stays for its disk cache.)
 */
export function Avatar({
  url,
  name,
  seed,
  defaultAvatarRev,
  maxPixels,
  size = layout.avatar,
  online = false,
  frame,
  sweep,
  frameOverflow,
}: AvatarProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const [failed, setFailed] = useState(false)
  const dimension = { borderRadius: size / 2, height: size, width: size }
  const fill = avatarFill(colors, name)

  /*
   * The uploaded photo wins. Below it the generated face, and only if both are
   * missing — or the image never arrived, which is what `failed` records — the
   * initials.
   *
   * Under `flags.v3Home` the face is v3's drawn portrait, a PNG sized for this
   * screen. The flag is read from the launch latch, not `useV3Home`: a hook
   * here would be a config subscription per face in every list.
   */
  const source = avatarSource({
    url,
    seed,
    size,
    rev: defaultAvatarRev,
    v3: v3HomeLatched(),
    pixelRatio: PixelRatio.get(),
    apiBase: API_URL,
    maxPixels,
  })

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
    <Framed frame={frame} size={size} sweep={sweep} overflow={frameOverflow}>
      {inner}
    </Framed>
  )
}

/**
 * The face inside its frame: art from the master sheet under `flags.v3Home`,
 * today's ring otherwise — and the ring, too, for a tone this build has no art
 * for, which `frameColor` then draws in ink.
 *
 * Its own component so that only a framed avatar reads the flag. Most avatars
 * wear nothing, and a list of them should not each subscribe to the config.
 */
function Framed({
  frame,
  size,
  sweep,
  overflow,
  children,
}: {
  frame: string
  size: number
  sweep: FrameSweepComponent | undefined
  overflow: AvatarProps['frameOverflow']
  children: ReactNode
}) {
  const { scheme } = useTheme()
  const v3Home = useV3Home()
  const art = v3Home ? artForTone(frame) : undefined

  if (art) {
    const box = frameArtBox(size)
    return (
      <View
        style={{
          alignItems: 'center',
          height: box,
          justifyContent: 'center',
          width: box,
          ...overflowMargin(overflow, (box - size) / 2),
        }}
      >
        <FrameArt art={art} size={size} scheme={scheme} sweep={sweep} />
        {children}
      </View>
    )
  }

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
  const ringWidth = Math.max(2, Math.round(size * 0.055))
  return (
    <View
      style={{
        alignItems: 'center',
        borderColor: frameColor(scheme, frame),
        borderRadius: (size + ringWidth * 4) / 2,
        borderWidth: ringWidth,
        height: size + ringWidth * 4,
        justifyContent: 'center',
        width: size + ringWidth * 4,
        ...overflowMargin(overflow, ringWidth * 2),
      }}
    >
      {children}
    </View>
  )
}

/** The negative margin that lets a frame of `spill` per side draw past the face's box. */
function overflowMargin(overflow: AvatarProps['frameOverflow'], spill: number) {
  if (overflow === 'all') return { margin: -spill }
  if (overflow === 'vertical') return { marginVertical: -spill }
  return {}
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
