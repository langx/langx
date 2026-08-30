import { PLAN_LIMITS } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useConversations, useMe } from '../../src/api/queries'
import { ConversationRowSkeleton } from '../../src/components/skeletons/ConversationRowSkeleton'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { relativeTimeCompact } from '../../src/lib/format'
import { useLocale, useT } from '../../src/i18n'

/** v3 draws chat avatars at 52, one step up from the 48 default. */
const AVATAR_SIZE = 52

export default function ChatsScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const conversations = useConversations()
  // Deduped on flatten: a keyset cursor over a moving sort key can emit the
  // same row on two pages, and a duplicate `key` in a FlatList is a warning
  // plus a row that never updates.
  const items = dedupeById(conversations.data?.pages.flatMap((page) => page.items) ?? [])

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
        <Text style={styles.title}>{t('tabs.chats')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chats.starredMessages')}
          hitSlop={10}
          onPress={() => router.push('/(app)/starred')}
        >
          <Feather name="star" size={21} color={colors.textMuted} />
        </Pressable>
      </View>

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <ConversationRowSkeleton key={key} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
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
              title={t('chats.emptyTitle')}
              body={t('chats.emptyBody', { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 })}
              actionLabel={t('chats.goToDiscover')}
              onAction={() => router.push('/(app)/discover')}
            />
          }
          renderItem={({ item, index }) => {
            const partnerId = item.participants.find((p) => p !== me.data?._id) ?? ''
            const partner = partners[partnerId]
            const unread = me.data ? (item.unread[me.data._id] ?? 0) : 0
            const mine = item.lastMessage.senderId === me.data?._id

            return (
              <Pressable
                onPress={() => router.push(`/(app)/chat/${item._id}`)}
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
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.title, color: colors.text, fontSize: 34, paddingTop: spacing.md },
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
