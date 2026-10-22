import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { TIER_BADGES, type DiscoverySort } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Animated, FlatList, RefreshControl, Text, View } from 'react-native'
import { useBoostedProfiles, useNewProfiles, useQuota } from '../../api/queries'
import type { DiscoveryItem, NewProfilesPage } from '../../api/types'
import { useChangeHaptic } from '../../hooks/useChangeHaptic'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useSelectPop } from '../../hooks/useSelectPop'
import { useT } from '../../i18n'
import { track } from '../../lib/analytics'
import { authClient } from '../../lib/auth-client'
import { chatsLeft } from '../../lib/chatsLeft'
import { shouldGateGuest } from '../../lib/guestGate'
import type { ListState } from '../../lib/listState'
import { openProfile } from '../../lib/navigation'
import { requireAccount } from '../../lib/requireAccount'
import { POP_FROM_PILL } from '../../lib/selectPop'
import {
  firstStripHoldPhase,
  holdForStrips,
  STRIP_HOLD_MS,
  stripSettled,
  type StripHoldPhase,
} from '../../lib/stripHold'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION } from '../../lib/theme/motionValues'
import { LoadFailed } from '../LoadFailed'
import { PeopleSearch, PeopleSearchResults } from '../PeopleSearch'
import { Tip } from '../Tip'
import { TourTarget } from '../TourTarget'
import { BUTTON_FACE } from '../ui/Button'
import { EmptyStateV3 } from '../ui/EmptyStateV3'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'
import { Screen } from '../ui/Screen'
import { Skeleton } from '../ui/Skeleton'
import { BoostedStripV3, StripArrival } from './BoostedStripV3'
import { dedupeGrounds } from '../../lib/avatarViewport'
import { NEWCOMER_TILE_WIDTH, NewcomerTile, PersonCard } from './PersonCard'

const FROM = '/(app)/(tabs)/discover'

/** A panel in the list's place, worded by the screen that knows why. */
export interface PeoplePanel {
  line: string
  action: string
  onAction: () => void
}

export interface PeopleV3Props {
  /** The People | Posts control. */
  segments: ReactNode
  searching: boolean
  onSearchingChange: (open: boolean) => void
  filterCount: number
  /** The filters button's spoken name, which says the count. */
  filterLabel: string
  onOpenFilters: () => void
  /** "Spanish ↔ English": which of the reader's languages the list is matched on. */
  pair: string | null
  sorts: readonly { value: DiscoverySort; label: string; pro: boolean }[]
  sort: DiscoverySort
  onSort: (sort: DiscoverySort) => void
  showTip: boolean
  /** Nearby, with a reason on this device why it cannot work. */
  nearby: PeoplePanel | null
  /** Nearby, after sharing was withdrawn somewhere else. */
  locationOff: PeoplePanel | null
  state: ListState
  onRetry: () => void
  people: readonly DiscoveryItem[]
  /**
   * The rows are the previous sort's or filters' while the new answer is in
   * flight (`keepPreviousData`), so the list dims until it lands.
   */
  stale: boolean
  /** The list's query; a new one scrolls back to the top. */
  listKey: string
  pull: { refreshing: boolean; onRefresh: () => void }
  onEndReached: () => void
  loadingMore: boolean
  /** The paid strip's query — the list's filters and sort, as today. */
  boostedParams: Record<string, string>
  /** The newcomer strip's query, or `null` on a sort it does not belong on. */
  newParams: Record<string, string> | null
  radiusKm: number | undefined
  twoPane: boolean
  /** The handle whose profile is in the side panel. */
  selected: string | undefined
  onSelect: (handle: string) => void
}

/**
 * People's People segment in the v3 look, behind `flags.v3Home` (`V-People`).
 *
 * Only the drawing. Every decision about what the list holds — the sort, the
 * filters, Nearby's permission dance, search — stays in `discover.tsx`, which
 * hands this its answers; with the flag off that screen draws its own list
 * exactly as before.
 *
 * The list is virtualised, its rows memoised and keyed by id, and nothing
 * animates in or out of it (rule 13).
 */
