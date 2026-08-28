import {
  formatDistance,
  getLanguage,
  LEVEL_SHORT_LABELS,
  NEARBY_MAX_KM,
  NEARBY_RADIUS_OPTIONS_KM,
  type DiscoverySort,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  useDiscovery,
  useHasFeature,
  useIsPro,
  useMe,
  useShareLocation,
} from '../../src/api/queries'
import { ApiRequestError } from '../../src/api/client'
import type { DiscoveryItem } from '../../src/api/types'
import { DiscoveryCardSkeleton } from '../../src/components/skeletons/DiscoveryCardSkeleton'
import { Avatar } from '../../src/components/ui/Avatar'
import { Chip } from '../../src/components/ui/Chip'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import {
  activeCount,
  hasProFilters,
  parseFilters,
  toQuery,
  withoutProFilters,
} from '../../src/lib/discoveryFilters'
import { showAlert } from '../../src/lib/alert'
import { captureLocation, LOCATION_FAILURE_MESSAGE } from '../../src/lib/location'
import { openPaywall } from '../../src/lib/paywall'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { colors, font, radius, spacing } from '../../src/lib/theme'

const SORTS: { key: DiscoverySort; label: string }[] = [
  { key: 'recommended', label: 'For you' },
  { key: 'active', label: 'Active' },
  { key: 'nearby', label: 'Nearby' },
]

function LanguageLine({ item }: { item: DiscoveryItem }) {
  const speaks = item.nativeLanguages.map((l) => getLanguage(l.code)?.name ?? l.code).join(', ')
  const learns = item.learning
    .map((l) => `${getLanguage(l.code)?.name ?? l.code} ${LEVEL_SHORT_LABELS[l.level]}`)
    .join(', ')
  return (
    <Text style={styles.languages} numberOfLines={1}>
      {speaks} → {learns}
    </Text>
  )
}

