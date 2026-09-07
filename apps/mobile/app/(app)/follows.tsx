import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useFollows } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { dedupeById } from '../../src/lib/dedupeById'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

type Tab = 'followers' | 'following'

/**
 * One screen with two tabs rather than two routes.
 *
 * Not `profile/[handle]/followers.tsx`: nesting would force renaming the
 * existing profile screen to `index.tsx` and editing its `Tabs.Screen` entry,
 * for a URL nobody types.
 */
export default function FollowsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { userId, tab, from } = useLocalSearchParams<{ userId: string; tab?: Tab; from?: string }>()
  const [which, setWhich] = useState<Tab>(tab === 'following' ? 'following' : 'followers')

  const here = `/(app)/follows?userId=${userId}&tab=${which}`
  const follows = useFollows(userId, which)
  const pull = usePullToRefresh(() => follows.refetch())
  const items = dedupeById(follows.data?.pages.flatMap((page) => page.items) ?? [])

  /*
   * The segments carry the two totals. A page knows its cursor, not its
   * count, so the numbers come off the profile these lists belong to — the
   * same cache entry the profile screen that led here already filled. Until
   * it is there the segments say what they are without a number rather than
   * showing a zero that is not one.
   */
  const follow = useProfileCache([userId])[userId]?.follow
  const followersLabel = follow
    ? t('profile.followers', { count: follow.followers })
    : t('profile.followersTitle')
  const followingLabel = follow
    ? t('profile.followingCount', { count: follow.following })
    : t('profile.followingTitle')

  return (
    <Screen fluid>
      <ScreenHeader title={t('profile.people')} onBack={() => goBackTo('/(app)/(tabs)/me', from)} />

      <SegmentedControl
        options={[
          { value: 'followers', label: followersLabel },
          { value: 'following', label: followingLabel },
        ]}
        selected={[which]}
        onToggle={(value) => setWhich(value)}
        accessibilityLabel={`${followersLabel} / ${followingLabel}`}
      />

      {follows.isPending ? (
        <ActivityIndicator style={styles.loading} />
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
            <EmptyState
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
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => openProfile(item.handle, here)}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} seed={item._id} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.handle}>@{item.handle}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  handle: { color: colors.textMuted, fontSize: 14 },
}))
