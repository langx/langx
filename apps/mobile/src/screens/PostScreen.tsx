import Feather from '@expo/vector-icons/Feather'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import {
  echoAudiosOf,
  FEED_TOP_CORRECTIONS,
  MAX_COMMENT_LENGTH,
  MAX_POST_LENGTH,
  PLAN_LIMITS,
  TOKEN_RULES,
  type FeedPost,
} from '@langx/shared'
import {
  uploadPostMedia,
  useAddComment,
  useAnswerPronunciation,
  useApplyEchoCorrection,
  useAttachEchoAudio,
  useCaptureEcho,
  useCorrectPost,
  useDeleteAnswer,
  useDeleteComment,
  useDeleteCorrection,
  useDeletePost,
  useEchoCardForPost,
  useMe,
  usePostAnswers,
  usePostComments,
  usePostCorrections,
  useRemoveEcho,
} from '../api/queries'
import type {
  Media,
  PostComment,
  PostCommentReply,
  PostCorrection,
  PronunciationAnswer,
} from '../api/types'
import type { MessageKey } from '../i18n'
import { AudioBubble, MediaGallery } from '../components/MediaBubble'
import { CommentThread } from '../components/CommentThread'
import { PhotoViewer } from '../components/PhotoViewer'
import { LoadFailed } from '../components/LoadFailed'
import { PostThreadSkeleton } from '../components/skeletons/PostThreadSkeleton'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { LikeButton } from '../components/LikeButton'
import { attachmentsOf } from '@langx/shared'
import { Screen } from '../components/ui/Screen'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { useKeyboardClearance } from '../hooks/useKeyboardClearance'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { dedupeById } from '../lib/dedupeById'
import { track } from '../lib/analytics'
import { replyDraftFor } from '../lib/commentThread'
import { foldCorrection } from '../lib/feedCache'
import { asksOf } from '../lib/postAsks'
import { replyRefusalKey } from '../lib/postRefusal'
import { goBackTo, openLikers, openProfile } from '../lib/navigation'
import { relativeTime } from '../lib/format'
import { chooseAlert, confirmAlert, showAlert } from '../lib/alert'
import { errorCodeOf } from '../lib/errors'
import { showToast } from '../lib/toast'
import { shareLink } from '../lib/share'
import { postShareText } from '../lib/shareText'
import { makeStyles, useTheme } from '../lib/theme'
import { useDisplayNames, useLocale, useT } from '../i18n'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { advanceUpload, percentOf, UPLOAD_START, type UploadProgress } from '../lib/uploadProgress'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useReviewPrompt } from '../hooks/useReviewPrompt'

