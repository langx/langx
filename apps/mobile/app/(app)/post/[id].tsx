import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { MAX_COMMENT_LENGTH, MAX_POST_LENGTH } from '@langx/shared'
import {
  uploadPostMedia,
  useAddComment,
  useAnswerPronunciation,
  useCorrectPost,
  useDeleteAnswer,
  useDeleteComment,
  useDeleteCorrection,
  useDeletePost,
  useMe,
  usePostAnswers,
  usePostComments,
  usePostCorrections,
} from '../../../src/api/queries'
import type { Media, PostCorrection, PronunciationAnswer } from '../../../src/api/types'
import { AudioBubble, MediaGallery } from '../../../src/components/MediaBubble'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { LevelBars } from '../../../src/components/ui/LevelBars'
import { LikeButton } from '../../../src/components/LikeButton'
import { attachmentsOf } from '@langx/shared'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { dedupeById } from '../../../src/lib/dedupeById'
import { foldCorrection } from '../../../src/lib/feedCache'
import { listState } from '../../../src/lib/listState'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { relativeTime } from '../../../src/lib/format'
import { confirmAlert } from '../../../src/lib/alert'
import { showToast } from '../../../src/lib/toast'
import { shareLink } from '../../../src/lib/share'
import { postShareText } from '../../../src/lib/shareText'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'

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
 * Everything on one post: its corrections or its recordings, and its comments.
 *
 * The feed card shows exactly one reply — the oldest — because a page of cards
 * cannot afford to carry a popular post's whole answer list. This is where the
 * rest live, and until it existed the card's "See all N" was a label on nothing.
 */