export function PeopleV3(props: PeopleV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const [black] = useFonts({ Nunito_900Black })
  const { data: session } = authClient.useSession()
  const guest = shouldGateGuest(session?.user)
  const reduceMotion = useReduceMotion()
  // Two cards that drew the same face sit on different grounds.
  const people = useMemo(() => dedupeGrounds(props.people), [props.people])

  /*
   * The strips over the list, asked for here — alongside the list — rather
   * than by the strips themselves, which only mount once the list has left
   * its skeleton: the cards used to draw and then move down by a strip's
   * height when it answered. See `lib/stripHold.ts`.
   */
  const boosted = useBoostedProfiles(props.boostedParams)
  const newcomers = useNewProfiles(props.newParams ?? {}, { enabled: props.newParams !== null })
  // Only where the list itself would draw: search, a failure and the
  // location panel have nothing under them for a strip to push.
  const listReady =
    (props.state === 'content' || props.state === 'empty') && !props.searching && !props.locationOff
  // Field by field, not spread: a query result tracks which fields are read,
  // and a spread would read them all and re-render on every one.
  const stripsSettled =
    stripSettled({
      enabled: true,
      isPending: boosted.isPending,
      fetchStatus: boosted.fetchStatus,
    }) &&
    stripSettled({
      enabled: props.newParams !== null,
      isPending: newcomers.isPending,
      fetchStatus: newcomers.fetchStatus,
    })
  /*
   * Only the list's first way out of its skeleton is held, and only once:
   * a list drawn from the cache never waits, and a list already shown is
   * never sent back to the skeleton by a strip refetching under a new sort.
   */
  const [phase, setPhase] = useState<StripHoldPhase>(() =>
    firstStripHoldPhase(props.state === 'skeleton'),
  )
  const [capped, setCapped] = useState(false)
  useEffect(() => {
    if (phase !== 'loading' || !listReady || stripsSettled) return
    const timer = setTimeout(() => setCapped(true), STRIP_HOLD_MS)
    return () => clearTimeout(timer)
  }, [phase, listReady, stripsSettled])
  const holding = holdForStrips({
    firstLoad: phase === 'loading',
    listReady,
    stripsSettled,
    capped,
  })
  /*
   * Whether the list was already on screen before this render: a strip that
   * arrives after that — past the cap, or on a sort it was not on — fades in
   * rather than shoving the cards down in one frame. One that arrives with
   * the list is simply there.
   */
  const showingList = listReady && !holding
  const [listShown, setListShown] = useState(false)
  useEffect(() => setListShown(showingList), [showingList])
  useEffect(() => {
    // Shown once is shown for good: see `StripHoldPhase`.
    if (showingList) setPhase('done')
  }, [showingList])

  /*
   * A sort or filter change: the previous answer stays up, dimmed, until the
   * new one lands, and the list goes back to its top — row 40 of the old
   * answer is nowhere in particular in the new one. Quick to dim, so the tap
   * is answered at once; slower to come back, so the new rows settle in.
   */
  const listRef = useRef<FlatList<DiscoveryItem>>(null)
  const dim = useRef(new Animated.Value(props.stale ? STALE_OPACITY : 1)).current
  useEffect(() => {
    const to = props.stale ? STALE_OPACITY : 1
    if (reduceMotion) {
      dim.setValue(to)
      return
    }
    const animation = Animated.timing(dim, {
      toValue: to,
      duration: props.stale ? DURATION.release : DURATION.enter,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [props.stale, reduceMotion, dim])
  const shownKey = useRef(props.listKey)
  useEffect(() => {
    if (shownKey.current === props.listKey) return
    shownKey.current = props.listKey
    listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion })
  }, [props.listKey, reduceMotion])

  // One tick when the sort actually moves — Nearby may ask first, or refuse.
  const markSortPress = useChangeHaptic(props.sort)

  /*
   * The latest of everything a row's handler reads, so the handlers can stay
   * the same functions for the life of the screen — a new one would defeat
   * every row's memo on each render.
   */
  const latest = useRef({ props, user: session?.user })
  latest.current = { props, user: session?.user }

  const onOpen = useCallback((person: DiscoveryItem, index: number) => {
    const { props: now } = latest.current
    track({ name: 'discovery_card_tapped', properties: { slot: index } })
    if (now.twoPane) now.onSelect(person.handle)
    else openProfile(person.handle, FROM)
  }, [])

  /*
   * A hello opens the new-chat screen, which writes the first message, charges
   * the allowance (or not, for a newcomer) and turns into the thread when
   * there already is one. None of that is decided here. A guest is sent to
   * sign up, with the hello remembered for after.
   */
  const onHello = useCallback((person: DiscoveryItem) => {
    if (!requireAccount(latest.current.user, { action: 'message', toUserId: person._id })) return
    router.push(`/(app)/chat/new?to=${person._id}&from=${encodeURIComponent(FROM)}`)
  }, [])

  const { twoPane, selected } = props
  const renderItem = useCallback(
    ({ item, index }: { item: DiscoveryItem; index: number }) => {
      const card = (
        <PersonCard
          person={item}
          index={index}
          selected={twoPane && selected === item.handle}
          black={black}
          onOpen={onOpen}
          onHello={onHello}
        />
      )
      /* Only the first card. The tour needs one to point at, and a
         registration per row would mean the last one to mount wins. */
      return index === 0 ? (
        <TourTarget id="discoverCard" radius={v3.radius.block}>
          {card}
        </TourTarget>
      ) : (
        card
      )
    },
    [twoPane, selected, black, onOpen, onHello, v3.radius.block],
  )

  const empty: PeoplePanel =
    props.sort === 'nearby'
      ? props.radiusKm !== undefined
        ? {
            line: t('discover.nobodyNearbyTitle', { radius: props.radiusKm }),
            action: t('discover.changeFilters'),
            onAction: props.onOpenFilters,
          }
        : {
            line: t('discover.nobodySharingTitle'),
            action: t('discover.forYou'),
            onAction: () => props.onSort('recommended'),
          }
      : {
          line: t('discover.emptyTitle'),
          action: t('discover.changeFilters'),
          onAction: props.onOpenFilters,
        }

  return (
    <Screen fluid tabbed ground={v3.colors.bg}>
      <View style={styles.header}>
        {/* While search is open the row belongs to the field, as on the current look. */}
        <View style={styles.titleRow}>
          {props.searching ? null : (
            <Text
              style={[styles.title, !black && styles.titleFallback]}
              accessibilityRole="header"
              numberOfLines={1}
            >
              {t('tabs.people')}
            </Text>
          )}
          <PeopleSearch from={FROM} onSearchingChange={props.onSearchingChange} />
          {props.searching ? null : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={props.filterLabel}
              onPress={props.onOpenFilters}
              style={styles.round}
            >
              <Feather name="sliders" size={v3.icon.lg} color={v3.colors.fg} />
              {props.filterCount > 0 ? <Text style={styles.badge}>{props.filterCount}</Text> : null}
            </PressableScale>
          )}
        </View>
        {props.searching ? null : props.segments}
        {props.pair && !props.searching ? (
          <TourTarget id="discoverPair" radius={v3.radius.pill} style={styles.pairTarget}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('discover.languagesA11y')}
              onPress={props.onOpenFilters}
              style={styles.pair}
            >
              <Text style={styles.pairLabel} numberOfLines={1}>
                {props.pair}
              </Text>
              <Feather name="chevron-down" size={v3.icon.sm} color={v3.colors.fg} />
            </PressableScale>
          </TourTarget>
        ) : null}
        {props.searching ? null : (
          <TourTarget id="discoverSorts" radius={v3.radius.pill} style={styles.sortsTarget}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('discover.sortLabel')}
              style={styles.sorts}
            >
              {props.sorts.map((option) => (
                <SortPill
                  key={option.value}
                  label={option.label}
                  pro={option.pro}
                  on={option.value === props.sort}
                  onPress={() => {
                    markSortPress()
                    props.onSort(option.value)
                  }}
                />
              ))}
            </View>
          </TourTarget>
        )}
      </View>

      {props.showTip ? <Tip slot="discover" /> : null}

      {props.nearby && !props.searching ? (
        <Panel panel={props.nearby} />
      ) : props.state === 'skeleton' || holding ? (
        <View style={[styles.list, styles.skeletons]}>
          <StripSkeleton />
          {SKELETON_CARDS.map((key) => (
            <Skeleton key={key} height={232} radius={v3.radius.block} />
          ))}
        </View>
      ) : props.locationOff ? (
        <Panel panel={props.locationOff} primary />
      ) : props.searching ? (
        <PeopleSearchResults from={FROM} />
      ) : props.state === 'failed' ? (
        <LoadFailed onRetry={props.onRetry} />
      ) : (
        <Animated.View style={[styles.fill, { opacity: dim }]}>
          <FlatList
            ref={listRef}
            data={people}
            keyExtractor={keyOf}
            renderItem={renderItem}
            ItemSeparatorComponent={Gap}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl {...props.pull} />}
            ListHeaderComponent={
              <View style={styles.listHead}>
                {guest ? null : <ChatsLeftLine />}
                {props.newParams ? (
                  <NewcomerStrip page={newcomers.data} late={listShown} onHello={onHello} />
                ) : null}
                {/* The paid strip, today's data in the v3 look: nothing when nobody qualifies. */}
                <BoostedStripV3 page={boosted.data} late={listShown} />
              </View>
            }
            onEndReachedThreshold={0.6}
            onEndReached={props.onEndReached}
            ListEmptyComponent={<Panel panel={empty} />}
            ListFooterComponent={
              props.loadingMore ? <ActivityIndicator style={styles.footer} /> : null
            }
          />
        </Animated.View>
      )}
    </Screen>
  )
}

