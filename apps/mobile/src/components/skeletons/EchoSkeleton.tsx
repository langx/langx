import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

const STATS = ['a', 'b', 'c']

/**
 * The Echo tab's stage before its summary: the tile you press and the two lines
 * under it.
 *
 * The tile is the "cards due" one — 160 wide, the 40 radius, and the 8 of shade
 * it stands on — because that is the stage somebody with a deck sees. The stage
 * is centred in the space the tab has, so the resting tile (a circle of the
 * same width) lands within a few points of the same place.
 */
export function EchoStageSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.stage}>
      <View style={styles.tileShade}>
        <Skeleton width={160} height={160} radius={40} />
      </View>
      <View style={styles.caption}>
        <View style={styles.titleLine}>
          <Skeleton width={176} height={20} />
        </View>
        <View style={styles.subLine}>
          <Skeleton width={152} height={15} />
        </View>
      </View>
    </View>
  )
}

/** The strip of three numbers under the stage: Today, This week, Cards. */
export function EchoStatsSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.stats}>
      {STATS.map((key) => (
        <View key={key} style={styles.stat}>
          <View style={styles.statValue}>
            <Skeleton width={32} height={20} />
          </View>
          <View style={styles.statLabel}>
            <Skeleton width={56} height={12} />
          </View>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  stage: { alignItems: 'center', gap: spacing.xl },
  // The tab's tile stands on a hard shade 8 tall.
  tileShade: { paddingBottom: 8 },
  caption: { alignItems: 'center', gap: spacing.xs },
  // The caption's lines: the heading's 20 on a 27 line, the sub's 15 on a 22.
  titleLine: { height: 27, justifyContent: 'center' },
  subLine: { height: 22, justifyContent: 'center' },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  stat: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: spacing.md },
  // The numeral's line (20pt heading) and the label's (12pt caption).
  statValue: { height: 27, justifyContent: 'center' },
  statLabel: { height: 15, justifyContent: 'center' },
}))