export default function PostScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const me = useMe()

  const here = `/(app)/post/${id}`
  /*
   * The corrections endpoint runs on every post, whatever its kind, because it
   * is the one that carries the post itself — and on a pronunciation request it
   * is a single index seek returning nothing. The alternative, threading a
   * `kind` through `openPost`, breaks on a cold deep link, where the only thing
   * this screen has is an id.
   */
  const query = usePostCorrections(id)
  const post = query.data?.pages[0]?.post
  const pronouncing = post?.kind === 'pronunciation'
  const answerQuery = usePostAnswers(id, pronouncing)
  const commentQuery = usePostComments(id)

  const correctPost = useCorrectPost()
  const answerPost = useAnswerPronunciation()
  const addComment = useAddComment()
  const deletePost = useDeletePost()
  const deleteCorrection = useDeleteCorrection()
  const deleteAnswer = useDeleteAnswer()
  const deleteComment = useDeleteComment()

  const [composing, setComposing] = useState(false)
  const [correction, setCorrection] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
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

  // One list, two row shapes. `'corrected' in item` is the discriminator the
  // renderer branches on — the two DTOs have no shared tag, and inventing one
  // would put a field on the wire whose only reader is this file.
  const replies: (PostCorrection | PronunciationAnswer)[] = pronouncing
    ? dedupeById(answerQuery.data?.pages.flatMap((page) => page.items) ?? [])
    : dedupeById(query.data?.pages.flatMap((page) => page.items) ?? [])
  const comments = dedupeById(commentQuery.data?.pages.flatMap((page) => page.items) ?? [])

  // The list is chronological; "Top" goes to the most-liked reply (the same
  // signal the feed's top panel surfaces), not to the oldest. No likes yet
  // means no Top — a tag every row could have said nothing.
  const topId = replies.reduce<{ id: string; likes: number } | null>(
    (best, item) =>
      item.likeCount > 0 && item.likeCount > (best?.likes ?? 0)
        ? { id: item._id, likes: item.likeCount }
        : best,
    null,
  )?.id

  const list = pronouncing ? answerQuery : query
  const state = listState({
    isPending: query.isPending,
    isError: query.isError,
    itemCount: replies.length,
  })

  const mine = post ? post.author._id === me.data?._id : false

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
  const replyCount = post ? (pronouncing ? post.answerCount : post.correctionCount) : 0
  const answeredByViewer = post
    ? pronouncing
      ? post.answeredByViewer
      : post.correctedByViewer
    : false

  function submitCorrection(): void {
    if (!post || !correction.trim() || correctPost.isPending) return
    correctPost.mutate(
      { postId: post._id, corrected: correction.trim() },
      {
        onSuccess: () => {
          setComposing(false)
          setCorrection('')
          showToast(t('feed.correctionSent'))
          // The mutation patches the feed pages; this thread's own pages it
          // does not know about, so the new row arrives by refetch.
          void query.refetch()
        },
        onError: () => showToast(t('common.retry')),
      },
    )
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
        const media = await uploadPostMedia({ kind: 'audio', ...recording })
        setTakes((current) => ({ ...current, [filling]: media }))
      } catch {
        showToast(t('feed.attachmentFailed'))
      } finally {
        setUploading(false)
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
        },
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  function submitComment(): void {
    if (!post || !commentDraft.trim() || addComment.isPending) return
    addComment.mutate(
      { postId: post._id, body: commentDraft.trim() },
      { onSuccess: () => setCommentDraft(''), onError: () => showToast(t('common.retry')) },
    )
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
        goBackTo('/(app)/feed', from)
      },
      onError: () => showToast(t('common.retry')),
    })
  }

  function removeReply(replyId: string): void {
    if (!post) return
    const done = {
      onSuccess: () => {
        showToast(t('feed.deleted'))
        void (pronouncing ? answerQuery : query).refetch()
        void query.refetch()
      },
      onError: () => showToast(t('common.retry')),
    }
    if (pronouncing) deleteAnswer.mutate({ postId: post._id, answerId: replyId }, done)
    else deleteCorrection.mutate({ postId: post._id, correctionId: replyId }, done)
  }

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('feed.post')}
        onBack={() => goBackTo('/(app)/feed', from)}
        trailing={
          post ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('share.post')}
              hitSlop={12}
              onPress={share}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Feather name="share" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null
        }
      />

      {state === 'skeleton' || !post ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={replies}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => {
                void query.refetch()
                if (pronouncing) void answerQuery.refetch()
              }}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
          }}
          ListHeaderComponent={
            <View>
              <View style={styles.post}>
                <View style={styles.postTop}>
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
                      <View style={styles.metaRow}>
                        <Text style={styles.meta} numberOfLines={1}>
                          {names.language(post.language)}
                        </Text>
                        {post.level ? <LevelBars level={post.level} /> : null}
                        <Text style={styles.meta} numberOfLines={1}>
                          · {relativeTime(post.createdAt, { t, locale })}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  <Text
                    style={[styles.count, replyCount === 0 ? styles.countNone : styles.countSome]}
                  >
                    {replyCount === 0
                      ? t(pronouncing ? 'feed.noAnswers' : 'feed.noCorrections')
                      : t(pronouncing ? 'feed.answers' : 'feed.corrections', { count: replyCount })}
                  </Text>
                </View>
                <Text style={styles.body}>{post.body}</Text>
                {attachmentsOf(post).length > 0 ? (
                  <View style={styles.media}>
                    <MediaGallery
                      items={attachmentsOf(post)}
                      onOpen={(index) => setViewing({ items: attachmentsOf(post), index })}
                    />
                  </View>
                ) : null}
                <View style={styles.likeRow}>
                  <LikeButton
                    targetType="post"
                    targetId={post._id}
                    likeCount={post.likeCount}
                    likedByViewer={post.likedByViewer}
                    disabled={mine}
                    from={here}
                  />
                  <Text style={styles.commentCount}>
                    {post.commentCount === 0
                      ? t('feed.comment')
                      : t('feed.comments', { count: post.commentCount })}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('share.post')}
                    hitSlop={8}
                    onPress={share}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.commentCount}>{t('share.action')}</Text>
                  </Pressable>
                  {mine ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      disabled={deletePost.isPending}
                      onPress={() => void confirmDeletePost()}
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.deleteAction}>{t('feed.deletePost')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Text style={styles.sectionTitle}>
                {t(pronouncing ? 'feed.allAnswers' : 'feed.allCorrections')}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={pronouncing ? 'mic' : 'edit-3'}
              title={t(pronouncing ? 'feed.answersEmptyTitle' : 'feed.correctionsEmptyTitle')}
              body={t(pronouncing ? 'feed.answersEmptyBody' : 'feed.correctionsEmptyBody')}
            />
          }
          renderItem={({ item, index }) => (
            <View
              style={[styles.correction, index === replies.length - 1 && styles.correctionLast]}
            >
              <Pressable
                style={styles.who}
                onPress={() => openProfile(item.author.handle, here)}
                accessibilityRole="button"
              >
                <Avatar
                  url={item.author.avatarUrl}
                  name={item.author.displayName}
                  seed={item.author._id}
                  size={28}
                />
                <Text style={styles.correctionName} numberOfLines={1}>
                  {item.author.displayName}
                </Text>
                {item._id === topId ? <Text style={styles.topTag}>{t('feed.topTag')}</Text> : null}
                <Text style={styles.time}>{relativeTime(item.createdAt, { t, locale })}</Text>
              </Pressable>

              {'corrected' in item ? (
                <CorrectedLine original={post.body} corrected={item.corrected} />
              ) : (
                <>
                  <Text style={styles.takeLabel}>{t('feed.normalTake')}</Text>
                  <View style={styles.media}>
                    <AudioBubble media={item.media} />
                  </View>
                  {item.slowMedia ? (
                    <>
                      <Text style={styles.takeLabel}>{t('feed.slowTake')}</Text>
                      <View style={styles.media}>
                        <AudioBubble media={item.slowMedia} />
                      </View>
                    </>
                  ) : null}
                </>
              )}
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              {'corrected' in item && attachmentsOf(item).length > 0 ? (
                <View style={styles.media}>
                  <MediaGallery
                    items={attachmentsOf(item)}
                    onOpen={(index) => setViewing({ items: attachmentsOf(item), index })}
                  />
                </View>
              ) : null}
              <View style={styles.likeRow}>
                <LikeButton
                  targetType={pronouncing ? 'answer' : 'correction'}
                  targetId={item._id}
                  likeCount={item.likeCount}
                  likedByViewer={item.likedByViewer}
                  disabled={item.author._id === me.data?._id}
                  from={here}
                />
                {item.author._id === me.data?._id ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => removeReply(item._id)}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.deleteAction}>
                      {t(pronouncing ? 'feed.deleteAnswer' : 'feed.deleteCorrection')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
          /*
           * Comments live in the footer as a plain `.map`, not a second list.
           * A `FlatList` inside a `FlatList` on the same axis loses its
           * virtualisation and warns about it; these rows are text, so the
           * bounded map is both cheaper and honest about what it is.
           */
          ListFooterComponent={
            <View>
              {list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null}
              <Text style={styles.sectionTitle}>{t('feed.allComments')}</Text>
              {comments.length === 0 ? (
                <Text style={styles.commentsEmpty}>{t('feed.commentsEmptyBody')}</Text>
              ) : null}
              {comments.map((item) => (
                <View key={item._id} style={styles.comment}>
                  <Pressable
                    style={styles.who}
                    onPress={() => openProfile(item.author.handle, here)}
                    accessibilityRole="button"
                  >
                    <Avatar
                      url={item.author.avatarUrl}
                      name={item.author.displayName}
                      seed={item.author._id}
                      size={24}
                    />
                    <Text style={styles.correctionName} numberOfLines={1}>
                      {item.author.displayName}
                    </Text>
                    <Text style={styles.time}>{relativeTime(item.createdAt, { t, locale })}</Text>
                  </Pressable>
                  <Text style={styles.commentBody}>{item.body}</Text>
                  {item.author._id === me.data?._id ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() =>
                        deleteComment.mutate(
                          { postId: post._id, commentId: item._id },
                          { onError: () => showToast(t('common.retry')) },
                        )
                      }
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.deleteAction}>{t('feed.deleteComment')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {commentQuery.hasNextPage ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void commentQuery.fetchNextPage()}
                  style={({ pressed }) => (pressed ? styles.pressed : null)}
                >
                  <Text style={styles.showMore}>{t('feed.showMoreComments')}</Text>
                </Pressable>
              ) : null}

              <View style={styles.commentCompose}>
                <FormField
                  label={t('feed.addComment')}
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder={t('feed.commentPlaceholder')}
                  multiline
                  autoCapitalize="sentences"
                  maxLength={MAX_COMMENT_LENGTH}
                />
                <Button
                  label={addComment.isPending ? t('feed.sending') : t('feed.comment')}
                  disabled={!commentDraft.trim() || addComment.isPending}
                  onPress={submitComment}
                />
              </View>
            </View>
          }
        />
      )}

      {/* The screen's one yellow. Absent on your own post, and once you have
          answered — the thread above already carries your row. */}
      {post && !mine && !answeredByViewer ? (
        composing ? (
          <View style={styles.compose}>
            {pronouncing ? (
              <>
                <Text style={styles.takeLabel}>{t('feed.normalTake')}</Text>
                {takes.fast ? (
                  <View style={styles.media}>
                    <AudioBubble media={takes.fast} />
                  </View>
                ) : null}
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
                    {takes.slow ? (
                      <View style={styles.media}>
                        <AudioBubble media={takes.slow} />
                      </View>
                    ) : null}
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
                      answerPost.isPending || uploading ? t('feed.sending') : t('feed.sendAnswer')
                    }
                    disabled={!takes.fast || answerPost.isPending || uploading}
                    onPress={submitAnswer}
                    style={styles.grow}
                  />
                  <Button
                    label={t('common.cancel')}
                    variant="secondary"
                    onPress={() => {
                      void recorder.cancel()
                      setSlot(null)
                      setTakes({})
                      setComposing(false)
                    }}
                    style={styles.grow}
                  />
                </View>
              </>
            ) : (
              <>
                <FormField
                  label={t('feed.yourCorrection')}
                  value={correction}
                  onChangeText={setCorrection}
                  multiline
                  autoCapitalize="sentences"
                  maxLength={MAX_POST_LENGTH}
                />
                <View style={styles.composeActions}>
                  <Button
                    label={correctPost.isPending ? t('feed.sending') : t('feed.sendCorrection')}
                    disabled={!correction.trim() || correctPost.isPending}
                    onPress={submitCorrection}
                    style={styles.grow}
                  />
                  <Button
                    label={t('common.cancel')}
                    variant="secondary"
                    onPress={() => setComposing(false)}
                    style={styles.grow}
                  />
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.footerBar}>
            <Button
              label={t(pronouncing ? 'feed.answerThis' : 'feed.addYours')}
              onPress={() => {
                // Seeded with the original, the same reason the feed gives:
                // a correction is an edit of it. A recording has nothing to seed.
                if (!pronouncing) setCorrection(post.body)
                setComposing(true)
              }}
            />
          </View>
        )
      ) : null}
      <PhotoViewer
        photos={viewing?.items ?? []}
        index={viewing?.index ?? null}
        onClose={() => setViewing(null)}
        onIndexChange={(index) => setViewing((open) => (open ? { ...open, index } : open))}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  post: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: 18,
    paddingTop: spacing.sm,
  },
  postTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  who: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 1 },
  meta: { color: colors.textMuted, flexShrink: 1, fontSize: 13, fontWeight: '400' },
  count: { fontSize: 13, fontWeight: '600' },
  countNone: { color: colors.danger },
  countSome: { color: colors.success },
  body: { ...font.body, color: colors.text, fontSize: 17, lineHeight: 26, marginTop: spacing.md },
  sectionTitle: { color: colors.textFaint, fontSize: 13, fontWeight: '600', paddingTop: 16 },
  correction: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  correctionLast: { borderBottomWidth: 0 },
  correctionName: { color: colors.text, flexShrink: 1, fontSize: 14, fontWeight: '700' },
  topTag: { color: colors.success, fontSize: 12, fontWeight: '700' },
  time: { color: colors.textFaint, fontSize: 12, fontWeight: '400', marginStart: 'auto' },
  corrected: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 23, marginTop: 10 },
  removed: { color: colors.textMuted, fontWeight: '400', textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: 13, fontWeight: '400', lineHeight: 20, marginTop: 6 },
  takeLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '600', marginTop: 10 },
  // `gap` and `alignItems` arrived with the comment count and the delete
  // action: this held one child until then.
  likeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: 10 },
  commentCount: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  deleteAction: { ...font.caption, color: colors.danger, fontWeight: '600' },
  comment: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 12 },
  commentBody: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 6,
  },
  commentsEmpty: { color: colors.textFaint, fontSize: 13, fontWeight: '400', paddingTop: 10 },
  commentCompose: { gap: spacing.sm, paddingTop: spacing.md },
  showMore: { color: colors.primary, fontSize: 13, fontWeight: '600', paddingVertical: 12 },
  media: { marginTop: 10 },
  compose: { gap: spacing.md, paddingVertical: spacing.md },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, width: 'auto' },
  footerBar: { paddingBottom: spacing.sm, paddingTop: spacing.sm },
  pressed: { opacity: 0.6 },
}))
