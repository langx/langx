import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

const TILES = ['a', 'b', 'c']

/**
 * A profile before its data: the hero, the row of numbers under it, and the
 * bio.
 *
 * Both profile screens draw this — your own tab and somebody else's page —
 * with the avatar each of them uses, which is the only measurement they do not
 * share. What follows the bio differs (a chart here, a gallery there) and is
 * left out: a placeholder for a section that may not exist moves the screen
 * when the real one arrives.
 */
export function ProfileSkeleton({ avatarSize }: { avatarSize: number }) {
  const styles = useStyles()

  return (
    <View>
      <View style={styles.hero}>
        <Skeleton width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
        <View style={styles.heroText}>
          <Skeleton width={172} height={24} />
          <Skeleton width={128} height={14} />
          <Skeleton width={148} height={13} />
        </View>
      </View>

      <View style={styles.stats}>
        {TILES.map((key) => (
          <View key={key} style={styles.tile}>
            <Skeleton width={42} height={26} />
            <Skeleton width={64} height={13} />
          </View>
        ))}
      </View>

      <View style={styles.bio}>
        <Skeleton width="100%" height={16} />
        <Skeleton width="92%" height={16} />
        <Skeleton width="45%" height={16} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  bio: { gap: 10, paddingBottom: 18, paddingTop: 22 },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 20 },
  heroText: { flex: 1, gap: spacing.xs },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 20,
  },
  tile: { flex: 1, gap: spacing.xs },
}))
