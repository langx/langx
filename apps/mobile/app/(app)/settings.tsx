import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { api, ApiRequestError } from '../../src/api/client'
import { useMe, useUpdateProfile } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { authClient } from '../../src/lib/auth-client'
import { colors, font, radius, spacing } from '../../src/lib/theme'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

function Row({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string
  subtitle?: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  )
}

export default function SettingsScreen() {
  const me = useMe()
  const update = useUpdateProfile()
  const [busy, setBusy] = useState(false)

  const profile = me.data
  const isPro = profile?.entitlement.tier === 'pro'

  async function signOut(): Promise<void> {
    await authClient.signOut()
    router.replace('/(auth)/sign-in')
  }

  /**
   * Export is a plain authenticated GET that returns a download. On web the
   * browser can just be pointed at it; on native there is no download folder
   * to point at, so the URL is opened externally and the OS decides.
   */
  async function exportData(): Promise<void> {
    const url = `${API_URL}/me/export`
    if (Platform.OS === 'web') {
      window.open(url, '_blank')
      return
    }
    await Linking.openURL(url)
  }

  function confirmDelete(): void {
    Alert.alert(
      'Delete your account',
      `Your account disappears immediately. Your data is kept for ${ACCOUNT_DELETION_GRACE_DAYS} days — signing back in within that window cancels the deletion. After that it is permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true)
              try {
                await api.post('/me/delete', { confirm: 'DELETE' })
                await authClient.signOut()
                router.replace('/(auth)/sign-in')
              } catch (error) {
                Alert.alert(
                  'Could not delete',
                  error instanceof ApiRequestError ? error.message : 'Try again.',
                )
              } finally {
                setBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>Privacy</Text>
      <Row
        title="Show me in Discover"
        subtitle="Turn this off and nobody will find you in Discover."
        value={profile?.settings.discoverable ?? true}
        onValueChange={(discoverable) =>
          update.mutate({ settings: { ...profile?.settings, discoverable } })
        }
      />
      <Row
        title="Incognito browsing"
        subtitle={isPro ? 'Look at profiles without leaving a trace.' : 'Pro feature.'}
        value={profile?.privacy.incognito ?? false}
        disabled={!isPro}
        onValueChange={(incognito) => update.mutate({ privacy: { incognito } })}
      />
      <Row
        title="Notifications"
        subtitle="Messages and the streak reminder."
        value={profile?.settings.notifications ?? true}
        onValueChange={(notifications) =>
          update.mutate({ settings: { ...profile?.settings, notifications } })
        }
      />

      <Text style={styles.section}>Your data</Text>
      <Button
        label="Download my data"
        variant="secondary"
        onPress={exportData}
        style={styles.button}
      />

      <Text style={styles.section}>Account</Text>
      <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.button} />

      <Pressable onPress={confirmDelete} disabled={busy} style={styles.delete}>
        <Text style={styles.deleteText}>Delete my account</Text>
      </Pressable>
      <Text style={styles.deleteHint}>
        Signing back in within {ACCOUNT_DELETION_GRACE_DAYS} days cancels the deletion.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  section: {
    ...font.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDisabled: { opacity: 0.5 },
  rowText: { flex: 1 },
  rowTitle: { ...font.body, color: colors.text },
  rowSubtitle: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  button: { marginTop: spacing.sm },
  delete: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
  },
  deleteText: { ...font.body, color: colors.danger, fontWeight: '700' },
  deleteHint: {
    ...font.caption,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})