function keyOf(person: DiscoveryItem): string {
  return person._id
}

function Gap() {
  const styles = useStyles()
  return <View style={styles.gap} />
}

function Panel({ panel, primary = false }: { panel: PeoplePanel; primary?: boolean }) {
  return (
    <EmptyStateV3
      art="people"
      line={panel.line}
      actionLabel={panel.action}
      onAction={panel.onAction}
      actionVariant={primary ? 'primary' : 'secondary'}
    />
  )
}

/**
 * "New chats left today: 3 of 5", for an account that has an allowance —
 * nothing for Pro, whose `limit` is null, and never for a guest, who has no
 * chats to start. A component of its own so a guest never asks for the quota.
 */
function ChatsLeftLine() {
  const styles = useStyles()
  const t = useT()
  const quota = useQuota()
  const line = chatsLeft(quota.data?.initiations)
  if (!line) return null
  return (
    <View style={styles.chatsLeft}>
      <View style={styles.chatsLeftText}>
        <Text style={styles.chatsLeftTitle}>
          {t('discover.chatsLeft', { count: line.left, total: line.total })}
        </Text>
        <Text style={styles.chatsLeftNote}>{t('discover.chatsLeftNote')}</Text>
      </View>
      {line.pips ? (
        <View style={styles.pips} accessibilityElementsHidden>
          {Array.from({ length: line.total }, (_, at) => (
            <View key={at} style={[styles.pip, at < line.left && styles.pipOn]} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/**
 * "New on LangX" — S2's strip, as the server answers it: empty while
 * `flags.discoveryReplyFirst` is off, for anybody under 18 and for a guest,
 * and then nothing is drawn, not even the heading. At most
 * `DISCOVERY_NEW_LIMIT` tiles, so a bounded row rather than a second list.
 */
function NewcomerStrip({
  page,
  late,
  onHello,
}: {
  page: NewProfilesPage | undefined
  /** Whether the list was already showing; see `StripArrival`. */
  late: boolean
  onHello: (person: DiscoveryItem) => void
}) {
  const styles = useStyles()
  const t = useT()
  const items = useMemo(() => dedupeGrounds(page?.items ?? []), [page])
  if (items.length === 0) return null
  return (
    <StripArrival late={late} style={styles.strip}>
      <Text style={styles.stripTitle} accessibilityRole="header">
        {t('discover.newOnLangx')}
      </Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item }) => <NewcomerTile person={item} onHello={onHello} />}
        ItemSeparatorComponent={Gap}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: NEWCOMER_TILE_WIDTH + GAP,
          offset: (NEWCOMER_TILE_WIDTH + GAP) * index,
          index,
        })}
      />
    </StripArrival>
  )
}

/**
 * One sort. The pill that has just been chosen pops into place, and every one
 * shrinks under the finger, as every v3 chip does.
 */
function SortPill({
  label,
  pro,
  on,
  onPress,
}: {
  label: string
  pro: boolean
  on: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const pop = useSelectPop(on, POP_FROM_PILL)
  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <PressableScale
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        onPress={onPress}
        style={[styles.sort, on && styles.sortOn]}
      >
        <Text style={[styles.sortLabel, on && styles.sortLabelOn]} numberOfLines={1}>
          {label}
        </Text>
        {/* The plan's own short form, never translated, as on `ProMark`. */}
        {pro && TIER_BADGES.pro ? (
          <Text style={[styles.pro, on && styles.proOn]}>{TIER_BADGES.pro}</Text>
        ) : null}
      </PressableScale>
    </Animated.View>
  )
}

/**
 * The strips' place while the skeleton holds: a heading and a row of tiles
 * the size of the boosted strip's, the taller of the two, so the cards'
 * rectangles start about where the cards will.
 */
function StripSkeleton() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.strip}>
      <Skeleton width={140} height={22} radius={v3.radius.pill} />
      <View style={styles.stripTiles}>
        {SKELETON_TILES.map((key) => (
          <Skeleton key={key} width={160} height={138} radius={v3.radius.tile} />
        ))}
      </View>
    </View>
  )
}

