import { router } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useConversations, useMe } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { colors, font, radius, spacing } from '../../src/lib/theme'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'şimdi'
  if (minutes < 60) return `${minutes}dk`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}sa`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}g`
  return new Date(iso).toLocaleDateString()
}

export default function ChatsScreen() {
  const me = useMe()
  const conversations = useConversations()
  const items = conversations.data?.items ?? []

  // One batched lookup for every counterpart, instead of a query per row.
  const partnerIds = items
    .map((c) => c.participants.find((p) => p !== me.data?._id))
    .filter((id): id is string => Boolean(id))
  const partners = useProfileCache(partnerIds)

  return (
    <Screen fluid>
      <Text style={styles.title}>Sohbetler</Text>

      {conversations.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              emoji="💬"
              title="Henüz sohbet yok"
              body="Keşfet sekmesinden birine yaz. Ücretsiz planda günde 5 yeni sohbet başlatabilirsin — gelen mesajlara cevap vermek sınırsız."
              actionLabel="Keşfet'e git"
              onAction={() => router.push('/(app)/discover')}
            />
          }
          renderItem={({ item }) => {
            const partnerId = item.participants.find((p) => p !== me.data?._id) ?? ''
            const partner = partners[partnerId]
            const unread = me.data ? (item.unread[me.data._id] ?? 0) : 0
            const mine = item.lastMessage.senderId === me.data?._id

            return (
              <Pressable
                onPress={() => router.push(`/(app)/chat/${item._id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Avatar
                  url={partner?.avatarUrl}
                  name={partner?.displayName ?? '?'}
                  online={partner?.isOnline ?? false}
                />
                <View style={styles.body}>
                  <View style={styles.top}>
                    <Text style={styles.name} numberOfLines={1}>
                      {partner?.displayName ?? 'Yükleniyor…'}
                    </Text>
                    <Text style={styles.time}>{relativeTime(item.lastMessage.createdAt)}</Text>
                  </View>
                  <View style={styles.bottom}>
                    <Text
                      style={[styles.preview, unread > 0 && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {mine ? 'Sen: ' : ''}
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

const styles = StyleSheet.create({
  title: { ...font.title, color: colors.text, paddingTop: spacing.md },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surface, borderRadius: radius.md },
  body: { flex: 1 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  name: { ...font.body, color: colors.text, flexShrink: 1, fontWeight: '700' },
  time: { ...font.caption, color: colors.textMuted },
  preview: { ...font.caption, color: colors.textMuted, flex: 1 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: colors.primaryText, fontSize: 11, fontWeight: '700' },
})
