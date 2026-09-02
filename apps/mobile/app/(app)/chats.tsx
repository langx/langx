import { CONVERSATION_FILTERS, PLAN_LIMITS, type ConversationFilter } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
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
import {
  useDeleteConversation,
  useConversationFlags,
  useConversations,
  useMe,
} from '../../src/api/queries'
import { PeopleSearch } from '../../src/components/PeopleSearch'
import { SwipeableRow } from '../../src/components/SwipeableRow'
import { ConversationRowSkeleton } from '../../src/components/skeletons/ConversationRowSkeleton'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { chooseAlert, confirmAlert, showAlert } from '../../src/lib/alert'
import { showToast } from '../../src/lib/toast'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { relativeTimeCompact } from '../../src/lib/format'
import { useLocale, useT } from '../../src/i18n'
import type { MessageKey } from '../../src/i18n/runtime'

/** v3 draws chat avatars at 52, one step up from the 48 default. */
const AVATAR_SIZE = 52

/** Per tab, keyed so a missing entry does not compile. */
const EMPTY_COPY: Record<ConversationFilter, { title: MessageKey; body: MessageKey }> = {
  all: { title: 'chats.emptyTitle', body: 'chats.emptyBody' },
  unreplied: { title: 'chats.unrepliedEmptyTitle', body: 'chats.unrepliedEmptyBody' },
  archived: { title: 'chats.archivedEmptyTitle', body: 'chats.archivedEmptyBody' },
}

