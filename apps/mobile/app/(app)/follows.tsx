import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useFollows } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Chip } from '../../src/components/ui/Chip'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { dedupeById } from '../../src/lib/dedupeById'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

type Tab = 'followers' | 'following'
const TABS: Tab[] = ['followers', 'following']

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

  return (
    <Screen fluid>
      <Pressable onPress={() => goBackTo('/(app)/me', from)} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>
        {which === 'followers' ? t('profile.followersTitle') : t('profile.followingTitle')}
      </Text>

      <View style={styles.tabs}>
        {TABS.map((option) => (
          <Chip
            key={option}
            label={
              option === 'followers' ? t('profile.followersTitle') : t('profile.followingTitle')
            }
            selected={which === option}
            onPress={() => setWhich(option)}
          />
        ))}
      </View>

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
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openProfile(item.handle, here)}>
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
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  tabs: { flexDirection: 'row', gap: 7, marginTop: 14 },
  loading: { marginTop: spacing.xxl },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  footer: { paddingVertical: spacing.lg },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 8 },
  body: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  handle: { ...font.caption, color: colors.textMuted },
}))
