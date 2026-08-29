import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useMe, usePostCorrections } from '../../../src/api/queries'
import { AudioBubble, ImageBubble } from '../../../src/components/MediaBubble'
import { Avatar } from '../../../src/components/ui/Avatar'
import { LikeButton } from '../../../src/components/LikeButton'
import { isImageContentType } from '@langx/shared'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { dedupeById } from '../../../src/lib/dedupeById'
import { listState } from '../../../src/lib/listState'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { relativeTime } from '../../../src/lib/format'
import { makeStyles } from '../../../src/lib/theme'
import { levelShortLabel, useDisplayNames, useLocale, useT } from '../../../src/i18n'

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
  // The post describes the whole thread, so the first page is the authority on
  // it — the same rule the viewers screen states about its summary.
  const post = query.data?.pages[0]?.post
  const items = dedupeById(query.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: query.isPending,
    isError: query.isError,
    itemCount: items.length,
  })

  const subtitle = post
    ? `${names.language(post.language)}${post.level ? ` ${levelShortLabel(t, post.level)}` : ''} · ${relativeTime(post.createdAt, { t, locale })}`
    : ''

  return (
    <Screen fluid>
      <Pressable onPress={() => goBackTo('/(app)/feed', from)} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </Pressable>

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
              <View style={styles.card}>
                <Pressable
                  style={styles.who}
                  onPress={() => openProfile(post.author.handle, here)}
                  accessibilityRole="button"
                >
                  <Avatar url={post.author.avatarUrl} name={post.author.displayName} size={38} />
                  <View style={styles.whoText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {post.author.displayName}
                    </Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                  </View>
                </Pressable>
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
                    disabled={post.author._id === me.data?._id}
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
          renderItem={({ item }) => (
            <View style={styles.correction}>
              <Pressable
                style={styles.who}
                onPress={() => openProfile(item.author.handle, here)}
                accessibilityRole="button"
              >
                <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={28} />
                <View style={styles.whoText}>
                  <Text style={styles.correctionName} numberOfLines={1}>
                    {item.author.displayName}
                  </Text>
                </View>
                <Text style={styles.subtitle}>{relativeTime(item.createdAt, { t, locale })}</Text>
              </Pressable>
              <Text style={styles.corrected}>{item.corrected}</Text>
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
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  loading: { marginTop: spacing.xxl },
  list: { gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  footer: { paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  who: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  correctionName: { ...font.label, color: colors.text, fontWeight: '600' },
  subtitle: { ...font.caption, color: colors.textMuted },
  body: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  sectionTitle: { ...font.heading, color: colors.text, marginTop: spacing.lg },
  correction: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
  },
  corrected: { ...font.label, color: colors.text, fontWeight: '600', lineHeight: 20, marginTop: 8 },
  note: { ...font.caption, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
  likeRow: { flexDirection: 'row', marginTop: 10 },
  media: { marginTop: 10 },
}))
