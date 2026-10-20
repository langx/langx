import type { LikeTargetType } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native'
import { useLikers } from '../../api/queries'
import { PersonRowsSkeletonV3, PersonRowV3 } from '../../components/people/PersonRowV3'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyNoteV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { dedupeById } from '../../lib/dedupeById'
import { goBackTo, openProfile } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

/**
 * Who liked one post or one correction, in the v3 look (`V-Likes`), behind
 * `flags.v3Home`. The list, the paging and where a row goes are
 * `likes.tsx`'s — and, as there, no count in the title: this list hides
 * people you blocked and the card's number does not.
 */
export function LikesScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { targetType, targetId, from } = useLocalSearchParams<{
    targetType: LikeTargetType
    targetId: string
    from?: string
  }>()

  const here = `/(app)/likes?targetType=${targetType}&targetId=${targetId}`
  const likers = useLikers(targetType, targetId)
  const pull = usePullToRefresh(() => likers.refetch())
  const items = dedupeById(likers.data?.pages.flatMap((page) => page.items) ?? [])

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={t('feed.likedBy')}
        onBack={() => goBackTo('/(app)/(tabs)/feed', from)}
      />

      {likers.isPending ? (
        <PersonRowsSkeletonV3 rows={SKELETON_ROWS} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (likers.hasNextPage && !likers.isFetchingNextPage) void likers.fetchNextPage()
          }}
          ListFooterComponent={
            likers.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyNoteV3
              icon="heart"
              title={t('feed.likersEmptyTitle')}
              body={t('feed.likersEmptyBody')}
            />
          }
          renderItem={({ item, index }) => (
            <PersonRowV3
              person={item}
              first={index === 0}
              last={index === items.length - 1}
              onPress={() => openProfile(item.handle, here)}
            />
          )}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  list: { paddingBottom: v3.space[32], paddingTop: v3.space[6] },
  footer: { paddingVertical: v3.space[16] },
}))
