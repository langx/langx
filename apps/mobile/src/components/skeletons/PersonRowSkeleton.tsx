import { View } from 'react-native'
import { layout, makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * A face and two lines: the row every list of people draws — likes, follows,
 * viewers, blocks. They share this one placeholder because they share the
 * geometry; a list whose rows differ has its own skeleton beside this file.
 */
export function PersonRowSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.row}>
      <Skeleton width={layout.avatar} height={layout.avatar} radius={layout.avatar / 2} />
      <View style={styles.body}>
        <Skeleton width={142} height={16} />
        <Skeleton width={88} height={14} />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  body: { flex: 1, gap: spacing.xs },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 14,
  },
}))
