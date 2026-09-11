import { CONVERSATION_FILTERS, PLAN_LIMITS, type ConversationFilter } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import {
  useDeleteConversation,
  useConversationFlags,
  useConversations,
  useMe,
  type ConversationDto,
} from '../../../src/api/queries'
import { Tip } from '../../../src/components/Tip'
import { SwipeableRow } from '../../../src/components/SwipeableRow'
import { ConversationRowSkeleton } from '../../../src/components/skeletons/ConversationRowSkeleton'
import { Avatar } from '../../../src/components/ui/Avatar'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { Screen } from '../../../src/components/ui/Screen'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import { usePushPermissionPrompt } from '../../../src/hooks/usePushRegistration'
import { chooseAlert, confirmAlert, showAlert } from '../../../src/lib/alert'
import { showToast } from '../../../src/lib/toast'
import { dedupeById } from '../../../src/lib/dedupeById'
import { listState } from '../../../src/lib/listState'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { relativeTimeCompact } from '../../../src/lib/format'
import { useLocale, useT } from '../../../src/i18n'
import type { MessageKey } from '../../../src/i18n/runtime'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { OfficialMark } from '../../../src/components/OfficialMark'

/** The design draws chat avatars at 56, the same size as Discover's rows. */
const AVATAR_SIZE = 56

/** Per tab, keyed so a missing entry does not compile. */
const EMPTY_COPY: Record<ConversationFilter, { title: MessageKey; body: MessageKey }> = {
  all: { title: 'chats.emptyTitle', body: 'chats.emptyBody' },
  unreplied: { title: 'chats.unrepliedEmptyTitle', body: 'chats.unrepliedEmptyBody' },
  archived: { title: 'chats.archivedEmptyTitle', body: 'chats.archivedEmptyBody' },
}

