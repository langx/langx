import { StyleSheet, View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * Geometry copied from `chats.tsx`'s row rather than approximated. A
 * placeholder of a different height makes the real rows jump into place when
 * they arrive, which reads worse than the spinner it replaced.
 */
/** The 52px avatar `chats.tsx` draws — v3's chat-row size, not `layout.avatar`. */
const AVATAR_SIZE = 52

export function ConversationRowSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.row}>
      <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Skeleton width={132} height={16} />
          <Skeleton width={34} height={12} />
        </View>
        <View style={styles.bottom}>
          <Skeleton width="70%" height={14} />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  body: { flex: 1 },
  bottom: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: spacing.lg,
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
}))