export default function ChatsScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const [filter, setFilter] = useState<ConversationFilter>('all')
  // Blanks the thread list while a search is open, so the results are not
  // competing with a list of unrelated conversations underneath them.
  const [searching, setSearching] = useState(false)
  const conversations = useConversations(filter)
  const flags = useConversationFlags()
  const removeConversation = useDeleteConversation()
  /** One row at a time: two open drawers is two sets of buttons and no way to tell them apart. */
  const [openRow, setOpenRow] = useState<string | null>(null)

  /**
   * Confirmed, and destructive, because it cannot be undone from here — unlike
   * archiving, which has a tab of its own to come back from. `profile`'s note
   * on unfollow states the rule this follows.
   */
  async function confirmDelete(conversationId: string): Promise<void> {
    const yes = await confirmAlert({
      title: t('chats.deleteTitle'),
      message: t('chats.deleteBody'),
      confirmLabel: t('chats.delete'),
      destructive: true,
    })
    if (!yes) return
    removeConversation.mutate(conversationId, {
      onSuccess: () => showToast(t('chats.deleted')),
      // Said out loud: somebody who confirmed a destructive action and saw
      // nothing has every reason to think it worked.
      onError: () => void showAlert(t('chats.deleteTitle'), t('common.retry')),
    })
  }

  /*
   * Pinned first, then the rest. The server returns them as two lists because
   * pinning makes the sort compound and the cursor cannot express that — so
   * the join happens here, where it is one concatenation rather than a widened
   * cursor format.
   */
  const pinned = conversations.data?.pages[0]?.pinned ?? []
  // Deduped on flatten: a keyset cursor over a moving sort key can emit the
  // same row on two pages, and a duplicate `key` in a FlatList is a warning
  // plus a row that never updates.
  const rest = dedupeById(conversations.data?.pages.flatMap((page) => page.items) ?? [])
  const items = [...pinned, ...rest]

  // One batched lookup for every counterpart, instead of a query per row.
  const partnerIds = items
    .map((c) => c.participants.find((p) => p !== me.data?._id))
    .filter((id): id is string => Boolean(id))
  const partners = useProfileCache(partnerIds)
  const state = listState({
    isPending: conversations.isPending,
    isError: conversations.isError,
    itemCount: items.length,
  })

  return (
    <Screen fluid>
      {/*
        The only way into the starred list. A star is private and one-sided, so
        without an entry point here it is a write with no read.
      */}
      <View style={styles.titleRow}>
        {/* Hidden while search is open, for the reason Discover's copy of this
            row records: the field needs the whole row, not what is left of it. */}
        {searching ? null : <Text style={styles.title}>{t('tabs.chats')}</Text>}
        {/*
          Here as well as on Discover, because this is the other place people
          arrive already knowing who they want: Discover is for finding someone,
          Chats is for finding someone again.
        */}
        <PeopleSearch from="/(app)/chats" onSearchingChange={setSearching} />
        {searching ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chats.starredMessages')}
            hitSlop={10}
            onPress={() => router.push('/(app)/starred')}
          >
            <Feather name="star" size={21} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/*
        Three tabs, matching the pattern `feed.tsx` set: the filter lives in
        `useState`, goes into the query key, and the server does the narrowing.
        Filtering the loaded pages on the client instead would show whatever
        happened to be fetched, which is exactly wrong for "who am I keeping
        waiting" — the answer is usually further down the list.
      */}
      {/* Hidden while searching, as on Discover: the list underneath is blank,
          so a filter over it has nothing to filter. */}
      {searching ? null : (
        <View style={styles.filters}>
          <SegmentedControl<ConversationFilter>
            options={CONVERSATION_FILTERS.map((value) => ({
              value,
              label: t(`chats.tab_${value}` as MessageKey),
            }))}
            selected={[filter]}
            onToggle={setFilter}
            accessibilityLabel={t('chats.filterPicker')}
          />
        </View>
      )}

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <ConversationRowSkeleton key={key} />
          ))}
        </View>
      ) : (
        <FlatList
          data={searching ? [] : items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={conversations.isRefetching}
              onRefresh={() => void conversations.refetch()}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (conversations.hasNextPage && !conversations.isFetchingNextPage) {
              void conversations.fetchNextPage()
            }
          }}
          ListFooterComponent={
            conversations.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="message-square"
              /*
                Per tab, because "no chats at all" and "nothing waiting on you"
                are opposite news and the generic copy makes the second read as
                the first — with a button offering to go and start one.
              */
              title={t(EMPTY_COPY[filter].title)}
              body={
                filter === 'all'
                  ? t('chats.emptyBody', { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 })
                  : t(EMPTY_COPY[filter].body)
              }
              {...(filter === 'all'
                ? {
                    actionLabel: t('chats.goToDiscover'),
                    onAction: () => router.push('/(app)/discover'),
                  }
                : {})}
            />
          }
          renderItem={({ item, index }) => {
            const partnerId = item.participants.find((p) => p !== me.data?._id) ?? ''
            const partner = partners[partnerId]
            const unread = item.unread
            const mine = item.lastMessage.senderId === me.data?._id

            const pin = {
              id: 'pin',
              icon: item.pinned ? ('chevrons-down' as const) : ('chevrons-up' as const),
              label: item.pinned ? t('chats.unpin') : t('chats.pin'),
              colour: colors.accent,
              onAction: () => {
                setOpenRow(null)
                flags.mutate({ conversationId: item._id, pinned: !item.pinned })
              },
            }
            const archive = {
              id: 'archive',
              icon: item.archived ? ('inbox' as const) : ('archive' as const),
              label: item.archived ? t('chats.unarchive') : t('chats.archive'),
              colour: colors.textMuted,
              onAction: () => {
                setOpenRow(null)
                flags.mutate({ conversationId: item._id, archived: !item.archived })
              },
            }
            const remove = {
              id: 'delete',
              icon: 'trash-2' as const,
              label: t('chats.delete'),
              colour: colors.danger,
              destructive: true,
              onAction: () => {
                setOpenRow(null)
                void confirmDelete(item._id)
              },
            }

            return (
              <SwipeableRow
                // Delete is last, so it is the furthest thing from a thumb that
                // opened the drawer meaning to archive.
                right={[pin]}
                left={[archive, remove]}
                open={openRow === item._id}
                onOpenChange={(open) => setOpenRow(open ? item._id : null)}
              >
                <Pressable
                  /*
                   * An open row closes rather than opening the thread. Tapping
                   * the part of a row that is holding its own buttons open
                   * means "never mind", and navigating away from a drawer that
                   * was never closed leaves it open behind you.
                   */
                  onPress={() =>
                    openRow === item._id ? setOpenRow(null) : router.push(`/(app)/chat/${item._id}`)
                  }
                  /*
                  Long press rather than a swipe. `react-native-gesture-handler`
                  is deliberately absent from this package, and the app already
                  teaches long-press-for-actions on every message bubble — a
                  second gesture grammar for the same idea is one to learn for
                  no reason.

                  `chooseAlert` rather than a new menu host: it already draws a
                  list of choices on every platform, including web, where
                  react-native's own `Alert` is an empty function.
                */
                  onLongPress={() => {
                    void chooseAlert(partner?.displayName ?? '', undefined, [
                      { label: item.pinned ? t('chats.unpin') : t('chats.pin'), value: 'pin' },
                      {
                        label: item.archived ? t('chats.unarchive') : t('chats.archive'),
                        value: 'archive',
                      },
                      // Also here, and not only behind the swipe: on a desktop
                      // browser the gesture is not offered at all, so this menu
                      // is the only way to reach any of them.
                      { label: t('chats.delete'), value: 'delete' },
                    ]).then((choice) => {
                      if (choice === 'pin') {
                        flags.mutate({ conversationId: item._id, pinned: !item.pinned })
                      }
                      if (choice === 'archive') {
                        flags.mutate({ conversationId: item._id, archived: !item.archived })
                      }
                      if (choice === 'delete') void confirmDelete(item._id)
                    })
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    index === items.length - 1 && styles.rowLast,
                    pressed && styles.rowPressed,
                  ]}
                >
                  {partner ? (
                    <Avatar
                      url={partner.avatarUrl}
                      name={partner.displayName}
                      online={partner.isOnline}
                      size={AVATAR_SIZE}
                    />
                  ) : (
                    <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
                  )}
                  <View style={styles.body}>
                    <View style={styles.top}>
                      {partner ? (
                        <Text style={styles.name} numberOfLines={1}>
                          {partner.displayName}
                        </Text>
                      ) : (
                        // The row is real, its partner is not resolved yet: the
                        // names come from a separate batched query. This used to
                        // read "Loading…", which looked like somebody's name.
                        <Skeleton width={132} height={16} />
                      )}
                      <Text style={styles.time}>
                        {relativeTimeCompact(item.lastMessage.createdAt, { t, locale })}
                      </Text>
                    </View>
                    <View style={styles.bottom}>
                      <Text
                        style={[styles.preview, unread > 0 && styles.previewUnread]}
                        numberOfLines={1}
                      >
                        {mine ? `${t('chats.youPrefix')} ` : ''}
                        {item.lastMessage.body}
                      </Text>
                      {unread > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{unread}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </SwipeableRow>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  filters: { paddingBottom: spacing.sm, paddingTop: spacing.md },
  // `zIndex` for the same reason Discover's copy of this row carries one:
  // the search results float, and a later sibling would paint over them.
  //
  // No `justifyContent`: the title's `flex: 1` is what holds the actions on the
  // trailing edge. `space-between` was right while this row was the title and
  // the star, and became wrong the moment search was dropped between them —
  // with three content-sized children it splits the slack into both gaps and
  // leaves the magnifier stranded in the middle of the row. `ScreenHeader` and
  // `me.tsx` both pin their actions with a flexible middle instead; this is
  // that. Discover's `marginStart: 'auto'` does the same job, but only while
  // the element carrying it is rendered.
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    zIndex: 2,
  },
  title: { ...font.title, color: colors.text, flex: 1, fontSize: 34, paddingTop: spacing.md },
  list: { paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: spacing.lg,
  },
  rowLast: { borderBottomWidth: 0 },
  // Surface === bg in v3, so a background highlight would be invisible; the
  // opacity dip is the app's press idiom for plain rows.
  rowPressed: { opacity: 0.65 },
  body: { flex: 1 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  name: { ...font.heading, color: colors.text, flexShrink: 1, fontSize: 16 },
  time: { ...font.caption, color: colors.textFaint },
  preview: { color: colors.textMuted, flex: 1, fontSize: 14 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 19,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: colors.textInverse, fontSize: 11, fontWeight: '700' },
}))

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
