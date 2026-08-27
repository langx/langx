import { Image, StyleSheet, Text, View } from 'react-native'
import { colors, layout, radius } from '../../lib/theme'

interface AvatarProps {
  url?: string | undefined
  name: string
  size?: number
  online?: boolean
}

/**
 * Falls back to an initial rather than a broken image or a grey square: most
 * accounts in a fresh install have no avatar, and a wall of identical grey
 * squares makes a discovery list unreadable.
 */
export function Avatar({ url, name, size = layout.avatar, online = false }: AvatarProps) {
  const dimension = { borderRadius: size / 2, height: size, width: size }

  return (
    <View>
      {url ? (
        <Image source={{ uri: url }} style={[styles.image, dimension]} />
      ) : (
        <View style={[styles.fallback, dimension]}>
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
      {online ? <View style={styles.dot} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface },
  fallback: { alignItems: 'center', backgroundColor: colors.surface, justifyContent: 'center' },
  initial: { color: colors.textMuted, fontWeight: '700' },
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
})
