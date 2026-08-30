import { Image, Text, View } from 'react-native'
// `layout` stays a direct import: it is scheme-independent, and a default
// parameter value is evaluated before any hook could have run.
import { layout, makeStyles, useTheme, type ThemeColors } from '../../lib/theme'

interface AvatarProps {
  url?: string | undefined
  name: string
  size?: number
  online?: boolean
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
 * Falls back to an initial rather than a broken image or a grey square: most
 * accounts in a fresh install have no avatar, and a wall of identical grey
 * squares makes a discovery list unreadable.
 */
export function Avatar({ url, name, size = layout.avatar, online = false }: AvatarProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const dimension = { borderRadius: size / 2, height: size, width: size }
  const fill = avatarFill(colors, name)

  return (
    // Sized rather than left to stretch: the online dot is positioned
    // absolutely against this view, and a parent with no dimensions of its own
    // fills the row instead, dropping the dot wherever that ends up.
    <View style={dimension}>
      {url ? (
        <Image source={{ uri: url }} style={[styles.image, dimension]} />
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
