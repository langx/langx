import { StyleSheet, View } from 'react-native'
import { colors, layout, spacing } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/** Geometry copied from `discover.tsx`'s card — name row, language line, bio. */
export function DiscoveryCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={layout.avatar} height={layout.avatar} radius={layout.avatar / 2} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Skeleton width={118} height={15} />
          <Skeleton width={22} height={11} />
        </View>
        <Skeleton width={160} height={12} style={styles.line} />
        <Skeleton width="88%" height={12} style={styles.line} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  card: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  line: { marginTop: 4 },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
})
