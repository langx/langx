import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/** Geometry copied from `discover.tsx`'s row — name line, language pair, bio. */
export function DiscoveryCardSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.row}>
      <Skeleton width={56} height={56} radius={28} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Skeleton width={118} height={17} />
          <Skeleton width={22} height={14} />
        </View>
        <Skeleton width={160} height={14} />
        <Skeleton width="88%" height={15} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  body: { flex: 1, gap: spacing.xs },
  row: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 20,
  },
  top: { alignItems: 'center', flexDirection: 'row', gap: 10 },
}))
