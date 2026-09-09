import { View } from 'react-native'
import { makeStyles, radius } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * Geometry copied from `feed.tsx`'s row — author line, the sentence, and the
 * block under it.
 *
 * What that block is alternates with the index, as the chat's bubbles do: a
 * feed is a mix of plain sentences, ones with a photo and ones carrying a top
 * correction, and five identical cards read as a loading bar rather than as
 * the feed that is coming.
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

      <View style={styles.body}>
        <Skeleton width="100%" height={18} />
        <Skeleton width={shape === 1 ? '52%' : '78%'} height={18} />
      </View>

      {shape === 0 ? <Skeleton width="100%" height={150} radius={radius.md} /> : null}
      {shape === 2 ? <Skeleton width="100%" height={62} radius={radius.lg} /> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
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
