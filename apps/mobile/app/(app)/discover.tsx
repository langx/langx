import {
  countryFlag,
  formatDistance,
  NEARBY_MAX_KM,
  NEARBY_RADIUS_OPTIONS_KM,
  type DiscoverySort,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { openProfile } from '../../src/lib/navigation'
import { useMemo, useState } from 'react'
import Feather from '@expo/vector-icons/Feather'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  useDiscovery,
  useHandleSearch,
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
import { LevelBars } from '../../src/components/ui/LevelBars'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import {
  activeCount,
  hasProFilters,
  parseFilters,
  toQuery,
  withoutProFilters,
} from '../../src/lib/discoveryFilters'
import { useDebounced } from '../../src/hooks/useDebounced'
import { showAlert } from '../../src/lib/alert'
import { captureLocation, LOCATION_FAILURE_KEY } from '../../src/lib/location'
import { openPaywall } from '../../src/lib/paywall'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useDisplayNames, useT, type MessageKey } from '../../src/i18n'

const SORTS: { key: DiscoverySort; label: MessageKey }[] = [
  { key: 'recommended', label: 'discover.forYou' },
  { key: 'active', label: 'discover.active' },
  { key: 'nearby', label: 'discover.nearby' },
]

function LanguageLine({ item }: { item: DiscoveryItem }) {
  const styles = useStyles()
  const names = useDisplayNames()

  const speaks = item.nativeLanguages.map((l) => names.language(l.code)).join(', ')
  const learns = item.learning.map((l) => names.language(l.code)).join(', ')
  // The bars carry the level now, so the names lose their level words. One
  // glyph for the pair: the first learning language's level, which is also the
  // one the match was made on.
  const level = item.learning[0]?.level
  return (
    <View style={styles.pairLine}>
      <Text style={styles.languages} numberOfLines={1}>
        {speaks} → {learns}
      </Text>
      {level ? <LevelBars level={level} /> : null}
    </View>
  )
}

