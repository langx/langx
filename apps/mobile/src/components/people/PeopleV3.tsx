import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { TIER_BADGES, type DiscoverySort } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useCallback, useRef, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useNewProfiles, useQuota } from '../../api/queries'
import type { DiscoveryItem } from '../../api/types'
import { useT } from '../../i18n'
import { track } from '../../lib/analytics'
import { authClient } from '../../lib/auth-client'
import { chatsLeft } from '../../lib/chatsLeft'
import { shouldGateGuest } from '../../lib/guestGate'
import type { ListState } from '../../lib/listState'
import { openProfile } from '../../lib/navigation'
import { requireAccount } from '../../lib/requireAccount'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { LoadFailed } from '../LoadFailed'
import { PeopleSearch, PeopleSearchResults } from '../PeopleSearch'
import { Tip } from '../Tip'
import { TourTarget } from '../TourTarget'
import { BUTTON_FACE } from '../ui/Button'
import { EmptyStateV3 } from '../ui/EmptyStateV3'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'
import { Screen } from '../ui/Screen'
import { Skeleton } from '../ui/Skeleton'
import { BoostedStripV3 } from './BoostedStripV3'
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.filterLabel}
              onPress={props.onOpenFilters}
              style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            >
              <Feather name="sliders" size={v3.icon.lg} color={v3.colors.fg} />
              {props.filterCount > 0 ? <Text style={styles.badge}>{props.filterCount}</Text> : null}
            </Pressable>
          )}
        </View>
        {props.searching ? null : props.segments}
        {props.pair && !props.searching ? (
          <TourTarget id="discoverPair" radius={v3.radius.pill} style={styles.pairTarget}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('discover.languagesA11y')}
              onPress={props.onOpenFilters}
              style={({ pressed }) => [styles.pair, pressed && styles.pressed]}
            >
              <Text style={styles.pairLabel} numberOfLines={1}>
                {props.pair}
              </Text>
              <Feather name="chevron-down" size={v3.icon.sm} color={v3.colors.fg} />
            </Pressable>
          </TourTarget>
        ) : null}
        {props.searching ? null : (
          <TourTarget id="discoverSorts" radius={v3.radius.pill} style={styles.sortsTarget}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('discover.sortLabel')}
              style={styles.sorts}
            >
              {props.sorts.map((option) => {
                const on = option.value === props.sort
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => props.onSort(option.value)}
                    style={({ pressed }) => [
                      styles.sort,
                      on && styles.sortOn,
                      pressed && !on && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.sortLabel, on && styles.sortLabelOn]} numberOfLines={1}>
                      {option.label}
                    </Text>
                    {/* The plan's own short form, never translated, as on `ProMark`. */}
                    {option.pro && TIER_BADGES.pro ? (
                      <Text style={[styles.pro, on && styles.proOn]}>{TIER_BADGES.pro}</Text>
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          </TourTarget>
        )}
      </View>

      {props.showTip ? <Tip slot="discover" /> : null}

      {props.nearby && !props.searching ? (
        <Panel panel={props.nearby} />
      ) : props.state === 'skeleton' ? (
        <View style={[styles.list, styles.skeletons]}>
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
        <FlatList
          data={props.people}
          keyExtractor={keyOf}
          renderItem={renderItem}
          ItemSeparatorComponent={Gap}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...props.pull} />}
          ListHeaderComponent={
            <View style={styles.listHead}>
              {guest ? null : <ChatsLeftLine />}
              {props.newParams ? (
                <NewcomerStrip params={props.newParams} onHello={onHello} />
              ) : null}
              {/* The paid strip, today's data in the v3 look: nothing when nobody qualifies. */}
              <BoostedStripV3 params={props.boostedParams} />
            </View>
          }
          onEndReachedThreshold={0.6}
          onEndReached={props.onEndReached}
          ListEmptyComponent={<Panel panel={empty} />}
          ListFooterComponent={
            props.loadingMore ? <ActivityIndicator style={styles.footer} /> : null
          }
        />
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
  params,
  onHello,
}: {
  params: Record<string, string>
  onHello: (person: DiscoveryItem) => void
}) {
  const styles = useStyles()
  const t = useT()
  const query = useNewProfiles(params)
  const items = query.data?.items ?? []
  if (items.length === 0) return null
  return (
    <View style={styles.strip}>
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
    </View>
  )
}

/** Between cards, and between tiles. */
const GAP = 10

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_CARDS = ['a', 'b', 'c']

const useStyles = makeStyles(({ v3 }) => ({
  pressed: { opacity: 0.7 },
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
  stripTitle: { ...v3.type.headline, color: v3.colors.fg, paddingHorizontal: v3.space[6] },
}))
