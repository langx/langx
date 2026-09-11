import Feather from '@expo/vector-icons/Feather'
import type { InAppNotificationKind } from '@langx/shared'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useMarkNotificationsRead, useNotifications } from '../../src/api/queries'
import { PersonRowSkeleton } from '../../src/components/skeletons/PersonRowSkeleton'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT, useLocale } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTime } from '../../src/lib/format'
import { goBackTo, openNotification } from '../../src/lib/navigation'
import { notificationCopy, notificationHref, stickyUnread } from '../../src/lib/notificationInbox'
import { makeStyles, useTheme } from '../../src/lib/theme'

const HERE = '/(app)/notifications'

/**
 * What stands in for a face on the kinds nobody did to you.
 *
 * A `Record` rather than a lookup with a fallback, so adding a kind to
 * `IN_APP_NOTIFICATION_KINDS` is a compile error here instead of a blank
 * circle in a list. Declared in this file rather than beside the other
 * mappers because `Feather.glyphMap` pulls in `@expo/vector-icons`, which the
 * unit tests cannot load.
 */
const KIND_ICONS: Record<InAppNotificationKind, keyof typeof Feather.glyphMap> = {
  follow: 'user-plus',
  postComment: 'message-circle',
  postCorrection: 'edit-3',
  pronunciationAnswer: 'mic',
  like: 'heart',
  badgeEarned: 'award',
  walletPool: 'gift',
  profileVisits: 'eye',
}

/**
 * What has happened to this account lately.
 *
 * The place the feed's pushes have always claimed things were waiting. A reply
 * push is throttled to one per post per hour and likes are batched to a day,
 * because a phone buzzing interrupts — this list does not, so every one of
 * them is here.
 */
export default function NotificationsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const list = useNotifications()
  const markRead = useMarkNotificationsRead()
  const pull = usePullToRefresh(() => list.refetch())
  const items = dedupeById(list.data?.pages.flatMap((page) => page.items) ?? [])

  /*
   * Which rows draw a dot — and deliberately not "the ones the server still
   * calls unread". Marking read patches the cache the moment it lands, so a
   * dot bound to that flag would blink out while the reader was looking at it.
   * The set only grows and dies with the screen, so a refetch cannot take a
   * dot away either and a later visit correctly shows none.
   */
  const unreadAtEntry = useRef<Set<string>>(new Set())
  unreadAtEntry.current = stickyUnread(unreadAtEntry.current, items)

  /*
   * Marked read once per fetch that brought something unread — not once per
   * mount, and not on `isSuccess`.
   *
   * Two traps, both found by driving the real app rather than by reading it.
   *
   * `isSuccess` is already true on a second visit, because the cache still
   * holds the last page. Gating on it fires the POST while this mount's
   * refetch is still in flight, so a notification that arrived in between
   * comes back from that refetch already read, with no dot — precisely the
   * case the dot exists for. `isFetchedAfterMount` is the flag that means
   * "what is in the cache was fetched since this screen opened".
   *
   * And once-per-mount is not enough, because on the web a push does not
   * unmount what it covers: opening a post from a row and coming back returns
   * to this same component with its refs intact. A row that arrived in between
   * would never be marked, and the bell would keep a count for something the
   * reader is looking at.
   *
   * So the latch is the fetch timestamp rather than a boolean. A double invoke
   * shares one timestamp and posts once; the cache patch that follows a
   * successful mark moves it again, but by then nothing is unread and the
   * guard below stops there.
   */
  const hasUnread = items.some((item) => !item.read)
  const markedAt = useRef(0)
  const mark = markRead.mutate
  useEffect(() => {
    if (!list.isFetchedAfterMount || !hasUnread) return
    if (list.dataUpdatedAt === markedAt.current) return
    markedAt.current = list.dataUpdatedAt
    mark()
  }, [list.isFetchedAfterMount, list.dataUpdatedAt, hasUnread, mark])

  return (
    <Screen fluid>
      <ScreenHeader title={t('inbox.title')} onBack={() => goBackTo('/(app)/(tabs)/feed')} />

      {list.isPending ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <PersonRowSkeleton key={key} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
          }}
          ListFooterComponent={
            list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyState icon="bell" title={t('inbox.emptyTitle')} body={t('inbox.emptyBody')} />
          }
          renderItem={({ item }) => {
            const copy = notificationCopy(item)
            const href = notificationHref(item, HERE)
            const unread = unreadAtEntry.current.has(item._id)
            return (
              <Pressable
                accessibilityRole="button"
                // A row whose target is gone is not a button that opens an
                // empty screen — it is not a button.
                disabled={!href}
                onPress={() => {
                  if (href) openNotification(href)
                }}
                style={({ pressed }) => [
                  styles.row,
                  unread && styles.unread,
                  pressed && styles.pressed,
                ]}
              >
                {item.actor ? (
                  <Avatar
                    url={item.actor.avatarUrl}
                    name={item.actor.displayName}
                    seed={item.actor._id}
                  />
                ) : (
                  <View style={styles.glyph}>
                    <Feather name={KIND_ICONS[item.kind]} size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.body}>
                  <Text style={styles.line} numberOfLines={2}>
                    {t(copy.key, copy.params)}
                  </Text>
                  {item.preview ? (
                    <Text style={styles.preview} numberOfLines={1}>
                      {item.preview}
                    </Text>
                  ) : null}
                  <Text style={styles.when}>{relativeTime(item.createdAt, { t, locale })}</Text>
                </View>
                {unread ? <View style={styles.dot} accessibilityLabel={t('inbox.unread')} /> : null}
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

const useStyles = makeStyles(({ colors, font, layout, radius, spacing }) => ({
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    // The same 14 the person-row skeleton draws, so the placeholder and the
    // real thing are the same height.
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  // A dot on a 48pt row is easy to miss on its own; the tint is what makes
  // "these three are new" readable without looking for anything.
  unread: { backgroundColor: colors.accentBg },
  pressed: { opacity: 0.7 },
  // `fill`, not `accentBg`: the unread tint below is `accentBg`, and a glyph
  // disc the same colour as the row it sits on disappears exactly when the row
  // is the one worth looking at.
  glyph: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: layout.avatar / 2,
    height: layout.avatar,
    justifyContent: 'center',
    width: layout.avatar,
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  line: { ...font.body, color: colors.text, fontSize: 15 },
  preview: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  when: { color: colors.textFaint, fontSize: 12 },
  dot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 8, width: 8 },
}))
