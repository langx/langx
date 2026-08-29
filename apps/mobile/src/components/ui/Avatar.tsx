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
 * Which of the four fills an avatar without a photo gets.
 *
 * Derived from the name so it is stable — the same person is the same colour on
 * every screen and across restarts — and deliberately decorative: these carry
 * no meaning, which is why they have no token of their own and why `pro` here
 * does not imply a subscription. Four colours is enough to break up a list
 * without turning it into confetti.
 */
function avatarFill(colors: ThemeColors, name: string): string {
  const cycle = [colors.accent, colors.pro, colors.secondary, colors.success]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return cycle[Math.abs(hash) % cycle.length] as string
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

  return (
    <View>
      {url ? (
        <Image source={{ uri: url }} style={[styles.image, dimension]} />
      ) : (
        <View style={[styles.fallback, dimension, { backgroundColor: avatarFill(colors, name) }]}>
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
            {name.trim().charAt(0).toUpperCase() || '?'}
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
  initial: { color: colors.textInverse, fontFamily: font.heading.fontFamily, fontWeight: '700' },
  dot: {
    backgroundColor: colors.success,
    borderColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: 'absolute',
    right: 0,
    width: 12,
  },
}))