/** Between cards, and between tiles. */
const GAP = 10

/** The list's opacity while it still shows the previous query's answer. */
const STALE_OPACITY = 0.5

/** More than a phone's width of them; the row clips. */
const SKELETON_TILES = ['a', 'b', 'c']

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_CARDS = ['a', 'b', 'c']

const useStyles = makeStyles(({ v3 }) => ({
  fill: { flex: 1, minHeight: 0 },
  header: { gap: v3.space[10], paddingBottom: v3.space[10], paddingTop: v3.space[8] },
  // `minHeight`, so the row does not jump when the search field replaces the title.
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8], minHeight: 48 },
  title: { ...v3.type.title, color: v3.colors.fg, flex: 1, paddingStart: v3.space[6] },
  // ExtraBold at Black's size until Black has loaded: the line thickens, never reflows.
  titleFallback: { fontFamily: DISPLAY_FONT },
  // The kit's targets: 44pt on iOS, 48dp on Android.
  round: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  badge: {
    ...v3.type.label,
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    color: v3.colors.onBlue,
    end: -2,
    minWidth: 20,
    overflow: 'hidden',
    paddingHorizontal: v3.space[4],
    position: 'absolute',
    textAlign: 'center',
    top: -2,
  },
  // The wrapper takes the alignment, so the tour's highlight hugs the pill.
  pairTarget: { alignSelf: 'flex-start', maxWidth: '100%' },
  pair: {
    alignItems: 'center',
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: BUTTON_FACE.small,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[16],
  },
  pairLabel: { ...v3.type.buttonSmall, color: v3.colors.fg, flexShrink: 1 },
  sortsTarget: { alignSelf: 'flex-start' },
  sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  sort: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: BUTTON_FACE.small,
    paddingHorizontal: v3.space[16],
  },
  sortOn: { backgroundColor: v3.colors.pill },
  sortLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
  sortLabelOn: { color: v3.colors.pillText },
  pro: {
    ...v3.type.label,
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    color: v3.colors.pillText,
    overflow: 'hidden',
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  proOn: { backgroundColor: v3.colors.pillText, color: v3.colors.pill },
  list: { paddingBottom: v3.space[32], paddingTop: v3.space[4] },
  skeletons: { gap: GAP },
  listHead: { gap: v3.space[12], paddingBottom: GAP },
  footer: { paddingVertical: v3.space[16] },
  gap: { height: GAP, width: GAP },
  chatsLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[6],
  },
  chatsLeftText: { flex: 1, minWidth: 0 },
  chatsLeftTitle: { ...v3.type.buttonSmall, color: v3.colors.fg },
  chatsLeftNote: { ...v3.type.caption, color: v3.colors.muted },
  pips: { flexDirection: 'row', gap: v3.space[4] },
  pip: {
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  pipOn: { backgroundColor: v3.colors.fg, borderColor: v3.colors.fg },
  strip: { gap: v3.space[8] },
  stripTiles: { flexDirection: 'row', gap: GAP, overflow: 'hidden' },
  stripTitle: { ...v3.type.headline, color: v3.colors.fg, paddingHorizontal: v3.space[6] },
}))
