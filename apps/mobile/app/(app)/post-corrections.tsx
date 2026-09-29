import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useAuthoredCorrections, useAuthoredPosts } from '../../src/api/queries'
import type { AuthoredCorrection } from '@langx/shared'
import { LoadFailed } from '../../src/components/LoadFailed'
import { PostListRow } from '../../src/components/PostListRow'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useDisplayNames, useLocale, useT } from '../../src/i18n'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTime } from '../../src/lib/format'
import { goBackTo, openPost } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * What opens from the Corrections and Feed tiles on somebody's profile: the
 * corrections they have written on other people's posts, and their own posts.
 * One screen with a tab for each, opened on the tab of the tile that was
 * pressed, as on your own "Your writing" screen — and for the same reason not
 * one merged list: a post and a correction of somebody else's post are
 * different things, and interleaving them makes every next row a surprise.
 *
 * The corrections tab is post corrections only, which is less than the
 * Corrections tile: that counts chat corrections and pronunciation recordings too, and
 * both of those happen somewhere a stranger has no business reading. The note
 * over that tab is the whole reason it is honest — `/me/corrections` made the
 * same choice for the same reason, and said so in the same place.
 *
 * Its own route rather than a mode of `corrections.tsx`. That screen is lists
 * of your own things, one of them opening chats only you can go to. Nothing
 * here is yours and every row goes to a post, so the two share rows and
 * nothing else.
 */
export default function PostCorrectionsScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const params = useLocalSearchParams<{ handle: string; from?: string; tab?: string }>()
  const { handle, from } = params
  // The tab of the tile that opened it; a link without one is a corrections
  // link, which is all this screen used to be.
  const [tab, setTab] = useState<'posts' | 'corrections'>(
    params.tab === 'posts' ? 'posts' : 'corrections',
  )

  // Both mount, so switching tabs does not stall on a request that could have
  // been made while the first was being read.
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
    <Screen fluid>
      <ScreenHeader
        title={t(tab === 'posts' ? 'tabs.feed' : 'me.corrections')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
      />

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
        <Text style={styles.note}>{t('corrections.publicNote')}</Text>
      ) : null}

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <Skeleton width={104} height={13} />
              <Skeleton width="100%" height={16} />
              <Skeleton width="58%" height={16} />
            </View>
          ))}
        </View>
      ) : state === 'failed' ? (
        // Above the empty state rather than folded into it, as on the writing
        // screen: "nothing yet" is news, and a failed request is not.
        <LoadFailed onRetry={() => void active.refetch()} />
      ) : state === 'empty' ? (
        tab === 'posts' ? (
          <EmptyState
            icon="message-square"
            title={t('corrections.publicPostsEmptyTitle')}
            body={t('corrections.publicPostsEmptyBody', { handle: handle ?? '' })}
          />
        ) : (
          <EmptyState
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
          renderItem={({ item }) => <PostListRow post={item} from={here} />}
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
          renderItem={({ item }) => <Row correction={item} from={here} styles={styles} />}
        />
      )}
    </Screen>
  )
}

/**
 * The post's sentence and the fix under it, drawn the way the chat correction
 * bubble draws its pair. Reading the original is what tells you what the
 * correction was *for*, which a list of rewrites on their own cannot.
 *
 * Tapping opens the post, where the rest of it is — the other corrections, the
 * author, the like button. None of that belongs on a row whose job is to get
 * you there.
 */
function Row({
  correction,
  from,
  styles,
}: {
  correction: AuthoredCorrection
  from: string
  styles: ReturnType<typeof useStyles>
}) {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPost(correction.postId, from)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={styles.language}>{names.language(correction.language)}</Text>
        <Text style={styles.when}>{relativeTime(correction.createdAt, { t, locale })}</Text>
      </View>
      <Text style={styles.original}>{correction.original}</Text>
      <Text style={styles.corrected}>{correction.corrected}</Text>
    </Pressable>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.sm },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingTop: spacing.sm },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.6 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  when: { color: colors.textFaint, fontSize: 13 },
  language: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  // Not colour alone: the strike-through is what carries the meaning for a
  // reader who cannot tell the two hues apart.
  original: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  corrected: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23 },
}))
