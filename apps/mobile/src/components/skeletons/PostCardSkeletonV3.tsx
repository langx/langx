import { View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { BUTTON_FACE } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'

/**
 * A v3 post card (`posts/PostCard`) before it has arrived: the same block,
 * radius and padding, with the author line, the chip, the words, the like and
 * the one big button where the card puts them.
 *
 * The plain 240 pt grey slabs it replaces were the right height and the wrong
 * thing — a loading bar three times over. What the middle holds alternates
 * with the index, as `FeedPostSkeleton` does for the current card: an ask's
 * sentence set big, a moment's picture, a moment's few lines.
 */
export function PostCardSkeletonV3({ index }: { index: number }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const shape = index % 3

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Skeleton width={40} height={40} radius={v3.radius.pill} />
        <View style={styles.headText}>
          <Skeleton width={124} height={15} />
          <Skeleton width={92} height={12} />
        </View>
        <Skeleton width={64} height={28} radius={v3.radius.pill} />
      </View>

      {shape === 0 ? (
        <View style={styles.lines}>
          <Skeleton width="58%" height={16} />
          <Skeleton width="86%" height={30} />
        </View>
      ) : shape === 1 ? (
        <View style={styles.lines}>
          <Skeleton width="100%" height={16} />
          <Skeleton width="64%" height={16} />
          <Skeleton width="100%" height={200} radius={v3.radius.tile} />
        </View>
      ) : (
        <View style={styles.lines}>
          <Skeleton width="100%" height={16} />
          <Skeleton width="92%" height={16} />
          <Skeleton width="48%" height={16} />
        </View>
      )}

      <Skeleton width={56} height={20} radius={v3.radius.pill} />
      <Skeleton width="100%" height={BUTTON_FACE.default} radius={v3.radius.pill} />
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // `PostCard`'s card, so the dissolve into it moves nothing.
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[14],
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  headText: { flex: 1, gap: v3.space[6], minWidth: 0 },
  lines: { gap: v3.space[8] },
}))
