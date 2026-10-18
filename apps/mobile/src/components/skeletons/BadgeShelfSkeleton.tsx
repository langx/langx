import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

const MARKS = ['a', 'b', 'c', 'd', 'e']

/**
 * The Me tab's badge shelf before its badges: the header, a row of marks and
 * the bar toward the next one.
 *
 * Every measurement is the shelf's own (`me.tsx`, `BadgeStrip`): it stands in
 * for the busiest case, where the strip and the next-badge line are both drawn,
 * so the common arrival moves nothing. An account with no badge earned has no
 * strip, and what sits under the shelf moves up by its height — which cannot be
 * known before the answer.
 */
export function BadgeShelfSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.shelf}>
      <View style={styles.head}>
        <Skeleton width={72} height={17} />
        <View style={styles.grow} />
        <Skeleton width={84} height={14} />
      </View>
      <View style={styles.marks}>
        {MARKS.map((key) => (
          <Skeleton key={key} width={MARK} height={MARK} radius={MARK / 2} />
        ))}
      </View>
      <View style={styles.next}>
        <View style={styles.nextRow}>
          <Skeleton width={148} height={13} />
          <Skeleton width={44} height={13} />
        </View>
        <Skeleton height={4} radius={2} />
      </View>
    </View>
  )
}

/** `BadgeStrip`'s `MARK_SIZE`. */
const MARK = 44

const useStyles = makeStyles(({ colors, spacing }) => ({
  shelf: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  // The shelf's header: 18 of air above a 22-high line (17pt type, chevron beside it).
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    height: 40,
    paddingTop: 18,
  },
  grow: { flex: 1 },
  marks: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  next: { gap: 8, paddingBottom: 18 },
  nextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
}))
