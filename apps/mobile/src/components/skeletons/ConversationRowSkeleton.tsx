import { StyleSheet, View } from 'react-native'
import { colors, layout, spacing } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * Geometry copied from `chats.tsx`'s row rather than approximated. A
 * placeholder of a different height makes the real rows jump into place when
 * they arrive, which reads worse than the spinner it replaced.
 */
export function ConversationRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={layout.avatar} height={layout.avatar} radius={layout.avatar / 2} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Skeleton width={132} height={15} />
          <Skeleton width={34} height={11} />
        </View>
        <View style={styles.bottom}>
          <Skeleton width="70%" height={12} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bottom: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
})
