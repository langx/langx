import {
  countryFlag,
  formatDistance,
  NEARBY_MAX_KM,
  NEARBY_RADIUS_OPTIONS_KM,
  type DiscoverySort,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { openProfile } from '../../../src/lib/navigation'
import { useMemo, useState } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useDiscovery, useHasFeature, useMe, useShareLocation } from '../../../src/api/queries'
import { ApiRequestError } from '../../../src/api/client'
import type { DiscoveryItem } from '../../../src/api/types'
import { DiscoveryCardSkeleton } from '../../../src/components/skeletons/DiscoveryCardSkeleton'
import { Avatar } from '../../../src/components/ui/Avatar'
import { PeopleSearch, PeopleSearchResults } from '../../../src/components/PeopleSearch'
import { Chip } from '../../../src/components/ui/Chip'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { LevelBars } from '../../../src/components/ui/LevelBars'
import { Screen } from '../../../src/components/ui/Screen'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Tip } from '../../../src/components/Tip'
import {
  activeCount,
  hasProFilters,
  parseFilters,
  scopeOf,
  toParams,
  toQuery,
  withoutProFilters,
  type DiscoveryFilters,
} from '../../../src/lib/discoveryFilters'
import {
  LanguageScopeSheet,
  scopeLabel,
  type LanguageScope,
} from '../../../src/components/LanguageScopeSheet'
import {
  captureLocation,
  locationPermissionState,
  reportLocationFailure,
} from '../../../src/lib/location'
import { openPaywall } from '../../../src/lib/paywall'
import { dedupeById } from '../../../src/lib/dedupeById'
import { listState } from '../../../src/lib/listState'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useT, type MessageKey } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

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
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const params = useLocalSearchParams<Record<string, string>>()
  const [sort, setSort] = useState<DiscoverySort>('recommended')
  const [radiusKm, setRadiusKm] = useState<number>(NEARBY_MAX_KM)
  const [searching, setSearching] = useState(false)

  /*
   * `advancedFilters`, not "any paid plan". Correct by accident while every
   * gated filter was Fluent's; correct by construction now. On discover it is
   * load-bearing: this decides whether to strip Pro filters before asking, and
   * if it disagrees with the server the reader gets a 403 instead of a list.
   */
  const isPro = useHasFeature('advancedFilters')
  const canUseNearby = useHasFeature('nearby')
  const me = useMe()
  const shareLocation = useShareLocation()
  const sharingLocation = me.data?.location !== undefined
  const filters = useMemo(() => parseFilters(params), [params])

  /**
   * Which of the viewer's own languages this search is made with — all of
   * them unless the params narrowed a side. The header used to print the
   * *first* of each and call it the match direction, while the server matched
   * on every language on both sides; now the label says what the search is
   * made with, and tapping it opens the sheet that changes it.
   */
  const nativeCodes = useMemo(() => me.data?.nativeLanguages.map((l) => l.code) ?? [], [me.data])
  const learningCodes = useMemo(() => me.data?.learning.map((l) => l.code) ?? [], [me.data])
  const scope = useMemo<LanguageScope>(
    () => ({
      native: filters.nativeLanguages ?? nativeCodes,
      learning: filters.learningLanguages ?? learningCodes,
    }),
    [filters, nativeCodes, learningCodes],
  )
  const pair = scopeLabel(scope)
  const [scopeOpen, setScopeOpen] = useState(false)

  /** Written to the route, like every other filter, so the URL stays the search. */
  function changeScope(next: LanguageScope): void {
    const nextFilters: DiscoveryFilters = { ...filters }
    delete nextFilters.nativeLanguages
    delete nextFilters.learningLanguages
    const native = scopeOf(next.native, nativeCodes)
    const learning = scopeOf(next.learning, learningCodes)
    if (native) nextFilters.nativeLanguages = native
    if (learning) nextFilters.learningLanguages = learning
    router.replace({ pathname: '/(app)/(tabs)/discover', params: toParams(nextFilters) })
  }

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
      openPaywall('nearby', '/(app)/(tabs)/discover')
      return
    }
    /*
     * The **OS**, not only the server's flag, and that is the whole of this
     * fix. A profile keeps its `location` forever once shared, so
     * `sharingLocation` stayed true after the permission was revoked in
     * Settings — and the short-circuit then skipped the ask entirely: no
     * dialog, no error, a `$geoNear` around a point nobody could update and an
     * empty list with nothing on screen to explain it.
     */
    const permission = await locationPermissionState()
    if (!permission.granted || !sharingLocation) {
      if (!(await enableSharing())) return
    } else {
      /*
       * Unconditionally, and **not** behind `shouldRefreshLocation`.
       *
       * That gate exists for the refresh nobody asked for — the one on
       * `useLocationRefresh`'s timer, where six hours is the right price for a
       * GPS wake-up. Pressing Nearby is the opposite kind of event: it is
       * somebody saying "where am I" out loud, and answering it from a fix
       * taken up to seven hours ago (six from the gate, one more from
       * `captureLocation`'s cached read) is how the feature came to look
       * broken to a person who had simply moved since lunch.
       *
       * Silent: permission is already granted, so nothing can pop up here.
       */
      await enableSharing({ fresh: true })
    }
    setSort('nearby')
  }

  /** Captures a fix and sends it. `false` when the user or the device said no. */
  async function enableSharing({ fresh = false } = {}): Promise<boolean> {
    const fix = await captureLocation({ fresh })
    if (!fix.ok) {
      // `location.needed` says what it was for; the helper adds the route to
      // the switch, which this screen used to be the only one not to offer.
      await reportLocationFailure(fix.reason, t, 'location.needed')
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
  const pull = usePullToRefresh(() => query.refetch())

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
        {/*
          While search is open the row belongs to the field. Everything else
          here competed with it for the same 420px and lost — the title slid
          off the leading edge and the language pair broke onto three lines.
          The arrow inside the field puts them all back.
        */}
        <View style={styles.titleRow}>
          {searching ? null : <Text style={styles.title}>{t('discover.title')}</Text>}
          {/* Which direction this list is matched in. Every row below is
              someone native in what you are learning and learning what you
              speak, and without this the list looks unsorted rather than
              matched. */}
          {pair && !searching ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('discover.languagesA11y')}
              onPress={() => setScopeOpen(true)}
              hitSlop={8}
              style={({ pressed }) => [styles.pairButton, pressed && styles.pressed]}
            >
              <Text style={styles.pair}>{pair}</Text>
            </Pressable>
          ) : null}
          {/* Advanced filters are the Pro hook, so the control is shown to
              everyone and the *screen* handles the upsell — hiding it makes
              the paywall a surprise instead of an offer. Free filters still
              live behind it, which is why a free account opens the filters
              rather than the paywall. */}
          {/* Beside the filters, not above the list: the two are the same
              question asked two ways — "narrow this" and "I already know who
              I am looking for". */}
          <PeopleSearch from="/(app)/(tabs)/discover" onSearchingChange={setSearching} />
          {searching ? null : (
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
          )}
        </View>
        <LanguageScopeSheet
          visible={scopeOpen}
          onClose={() => setScopeOpen(false)}
          nativeCodes={nativeCodes}
          learningCodes={learningCodes}
          scope={scope}
          onChange={changeScope}
        />
        {/* Search takes the screen, not a strip of it: a sort control above a
            list that has been blanked is answering a question nobody asked. */}
        {searching ? null : (
          <View style={styles.segmented}>
            <SegmentedControl
              options={SORTS.map((option) => ({
                value: option.key,
                label:
                  option.key === 'nearby' && !canUseNearby
                    ? `${t(option.label)} ✦`
                    : t(option.label),
              }))}
              selected={[sort]}
              onToggle={(key) => (key === 'nearby' ? void chooseNearby() : setSort(key))}
              accessibilityLabel={t('discover.sortLabel')}
            />
          </View>
        )}
        {/* Only while it applies. A radius control above a list that is not
            sorted by distance would be a control with nothing to control —
            and the row is dropped rather than emptied, because an empty one
            still spends its `marginTop` and that stray 14px was the gap above
            this screen's tip. */}
        {sort === 'nearby' ? (
          <View style={styles.chips}>
            {NEARBY_RADIUS_OPTIONS_KM.map((km) => (
              <Chip
                key={km}
                label={t('discover.distanceKm', { km })}
                tone="accent"
                selected={radiusKm === km}
                onPress={() => setRadiusKm(km)}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Above the list rather than inside it: a hint that scrolls away is
          one nobody reads. */}
      {searching ? null : <Tip slot="discover" />}

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
      ) : searching ? (
        /* In the list's place, in normal flow — not floated over it. See
           `PeopleSearch` for what floating cost. */
        <PeopleSearchResults from="/(app)/(tabs)/discover" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
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
              onPress={() => openProfile(item.handle, '/(app)/(tabs)/discover')}
              style={({ pressed }) => [
                styles.row,
                index === items.length - 1 && styles.rowLast,
                pressed && styles.pressed,
              ]}
            >
              <Avatar
                url={item.avatarUrl}
                name={item.displayName}
                seed={item._id}
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
  // The bottom half is the gap above the tip; `Tip` owns the one below it.
  header: { paddingBottom: spacing.sm, paddingTop: spacing.md },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { ...font.title, color: colors.text, flexShrink: 1, fontSize: 34 },
  pairButton: { marginStart: 'auto' },
  pair: { ...font.label, color: colors.accent, fontSize: 14, fontWeight: '700' },
  filterButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
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
