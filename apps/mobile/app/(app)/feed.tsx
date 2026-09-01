import {
  FEED_FILTERS,
  MAX_POST_LENGTH,
  POST_KINDS,
  type FeedFilter,
  type PostKind,
} from '@langx/shared'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { FormField } from '../../src/components/ui/FormField'
import { Button } from '../../src/components/ui/Button'
import { uploadPostMedia } from '../../src/api/queries'
import { useCorrectPost, useCreatePost, useDeletePost, useFeed, useMe } from '../../src/api/queries'
import type { CreatePostInput, FeedPost } from '../../src/api/types'
import { AttachmentBar, type PendingAttachment } from '../../src/components/AttachmentBar'
import { AudioBubble, ImageBubble } from '../../src/components/MediaBubble'
import { Avatar } from '../../src/components/ui/Avatar'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { authClient } from '../../src/lib/auth-client'
import { requireAccount } from '../../src/lib/requireAccount'
import { LikeButton } from '../../src/components/LikeButton'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { dedupeById } from '../../src/lib/dedupeById'
import { foldCorrection } from '../../src/lib/feedCache'
import { openPost, openProfile } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { useDisplayNames, useLocale, useT, type MessageKey } from '../../src/i18n'
import { isImageContentType } from '@langx/shared'
import { ApiRequestError } from '../../src/api/client'
import { showToast } from '../../src/lib/toast'
import { relativeTime } from '../../src/lib/format'

const FILTER_LABELS: Record<FeedFilter, MessageKey> = {
  needsCorrection: 'feed.needsCorrection',
  following: 'feed.following',
}

/**
 * The two halves of the feed. A `Record` keyed on `PostKind` rather than a list,
 * for the same reason `FILTER_LABELS` is one: adding a section without a label
 * has to be a compile error, not a screen that renders the enum value.
 */
const SECTION_LABELS: Record<PostKind, MessageKey> = {
  correction: 'feed.correctionSection',
  pronunciation: 'feed.pronunciationSection',
}

/**
 * The corrected sentence as one line, only the changed parts carrying colour —
 * see `foldCorrection`. The level of styling detail lives in this screen's
 * stylesheet so the fold itself stays pure.
 */
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