export default function DiscoverScreen() {
  const params = useLocalSearchParams<Record<string, string>>()
  const [sort, setSort] = useState<DiscoverySort>('recommended')
  const [radiusKm, setRadiusKm] = useState<number>(NEARBY_MAX_KM)

  const isPro = useIsPro()
  const canUseNearby = useHasFeature('nearby')
  const me = useMe()
  const shareLocation = useShareLocation()
  const sharingLocation = me.data?.location !== undefined
  const filters = useMemo(() => parseFilters(params), [params])

  /**
   * Nearby has two preconditions and they fail differently, so the chip
   * resolves both before switching rather than letting the request come back
   * 403 or 409 and turning a missing setting into an error screen.
   *
   * Sharing is asked for here as well as in Settings because this is where
   * someone finds out they want it — sending them to Settings to find a
   * toggle, then back, is how a feature goes untried.
   */
  async function chooseNearby(): Promise<void> {
    if (!canUseNearby) {
      openPaywall('nearby')
      return
    }
    if (!sharingLocation && !(await enableSharing())) return
    setSort('nearby')
  }

  /** Captures a fix and sends it. `false` when the user or the device said no. */
  async function enableSharing(): Promise<boolean> {
    const fix = await captureLocation()
    if (!fix.ok) {
      void showAlert('Location needed', LOCATION_FAILURE_MESSAGE[fix.reason])
      return false
    }
    shareLocation.mutate({ lat: fix.lat, lng: fix.lng })
    return true
  }

  /**
   * A free account never sends a Pro filter, even when one reaches it — a
   * pasted URL, or a subscription that lapsed while the link sat in a tab.
   * The server would answer 403, and an error page is a worse response to
   * "here is a link to some people" than an unfiltered list.
   */
  const effective = isPro || !hasProFilters(filters) ? filters : withoutProFilters(filters)
  const query = useDiscovery({
    sort,
    ...toQuery(effective),
    // Only sent where it means something. On any other sort the server ignores
    // it, but sending it anyway would put it in the query string the cache is
    // keyed on and refetch every list each time the radius changed.
    ...(sort === 'nearby' ? { radiusKm: String(radiusKm) } : {}),
  })

  // Deduped for the reason `dedupeById` gives: presence moves
  // `stats.lastActiveAt` about once a minute now, so the `active` keyset can
  // hand back a profile already seen on an earlier page.
  const items = dedupeById(query.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: query.isPending,
    isError: query.isError,
    itemCount: items.length,
  })
  const count = activeCount(effective)
  const locationRevoked =
    query.error instanceof ApiRequestError && query.error.code === 'LOCATION_REQUIRED'

  return (
    <Screen fluid>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.filters}>
          {SORTS.map((option) => (
            <Chip
              key={option.key}
              label={option.key === 'nearby' && !canUseNearby ? `${option.label} ✦` : option.label}
              selected={sort === option.key}
              onPress={() => (option.key === 'nearby' ? void chooseNearby() : setSort(option.key))}
            />
          ))}
          <Chip
            // "Online first", not "Online": it is a sort modifier now, and a
            // label promising a filter would be describing the old behaviour.
            label="Online first"
            tone="accent"
            selected={effective.online === true}
            onPress={() => router.setParams(effective.online ? { online: '' } : { online: '1' })}
          />
          {/* Advanced filters are the Pro hook, so the control is shown to
              everyone and the *screen* handles the upsell — hiding it makes
              the paywall a surprise instead of an offer. Free filters still
              live behind it, which is why a free account opens the filters
              rather than the paywall. */}
          <Chip
            label={count > 0 ? `Filters · ${count}` : isPro ? 'Filters' : 'Filters ✦'}
            tone="pro"
            selected={count > 0}
            onPress={() => router.push({ pathname: '/(app)/filters', params })}
          />
        </View>

        {/* Only while it applies. A radius row above a list that is not sorted
            by distance would be a control with nothing to control. */}
        {sort === 'nearby' ? (
          <View style={styles.filters}>
            {NEARBY_RADIUS_OPTIONS_KM.map((km) => (
              <Chip
                key={km}
                label={`${km} km`}
                tone="accent"
                selected={radiusKm === km}
                onPress={() => setRadiusKm(km)}
              />
            ))}
          </View>
        ) : null}
      </View>

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <DiscoveryCardSkeleton key={key} />
          ))}
        </View>
      ) : locationRevoked ? (
        /**
         * The client checked before switching, so reaching here means sharing
         * was withdrawn since — on another device, or in Settings while this
         * screen sat in the background. Recoverable in one tap, so it is
         * offered as one rather than as an error.
         */
        <EmptyState
          emoji="📍"
          title="Location sharing is off"
          body="Nearby needs to know roughly where you are. Nothing precise is stored, and nobody sees more than a rough distance."
          actionLabel={shareLocation.isPending ? 'Turning on…' : 'Turn it on'}
          onAction={() => void enableSharing()}
        />
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
            sort === 'nearby' ? (
              // Two things narrow this list that narrow no other, and a user
              // who is not told about the second one concludes the feature is
              // broken rather than that the pool is small.
              <EmptyState
                emoji="📍"
                title={`Nobody within ${radiusKm} km`}
                body="Only people who have turned on location sharing appear here. Try a wider radius, or one of the other tabs."
              />
            ) : (
              <EmptyState
                emoji="🔍"
                title="Nobody here yet"
                body="People whose languages match yours in both directions show up here. Try loosening the filters."
              />
            )
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
                {item.distanceKm !== undefined ? (
                  // `formatDistance` words it as the bound it is — the server
                  // sends a bucket edge, never a measured distance.
                  <Text style={styles.distance}>📍 {formatDistance(item.distanceKm)}</Text>
                ) : null}
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
  distance: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  bio: { ...font.caption, color: colors.textMuted, marginTop: 2 },
})

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
