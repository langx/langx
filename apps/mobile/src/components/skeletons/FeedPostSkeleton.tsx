import { View } from 'react-native'
import { makeStyles, radius } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * Geometry copied from `feed.tsx`'s card — author line, the ask badges, the
 * sentence, the block under it, and the action row every card now has.
 *
 * What that block is alternates with the index, as the chat's bubbles do: the
 * timeline mixes photo moments drawn full width, plain sentences, and asks
 * carrying a top correction, and five identical cards read as a loading bar
 * rather than as the feed that is coming. Only the asks wear a badge line.
 */
export function FeedPostSkeleton({ index }: { index: number }) {
  const styles = useStyles()

  const shape = index % 3
  return (
    <View style={styles.row}>
      <View style={styles.who}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={styles.whoText}>
          <Skeleton width={124} height={15} />
          <Skeleton width={92} height={13} style={styles.metaGap} />
        </View>
      </View>

      {shape === 0 ? null : <Skeleton width={120} height={12} />}

      <View style={styles.body}>
        <Skeleton width="100%" height={18} />
        <Skeleton width={shape === 1 ? '52%' : '78%'} height={18} />
      </View>

      {shape === 0 ? <Skeleton width="100%" height={260} radius={radius.md} /> : null}
      {shape === 2 ? <Skeleton width="100%" height={62} radius={radius.lg} /> : null}

      <View style={styles.actions}>
        <Skeleton width={44} height={16} />
        <Skeleton width={96} height={16} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  actions: { flexDirection: 'row', gap: 18 },
  body: { gap: spacing.sm },
  metaGap: { marginTop: spacing.xs },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 14,
    paddingVertical: 22,
  },
  who: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  whoText: { flex: 1 },
}))
