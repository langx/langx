import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * Geometry copied from `chats.tsx`'s row rather than approximated. A
 * placeholder of a different height makes the real rows jump into place when
 * they arrive, which reads worse than the spinner it replaced.
 */
/** The 56px avatar `chats.tsx` draws — the design's list size, not `layout.avatar`. */
const AVATAR_SIZE = 56

export function ConversationRowSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.row}>
      <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Skeleton width={132} height={17} />
          <Skeleton width={34} height={13} />
        </View>
        <View style={styles.bottom}>
          <Skeleton width="70%" height={15} />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  body: { flex: 1, gap: spacing.xs },
  bottom: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 18,
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
}))
