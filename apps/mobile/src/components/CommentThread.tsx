import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, Pressable, Text, View, type LayoutChangeEvent } from 'react-native'
import { useCommentReplies } from '../api/queries'
import type { PostComment, PostCommentReply } from '../api/types'
import { useLocale, useT } from '../i18n'
import { hiddenReplyCount, repliesToShow } from '../lib/commentThread'
import { relativeTime } from '../lib/format'
import { openProfile } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'
import { Avatar } from './ui/Avatar'

/**
 * One root comment and the replies under it — one level, never deeper.
 *
 * Deeper trees do not read on a phone and cannot be paged cheaply, so a reply
 * to a reply joins the same root and says who it answers with an `@handle`.
 * The root shows its first replies from the thread's own page; the rest load
 * only when somebody asks for them, from the root's own replies endpoint.
 *
 * A row's buttons sit side by side and never inside one another — the author
 * opens a profile, Reply opens the composer, the "more" glyph opens Report or
 * Delete — so the web build renders no button inside a button. The long press
 * on the words opens the same sheet, as it does on a feed card.
 */
export function CommentThread({
  root,
  postId,
  here,
  expanded,
  onExpand,
  onReply,
  onMore,
  highlightId,
  onLayout,
}: {
  root: PostComment
  postId: string
  /** The route a profile opened from here goes back to. */
  here: string
  expanded: boolean
  onExpand: () => void
  onReply: (target: PostCommentReply) => void
  /** `rootId` is set when the comment is a reply. */
  onMore: (comment: PostCommentReply, rootId?: string) => void
  /** The comment a notification pointed at, drawn tinted. */
  highlightId?: string | undefined
  onLayout?: (event: LayoutChangeEvent) => void
}) {
  const styles = useStyles()
  const t = useT()
  const replies = useCommentReplies(postId, root._id, expanded)
  const loaded = expanded ? replies.data?.pages.flatMap((page) => page.items) : undefined
  const shown = repliesToShow(root, loaded)
  // Once expanded, what is missing is whatever the endpoint has not paged in
  // yet; the root's count can be a reply behind, and a link promising one
  // more that never arrives is worse than none.
  const hidden = expanded && !replies.hasNextPage ? 0 : hiddenReplyCount(root, shown.length)

  function more(): void {
    if (hidden === 0) return
    if (!expanded) onExpand()
    else if (!replies.isFetchingNextPage) void replies.fetchNextPage()
  }

  return (
    <View style={styles.thread} {...(onLayout ? { onLayout } : {})}>
      <CommentRow
        comment={root}
        here={here}
        highlighted={highlightId === root._id}
        onReply={() => onReply(root)}
        onMore={() => onMore(root)}
      />
      {shown.length > 0 || hidden > 0 ? (
        // `marginStart`, not `marginLeft`, so the indent follows the reading
        // direction and an Arabic thread steps in from the right.
        <View style={styles.replies}>
          {shown.map((reply) => (
            <CommentRow
              key={reply._id}
              comment={reply}
              here={here}
              reply
              highlighted={highlightId === reply._id}
              onReply={() => onReply({ ...reply, parentId: reply.parentId ?? root._id })}
              onMore={() => onMore(reply, root._id)}
            />
          ))}
          {hidden > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={more}
              style={({ pressed }) => [styles.viewMore, pressed && styles.pressed]}
            >
              <View style={styles.viewMoreRule} />
              <Text style={styles.viewMoreLabel}>{t('feed.viewReplies', { count: hidden })}</Text>
              {replies.isFetching ? <ActivityIndicator size="small" /> : null}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function CommentRow({
  comment,
  here,
  reply = false,
  highlighted,
  onReply,
  onMore,
}: {
  comment: PostCommentReply
  here: string
  reply?: boolean
  highlighted: boolean
  onReply: () => void
  onMore: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  /*
   * A removed root keeps its place so the replies under it still read as a
   * conversation. Nothing on it can be acted on — there is nobody's words
   * left to answer or report — so it is text, not a row of buttons.
   */
  if (comment.deleted) {
    return (
      <View style={[styles.row, highlighted && styles.highlighted]}>
        <Text style={styles.removed}>{t('feed.commentRemoved')}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.row, highlighted && styles.highlighted]}>
      <Pressable
        style={styles.who}
        onPress={() => openProfile(comment.author.handle, here)}
        accessibilityRole="button"
      >
        <Avatar
          url={comment.author.avatarUrl}
          name={comment.author.displayName}
          seed={comment.author._id}
          size={reply ? 24 : 28}
        />
        <Text style={styles.name} numberOfLines={1}>
          {comment.author.displayName}
        </Text>
        <Text style={styles.time}>{relativeTime(comment.createdAt, { t, locale })}</Text>
      </Pressable>
      <Pressable onLongPress={onMore} accessibilityHint={t('feed.commentOptions')}>
        <Text style={styles.body}>{comment.body}</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onReply}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <Text style={styles.action}>{t('feed.reply')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('feed.commentOptions')}
          hitSlop={8}
          onPress={onMore}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <Feather name="more-horizontal" size={16} color={colors.textFaint} />
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  thread: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  // The avatar's width plus the row's gap: a reply's author lines up under the
  // root's name, which is what makes the indent read as "answering this".
  replies: { marginStart: 38 },
  row: { borderRadius: radius.md, gap: 6, paddingVertical: spacing.sm },
  highlighted: { backgroundColor: colors.accentBg, paddingHorizontal: spacing.sm },
  who: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  name: { ...font.heading, color: colors.text, flex: 1, fontSize: 14 },
  time: { color: colors.textFaint, fontSize: 12, fontWeight: '400' },
  body: { color: colors.text, fontSize: 15, fontWeight: '400', lineHeight: 22 },
  removed: { color: colors.textFaint, fontSize: 14, fontStyle: 'italic' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  action: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  viewMore: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: 6 },
  viewMoreRule: { backgroundColor: colors.border, height: 1, width: 20 },
  viewMoreLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
