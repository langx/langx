import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { MAX_POST_LENGTH } from '@langx/shared'
import { useCorrectPost, useMe, usePostCorrections } from '../../../src/api/queries'
import { AudioBubble, ImageBubble } from '../../../src/components/MediaBubble'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { LevelBars } from '../../../src/components/ui/LevelBars'
import { LikeButton } from '../../../src/components/LikeButton'
import { isImageContentType } from '@langx/shared'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { dedupeById } from '../../../src/lib/dedupeById'
import { foldCorrection } from '../../../src/lib/feedCache'
import { listState } from '../../../src/lib/listState'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { relativeTime } from '../../../src/lib/format'
import { showToast } from '../../../src/lib/toast'
import { makeStyles } from '../../../src/lib/theme'
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
 * Every correction on one post.
 *
 * The feed card shows exactly one — the oldest — because a page of cards cannot
 * afford to carry a popular post's whole answer list. This is where the rest
 * live, and until it existed the card's "See all N" was a label on nothing.
 */
export default function PostScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const me = useMe()

  const here = `/(app)/post/${id}`
  const query = usePostCorrections(id)
  const correctPost = useCorrectPost()
  const [composing, setComposing] = useState(false)
  const [correction, setCorrection] = useState('')
  // The post describes the whole thread, so the first page is the authority on
  // it — the same rule the viewers screen states about its summary.
  const post = query.data?.pages[0]?.post
  const items = dedupeById(query.data?.pages.flatMap((page) => page.items) ?? [])
  // The list is chronological; "Top" goes to the most-liked correction (the
  // same signal the feed's top-correction panel surfaces), not to the oldest.
  // No likes yet means no Top — a tag every row could have said nothing.
  const topId = items.reduce<{ id: string; likes: number } | null>(
    (best, item) =>
      item.likeCount > 0 && item.likeCount > (best?.likes ?? 0)
        ? { id: item._id, likes: item.likeCount }
        : best,
    null,
  )?.id
  const state = listState({
    isPending: query.isPending,
    isError: query.isError,
    itemCount: items.length,
  })

  const mine = post ? post.author._id === me.data?._id : false

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

  return (
    <Screen fluid>
      <ScreenHeader title={t('feed.post')} onBack={() => goBackTo('/(app)/feed', from)} />

      {state === 'skeleton' || !post ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
          }}
          ListFooterComponent={
            query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListHeaderComponent={
            <View>
              <View style={styles.post}>
                <View style={styles.postTop}>
                  <Pressable
                    style={styles.who}
                    onPress={() => openProfile(post.author.handle, here)}
                    accessibilityRole="button"
                  >
                    <Avatar url={post.author.avatarUrl} name={post.author.displayName} size={40} />
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
                    style={[
                      styles.count,
                      post.correctionCount === 0 ? styles.countNone : styles.countSome,
                    ]}
                  >
                    {post.correctionCount === 0
                      ? t('feed.noCorrections')
                      : t('feed.corrections', { count: post.correctionCount })}
                  </Text>
                </View>
                <Text style={styles.body}>{post.body}</Text>
                {post.media ? (
                  <View style={styles.media}>
                    {isImageContentType(post.media.contentType) ? (
                      <ImageBubble media={post.media} />
                    ) : (
                      <AudioBubble media={post.media} />
                    )}
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
                </View>
              </View>
              <Text style={styles.sectionTitle}>{t('feed.allCorrections')}</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="edit-3"
              title={t('feed.correctionsEmptyTitle')}
              body={t('feed.correctionsEmptyBody')}
            />
          }
          renderItem={({ item, index }) => (
            <View style={[styles.correction, index === items.length - 1 && styles.correctionLast]}>
              <Pressable
                style={styles.who}
                onPress={() => openProfile(item.author.handle, here)}
                accessibilityRole="button"
              >
                <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={28} />
                <Text style={styles.correctionName} numberOfLines={1}>
                  {item.author.displayName}
                </Text>
                {item._id === topId ? <Text style={styles.topTag}>{t('feed.topTag')}</Text> : null}
                <Text style={styles.time}>{relativeTime(item.createdAt, { t, locale })}</Text>
              </Pressable>
              <CorrectedLine original={post.body} corrected={item.corrected} />
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
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
                  targetType="correction"
                  targetId={item._id}
                  likeCount={item.likeCount}
                  likedByViewer={item.likedByViewer}
                  disabled={item.author._id === me.data?._id}
                  from={here}
                />
              </View>
            </View>
          )}
        />
      )}

      {/* The screen's one yellow. Absent on your own post, and once you have
          answered — the thread above already carries your row. */}
      {post && !mine && !post.correctedByViewer ? (
        composing ? (
          <View style={styles.compose}>
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
          </View>
        ) : (
          <View style={styles.footerBar}>
            <Button
              label={t('feed.addYours')}
              onPress={() => {
                // Seeded with the original, the same reason the feed gives:
                // a correction is an edit of it.
                setCorrection(post.body)
                setComposing(true)
              }}
            />
          </View>
        )
      ) : null}
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
  likeRow: { flexDirection: 'row', marginTop: 10 },
  media: { marginTop: 10 },
  compose: { gap: spacing.md, paddingVertical: spacing.md },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, width: 'auto' },
  footerBar: { paddingBottom: spacing.sm, paddingTop: spacing.sm },
}))
