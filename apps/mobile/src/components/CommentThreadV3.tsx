import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native'
import { useCommentReplies } from '../api/queries'
import type { PostCommentReply } from '../api/types'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useLocale, useT } from '../i18n'
import { hiddenReplyCount, repliesToShow } from '../lib/commentThread'
import { relativeTime } from '../lib/format'
import { openProfile } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'
import { EASE_OUT } from '../lib/theme/motionAnimated'
import { DELAY, DURATION } from '../lib/theme/motionValues'
import type { CommentThreadProps } from './CommentThread'
import { Avatar } from './ui/Avatar'
import { IconButton } from './ui/IconButton'

/** The face's side on a root comment, and on a reply under it. */
const ROOT_FACE = 34
const REPLY_FACE = 28

/**
 * A root comment and its replies in the redesign's look (`V-Post`, the
 * Comments block), behind `flags.v3Home`. The paging, the one level of
 * replies and the buttons-side-by-side rule are `CommentThread.tsx`'s — read
 * its comments for why. The board's change: the face beside the words rather
 * than above them, the name in Nunito with the time after it, Reply as a grey
 * pill with its glyph, and the threads parted by space instead of rules.
 */
export function CommentThreadV3({
  root,
  postId,
  here,
  expanded,
  onExpand,
  onReply,
  onMore,
  highlightId,
  onLayout,
}: CommentThreadProps) {
  const styles = useStyles()
  const t = useT()
  const replies = useCommentReplies(postId, root._id, expanded)
  const loaded = expanded ? replies.data?.pages.flatMap((page) => page.items) : undefined
  const shown = repliesToShow(root, loaded)
  const hidden = expanded && !replies.hasNextPage ? 0 : hiddenReplyCount(root, shown.length)

  function more(): void {
    if (hidden === 0) return
    if (!expanded) onExpand()
    else if (!replies.isFetchingNextPage) void replies.fetchNextPage()
  }

  return (
    <View style={styles.thread} {...(onLayout ? { onLayout } : {})}>
      <CommentRowV3
        comment={root}
        here={here}
        highlighted={highlightId === root._id}
        onReply={() => onReply(root)}
        onMore={() => onMore(root)}
      />
      {shown.length > 0 || hidden > 0 ? (
        // `marginStart`, so an Arabic thread steps in from the right.
        <View style={styles.replies}>
          {shown.map((reply) => (
            <CommentRowV3
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

function CommentRowV3({
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
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  // A removed root keeps its place, as text — see `CommentThread.tsx`.
  if (comment.deleted) {
    return (
      <View style={[styles.row, highlighted && styles.highlighted]}>
        {highlighted ? <HighlightTint /> : null}
        <Text style={styles.removed}>{t('feed.commentRemoved')}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.row, highlighted && styles.highlighted]}>
      {highlighted ? <HighlightTint /> : null}
      {/*
        The face opens the profile, as it does in today's thread, where it sat
        inside the name's button. Hidden from a screen reader, which already
        has the name for that: one stop per person, not two.
      */}
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        onPress={() => openProfile(comment.author.handle, here)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar
          url={comment.author.avatarUrl}
          name={comment.author.displayName}
          seed={comment.author._id}
          size={reply ? REPLY_FACE : ROOT_FACE}
        />
      </Pressable>
      <View style={styles.column}>
        {/* The line is 20 tall; the slop makes the name a target a thumb can find. */}
        <Pressable
          style={styles.who}
          hitSlop={{ bottom: 4, top: 12 }}
          onPress={() => openProfile(comment.author.handle, here)}
          accessibilityRole="button"
        >
          <Text style={styles.name} numberOfLines={1}>
            {comment.author.displayName}
          </Text>
          <Text style={styles.time}>· {relativeTime(comment.createdAt, { t, locale })}</Text>
        </Pressable>
        <Pressable onLongPress={onMore} accessibilityHint={t('feed.commentOptions')}>
          <Text style={styles.body}>{comment.body}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onReply}
            style={({ pressed }) => [styles.replyPill, pressed && styles.pressed]}
          >
            <Feather name="corner-up-left" size={v3.icon.sm} color={v3.colors.fg} />
            <Text style={styles.replyLabel}>{t('feed.reply')}</Text>
          </Pressable>
          {/* The long press's button: every gesture has one. */}
          <IconButton
            icon="more-horizontal"
            accessibilityLabel={t('feed.commentOptions')}
            onPress={onMore}
            iconSize={v3.icon.md}
            color={v3.colors.muted}
          />
        </View>
      </View>
    </View>
  )
}

/** How long the pointed-at comment keeps its tint once the screen has arrived. */
const TINT_HOLD = 600

/**
 * The tint behind the comment a notification pointed at. It used to stay for
 * as long as the screen was open, so the one comment somebody came for went
 * on looking selected after they had read it. Now it holds long enough to be
 * found — the push's own slide, then `TINT_HOLD` — and fades. A layer under
 * the row rather than the row's own background, and the room round the words
 * stays, so the fade moves nothing. With reduce motion on it goes at once
 * when the hold ends.
 */
function HighlightTint() {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const hold = DELAY.afterPush + TINT_HOLD
    if (reduceMotion) {
      const timer = setTimeout(() => opacity.setValue(0), hold)
      return () => clearTimeout(timer)
    }
    const fade = Animated.sequence([
      Animated.delay(hold),
      Animated.timing(opacity, {
        toValue: 0,
        duration: DURATION.roll,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ])
    fade.start()
    return () => fade.stop()
  }, [opacity, reduceMotion])
  return <Animated.View pointerEvents="none" style={[styles.tint, { opacity }]} />
}

const useStyles = makeStyles(({ v3 }) => ({
  thread: { gap: v3.space[4], paddingVertical: v3.space[6] },
  // The root's face plus the row's gap: a reply's face lines up under the
  // root's name, which is what makes the indent read as "answering this".
  replies: { gap: v3.space[4], marginStart: ROOT_FACE + v3.space[10] },
  row: { borderRadius: v3.radius.row, flexDirection: 'row', gap: v3.space[10] },
  // The comment a notification pointed at: Echo's tint, the board's one
  // "look here" colour, with room so the words do not touch its edge.
  highlighted: {
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[8],
  },
  tint: {
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.row,
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  column: { flex: 1, gap: v3.space[4], minWidth: 0 },
  who: { alignItems: 'baseline', flexDirection: 'row', gap: v3.space[4] },
  name: { ...v3.type.buttonSmall, color: v3.colors.fg, flexShrink: 1 },
  time: { ...v3.type.caption, color: v3.colors.muted },
  body: { ...v3.type.callout, color: v3.colors.fg },
  removed: { ...v3.type.caption, color: v3.colors.muted, fontStyle: 'italic' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  replyPill: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 44,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[10],
  },
  replyLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
  viewMore: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
  },
  viewMoreRule: { backgroundColor: v3.colors.line, height: 2, width: 20 },
  viewMoreLabel: { ...v3.type.label, color: v3.colors.muted },
  pressed: { opacity: 0.6 },
}))
