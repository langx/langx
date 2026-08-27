import { getLanguage } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useDiscovery, useMe } from '../../src/api/queries'
import type { DiscoveryItem } from '../../src/api/types'
import { Avatar } from '../../src/components/ui/Avatar'
import { Chip } from '../../src/components/ui/Chip'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { colors, font, radius, spacing } from '../../src/lib/theme'

const SORTS = [
  { key: 'recommended', label: 'For you' },
  { key: 'active', label: 'Active' },
] as const

function LanguageLine({ item }: { item: DiscoveryItem }) {
  const speaks = item.nativeLanguages.map((l) => getLanguage(l.code)?.name ?? l.code).join(', ')
  const learns = item.learning
    .map((l) => `${getLanguage(l.code)?.name ?? l.code} ${l.level}`)
    .join(', ')
  return (
    <Text style={styles.languages} numberOfLines={1}>
      {speaks} → {learns}
    </Text>
  )
}

export default function DiscoverScreen() {
  const me = useMe()
  const [sort, setSort] = useState<'recommended' | 'active'>('recommended')
  const [onlineOnly, setOnlineOnly] = useState(false)

  const query = useDiscovery({
    sort,
    ...(onlineOnly ? { online: 'true' } : {}),
  })

  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const isPro = me.data?.entitlement.tier === 'pro'

  return (
    <Screen fluid>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.filters}>
          {SORTS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              selected={sort === option.key}
              onPress={() => setSort(option.key)}
            />
          ))}
          <Chip
            label="Online"
            tone="accent"
            selected={onlineOnly}
            onPress={() => setOnlineOnly((v) => !v)}
          />
          {/* Advanced filters are the Pro hook. Showing the control and
              routing to the paywall sells better than hiding it entirely —
              the user has to see what they are missing. */}
          <Chip
            label={isPro ? 'Filters' : 'Filters ✦'}
            tone="pro"
            onPress={() => router.push(isPro ? '/(app)/settings' : '/(app)/paywall')}
          />
        </View>
      </View>

      {query.isPending ? (
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
          ListEmptyComponent={
            <EmptyState
              emoji="🔍"
              title="Nobody here yet"
              body="People whose languages match yours in both directions show up here. Try loosening the filters."
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/profile/${item.handle}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} online={item.isOnline} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.age}>{item.age}</Text>
                  {item.streak.current > 0 ? (
                    <Text style={styles.streak}>🔥{item.streak.current}</Text>
                  ) : null}
                </View>
                <LanguageLine item={item} />
                {item.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>
                    {item.bio}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md },
  title: { ...font.title, color: colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
  footer: { paddingVertical: spacing.lg },
  card: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  cardPressed: { backgroundColor: colors.surface, borderRadius: radius.md },
  cardBody: { flex: 1 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { ...font.body, color: colors.text, flexShrink: 1, fontWeight: '700' },
  age: { ...font.caption, color: colors.textMuted },
  streak: { ...font.caption, color: colors.streak, fontWeight: '700' },
  languages: { ...font.caption, color: colors.accent, marginTop: 2 },
  bio: { ...font.caption, color: colors.textMuted, marginTop: 2 },
})
