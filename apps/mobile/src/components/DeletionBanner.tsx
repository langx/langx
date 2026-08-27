import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api } from '../api/client'
import { keys, useMe } from '../api/queries'
import { colors, font, spacing } from '../lib/theme'

function daysLeft(deletedAt: string): number {
  const purgeAt = new Date(deletedAt).getTime() + ACCOUNT_DELETION_GRACE_DAYS * 86_400_000
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / 86_400_000))
}

/**
 * The one thing that made the 30-day grace period real.
 *
 * `decisions.md` says the delay exists so "a single angry tap can be taken
 * back" — but the server's `POST /me/delete/cancel` had no caller, and nothing
 * anywhere told the user a deletion was pending. Someone who tapped delete and
 * came back the next day found a working app in which they were invisible to
 * everybody, with no warning, no countdown and no way out.
 *
 * A banner rather than a blocking screen: the account genuinely still works
 * during the grace period, and locking them out of it would be a second
 * punishment for a decision they may be about to reverse. It sits above the
 * tabs, so it is on every screen and cannot be walked past.
 */
export function DeletionBanner() {
  const me = useMe()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const deletedAt = me.data?.deletedAt
  if (!deletedAt) return null

  const left = daysLeft(deletedAt)

  async function keepAccount(): Promise<void> {
    setBusy(true)
    try {
      await api.post('/me/delete/cancel', {})
      await queryClient.invalidateQueries({ queryKey: keys.me })
    } catch {
      // Left visible on failure. A banner that vanishes without the deletion
      // actually being cancelled is the worst possible outcome here.
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.text}>
        <Text style={styles.title}>
          {left === 0
            ? 'Your account is being deleted today.'
            : left === 1
              ? 'Your account will be deleted tomorrow.'
              : `Your account will be deleted in ${left} days.`}
        </Text>
        <Text style={styles.body}>Until then nobody can find you or see your profile.</Text>
      </View>
      <Pressable onPress={() => void keepAccount()} disabled={busy} hitSlop={8}>
        <Text style={styles.action}>{busy ? 'Wait…' : 'Keep it'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1 },
  title: { ...font.caption, color: colors.primaryText, fontWeight: '700' },
  body: { ...font.caption, color: colors.primaryText, opacity: 0.9 },
  action: {
    ...font.caption,
    color: colors.primaryText,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
})