/** The folded diff line — same drawing as the feed's top-correction panel. */
function CorrectedLine({ original, corrected }: { original: string; corrected: string }) {
  const styles = useStyles()
  const runs = useMemo(() => foldCorrection(original, corrected), [original, corrected])
  return (
    <Text style={styles.corrected}>
      {runs.map((run, index) => (
        <Text
          key={index}
          style={
            run.kind === 'removed' ? styles.removed : run.kind === 'added' ? styles.added : null
          }
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

/**
 * Everything on one post: its corrections and its recordings — whichever it
 * asked for, both when it asked for both — and its comments.
 *
 * The feed card shows exactly one reply — the oldest — because a page of cards
 * cannot afford to carry a popular post's whole answer list. This is where the
 * rest live, and until it existed the card's "See all N" was a label on nothing.
 */
export interface PostScreenProps {
  postId: string
  /**
   * Where the back arrow goes. A post is reachable from the feed, the
   * corrections list and a correction's own page, so the parent is the
   * caller's to name.
   */
  from?: string
  /** Drawn beside a list rather than pushed over it. See `ChatScreen`. */
  embedded?: boolean
  /** How the panel empties itself; only the embedded screen has one. */
  onClose?: () => void
  /**
   * A comment to bring into view, from a reply notification. The thread is in
   * the list's footer, below every correction and recording, so without this
   * the tap lands on the post and the reply is somewhere under the fold.
   */
  focusCommentId?: string
}

/** One row of the thread's list: a section heading, its empty line, or a reply. */
type Row =
  | { type: 'title'; key: string; label: MessageKey }
  | { type: 'empty'; key: string; title: MessageKey; body: MessageKey }
  | { type: 'reply'; key: string; item: PostCorrection | PronunciationAnswer }

/** The comment composer's target when it is a reply rather than a new comment. */
interface ReplyTarget {
  /** What is sent as `parentId` — the comment tapped; the server finds its root. */
  commentId: string
  /** Where the reply is drawn, known here so it appears without a refetch. */
  rootId: string
  name: string
}

/** The most-liked reply in a list, or none when nothing has a like yet. */
function topOf(items: readonly (PostCorrection | PronunciationAnswer)[]): string | undefined {
  return items.reduce<{ id: string; likes: number } | null>(
    (best, item) =>
      item.likeCount > 0 && item.likeCount > (best?.likes ?? 0)
        ? { id: item._id, likes: item.likeCount }
        : best,
    null,
  )?.id
}

export function PostScreen({
  postId,
  from,
  embedded = false,
  onClose,
  focusCommentId,
}: PostScreenProps) {
  useScreenInteractive(!embedded)
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()
  const id = postId
  const me = useMe()

  const here = `/(app)/post/${id}`
  /*
   * The corrections endpoint runs on every post, whatever it asks, because it
   * is the one that carries the post itself — and on a post with no correction
   * ask it is a single index seek returning nothing. The alternative, threading
   * the asks through `openPost`, breaks on a cold deep link, where the only
   * thing this screen has is an id.
   */
  const query = usePostCorrections(id)
  const post = query.data?.pages[0]?.post
  const asks = post ? asksOf(post) : []
  const correcting = asks.includes('correction')
  const pronouncing = asks.includes('pronunciation')
  const answerQuery = usePostAnswers(id, pronouncing)
  const commentQuery = usePostComments(id)
  // Every query behind one spinner: the answers and the comments are part of
  // this screen, so a pull that refreshed only some of it would be a lie about
  // the rest.
  const pull = usePullToRefresh(() =>
    Promise.all([
      query.refetch(),
      commentQuery.refetch(),
      ...(pronouncing ? [answerQuery.refetch()] : []),
    ]),
  )

  /*
   * The correction box and the comment box sit at the bottom of the thread,
   * where the keyboard lands, and this list pulls to refresh, so it cannot
   * hand the problem to `automaticallyAdjustKeyboardInsets` — see the hook.
   */
  const keyboard = useKeyboardClearance((offset, animated) =>
    listRef.current?.scrollToOffset({ offset, animated }),
  )
  const listRef = useRef<FlatList<Row>>(null)
  /*
   * The two boxes, not the two fields: each has a send button under it, and
   * what the keyboard has to clear is the button. `collapsable={false}` on
   * both, since a view kept only to be measured must not be flattened away.
   */
  const correctionBox = useRef<View>(null)
  const commentBox = useRef<View>(null)

  const correctPost = useCorrectPost()
  const review = useReviewPrompt()
  const answerPost = useAnswerPronunciation()
  const addComment = useAddComment()
  const captureEcho = useCaptureEcho()
  const removeEcho = useRemoveEcho()
  const deletePost = useDeletePost()
  const deleteCorrection = useDeleteCorrection()
  const deleteAnswer = useDeleteAnswer()
  const mine = post ? post.author._id === me.data?._id : false
  /*
   * The Echo card this post was asked from, when it was asked from one. Null
   * for every post written straight from the composer, which is most of them —
   * so the actions below are drawn only when it resolves.
   *
   * Asked only for your own post that asks something: a card can only be
   * linked to its author's post, and only through an ask, so on anybody
   * else's post — and on a moment — the answer is known to be null without
   * spending a round trip on it.
   */
  const askedFrom = useEchoCardForPost(id, mine && asks.length > 0)
  const attachAudio = useAttachEchoAudio()
  const applyCorrection = useApplyEchoCorrection()
  const deleteComment = useDeleteComment()

  /*
   * Which slot of the card this post fills. A card holds one pronunciation ask
   * and one correction ask, possibly on two different posts, so "this post
   * came from a card" does not mean both keep buttons belong on it — each is
   * drawn only for the slot that names this post, which is the same check the
   * server makes.
   */
  const keepsRecordings = !!post && askedFrom.data?.askedPostId === post._id
  const keepsCorrections = !!post && askedFrom.data?.askedCorrectionPostId === post._id
  /*
   * Which answers are already on the card. Every row carries the button, so
   * without this the card's own recordings would be offered back as if the
   * card were empty — and the answer id is what the card stores for exactly
   * this reason.
   */
  const askedCardId = askedFrom.data?._id
  const kept = new Set(
    echoAudiosOf(askedFrom.data ?? {})
      .map((audio) => audio.answerId)
      .filter((answerId) => !!answerId),
  )

  /** The recorder's open/closed state. The correction box is always open. */
  const [composing, setComposing] = useState(false)
  const [correction, setCorrection] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  /** Roots whose every reply has been asked for, not just the preview. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  /*
   * One recorder for both takes, not two.
   *
   * Two `useVoiceRecorder()` instances mean two native recorders sharing one
   * audio session, and which of them owns it after the first `stop()` is not
   * something to find out on a user's phone. `slot` says which take the next
   * recording fills; the finished ones live in `takes`.
   */
  const recorder = useVoiceRecorder()
  const [slot, setSlot] = useState<'fast' | 'slow' | null>(null)
  const [takes, setTakes] = useState<{ fast?: Media; slow?: Media }>({})
  /** Owned by the screen: a comment row is recycled out from under its viewer. */
  /**
   * What the viewer is showing and where it opened. A post carries a gallery
   * now, so arriving on the tile that was tapped is the difference between
   * paging and hunting.
   */
  const [viewing, setViewing] = useState<{ items: Media[]; index: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  /**
   * How far the take being sent has got, or `null`.
   *
   * The feed's composer shows this on the thumbnail; here there is no
   * thumbnail, so it goes on the send button's own label — the only thing on
   * screen while a recording is on its way.
   */
  const [takeProgress, setTakeProgress] = useState<UploadProgress | null>(null)
  /** Leaving the screen stops the post's own video; see `MediaGallery` below. */
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )

  // Two row shapes under one list. `'corrected' in item` is the discriminator
  // the renderer branches on — the two DTOs have no shared tag, and inventing
  // one would put a field on the wire whose only reader is this file.
  const corrections = correcting
    ? dedupeById(query.data?.pages.flatMap((page) => page.items) ?? [])
    : []
  const answers = pronouncing
    ? dedupeById(answerQuery.data?.pages.flatMap((page) => page.items) ?? [])
    : []
  const comments: PostComment[] = dedupeById(
    commentQuery.data?.pages.flatMap((page) => page.items) ?? [],
  )

  // Each list is chronological; "Top" goes to its most-liked reply (the same
  // signal the feed's top panel surfaces), not to the oldest. No likes yet
  // means no Top — a tag every row could have said nothing.
  const topCorrectionId = topOf(corrections)
  const topAnswerId = topOf(answers)

  /*
   * One list with both sections in it, rather than a list per ask: a post that
   * asks for both is one thread, and two virtualised lists on one axis lose
   * their virtualisation. Corrections first, since that is the order the badges
   * are in. A moment has neither and goes straight to its comments.
   */
  const rows: Row[] = [
    ...(correcting
      ? [
          { type: 'title', key: 'title-corrections', label: 'feed.correctionsTitle' } as const,
          ...(corrections.length > 0
            ? corrections.map((item) => ({ type: 'reply' as const, key: item._id, item }))
            : [
                {
                  type: 'empty',
                  key: 'empty-corrections',
                  title: 'feed.correctionsEmptyTitle',
                  body: 'feed.correctionsEmptyBody',
                } as const,
              ]),
        ]
      : []),
    ...(pronouncing
      ? [
          { type: 'title', key: 'title-recordings', label: 'feed.recordingsTitle' } as const,
          ...(answers.length > 0
            ? answers.map((item) => ({ type: 'reply' as const, key: item._id, item }))
            : answerQuery.isPending
              ? []
              : [
                  {
                    type: 'empty',
                    key: 'empty-recordings',
                    title: 'feed.answersEmptyTitle',
                    body: 'feed.answersEmptyBody',
                  } as const,
                ]),
        ]
      : []),
  ]

  /*
   * Paging runs down the list as it is drawn: corrections until there are no
   * more, then recordings. Each is bounded at one reply per person per post,
   * so neither can hold the other back for long.
   */
  const pager = correcting && query.hasNextPage ? query : pronouncing ? answerQuery : query

  const router = useRouter()

  /*
   * Bringing a notified comment into view. The thread sits in the list's
   * footer, so its offset is the content's height less what follows the row:
   * the footer's own height, its bottom padding, and where in the footer the
   * row starts. Measured, not guessed, and done once — scrolling back to it
   * on every layout would fight the reader.
   */
  const [focusPending, setFocusPending] = useState(Boolean(focusCommentId))
  const layout = useRef({ content: 0, footer: 0, block: 0, threads: new Map<string, number>() })
  const focusRootId = focusCommentId
    ? comments.find(
        (root) =>
          root._id === focusCommentId ||
          (root.replies ?? []).some((reply) => reply._id === focusCommentId),
      )?._id
    : undefined

  function tryFocus(): void {
    if (!focusPending || !focusRootId) return
    const { content, footer, block, threads } = layout.current
    const at = threads.get(focusRootId)
    if (!content || !footer || at === undefined) return
    const offset = content - LIST_BOTTOM_PADDING - footer + block + at
    listRef.current?.scrollToOffset({ offset: Math.max(0, offset - 16), animated: true })
    setFocusPending(false)
  }
  // Re-tried whenever a measurement or the comments change; the guard above
  // makes every call after the first a no-op.
  useEffect(tryFocus)

  function share(): void {
    if (!post) return
    void shareLink(
      postShareText(t, {
        id: post._id,
        body: post.body,
        languageName: names.language(post.language),
      }),
    )
  }

  /**
   * The header's "more" sheet. Share and Report on somebody else's post,
   * delete on your own — the things that used to sit as text actions under
   * the sentence.
   */
  async function openMore(): Promise<void> {
    if (!post) return
    const choice = mine
      ? await chooseAlert(t('feed.post'), undefined, [
          { label: t('feed.deletePost'), value: 'delete' as const, destructive: true },
        ])
      : await chooseAlert(t('feed.post'), undefined, [
          { label: t('share.action'), value: 'share' as const },
          { label: t('common.report'), value: 'report' as const, destructive: true },
        ])
    if (choice === 'share') share()
    if (choice === 'report') void confirmReport()
    if (choice === 'delete') void confirmDeletePost()
  }

  /** The report screen, pointed at the post. */
  function confirmReport(): void {
    if (!post) return
    router.push({
      pathname: '/(app)/report',
      params: { userId: post.author._id, postId: post._id },
    })
  }

  function submitCorrection(): void {
    if (!post || !correction.trim() || correctPost.isPending) return
    correctPost.mutate(
      { postId: post._id, corrected: correction.trim() },
      {
        onSuccess: () => {
          setCorrection('')
          showToast(t('feed.correctionSent'))
          // The mutation patches the feed pages; this thread's own pages it
          // does not know about, so the new row — and the post's
          // `correctedByViewer`, which swaps the box for "You corrected this" —
          // arrive by refetch.
          void query.refetch()
          review.request({ kind: 'correction' })
        },
        onError: (caught) => showReplyError(caught, 'feed.alreadyCorrected'),
      },
    )
  }

  /**
   * A refused correction or recording, said as what it is: the post asks for
   * something else, or — the one refusal without a `reason` — you already
   * answered it. `common.retry` is left for the network and the unknown, which
   * are the cases a retry can fix. Either refusal also refreshes the post, so
   * the box that offered the impossible goes away.
   */
  function showReplyError(caught: unknown, duplicate: MessageKey): void {
    const refusal = replyRefusalKey(caught, duplicate)
    if (!refusal) {
      showToast(t('common.retry'))
      return
    }
    showToast(t(refusal.key))
    void query.refetch()
  }

  /** Stop the running take and keep it, or start one in the slot asked for. */
  async function toggleRecording(which: 'fast' | 'slow'): Promise<void> {
    if (recorder.isRecording) {
      const recording = await recorder.stop()
      const filling = slot ?? which
      setSlot(null)
      if (!recording) return
      setUploading(true)
      try {
        // Uploaded on stop rather than on submit, unlike the feed's attachment
        // bar: a take has to be playable back before it is worth sending, and
        // `AudioBubble` plays a URL, not a local recording handle.
        setTakeProgress(UPLOAD_START)
        const media = await uploadPostMedia({
          kind: 'audio',
          ...recording,
          onProgress: (loaded, total) =>
            setTakeProgress((current) => advanceUpload(current ?? UPLOAD_START, loaded, total)),
        })
        setTakes((current) => ({ ...current, [filling]: media }))
      } catch {
        showToast(t('feed.attachmentFailed'))
      } finally {
        setUploading(false)
        setTakeProgress(null)
      }
      return
    }
    setSlot(which)
    const started = await recorder.start()
    if (!started) {
      setSlot(null)
      if (recorder.error) showToast(recorder.error)
    }
  }

  function submitAnswer(): void {
    if (!post || answerPost.isPending || uploading) return
    // The fast take is the answer; the slow one is a bonus. Guarded here as
    // well as by the disabled button, because the button is not the only way
    // this runs on a slow phone.
    if (!takes.fast) {
      showToast(t('feed.needRecording'))
      return
    }
    answerPost.mutate(
      { postId: post._id, media: takes.fast, ...(takes.slow ? { slowMedia: takes.slow } : {}) },
      {
        onSuccess: () => {
          setTakes({})
          setComposing(false)
          showToast(t('feed.answerSent'))
          void answerQuery.refetch()
          // And the post, which rides on the corrections pages: without it
          // the header kept "0 recordings" and the recorder stayed open for
          // a second take the server would refuse — `answeredByViewer` is
          // what takes it away. The correction path above does the same.
          void query.refetch()
        },
        onError: (caught) => {
          setTakes({})
          setComposing(false)
          showReplyError(caught, 'feed.youAnswered')
        },
      },
    )
  }

  function submitComment(): void {
    if (!post || !commentDraft.trim() || addComment.isPending) return
    addComment.mutate(
      {
        postId: post._id,
        body: commentDraft.trim(),
        ...(replyTarget ? { parentId: replyTarget.commentId, rootId: replyTarget.rootId } : {}),
      },
      {
        onSuccess: () => {
          setCommentDraft('')
          setReplyTarget(null)
        },
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  /**
   * Point the composer at a comment. A reply to a reply lands under the same
   * root and starts with `@handle` — see `replyDraftFor` — which goes in only
   * when the box is empty, so a half-written comment is never thrown away.
   * The list then runs to its end, where the composer is.
   */
  function startReply(target: PostCommentReply): void {
    const { rootId, prefill } = replyDraftFor(target)
    setReplyTarget({
      commentId: target._id,
      rootId,
      name: target.author.displayName || target.author.handle,
    })
    if (prefill && !commentDraft.trim()) setCommentDraft(prefill)
    listRef.current?.scrollToEnd({ animated: true })
  }

  /** Report somebody else's comment, delete your own — the row's one sheet. */
  async function commentMore(comment: PostCommentReply, rootId?: string): Promise<void> {
    if (!post) return
    const own = comment.author._id === me.data?._id
    const choice = await chooseAlert(t('feed.comment'), undefined, [
      own
        ? { label: t('feed.deleteComment'), value: 'delete' as const, destructive: true }
        : { label: t('feed.reportComment'), value: 'report' as const, destructive: true },
    ])
    if (choice === 'delete') {
      deleteComment.mutate(
        { postId: post._id, commentId: comment._id, ...(rootId ? { rootId } : {}) },
        { onError: () => showToast(t('common.retry')) },
      )
    }
    if (choice === 'report') {
      router.push({
        pathname: '/(app)/report',
        params: { userId: comment.author._id, postId: post._id, commentId: comment._id },
      })
    }
  }

  async function toggleEcho(post: FeedPost): Promise<void> {
    try {
      if (post.echoedByViewer) {
        await removeEcho.mutateAsync({ idOrSourceKey: `post:${post._id}` })
        showToast(t('echo.removed'))
        return
      }
      const result = await captureEcho.mutateAsync({ source: { kind: 'post', postId: post._id } })
      if (result.created) track({ name: 'echo_card_captured', properties: { source: 'post' } })
      showToast(t(result.created ? 'echo.added' : 'echo.alreadyAdded'))
    } catch (error) {
      // A ceiling, not a paywall: the same number on every plan.
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(
          t('echo.limitTitle'),
          t('echo.limitBody', { count: PLAN_LIMITS.free.echoCapturesPerDay ?? 0 }),
        )
      } else {
        await showAlert(t('echo.addFailedTitle'), t('common.retry'))
      }
    }
  }

  async function confirmDeletePost(): Promise<void> {
    if (!post) return
    const yes = await confirmAlert({
      title: t('feed.deleteConfirmTitle'),
      message: t('feed.deletePostConfirmBody'),
      confirmLabel: t('feed.deletePost'),
      destructive: true,
    })
    if (!yes) return
    deletePost.mutate(post._id, {
      onSuccess: () => {
        showToast(t('feed.deleted'))
        // In a panel the list is already on screen, so the panel empties
        // rather than the tab navigating to itself with a deleted post in it.
        if (embedded) onClose?.()
        else goBackTo('/(app)/(tabs)/feed', from)
      },
      onError: () => showToast(t('common.retry')),
    })
  }

  function removeReply(reply: PostCorrection | PronunciationAnswer): void {
    if (!post) return
    const correctionRow = 'corrected' in reply
    const done = {
      onSuccess: () => {
        showToast(t('feed.deleted'))
        void (correctionRow ? query : answerQuery).refetch()
        // The post rides on the corrections page, and its counts just moved.
        if (!correctionRow) void query.refetch()
      },
      onError: () => showToast(t('common.retry')),
    }
    if (correctionRow) deleteCorrection.mutate({ postId: post._id, correctionId: reply._id }, done)
    else deleteAnswer.mutate({ postId: post._id, answerId: reply._id }, done)
  }

  /**
   * Keep this recording on the card that asked the question.
   *
   * Added to whatever the card already holds rather than replacing it: two
   * people answering the same question is the reason to ask the feed, and the
   * card is the place to compare them. Each row says whether its own recording
   * is already there, so the button never offers what has been done.
   */
  function keepOnCard(answerId: string): void {
    const cardId = askedFrom.data?._id
    if (!cardId) return
    attachAudio.mutate(
      { cardId, answerId },
      {
        onSuccess: () => showToast(t('echo.audioKept')),
        /*
         * The one refusal this can meet with the button honestly drawn: the
         * card already holds as many recordings as it keeps. Said here, where
         * the reader tried, rather than by hiding the Echo action upstream —
         * people can still record on the post either way.
         */
        onError: (caught) =>
          showToast(
            t(errorCodeOf(caught) === 'VALIDATION_FAILED' ? 'echo.audioFull' : 'common.retry'),
          ),
      },
    )
  }

  /** Keep this correction as the card's sentence. The text half of the above. */
  function keepCorrectionOnCard(correctionId: string): void {
    const cardId = askedFrom.data?._id
    if (!cardId) return
    applyCorrection.mutate(
      { cardId, correctionId },
      {
        onSuccess: () => showToast(t('echo.correctionKept')),
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  return (
    <Screen fluid>
      <Animated.View
        ref={keyboard.frameRef}
        style={[styles.avoid, { paddingBottom: keyboard.pad }]}
      >
        <ScreenHeader
          title={t('feed.post')}
          {...(embedded ? {} : { onBack: () => goBackTo('/(app)/(tabs)/feed', from) })}
          trailing={
            post ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mine ? t('feed.deletePost') : t('share.action')}
                hitSlop={12}
                onPress={() => void openMore()}
                style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              >
                <Feather name="more-horizontal" size={22} color={colors.text} />
              </Pressable>
            ) : null
          }
        />

        {query.isError && !post ? (
          /*
           * `!post` rather than `state`, because the `|| !post` below is what
           * made this the worst of the seven: a failed load leaves `post`
           * undefined forever, so the condition stayed true and the screen
           * pulsed placeholders that were never going to resolve. The pronounce
           * tab counts its rows from a different query, so `state` alone can be
           * `'content'` while the post itself never arrived.
           *
           * A post that is already in hand survives a failed refetch and still
           * renders below.
           */
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : !post ? (
          <PostThreadSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            {...keyboard.scrollProps}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl {...pull} />}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (pager.hasNextPage && !pager.isFetchingNextPage) void pager.fetchNextPage()
            }}
            onContentSizeChange={(_width, height) => {
              layout.current.content = height
              tryFocus()
            }}
            ListHeaderComponent={
              <View>
                <Pressable
                  style={styles.who}
                  onPress={() => openProfile(post.author.handle, here)}
                  accessibilityRole="button"
                >
                  <Avatar
                    url={post.author.avatarUrl}
                    name={post.author.displayName}
                    seed={post.author._id}
                    size={40}
                  />
                  <View style={styles.whoText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {post.author.displayName}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {names.language(post.language)} ·{' '}
                      {relativeTime(post.createdAt, { t, locale })}
                    </Text>
                  </View>
                  {/* The prototype's ink pill on the post itself; the threshold is
                    shared with the feed, and so is the rule that only a
                    correction ask can earn it. */}
                  {correcting && post.correctionCount >= FEED_TOP_CORRECTIONS ? (
                    <Text style={styles.topPost}>{t('feed.top')}</Text>
                  ) : null}
                </Pressable>
                {post.body.trim() ? <Text style={styles.body}>{post.body}</Text> : null}
                {attachmentsOf(post).length > 0 ? (
                  <View style={styles.media}>
                    <MediaGallery
                      items={attachmentsOf(post)}
                      onOpen={(index) => setViewing({ items: attachmentsOf(post), index })}
                      /*
                       * The same preview the feed draws, so a video does not
                       * change character between the list and the post it was
                       * tapped from. The replies below keep the thread's
                       * controls: several clips starting at once in a list of
                       * answers is the case autoplay is wrong for.
                       */
                      videoMode="preview"
                      videoPlaying={focused}
                      fill
                    />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <LikeButton
                    targetType="post"
                    targetId={post._id}
                    likeCount={post.likeCount}
                    likedByViewer={post.likedByViewer}
                    disabled={mine}
                    from={here}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => openLikers('post', post._id, here)}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.actionMuted}>{t('feed.likedBy')}</Text>
                  </Pressable>
                  {/*
                    A count per ask, the first pushed to the end; a moment,
                    which asks for nothing, counts its comments instead.
                  */}
                  {asks.length === 0 ? (
                    <Text style={[styles.actionMuted, styles.actionEnd]}>
                      {t('feed.comments', { count: post.commentCount })}
                    </Text>
                  ) : null}
                  {correcting ? (
                    <Text style={[styles.actionMuted, styles.actionEnd]}>
                      {t('feed.corrections', { count: post.correctionCount })}
                    </Text>
                  ) : null}
                  {pronouncing ? (
                    <Text style={[styles.actionMuted, correcting ? null : styles.actionEnd]}>
                      {t('feed.answers', { count: post.answerCount ?? 0 })}
                    </Text>
                  ) : null}
                </View>
                {/*
                Visible here, and behind a long press in the feed. This screen
                is where a learner lands after reading the correction, and the
                row has space; a card in a list, mostly somebody's sentence,
                does not.
              */}
                {/* Only with words: an Echo card is a sentence, and a caption-less
                  photo has none to keep. */}
                {post.body.trim() ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => void toggleEcho(post)}
                    style={({ pressed }) => [styles.echoRow, pressed && styles.pressed]}
                  >
                    <Feather
                      name="repeat"
                      size={14}
                      color={post.echoedByViewer ? colors.textFaint : colors.accent}
                    />
                    <Text style={post.echoedByViewer ? styles.actionMuted : styles.accentAction}>
                      {t(post.echoedByViewer ? 'echo.removeFromEcho' : 'echo.addToEcho')}
                    </Text>
                  </Pressable>
                ) : null}
                {/*
                Back to the card this post was asked from. Only its owner ever
                sees it — `askedFrom` is looked up by the viewer — and until
                now the link ran one way only: a card could open the feed, and
                the feed could give an answer back, but there was nowhere to go
                to see what the answer landed on.
              */}
                {askedCardId ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/echo/card/[id]',
                        params: { id: askedCardId },
                      })
                    }
                    style={({ pressed }) => [styles.echoRow, pressed && styles.pressed]}
                  >
                    <Feather name="layers" size={14} color={colors.accent} />
                    <Text style={styles.accentAction}>{t('echo.seeCard')}</Text>
                  </Pressable>
                ) : null}
              </View>
            }
            renderItem={({ item: row }) => {
              if (row.type === 'title') {
                return <Text style={styles.sectionTitle}>{t(row.label)}</Text>
              }
              if (row.type === 'empty') {
                return (
                  <Text style={styles.empty}>
                    {t(row.title)}. {t(row.body)}
                  </Text>
                )
              }
              const item = row.item
              const correctionRow = 'corrected' in item
              return (
                <View style={styles.reply}>
                  <Pressable
                    style={styles.replyWho}
                    onPress={() => openProfile(item.author.handle, here)}
                    accessibilityRole="button"
                  >
                    <Avatar
                      url={item.author.avatarUrl}
                      name={item.author.displayName}
                      seed={item.author._id}
                      size={36}
                    />
                    <Text style={styles.replyName} numberOfLines={1}>
                      {item.author.displayName}
                    </Text>
                    {item._id === (correctionRow ? topCorrectionId : topAnswerId) ? (
                      <View style={styles.topPill}>
                        <Text style={styles.topPillLabel}>{t('feed.topTag')}</Text>
                      </View>
                    ) : null}
                  </Pressable>

                  {'corrected' in item ? (
                    <View style={styles.card}>
                      <CorrectedLine original={post.body} corrected={item.corrected} />
                      {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                    </View>
                  ) : (
                    <View style={styles.takes}>
                      <Text style={styles.takeLabel}>{t('feed.normalTake')}</Text>
                      <AudioBubble media={item.media} />
                      {item.slowMedia ? (
                        <>
                          <Text style={styles.takeLabel}>{t('feed.slowTake')}</Text>
                          <AudioBubble media={item.slowMedia} />
                        </>
                      ) : null}
                      {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                    </View>
                  )}
                  {'corrected' in item && attachmentsOf(item).length > 0 ? (
                    <MediaGallery
                      items={attachmentsOf(item)}
                      onOpen={(index) => setViewing({ items: attachmentsOf(item), index })}
                      /*
                       * The thread's controls, not the feed's preview: several
                       * clips starting at once in a list of answers is the case
                       * autoplay is wrong for (`docs/decisions.md` → *A thread
                       * doesn't autoplay*). A single video still opens full
                       * screen — from the native controls' own button, since in
                       * this mode the tap belongs to the scrub bar — and a grid
                       * tile still opens the viewer.
                       */
                      videoMode="controls"
                    />
                  ) : null}
                  <View style={styles.likeRow}>
                    <LikeButton
                      targetType={correctionRow ? 'correction' : 'answer'}
                      targetId={item._id}
                      likeCount={item.likeCount}
                      likedByViewer={item.likedByViewer}
                      disabled={item.author._id === me.data?._id}
                      from={here}
                      size="small"
                    />
                    {/*
                  The recording, onto the card that asked for it. Drawn only
                  on an answer to a post one of your own cards opened — which
                  is the same condition the server checks, so a button that is
                  here always works.
                */}
                    {!correctionRow && keepsRecordings ? (
                      kept.has(item._id) ? (
                        <Text style={styles.keptLabel}>{t('echo.audioAlreadyKept')}</Text>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          disabled={attachAudio.isPending}
                          onPress={() => keepOnCard(item._id)}
                          style={({ pressed }) => (pressed ? styles.pressed : null)}
                        >
                          <Text style={styles.keepAction}>{t('echo.keepOnCard')}</Text>
                        </Pressable>
                      )
                    ) : null}
                    {/* The written answer, onto the same card: it replaces the
                    sentence, because a card whose sentence is wrong teaches
                    the mistake every time it comes back. */}
                    {correctionRow && keepsCorrections ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        disabled={applyCorrection.isPending}
                        onPress={() => keepCorrectionOnCard(item._id)}
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                      >
                        <Text style={styles.keepAction}>{t('echo.keepCorrection')}</Text>
                      </Pressable>
                    ) : null}
                    {item.author._id === me.data?._id ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => removeReply(item)}
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                      >
                        <Text style={styles.deleteAction}>
                          {t(correctionRow ? 'feed.deleteCorrection' : 'feed.deleteAnswer')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )
            }}
            /*
             * Comments live in the footer as a plain `.map`, not a second list.
             * A `FlatList` inside a `FlatList` on the same axis loses its
             * virtualisation and warns about it; these rows are text, so the
             * bounded map is both cheaper and honest about what it is.
             */
            ListFooterComponent={
              <View
                onLayout={(event: LayoutChangeEvent) => {
                  layout.current.footer = event.nativeEvent.layout.height
                  tryFocus()
                }}
              >
                {pager.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null}

                {/*
                The correction box, always open under the thread — on a post
                that asks for one, and has words to correct. Absent on your
                own post, and once you have answered: the thread above already
                carries your row. The screen's one yellow is its send button.
              */}
                {correcting && !mine && post.body.trim() ? (
                  post.correctedByViewer ? (
                    <View style={styles.done}>
                      <Feather name="check" size={16} color={colors.success} />
                      <Text style={styles.doneLabel}>{t('feed.youCorrected')}</Text>
                    </View>
                  ) : (
                    <View ref={correctionBox} collapsable={false} style={styles.compose}>
                      <View style={styles.composeHead}>
                        <Text style={styles.composeTitle}>{t('feed.yourCorrection')}</Text>
                        {/*
                        Seeded on request rather than by default: a correction
                        is usually an edit of the original, but a rewrite from
                        scratch should not have to delete it first.
                      */}
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => setCorrection(post.body)}
                          style={({ pressed }) => (pressed ? styles.pressed : null)}
                        >
                          <Text style={styles.accentAction}>{t('feed.startFromOriginal')}</Text>
                        </Pressable>
                      </View>
                      <FormField
                        value={correction}
                        onChangeText={setCorrection}
                        {...keyboard.fieldProps(correctionBox)}
                        placeholder={t('feed.correctionPlaceholder')}
                        multiline
                        autoCapitalize="sentences"
                        maxLength={MAX_POST_LENGTH}
                      />
                      <Button
                        label={correctPost.isPending ? t('feed.sending') : t('feed.sendCorrection')}
                        disabled={!correction.trim() || correctPost.isPending}
                        onPress={submitCorrection}
                      />
                      {/* What a correction pays, from `TOKEN_RULES` rather than the copy. */}
                      <Text style={styles.reward}>
                        {t('feed.correctionReward', { count: TOKEN_RULES.award.correction })}
                      </Text>
                    </View>
                  )
                ) : null}

                <View
                  onLayout={(event: LayoutChangeEvent) => {
                    layout.current.block = event.nativeEvent.layout.y
                    tryFocus()
                  }}
                >
                  <Text style={styles.sectionTitle}>{t('feed.allComments')}</Text>
                  {comments.length === 0 ? (
                    <Text style={styles.empty}>{t('feed.commentsEmptyBody')}</Text>
                  ) : null}
                  {comments.map((root) => (
                    <CommentThread
                      key={root._id}
                      root={root}
                      postId={post._id}
                      here={here}
                      expanded={expanded.has(root._id)}
                      onExpand={() => setExpanded((current) => new Set(current).add(root._id))}
                      onReply={startReply}
                      onMore={(comment, rootId) => void commentMore(comment, rootId)}
                      highlightId={focusCommentId}
                      onLayout={(event) => {
                        layout.current.threads.set(root._id, event.nativeEvent.layout.y)
                        tryFocus()
                      }}
                    />
                  ))}
                </View>
                {commentQuery.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void commentQuery.fetchNextPage()}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.showMore}>{t('feed.showMoreComments')}</Text>
                  </Pressable>
                ) : null}

                <View ref={commentBox} collapsable={false} style={styles.commentCompose}>
                  {/*
                    Which comment the box is answering, with the way out of it.
                    A strip above the field rather than a label inside it, so
                    it survives the field being cleared.
                  */}
                  {replyTarget ? (
                    <View style={styles.replyStrip}>
                      <Text style={styles.replyStripLabel} numberOfLines={1}>
                        {t('feed.replyingTo', { name: replyTarget.name })}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('feed.cancelReply')}
                        hitSlop={10}
                        onPress={() => setReplyTarget(null)}
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                      >
                        <Feather name="x" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ) : null}
                  <FormField
                    label={t('feed.addComment')}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    {...keyboard.fieldProps(commentBox)}
                    placeholder={t('feed.commentPlaceholder')}
                    multiline
                    autoCapitalize="sentences"
                    maxLength={MAX_COMMENT_LENGTH}
                  />
                  {/* Outlined, not yellow: the correction's send button is this screen's one commit. */}
                  <Button
                    label={
                      addComment.isPending
                        ? t('feed.sending')
                        : replyTarget
                          ? t('feed.reply')
                          : t('feed.comment')
                    }
                    variant="secondary"
                    disabled={!commentDraft.trim() || addComment.isPending}
                    onPress={submitComment}
                  />
                </View>
              </View>
            }
          />
        )}

        {/* The recorder, on a pronunciation request. Absent on your own, and once
          you have recorded — the thread above already carries your row. */}
        {post && pronouncing && !mine && !post.answeredByViewer ? (
          composing ? (
            <View style={styles.takes}>
              <Text style={styles.takeLabel}>{t('feed.normalTake')}</Text>
              {takes.fast ? <AudioBubble media={takes.fast} /> : null}
              <Button
                label={
                  recorder.isRecording && slot === 'fast'
                    ? `${t('feed.stopRecording')} · ${recorder.seconds}s`
                    : takes.fast
                      ? t('feed.recordAgain')
                      : t('feed.answerThis')
                }
                variant={takes.fast ? 'secondary' : 'primary'}
                disabled={uploading || (recorder.isRecording && slot !== 'fast')}
                onPress={() => void toggleRecording('fast')}
              />

              {/* Offered only once there is something to be slower than. */}
              {takes.fast ? (
                <>
                  <Text style={styles.takeLabel}>{t('feed.slowTake')}</Text>
                  {takes.slow ? <AudioBubble media={takes.slow} /> : null}
                  <Button
                    label={
                      recorder.isRecording && slot === 'slow'
                        ? `${t('feed.stopRecording')} · ${recorder.seconds}s`
                        : takes.slow
                          ? t('feed.recordAgain')
                          : t('feed.addSlowTake')
                    }
                    variant="secondary"
                    disabled={uploading || (recorder.isRecording && slot !== 'slow')}
                    onPress={() => void toggleRecording('slow')}
                  />
                </>
              ) : null}

              <View style={styles.composeActions}>
                <Button
                  label={
                    takeProgress && takeProgress.phase !== 'reading'
                      ? t('composer.uploadingPercent', { percent: percentOf(takeProgress) })
                      : answerPost.isPending || uploading
                        ? t('feed.sending')
                        : t('feed.sendAnswer')
                  }
                  disabled={!takes.fast || answerPost.isPending || uploading}
                  onPress={submitAnswer}
                  style={styles.grow}
                />
                <Button
                  label={t('common.cancel')}
                  variant="neutral"
                  onPress={() => {
                    void recorder.cancel()
                    setSlot(null)
                    setTakes({})
                    setComposing(false)
                  }}
                  style={styles.grow}
                />
              </View>
            </View>
          ) : (
            <View style={styles.footerBar}>
              <Button label={t('feed.answerThis')} onPress={() => setComposing(true)} />
            </View>
          )
        ) : null}
      </Animated.View>
      <PhotoViewer
        photos={viewing?.items ?? []}
        index={viewing?.index ?? null}
        onClose={() => setViewing(null)}
        onIndexChange={(index) => setViewing((open) => (open ? { ...open, index } : open))}
      />
    </Screen>
  )
}