export default function DiscoverScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const params = useLocalSearchParams<Record<string, string>>()
  const [sort, setSort] = useState<DiscoverySort>('recommended')
  const [radiusKm, setRadiusKm] = useState<number>(NEARBY_MAX_KM)
  const [searching, setSearching] = useState(false)
  const [term, setTerm] = useState('')
  // The input renders `term` and the query follows the settled value, so
  // typing stays responsive and "behic" is one request rather than five.
  const search = useHandleSearch(useDebounced(term))

  // Both the arrow and any future caller mean the same two things by it, and
  // forgetting the second one leaves a stale query behind the next open.
  function closeSearch(): void {
    setSearching(false)
    setTerm('')
  }

  const isPro = useIsPro()
  const canUseNearby = useHasFeature('nearby')
  const me = useMe()
  const shareLocation = useShareLocation()
  const sharingLocation = me.data?.location !== undefined
  const filters = useMemo(() => parseFilters(params), [params])

  /** "TR → ES" — the first of each, since the header has room for one pair. */
  const pair = useMemo(() => {
    const speaks = me.data?.nativeLanguages[0]?.code
    const learns = me.data?.learning[0]?.code
    return speaks && learns ? `${speaks.toUpperCase()} → ${learns.toUpperCase()}` : null
  }, [me.data])

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
      openPaywall('nearby', '/(app)/discover')
      return
    }
    if (!sharingLocation && !(await enableSharing())) return
    setSort('nearby')
  }

  /** Captures a fix and sends it. `false` when the user or the device said no. */
  async function enableSharing(): Promise<boolean> {
    const fix = await captureLocation()
    if (!fix.ok) {
      void showAlert(t('location.needed'), t(LOCATION_FAILURE_KEY[fix.reason]))
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
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('discover.title')}</Text>
          {/* Which direction this list is matched in. Every row below is
              someone native in what you are learning and learning what you
              speak, and without this the list looks unsorted rather than
              matched. */}
          {pair ? <Text style={styles.pair}>{pair}</Text> : null}
          {/* Advanced filters are the Pro hook, so the control is shown to
              everyone and the *screen* handles the upsell — hiding it makes
              the paywall a surprise instead of an offer. Free filters still
              live behind it, which is why a free account opens the filters
              rather than the paywall. */}
          {/* Beside the filters, not above the list: the two are the same
              question asked two ways — "narrow this" and "I already know who
              I am looking for". */}
          {/*
            Opens search and nothing else. It used to toggle, which put the way
            *out* of search up here in the header: a 22px glyph beside an
            identical-looking filters icon, diagonally opposite the caret, and
            announced to a screen reader as "Search by username" even while it
            meant close. Leaving is now the arrow inside the field, at the
            geometry every other back control in the app uses.
          */}
          {searching ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('discover.searchHandles')}
              onPress={() => setSearching(true)}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Feather name="search" size={22} color={colors.text} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              count > 0
                ? t('discover.filtersWithCount', { count })
                : isPro
                  ? t('filters.title')
                  : t('discover.filters')
            }
            onPress={() => router.push({ pathname: '/(app)/filters', params })}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Feather name="sliders" size={22} color={colors.text} />
            {count > 0 ? <Text style={styles.filterCount}>{count}</Text> : null}
          </Pressable>
        </View>
        {searching ? (
          <View style={styles.searchField}>
            {/*
              Leaving search is local state, never navigation. Discover is a tab
              root, so `router.back()` would drop the reader on the first tab —
              see `backHref` for why `canGoBack()` does not save you there.
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.backPlain')}
              onPress={closeSearch}
              hitSlop={12}
              style={({ pressed }) => [styles.searchLeave, pressed && styles.pressed]}
            >
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder={t('discover.searchPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              style={styles.searchInput}
            />
            {/*
              Clears the text without leaving search — a different intent from
              the arrow, which is why it is a different control rather than one
              button meaning two things. Only while there is something to clear.
            */}
            {term.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.clear')}
                onPress={() => setTerm('')}
                hitSlop={10}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {searching ? (
          <View style={styles.searchResults}>
            {search.isFetching ? <ActivityIndicator style={styles.searchSpinner} /> : null}
            {search.data?.items.map((result) => (
              <Pressable
                key={result._id}
                accessibilityRole="button"
                onPress={() => openProfile(result.handle, '/(app)/discover')}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
              >
                <Avatar url={result.avatarUrl} name={result.displayName} size={36} />
                <View style={styles.searchText}>
                  <Text style={styles.searchName} numberOfLines={1}>
                    {result.displayName}
                  </Text>
                  <Text style={styles.searchHandle} numberOfLines={1}>
                    @{result.handle}
                  </Text>
                </View>
              </Pressable>
            ))}
            {/* Only once a real search has settled: "no matches" under two
                letters would be answering a question nobody finished asking. */}
            {search.data?.items.length === 0 && !search.isFetching ? (
              <Text style={styles.searchNone}>{t('discover.searchNone')}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.segmented}>
          <SegmentedControl
            options={SORTS.map((option) => ({
              value: option.key,
              label:
                option.key === 'nearby' && !canUseNearby ? `${t(option.label)} ✦` : t(option.label),
            }))}
            selected={[sort]}
            onToggle={(key) => (key === 'nearby' ? void chooseNearby() : setSort(key))}
            accessibilityLabel={t('discover.sortLabel')}
          />
        </View>
        <View style={styles.chips}>
          {/* Only while it applies. A radius control above a list that is not
              sorted by distance would be a control with nothing to control. */}
          {sort === 'nearby'
            ? NEARBY_RADIUS_OPTIONS_KM.map((km) => (
                <Chip
                  key={km}
                  label={t('discover.distanceKm', { km })}
                  tone="accent"
                  selected={radiusKm === km}
                  onPress={() => setRadiusKm(km)}
                />
              ))
            : null}
        </View>
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
          icon="map-pin"
          title={t('discover.locationOffTitle')}
          body={t('discover.locationOffBody')}
          actionLabel={shareLocation.isPending ? t('discover.turningOn') : t('discover.turnOn')}
          onAction={() => void enableSharing()}
        />
      ) : (
        <FlatList
          data={searching ? [] : items}
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
            searching ? null : sort === 'nearby' ? (
              // Two things narrow this list that narrow no other, and a user
              // who is not told about the second one concludes the feature is
              // broken rather than that the pool is small.
              <EmptyState
                icon="map-pin"
                title={t('discover.nobodyNearbyTitle', { radius: radiusKm })}
                body={t('discover.nobodyNearbyBody')}
              />
            ) : (
              <EmptyState
                icon="search"
                title={t('discover.emptyTitle')}
                body={t('discover.emptyBody')}
              />
            )
          }
          ListFooterComponent={
            query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => openProfile(item.handle, '/(app)/discover')}
              style={({ pressed }) => [
                styles.row,
                index === items.length - 1 && styles.rowLast,
                pressed && styles.pressed,
              ]}
            >
              <Avatar
                url={item.avatarUrl}
                name={item.displayName}
                size={56}
                online={item.isOnline}
              />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.age}>{item.age}</Text>
                  {/* The flag, not the country's name: it is one glyph in a row
                      that has none to spare, and it is the one thing on this
                      row that is the same word in every language. */}
                  {item.country ? (
                    <Text style={styles.flag}>{countryFlag(item.country)}</Text>
                  ) : null}
                  {item.streak.current > 0 ? (
                    <Text style={styles.streak} numberOfLines={1}>
                      🔥 {item.streak.current}
                    </Text>
                  ) : null}
                </View>
                <LanguageLine item={item} />
                {item.distanceKm !== undefined ? (
                  // `formatDistance` words it as the bound it is — the server
                  // sends a bucket edge, never a measured distance.
                  <Text style={styles.distance}>{formatDistance(item.distanceKm)}</Text>
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

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  flag: { fontSize: 15 },
  header: { paddingTop: spacing.md },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { ...font.title, color: colors.text, flexShrink: 1, fontSize: 34 },
  pair: {
    ...font.label,
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    marginStart: 'auto',
  },
  filterButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  /**
   * The input, and only the input. Both this and every result row used to be
   * `searchRow`, so each result wore the field's fill, its pill radius and its
   * top margin — the thing you type into and the things you tap looked like the
   * same object stacked five deep. Splitting them is also what makes it safe to
   * pad this one for the two controls inside it.
   */
  searchField: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingEnd: spacing.md,
    paddingStart: spacing.sm,
    paddingVertical: spacing.sm,
  },
  // Matches every other back control in the app: a 30x30 box, hitSlop 12.
  searchLeave: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  searchInput: { ...font.body, color: colors.text, flex: 1, padding: 0 },
  searchResults: { gap: spacing.xs, marginTop: spacing.xs },
  searchSpinner: { marginTop: spacing.md },
  searchText: { flex: 1, gap: 1 },
  searchName: { ...font.label, color: colors.text, fontSize: 15 },
  searchHandle: { ...font.caption, color: colors.textMuted },
  searchNone: {
    ...font.caption,
    color: colors.textFaint,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  filterCount: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 18,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
    textAlign: 'center',
  },
  segmented: { marginTop: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  row: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 20,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.7 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { ...font.heading, color: colors.text, flexShrink: 1, fontSize: 17 },
  age: { ...font.label, color: colors.textMuted, fontSize: 14, fontWeight: '400' },
  streak: {
    ...font.label,
    color: colors.textMuted,
    /**
     * The row is `name (shrinkable) · age · streak`, and without this the
     * streak is shrinkable too — so on a 320px screen it squeezed to a
     * two-line blob with "🔥" above the digits. The name is the thing that
     * should give way; the count is four characters and either fits or does
     * not.
     */
    flexShrink: 0,
    fontWeight: '400',
    marginStart: 'auto',
  },
  pairLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  languages: { ...font.label, color: colors.accent, flexShrink: 1, fontSize: 14 },
  distance: { ...font.caption, color: colors.textMuted, marginTop: 3 },
  bio: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: 5,
  },
}))

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
