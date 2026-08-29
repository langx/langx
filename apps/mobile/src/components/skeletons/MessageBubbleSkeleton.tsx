import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

/**
 * A thread's worth of placeholder bubbles, alternating sides.
 *
 * Widths vary per index on purpose: a column of identical bars reads as a
 * loading bar, and what is loading here is a conversation.
 */
export function MessageBubbleSkeleton({ index }: { index: number }) {
  const styles = useStyles()

  const mine = index % 2 === 1
  const width = WIDTHS[index % WIDTHS.length] ?? WIDTHS[0]
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Skeleton width={width} height={14} />
    </View>
  )
}

const WIDTHS: readonly [number, ...number[]] = [168, 96, 210, 132, 76, 190]

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  bubble: {
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
}))