/** The list's bottom padding, named because the comment focus measures from it. */
const LIST_BOTTOM_PADDING = 24

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  avoid: { flex: 1 },
  list: { paddingBottom: LIST_BOTTOM_PADDING },
  footer: { paddingVertical: spacing.lg },
  // 36 square: the glyph's own hit box, before `hitSlop` widens it.
  more: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  who: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  // The post's own Top badge; `topPill` below is the TOP tag on a correction row.
  topPost: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  meta: { color: colors.textFaint, fontSize: 13, fontWeight: '400' },
  body: { color: colors.text, fontSize: 22, lineHeight: 32, paddingBottom: 18 },
  media: { paddingBottom: 18 },
  actions: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 20,
    paddingBottom: 20,
  },
  actionMuted: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionEnd: { marginStart: 'auto' },
  echoRow: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingVertical: 10 },
  sectionTitle: {
    ...font.heading,
    color: colors.text,
    fontSize: 18,
    paddingBottom: 6,
    paddingTop: 22,
  },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 23, paddingVertical: 20 },
  reply: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingVertical: spacing.lg,
  },
  replyWho: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  replyName: { ...font.heading, color: colors.text, flex: 1, fontSize: 14 },
  topPill: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  topPillLabel: { color: colors.success, fontSize: 11, fontWeight: '700' },
  // The correction's card: the same green box the feed's top correction sits in.
  card: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  corrected: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  removed: { color: colors.textMuted, fontWeight: '400', textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  takes: { gap: 10, paddingVertical: spacing.sm },
  takeLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  likeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  deleteAction: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  // The same row as Delete, in the accent instead of the danger colour: this
  // one adds something.
  keepAction: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  // Said rather than offered: the recording is already there, and a disabled
  // button would leave the reader working out why it is greyed.
  keptLabel: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  done: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: 20 },
  doneLabel: { color: colors.success, fontSize: 14, fontWeight: '600' },
  compose: { gap: spacing.md, paddingTop: 22 },
  composeHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  composeTitle: { ...font.heading, color: colors.text, fontSize: 18 },
  accentAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  reward: { color: colors.textFaint, fontSize: 13, textAlign: 'center' },
  comment: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingVertical: spacing.md,
  },
  time: { color: colors.textFaint, fontSize: 12, fontWeight: '400', marginStart: 'auto' },
  commentBody: { color: colors.text, fontSize: 15, fontWeight: '400', lineHeight: 22 },
  showMore: { color: colors.accent, fontSize: 14, fontWeight: '600', paddingVertical: spacing.md },
  commentCompose: { gap: spacing.md, paddingTop: spacing.lg },
  replyStrip: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  replyStripLabel: { color: colors.textMuted, flex: 1, fontSize: 13, fontWeight: '600' },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, width: 'auto' },
  footerBar: { paddingBottom: spacing.sm, paddingTop: spacing.sm },
  pressed: { opacity: 0.6 },
}))
