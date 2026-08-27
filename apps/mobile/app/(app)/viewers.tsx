import { router } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useViewers } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { openPaywall } from '../../src/lib/paywall'
import { colors, font, spacing } from '../../src/lib/theme'

export default function ViewersScreen() {
  const viewers = useViewers()

  return (
    <Screen fluid>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Who viewed your profile</Text>

      {viewers.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : viewers.data?.locked ? (
        <View style={styles.locked}>
          <Text style={styles.lockedCount}>{viewers.data.total}</Text>
          <Text style={styles.lockedLabel}>
            {viewers.data.total === 0
              ? 'Nobody has viewed your profile yet.'
              : 'people viewed your profile'}
          </Text>
          {viewers.data.total > 0 ? (
            <Button
              label="See who they are"
              onPress={() => openPaywall('profileViewerIdentities')}
              style={styles.cta}
            />
          ) : null}
        </View>
      ) : (
        <FlatList
          data={viewers.data?.viewers ?? []}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState emoji="👀" title="No visitors yet" body="Filling in your profile helps." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/profile/${item.handle}`)}
              style={styles.row}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} />
              <View style={styles.body}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.time}>{new Date(item.lastViewedAt).toLocaleDateString()}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  loading: { marginTop: spacing.xxl },
  locked: { alignItems: 'center', paddingVertical: spacing.xxl },
  lockedCount: { color: colors.text, fontSize: 56, fontWeight: '700' },
  lockedLabel: { ...font.body, color: colors.textMuted },
  cta: { marginTop: spacing.xl, minWidth: 220 },
  list: { paddingTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  body: { flex: 1 },
  name: { ...font.body, color: colors.text, fontWeight: '600' },
  time: { ...font.caption, color: colors.textMuted },
})
