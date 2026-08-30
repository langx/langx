import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useFollows } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { dedupeById } from '../../src/lib/dedupeById'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

type Tab = 'followers' | 'following'

/**
 * One screen with two tabs rather than two routes.
 *
 * Not `profile/[handle]/followers.tsx`: nesting would force renaming the
 * existing profile screen to `index.tsx` and editing its `Tabs.Screen` entry,
 * for a URL nobody types.
 */
export default function FollowsScreen() {
  const styles = useStyles()
  const t = useT()
  const { userId, tab, from } = useLocalSearchParams<{ userId: string; tab?: Tab; from?: string }>()
  const [which, setWhich] = useState<Tab>(tab === 'following' ? 'following' : 'followers')

  const here = `/(app)/follows?userId=${userId}&tab=${which}`
  const follows = useFollows(userId, which)
  const items = dedupeById(follows.data?.pages.flatMap((page) => page.items) ?? [])

  const followersLabel = t('profile.followersTitle')
  const followingLabel = t('profile.followingTitle')

  return (
    <Screen fluid>
      <ScreenHeader
        title={which === 'followers' ? followersLabel : followingLabel}
        onBack={() => goBackTo('/(app)/me', from)}
      />

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
          refreshControl={
            <RefreshControl
              refreshing={follows.isRefetching}
              onRefresh={() => void follows.refetch()}
            />
          }
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
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                // The last row leaves the list edge undrawn, v3-style.
                index < items.length - 1 && styles.divided,
                pressed && styles.pressed,
              ]}
              onPress={() => openProfile(item.handle, here)}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.handle}>@{item.handle}</Text>
              </View>
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
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 15 },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  pressed: { opacity: 0.7 },
  body: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  handle: { ...font.caption, color: colors.textMuted },
}))
