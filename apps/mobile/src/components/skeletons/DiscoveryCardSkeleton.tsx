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
          <Skeleton width={118} height={15} />
          <Skeleton width={22} height={12} />
        </View>
        <Skeleton width={160} height={12} style={styles.line} />
        <Skeleton width="88%" height={12} style={styles.line} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  body: { flex: 1 },
  row: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 20,
  },
  line: { marginTop: 6 },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
}))