export default function FeedScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()

  const [section, setSection] = useState<PostKind>('correction')
  const [filter, setFilter] = useState<FeedFilter>('needsCorrection')
  /**
   * Composing happens inline rather than in a modal. Both things being written
   * here are *about* something on screen — a sentence you are unsure of, or
   * somebody else's sentence — and a sheet that covers the thing it refers to
   * makes the writer work from memory.
   */
  const [asking, setAsking] = useState(false)
  const [draft, setDraft] = useState('')
  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [correction, setCorrection] = useState('')
  const [askMedia, setAskMedia] = useState<PendingAttachment | null>(null)
  const [correctionMedia, setCorrectionMedia] = useState<PendingAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const { data: session } = authClient.useSession()
  const me = useMe()
  const feed = useFeed(section, filter)
  const createPost = useCreatePost()
  const correctPost = useCorrectPost()
  const deletePost = useDeletePost()
  const pronouncing = section === 'pronunciation'

  const items = dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: feed.isPending,
    isError: feed.isError,
    itemCount: items.length,
  })

  /**
   * The language you post in is the first one you are learning. Asking which
   * would be a second question on top of the sentence, and the overwhelming
   * majority of people here are learning exactly one.
   */
  const askLanguage = me.data?.learning[0]?.code

  /**
   * The attachment is uploaded here, on submit, not when it was picked.
   *
   * Picking is not committing: uploading then would spend a day's media quota
   * and leave bytes in the bucket for a post the writer went on to abandon.
   */
  async function attach(pending: PendingAttachment | null) {
    if (!pending) return undefined
    return uploadPostMedia(pending)
  }

  /**
   * Every failure used to read "the attachment did not upload", including the
   * ones that had nothing to do with an attachment — most visibly "you have
   * already corrected this", which is not an error the writer can act on by
   * retrying and is exactly what the retry it invited would hit again.
   */
  function reportWriteError(caught: unknown): void {
    // REST, so `instanceof` is the right check here. The `errorCodeOf`
    // workaround in the chat screen exists only because `emitWithAck` rejects
    // with a plain Error.
    if (!(caught instanceof ApiRequestError)) {
      showToast(t('feed.attachmentFailed'))
      return
    }
    if (caught.code === 'QUOTA_EXCEEDED') {
      showToast(t('feed.mediaQuota'))
      return
    }
    showToast(
      caught.code === 'VALIDATION_FAILED' ? t('feed.wrongPostKind') : t('feed.attachmentFailed'),
    )
  }

  function confirmDelete(postId: string): void {
    Alert.alert(t('feed.deleteConfirmTitle'), t('feed.deletePostConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('feed.deletePost'),
        style: 'destructive',
        onPress: () =>
          deletePost.mutate(postId, {
            onSuccess: () => showToast(t('feed.deleted')),
            onError: () => showToast(t('common.retry')),
          }),
      },
    ])
  }

  async function submitAsk(): Promise<void> {
    if (!requireAccount(session?.user)) return
    if (!askLanguage || !draft.trim() || uploading) return
    setUploading(true)
    let media
    try {
      media = await attach(askMedia)
    } catch {
      setUploading(false)
      showToast(t('feed.attachmentFailed'))
      return
    }
    setUploading(false)

    createPost.mutate(
      // `Profile.learning[].code` is a bare string on the DTO; `CreatePostInput`
      // wants the code union. The server validates it again either way.
      {
        body: draft.trim(),
        language: askLanguage as CreatePostInput['language'],
        kind: section,
        ...(media ? { media } : {}),
      },
      {
        onSuccess: () => {
          setDraft('')
          setAskMedia(null)
          setAsking(false)
          showToast(t('feed.posted'))
        },
        onError: reportWriteError,
      },
    )
  }

  function startCorrecting(post: FeedPost): void {
    setCorrectingId(post._id)
    // Seeded with the original, because a correction is an edit of it — making
    // someone retype a sentence they agree with except for one word is how
    // corrections stop happening.
    setCorrection(post.body)
  }

  async function submitCorrection(postId: string): Promise<void> {
    if (!requireAccount(session?.user)) return
    if (!correction.trim() || uploading) return
    setUploading(true)
    let media
    try {
      media = await attach(correctionMedia)
    } catch {
      setUploading(false)
      showToast(t('feed.attachmentFailed'))
      return
    }
    setUploading(false)

    correctPost.mutate(
      { postId, corrected: correction.trim(), ...(media ? { media } : {}) },
      {
        onSuccess: () => {
          setCorrectingId(null)
          setCorrection('')
          setCorrectionMedia(null)
          showToast(t('feed.correctionSent'))
        },
        onError: (caught) => {
          // The server's own duplicate guard, surfaced as the sentence it
          // actually is. The composer closes too: it is offering an action
          // that cannot succeed.
          if (caught instanceof ApiRequestError && caught.code === 'VALIDATION_FAILED') {
            setCorrectingId(null)
            setCorrectionMedia(null)
            showToast(t('feed.alreadyCorrected'))
            void feed.refetch()
            return
          }
          reportWriteError(caught)
        },
      },
    )
  }

  return (
    <Screen fluid>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('feed.title')}</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setAsking((open) => !open)}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Text style={styles.ask}>
              {asking ? t('common.cancel') : pronouncing ? t('feed.pronounceAsk') : t('feed.ask')}
            </Text>
          </Pressable>
        </View>
        {asking && askLanguage ? (
          <View style={styles.compose}>
            <FormField
              label={t(pronouncing ? 'feed.pronounceTitle' : 'feed.askTitle', {
                language: names.language(askLanguage),
              })}
              value={draft}
              onChangeText={setDraft}
              placeholder={t(pronouncing ? 'feed.pronouncePlaceholder' : 'feed.askPlaceholder')}
              multiline
              autoCapitalize="sentences"
              maxLength={MAX_POST_LENGTH}
            />
            <View style={styles.composeActions}>
              <AttachmentBar
                pending={askMedia}
                onPick={setAskMedia}
                onClear={() => setAskMedia(null)}
                disabled={createPost.isPending || uploading}
              />
              <Button
                label={createPost.isPending || uploading ? t('feed.posting') : t('feed.post')}
                disabled={!draft.trim() || createPost.isPending || uploading}
                onPress={() => void submitAsk()}
                style={styles.grow}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.sections}>
          <SegmentedControl<PostKind>
            options={POST_KINDS.map((option) => ({
              value: option,
              label: t(SECTION_LABELS[option]),
            }))}
            selected={[section]}
            onToggle={setSection}
            accessibilityLabel={t('feed.title')}
          />
        </View>

        {/*
          `needsCorrection` and `following` are controls on the correction
          queue, not on the feed as a whole: the pronunciation section has one
          order — unanswered first — and nothing to filter by yet. Showing them
          there would offer two switches that change nothing.
        */}
        {pronouncing ? null : (
          <View style={styles.filters}>
            <SegmentedControl<FeedFilter>
              options={FEED_FILTERS.map((option) => ({
                value: option,
                label: t(FILTER_LABELS[option]),
              }))}
              selected={[filter]}
              onToggle={setFilter}
              accessibilityLabel={t('feed.title')}
            />
          </View>
        )}
      </View>

      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
          }}
          ListEmptyComponent={
            pronouncing ? (
              <EmptyState
                icon="mic"
                title={t('feed.pronounceEmptyTitle')}
                body={t('feed.pronounceEmptyBody')}
              />
            ) : filter === 'following' ? (
              <EmptyState
                icon="users"
                title={t('feed.followingEmptyTitle')}
                body={t('feed.followingEmptyBody')}
              />
            ) : (
              <EmptyState
                icon="check-circle"
                title={t('feed.correctedEmptyTitle')}
                body={t('feed.correctedEmptyBody')}
              />
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item, index }) => {
            const mine = item.author._id === me.data?._id
            const replyCount = pronouncing ? item.answerCount : item.correctionCount
            return (
              <View style={[styles.row, index === items.length - 1 && styles.rowLast]}>
                <View style={styles.rowTop}>
                  <Pressable
                    style={styles.whoRow}
                    accessibilityRole="button"
                    onPress={() => openProfile(item.author.handle, '/(app)/feed')}
                  >
                    <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={40} />
                    <View style={styles.who}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.author.displayName}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.meta} numberOfLines={1}>
                          {names.language(item.language)}
                        </Text>
                        {item.level ? <LevelBars level={item.level} /> : null}
                        <Text style={styles.meta} numberOfLines={1}>
                          · {relativeTime(item.createdAt, { t, locale })}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  {/*
                    The danger colour for "nobody has answered", success once
                    somebody has. It is the same distinction the feed is
                    sorted by, so it should be the same colour the sort implies.

                    Pressable whether or not there are corrections: the thread
                    behind it is worth opening either way, and this is the one
                    affordance every row has.
                  */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openPost(item._id, '/(app)/feed')}
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.count, replyCount === 0 ? styles.countNone : styles.countSome]}
                    >
                      {replyCount === 0
                        ? t(pronouncing ? 'feed.noAnswers' : 'feed.noCorrections')
                        : t(pronouncing ? 'feed.answers' : 'feed.corrections', {
                            count: replyCount,
                          })}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                {item.media ? (
                  <View style={styles.media}>
                    {isImageContentType(item.media.contentType) ? (
                      <ImageBubble media={item.media} />
                    ) : (
                      <AudioBubble media={item.media} />
                    )}
                  </View>
                ) : null}

                <View style={styles.likeRow}>
                  <LikeButton
                    targetType="post"
                    targetId={item._id}
                    likeCount={item.likeCount}
                    likedByViewer={item.likedByViewer}
                    disabled={mine}
                    from="/(app)/feed"
                  />
                  {/*
                    Beside the like, and shown at zero as an invitation rather
                    than hidden like the like count is. A like at zero says
                    nothing worth a tap; "Comment" is the affordance itself.
                  */}
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => openPost(item._id, '/(app)/feed')}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.commentCount}>
                      {item.commentCount === 0
                        ? t('feed.comment')
                        : t('feed.comments', { count: item.commentCount })}
                    </Text>
                  </Pressable>
                  {mine ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      disabled={deletePost.isPending}
                      onPress={() => confirmDelete(item._id)}
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.deleteAction}>{t('feed.deletePost')}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {item.topAnswer ? (
                  <View style={styles.top}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openProfile(item.topAnswer!.author.handle, '/(app)/feed')}
                      hitSlop={6}
                    >
                      <Text style={styles.topLabel}>
                        {t('feed.normalTake')} · {item.topAnswer.author.displayName}
                      </Text>
                    </Pressable>
                    {/*
                      `AudioBubble` unchanged, half-speed toggle and all. The
                      two do not conflict: the toggle stretches this recording,
                      a slow take is the same person re-articulating, and a
                      learner may want either.
                    */}
                    <View style={styles.media}>
                      <AudioBubble media={item.topAnswer.media} />
                    </View>
                    {item.topAnswer.slowMedia ? (
                      <>
                        <Text style={styles.topLabel}>{t('feed.slowTake')}</Text>
                        <View style={styles.media}>
                          <AudioBubble media={item.topAnswer.slowMedia} />
                        </View>
                      </>
                    ) : null}
                    {item.topAnswer.note ? (
                      <Text style={styles.topNote}>{item.topAnswer.note}</Text>
                    ) : null}
                    <View style={styles.likeRow}>
                      <LikeButton
                        targetType="answer"
                        targetId={item.topAnswer._id}
                        likeCount={item.topAnswer.likeCount}
                        likedByViewer={item.topAnswer.likedByViewer}
                        disabled={item.topAnswer.author._id === me.data?._id}
                        from="/(app)/feed"
                      />
                    </View>
                  </View>
                ) : null}

                {item.topCorrection ? (
                  <View style={styles.top}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openProfile(item.topCorrection!.author.handle, '/(app)/feed')}
                      hitSlop={6}
                    >
                      <Text style={styles.topLabel}>
                        {t('feed.topCorrection')} {item.topCorrection.author.displayName}
                      </Text>
                    </Pressable>
                    <CorrectedLine original={item.body} corrected={item.topCorrection.corrected} />
                    {item.topCorrection.note ? (
                      <Text style={styles.topNote}>{item.topCorrection.note}</Text>
                    ) : null}
                    {item.topCorrection.media ? (
                      <View style={styles.media}>
                        {isImageContentType(item.topCorrection.media.contentType) ? (
                          <ImageBubble media={item.topCorrection.media} />
                        ) : (
                          <AudioBubble media={item.topCorrection.media} />
                        )}
                      </View>
                    ) : null}
                    <View style={styles.likeRow}>
                      <LikeButton
                        targetType="correction"
                        targetId={item.topCorrection._id}
                        likeCount={item.topCorrection.likeCount}
                        likedByViewer={item.topCorrection.likedByViewer}
                        disabled={item.topCorrection.author._id === me.data?._id}
                        from="/(app)/feed"
                      />
                    </View>
                  </View>
                ) : null}

                {/*
                  Recording happens on the post screen, not here. A recorder
                  inside a virtualised list is where audio-session bugs live —
                  a row can unmount mid-take — and the optional second take
                  needs room the card does not have.
                */}
                {pronouncing && !mine ? (
                  <View style={styles.actions}>
                    {item.answeredByViewer ? (
                      <Text style={styles.actionDone}>{t('feed.youAnswered')}</Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/feed')}
                        style={({ pressed }) => [styles.correctPill, pressed && styles.pressed]}
                      >
                        <Text style={styles.correctPillLabel}>{t('feed.answerThis')}</Text>
                      </Pressable>
                    )}
                    {item.answerCount > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/feed')}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.seeAll}>
                          {t('feed.seeAll', { count: item.answerCount })}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Your own post has nothing to act on: you cannot correct it,
                    and the count above already says whether anyone has. */}
                {!pronouncing && !mine && correctingId === item._id ? (
                  <View style={styles.compose}>
                    <FormField
                      label={t('feed.yourCorrection')}
                      value={correction}
                      onChangeText={setCorrection}
                      multiline
                      autoCapitalize="sentences"
                      maxLength={MAX_POST_LENGTH}
                    />
                    <AttachmentBar
                      pending={correctionMedia}
                      onPick={setCorrectionMedia}
                      onClear={() => setCorrectionMedia(null)}
                      disabled={correctPost.isPending || uploading}
                    />
                    <View style={styles.actions}>
                      <Button
                        label={
                          correctPost.isPending || uploading
                            ? t('feed.sending')
                            : t('feed.sendCorrection')
                        }
                        disabled={!correction.trim() || correctPost.isPending || uploading}
                        onPress={() => void submitCorrection(item._id)}
                        style={styles.grow}
                      />
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        onPress={() => {
                          setCorrectingId(null)
                          setCorrectionMedia(null)
                        }}
                        style={styles.grow}
                      />
                    </View>
                  </View>
                ) : !pronouncing && !mine ? (
                  <View style={styles.actions}>
                    {/*
                      A yellow pill on every uncorrected post, deliberately:
                      each one is a separate ask, and v3 repeats the commit per
                      ask. Once a post has answers the invitation relaxes to a
                      blue text action.
                    */}
                    {item.correctedByViewer ? (
                      <Text style={styles.actionDone}>{t('feed.youCorrected')}</Text>
                    ) : item.correctionCount === 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={correctPost.isPending}
                        onPress={() => startCorrecting(item)}
                        style={({ pressed }) => [styles.correctPill, pressed && styles.pressed]}
                      >
                        <Text style={styles.correctPillLabel}>{t('feed.correctThis')}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={correctPost.isPending}
                        onPress={() => startCorrecting(item)}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.addYours}>{t('feed.addYours')}</Text>
                      </Pressable>
                    )}
                    {item.correctionCount > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/feed')}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.seeAll}>
                          {t('feed.seeAll', { count: item.correctionCount })}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  header: { paddingTop: spacing.md },
  titleRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.title, color: colors.text, fontSize: 34 },
  ask: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  sections: { marginTop: 18 },
  filters: { marginTop: spacing.sm },
  compose: { gap: spacing.md, marginTop: spacing.md },
  grow: { flex: 1, width: 'auto' },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 20,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  whoRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minWidth: 0 },
  who: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 1 },
  meta: { color: colors.textMuted, flexShrink: 1, fontSize: 13, fontWeight: '400' },
  count: { fontSize: 13, fontWeight: '600' },
  countNone: { color: colors.danger },
  countSome: { color: colors.success },
  body: { ...font.body, color: colors.text, fontSize: 17, lineHeight: 26, marginTop: spacing.md },
  top: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topLabel: { color: colors.success, fontSize: 12, fontWeight: '700' },
  corrected: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 23, marginTop: 5 },
  removed: { color: colors.textMuted, fontWeight: '400', textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '800' },
  topNote: { ...font.caption, color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 20, marginTop: 14 },
  // `gap` and `alignItems` arrived with the comment count: this held one child
  // until then, so neither had anything to do.
  likeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: 10 },
  commentCount: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  deleteAction: { ...font.caption, color: colors.danger, fontWeight: '600' },
  media: { marginTop: 10 },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  correctPill: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
  },
  correctPillLabel: {
    color: colors.primaryText,
    fontFamily: font.heading.fontFamily,
    fontSize: 14,
    fontWeight: '800',
  },
  textAction: { justifyContent: 'center', minHeight: 44 },
  addYours: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  seeAll: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionDone: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
}))