export default function ChatsScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  usePushPermissionPrompt()
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const conversations = useConversations(filter)
  const pull = usePullToRefresh(() => conversations.refetch())
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

  /**
   * The `⋯` at the end of every row opens this, and so does a long press on
   * the row itself — the gesture the app teaches on every message bubble.
   *
   * `chooseAlert` rather than a new menu host: it already draws a list of
   * choices on every platform, including web, where react-native's own `Alert`
   * is an empty function. And it is here as well as behind the swipe because
   * on a desktop browser the swipe is not offered at all, so this menu is the
   * only way to reach any of these.
   */
  function openMenu(item: ConversationDto, title: string): void {
    void chooseAlert(title, undefined, [
      { label: item.pinned ? t('chats.unpin') : t('chats.pin'), value: 'pin' },
      { label: item.archived ? t('chats.unarchive') : t('chats.archive'), value: 'archive' },
      { label: t('chats.delete'), value: 'delete', destructive: true },
    ]).then((choice) => {
      if (choice === 'pin') flags.mutate({ conversationId: item._id, pinned: !item.pinned })
      if (choice === 'archive') {
        flags.mutate({ conversationId: item._id, archived: !item.archived })
      }
      if (choice === 'delete') void confirmDelete(item._id)
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
    isPaused: conversations.fetchStatus === 'paused',
  })

  return (
    <Screen fluid>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('tabs.chats')}</Text>
          {/*
            The only way into the starred list. A star is private and one-sided,
            so without an entry point here it is a write with no read.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chats.starredMessages')}
            hitSlop={8}
            onPress={() => router.push('/(app)/starred')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="star" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/*
          Three tabs, matching the pattern `feed.tsx` set: the filter lives in
          `useState`, goes into the query key, and the server does the narrowing.
          Filtering the loaded pages on the client instead would show whatever
          happened to be fetched, which is exactly wrong for "who am I keeping
          waiting" — the answer is usually further down the list.
        */}
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
      </View>

      {/* Above the list rather than inside it: a hint that scrolls away is
          one nobody reads. */}
      <Tip slot="chats" />

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <ConversationRowSkeleton key={key} />
          ))}
        </View>
      ) : state === 'failed' ? (
        /* Before the list, because `ListEmptyComponent` would otherwise say
           "No chats yet" to somebody whose request never arrived — and offer
           to go and start one. */
        <LoadFailed onRetry={() => void conversations.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
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
            /*
              Per tab, because "no chats at all" and "nothing waiting on you"
              are opposite news and the generic copy makes the second read as
              the first — with a button offering to go and start one.
            */
            <EmptyState
              icon="message-square"
              title={t(EMPTY_COPY[filter].title)}
              body={
                filter === 'all'
                  ? t('chats.emptyBody', { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 })
                  : t(EMPTY_COPY[filter].body)
              }
              actionLabel={t('chats.goToDiscover')}
              actionVariant="secondary"
              onAction={() => router.push('/(app)/(tabs)/discover')}
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
                <View style={[styles.row, index === items.length - 1 && styles.rowLast]}>
                  <Pressable
                    /*
                     * An open row closes rather than opening the thread. Tapping
                     * the part of a row that is holding its own buttons open
                     * means "never mind", and navigating away from a drawer that
                     * was never closed leaves it open behind you.
                     */
                    onPress={() =>
                      openRow === item._id
                        ? setOpenRow(null)
                        : router.push(`/(app)/chat/${item._id}`)
                    }
                    onLongPress={() => openMenu(item, partner?.displayName ?? '')}
                    style={({ pressed }) => [styles.thread, pressed && styles.pressed]}
                  >
                    {partner ? (
                      <Avatar
                        url={partner.avatarUrl}
                        name={partner.displayName}
                        seed={partner._id}
                        online={partner.isOnline}
                        size={AVATAR_SIZE}
                      />
                    ) : (
                      <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
                    )}
                    <View style={styles.body}>
                      <View style={styles.top}>
                        {partner ? (
                          <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>
                              {partner.displayName}
                            </Text>
                            {partner.official ? <OfficialMark size={14} /> : null}
                          </View>
                        ) : (
                          // The row is real, its partner is not resolved yet: the
                          // names come from a separate batched query. This used to
                          // read "Loading…", which looked like somebody's name.
                          <View style={styles.grow}>
                            <Skeleton width={132} height={17} />
                          </View>
                        )}
                        {item.pinned ? (
                          <Feather name="bookmark" size={14} color={colors.textFaint} />
                        ) : null}
                        <Text style={styles.time}>
                          {relativeTimeCompact(item.lastMessage.createdAt, { t, locale })}
                        </Text>
                      </View>
                      <View style={styles.bottom}>
                        <Text style={styles.preview} numberOfLines={1}>
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('messageMenu.more')}
                    onPress={() => openMenu(item, partner?.displayName ?? '')}
                    hitSlop={6}
                    style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
                  >
                    <Feather name="more-horizontal" size={20} color={colors.textFaint} />
                  </Pressable>
                </View>
              </SwipeableRow>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // The bottom half is the gap above the tip; `Tip` owns the one below it.
  header: { paddingBottom: spacing.sm, paddingTop: spacing.md },
  // The title's `flex: 1` is what holds the star on the trailing edge;
  // `ScreenHeader` and `me.tsx` pin their actions with a flexible middle the
  // same way.
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 14, minHeight: 48 },
  title: { ...font.title, color: colors.text, flex: 1, fontSize: 34 },
  iconButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  filters: { marginTop: 18 },
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 18,
  },
  rowLast: { borderBottomWidth: 0 },
  // Surface === bg in v3, so a background highlight would be invisible; the
  // opacity dip is the app's press idiom for plain rows.
  pressed: { opacity: 0.7 },
  /** The tappable part of the row — everything but the `⋯`. */
  thread: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.lg, minWidth: 0 },
  body: { flex: 1, gap: spacing.xs, minWidth: 0 },
  grow: { flex: 1 },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  bottom: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  nameRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6 },
  name: { ...font.heading, color: colors.text, flex: 1, fontSize: 17 },
  time: { color: colors.textFaint, fontSize: 13 },
  preview: { color: colors.textMuted, flex: 1, fontSize: 15 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minWidth: 20,
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.textInverse, fontSize: 12, fontWeight: '700', lineHeight: 20 },
  more: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  // The one press state that is a fill rather than a dip: a round button on a
  // plain row has nothing else to show it was hit.
  morePressed: { backgroundColor: colors.fill },
}))

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
