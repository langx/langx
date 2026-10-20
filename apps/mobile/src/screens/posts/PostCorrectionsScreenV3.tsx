import Feather from '@expo/vector-icons/Feather'
import type { AuthoredCorrection } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useAuthoredCorrections, useAuthoredPosts } from '../../api/queries'
import { LoadFailed } from '../../components/LoadFailed'
import { PostListRowV3 } from '../../components/posts/PostListRowV3'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyNoteV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { dedupeById } from '../../lib/dedupeById'
import { foldCorrection } from '../../lib/feedCache'
import { relativeTime } from '../../lib/format'
import { listState } from '../../lib/listState'
import { goBackTo, openPost } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * Somebody's writing in the v3 look (`V-PostCorrections`), behind
 * `flags.v3Home`: the corrections they wrote on posts, and their own posts,
 * a tab each. The queries, the paging, the tabs and where every row goes are
 * `post-corrections.tsx`'s, and so is the note that says chat corrections
 * stay in their chats.
 */
export function PostCorrectionsScreenV3() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const params = useLocalSearchParams<{ handle: string; from?: string; tab?: string }>()
  const { handle, from } = params
  const [tab, setTab] = useState<'posts' | 'corrections'>(
    params.tab === 'posts' ? 'posts' : 'corrections',
  )

  const posts = useAuthoredPosts(handle ?? '')
  const page = useAuthoredCorrections(handle ?? '')
  const postItems = useMemo(
    () => dedupeById(posts.data?.pages.flatMap((p) => p.items) ?? []),
    [posts.data],
  )
  const items = useMemo(
    () => dedupeById(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )

  const active = tab === 'posts' ? posts : page
  const state = listState({
    isPending: active.isPending,
    isError: active.isError,
    itemCount: tab === 'posts' ? postItems.length : items.length,
    isPaused: active.fetchStatus === 'paused',
  })

  const here = `/(app)/post-corrections?handle=${handle}`

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={t(tab === 'posts' ? 'tabs.feed' : 'me.corrections')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
      />
      {handle ? <Text style={styles.whose}>@{handle}</Text> : null}

      <View style={styles.controls}>
        <SegmentedControl
          options={[
            { value: 'posts', label: t('corrections.tabPosts') },
            { value: 'corrections', label: t('corrections.tabCorrections') },
          ]}
          selected={[tab]}
          onToggle={(value) => setTab(value)}
          accessibilityLabel={`${t('corrections.tabPosts')} / ${t('corrections.tabCorrections')}`}
        />
        {tab === 'corrections' ? (
          <View style={styles.note}>
            <Feather name="lock" size={v3.icon.xs} color={v3.colors.muted} />
            <Text style={styles.noteText}>{t('corrections.publicNote')}</Text>
          </View>
        ) : null}
      </View>

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.skeleton}>
              <Skeleton width={104} height={14} />
              <Skeleton width="100%" height={18} />
              <Skeleton width="58%" height={18} />
            </View>
          ))}
        </View>
      ) : state === 'failed' ? (
        <LoadFailed onRetry={() => void active.refetch()} />
      ) : state === 'empty' ? (
        tab === 'posts' ? (
          <EmptyNoteV3
            icon="message-square"
            title={t('corrections.publicPostsEmptyTitle')}
            body={t('corrections.publicPostsEmptyBody', { handle: handle ?? '' })}
          />
        ) : (
          <EmptyNoteV3
            icon="edit-3"
            title={t('corrections.publicEmptyTitle')}
            body={t('corrections.publicEmptyBody', { handle: handle ?? '' })}
          />
        )
      ) : tab === 'posts' ? (
        <FlatList
          data={postItems}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            posts.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item }) => <PostListRowV3 post={item} from={here} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            page.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item }) => <Row correction={item} from={here} />}
        />
      )}
    </Screen>
  )
}

/**
 * The post's sentence struck through and the fix under it, only the changed
 * words in green — the strike is what carries the meaning for a reader who
 * cannot tell the two colours apart. Tapping opens the post.
 */
function Row({ correction, from }: { correction: AuthoredCorrection; from: string }) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { locale, isRtl } = useLocale()
  const names = useDisplayNames()
  const runs = useMemo(
    () => foldCorrection(correction.original, correction.corrected),
    [correction.original, correction.corrected],
  )

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPost(correction.postId, from)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <View style={styles.top}>
          <Text style={styles.language}>{names.language(correction.language)}</Text>
          <Text style={styles.when}>{relativeTime(correction.createdAt, { t, locale })}</Text>
        </View>
        <Text style={styles.original}>{correction.original}</Text>
        <Text style={styles.corrected}>
          {runs
            .filter((run) => run.kind !== 'removed')
            .map((run, at) => (
              <Text key={at} style={run.kind === 'added' ? styles.added : null}>
                {run.text}
              </Text>
            ))}
        </Text>
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ v3 }) => ({
  whose: { ...v3.type.callout, color: v3.colors.muted, paddingBottom: v3.space[4] },
  controls: { gap: v3.space[10], paddingBottom: v3.space[4], paddingTop: v3.space[8] },
  note: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: v3.space[8],
    paddingHorizontal: v3.space[6],
  },
  noteText: { ...v3.type.caption, color: v3.colors.muted, flex: 1 },
  loading: { paddingVertical: v3.space[16] },
  list: { gap: v3.space[8], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  skeleton: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    padding: v3.space[14],
  },
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[12],
    paddingStart: v3.space[14],
    paddingTop: v3.space[12],
  },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: v3.space[6], minWidth: 0 },
  top: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  language: { ...v3.type.caption, color: v3.colors.echoText, flex: 1, fontWeight: '800' },
  when: { ...v3.type.caption, color: v3.colors.muted },
  original: {
    ...v3.type.caption,
    color: v3.colors.muted,
    fontSize: 15,
    textDecorationLine: 'line-through',
  },
  corrected: { ...v3.type.body, color: v3.colors.fg, fontWeight: '600' },
  added: { color: v3.colors.correction, fontWeight: '800' },
}))
