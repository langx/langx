import Feather from '@expo/vector-icons/Feather'
import type { InAppNotification, InAppNotificationKind } from '@langx/shared'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useMarkNotificationsRead, useNotifications } from '../../api/queries'
import { PersonRowsSkeletonV3 } from '../../components/people/PersonRowV3'
import { RowBoundary } from '../../components/RowBoundary'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyNoteV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { dedupeById } from '../../lib/dedupeById'
import { relativeTime } from '../../lib/format'
import { goBackTo, openNotification } from '../../lib/navigation'
import { drawableRows, notificationCopy, notificationHref } from '../../lib/notificationInbox'
import { clearFromTray } from '../../lib/notifications'
import { makeStyles, useTheme } from '../../lib/theme'

const HERE = '/(app)/notifications'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

/** The glyph for a kind nobody did to you — the same table as `notifications.tsx`. */
const KIND_ICONS: Record<InAppNotificationKind, keyof typeof Feather.glyphMap> = {
  follow: 'user-plus',
  postComment: 'message-circle',
  postCorrection: 'edit-3',
  pronunciationAnswer: 'mic',
  like: 'heart',
  badgeEarned: 'award',
  walletPool: 'gift',
  profileVisits: 'eye',
  commentReply: 'corner-down-right',
  testimonial: 'message-square',
}

/**
 * The notification centre in the v3 look (`V-Notifications`), behind
 * `flags.v3Home`. What it does is `notifications.tsx`'s: reading the list
 * marks nothing; "Mark all read" is offered only while something is unread;
 * tapping a row reads the pile behind it, clears it from the tray and opens
 * it; a row whose target is gone is not a button.
 */
export function NotificationsScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const list = useNotifications()
  const markRead = useMarkNotificationsRead()
  const pull = usePullToRefresh(() => list.refetch())
  const items = dedupeById(drawableRows(list.data?.pages))

  const hasUnread = items.some((item) => !item.read)

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={t('inbox.title')}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
        trailing={
          hasUnread ? (
            <Button
              label={t('inbox.markAllRead')}
              icon="check"
              variant="secondary"
              size="small"
              style={styles.markAll}
              disabled={markRead.isPending}
              onPress={() => markRead.mutate()}
            />
          ) : null
        }
      />

      {list.isPending ? (
        <PersonRowsSkeletonV3 rows={SKELETON_ROWS} />
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
            <EmptyNoteV3 icon="bell" title={t('inbox.emptyTitle')} body={t('inbox.emptyBody')} />
          }
          renderItem={({ item, index }) => (
            // One row that throws is one row missing, not the screen.
            <RowBoundary>
              <NotificationRowV3
                item={item}
                first={index === 0}
                last={index === items.length - 1}
                onRead={(id) => markRead.mutate(id)}
              />
            </RowBoundary>
          )}
        />
      )}
    </Screen>
  )
}

/** One row, inside its own boundary for the reason `notifications.tsx` gives. */
function NotificationRowV3({
  item,
  first,
  last,
  onRead,
}: {
  item: InAppNotification
  first: boolean
  last: boolean
  onRead: (id: string) => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const copy = notificationCopy(item)
  if (!copy) return null
  const href = notificationHref(item, HERE)
  const unread = !item.read
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!href}
      onPress={() => {
        if (!href) return
        if (!item.read) onRead(item._id)
        void clearFromTray({ row: item })
        openNotification(href)
      }}
      style={({ pressed }) => [
        styles.row,
        first && styles.first,
        last && styles.last,
        !first && styles.divided,
        unread && styles.unread,
        pressed && styles.pressed,
      ]}
    >
      {item.actor ? (
        <Avatar
          url={item.actor.avatarUrl}
          name={item.actor.displayName}
          seed={item.actor._id}
          size={48}
        />
      ) : (
        <View style={styles.glyph}>
          <Feather name={KIND_ICONS[item.kind]} size={v3.icon.lg} color={v3.colors.fg} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.line, unread && styles.lineUnread]} numberOfLines={2}>
          {t(copy.key, copy.params)}
        </Text>
        {item.preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {item.preview}
          </Text>
        ) : null}
        <Text style={styles.when}>
          {relativeTime(item.createdAt, { t, locale })}
          {item.earlier ? ` · ${t('inbox.earlier', { count: item.earlier })}` : ''}
        </Text>
      </View>
      {unread ? <View style={styles.dot} accessibilityLabel={t('inbox.unread')} /> : null}
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  markAll: { width: 'auto' },
  list: { paddingBottom: v3.space[32], paddingTop: v3.space[8] },
  footer: { paddingVertical: v3.space[16] },
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 84,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[12],
  },
  first: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  last: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  // The tint is what says "these are new" without hunting for the dot.
  unread: { backgroundColor: v3.colors.echoTint },
  pressed: { opacity: 0.7 },
  // The row's own grey would swallow a grey disc; the line colour stays visible on both grounds.
  glyph: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  body: { flex: 1, gap: v3.space[2], minWidth: 0 },
  line: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '500' },
  lineUnread: { fontWeight: '700' },
  preview: { ...v3.type.caption, color: v3.colors.muted, fontStyle: 'italic' },
  when: { ...v3.type.caption, color: v3.colors.muted },
  dot: { backgroundColor: v3.colors.blue, borderRadius: v3.radius.pill, height: 12, width: 12 },
}))
