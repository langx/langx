import Feather from '@expo/vector-icons/Feather'
import type { InAppNotificationKind } from '@langx/shared'
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
import { notificationCopy, notificationHref } from '../../src/lib/notificationInbox'
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
 * because a phone buzzing interrupts — this list does not, so none of them is
 * dropped.
 *
 * They are *collapsed*, which is a different thing: ten people commenting on
 * one sentence is ten pieces of one piece of news, and ten rows saying so is a
 * list nobody can read. The server groups them and the row says how many, so
 * nothing is lost and the screen stays scannable. See `listNotifications`.
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

  const hasUnread = items.some((item) => !item.read)

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('inbox.title')}
        onBack={() => goBackTo('/(app)/(tabs)/feed')}
        /*
         * Reading the list does **not** mark it read, which is why this is a
         * button rather than a thing that happens to you. Somebody who opens
         * the centre to check one name has not dealt with the other eleven,
         * and clearing them on their behalf loses the only record of what
         * they have not looked at yet. It is offered only when there is
         * something to clear — a control that can do nothing should not be
         * on screen.
         */
        trailing={
          hasUnread ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              disabled={markRead.isPending}
              onPress={() => markRead.mutate()}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.markAll}>{t('inbox.markAllRead')}</Text>
            </Pressable>
          ) : null
        }
      />

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
            const unread = !item.read
            return (
              <Pressable
                accessibilityRole="button"
                // A row whose target is gone is not a button that opens an
                // empty screen — it is not a button.
                disabled={!href}
                onPress={() => {
                  if (!href) return
                  // Opening it *is* dealing with it, so the dot goes and the
                  // bell drops by one. The server reads the whole pile behind
                  // this row, which is what the row was already speaking for.
                  if (!item.read) markRead.mutate(item._id)
                  openNotification(href)
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
  markAll: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  dot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 8, width: 8 },
}))
