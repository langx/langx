import { View } from 'react-native'
import { makeStyles, radius } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'

const REPLIES = ['a', 'b', 'c']

/**
 * The post screen while it loads: the sentence at the top, then the answers.
 *
 * Geometry copied from `post/[id].tsx` — the header's 40px avatar and 22px
 * body, the replies' 36px one and the card under it. The card is drawn in the
 * placeholder tint rather than the correction's green: a block of colour that
 * turns out to hold nothing reads as content that failed, not as content on
 * its way.
 */
export function PostThreadSkeleton() {
  const styles = useStyles()

  return (
    <View style={styles.root}>
      <View style={styles.who}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={styles.whoText}>
          <Skeleton width={124} height={15} />
          <Skeleton width={96} height={13} />
        </View>
      </View>

      <View style={styles.body}>
        <Skeleton width="100%" height={22} />
        <Skeleton width="64%" height={22} />
      </View>

      <View style={styles.actions}>
        <Skeleton width={52} height={14} />
        <Skeleton width={68} height={14} />
      </View>

      <Skeleton width={148} height={18} style={styles.sectionTitle} />

      {REPLIES.map((key) => (
        <View key={key} style={styles.reply}>
          <View style={styles.replyWho}>
            <Skeleton width={36} height={36} radius={18} />
            <Skeleton width={112} height={14} />
          </View>
          <Skeleton width="100%" height={64} radius={radius.lg} />
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  actions: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 20,
    paddingBottom: 20,
  },
  body: { gap: 10, paddingBottom: 18 },
  reply: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingVertical: spacing.lg,
  },
  replyWho: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  root: { paddingBottom: spacing.xl },
  sectionTitle: { marginBottom: 6, marginTop: 22 },
  who: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  whoText: { flex: 1, gap: spacing.xs },
}))
