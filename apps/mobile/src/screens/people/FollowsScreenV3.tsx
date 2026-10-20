import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'
import { useFollows } from '../../api/queries'
import { PersonRowsSkeletonV3, PersonRowV3 } from '../../components/people/PersonRowV3'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyNoteV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useProfileCache } from '../../hooks/useProfileCache'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { dedupeById } from '../../lib/dedupeById'
import { goBackTo, openProfile } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

type Tab = 'followers' | 'following'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

/**
 * Followers and following in the v3 look (`V-Follows`), behind
 * `flags.v3Home`: one page, two segments carrying the totals. The lists,
 * the paging, the totals off the profile's cache — a word with no number
 * until it is there, never a zero — and where a row goes are `follows.tsx`'s.
 */
export function FollowsScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { userId, tab, from } = useLocalSearchParams<{ userId: string; tab?: Tab; from?: string }>()
  const [which, setWhich] = useState<Tab>(tab === 'following' ? 'following' : 'followers')

  const here = `/(app)/follows?userId=${userId}&tab=${which}`
  const follows = useFollows(userId, which)
  const pull = usePullToRefresh(() => follows.refetch())
  const items = dedupeById(follows.data?.pages.flatMap((page) => page.items) ?? [])

  const follow = useProfileCache([userId])[userId]?.follow
  const followersLabel = follow
    ? t('profile.followers', { count: follow.followers })
    : t('profile.followersTitle')
  const followingLabel = follow
    ? t('profile.followingCount', { count: follow.following })
    : t('profile.followingTitle')

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={t('profile.people')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
      />

      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'followers', label: followersLabel },
            { value: 'following', label: followingLabel },
          ]}
          selected={[which]}
          onToggle={(value) => setWhich(value)}
          accessibilityLabel={`${followersLabel} / ${followingLabel}`}
        />
      </View>

      {follows.isPending ? (
        <PersonRowsSkeletonV3 rows={SKELETON_ROWS} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (follows.hasNextPage && !follows.isFetchingNextPage) void follows.fetchNextPage()
          }}
          ListFooterComponent={
            follows.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyNoteV3
              icon="users"
              title={
                which === 'followers'
                  ? t('profile.followersEmptyTitle')
                  : t('profile.followingEmptyTitle')
              }
              body={
                which === 'followers'
                  ? t('profile.followersEmptyBody')
                  : t('profile.followingEmptyBody')
              }
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
  segments: { paddingBottom: v3.space[14], paddingTop: v3.space[6] },
  list: { paddingBottom: v3.space[32] },
  footer: { paddingVertical: v3.space[16] },
}))
