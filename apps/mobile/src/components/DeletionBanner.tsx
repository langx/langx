import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../api/client'
import { keys, useMe } from '../api/queries'
import { makeStyles } from '../lib/theme'
import { useT } from '../i18n'

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
  const styles = useStyles()
  const t = useT()

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
            ? t('deletion.today')
            : left === 1
              ? t('deletion.tomorrow')
              : t('deletion.inDays', { count: left })}
        </Text>
        <Text style={styles.body}>{t('deletion.untilThen')}</Text>
      </View>
      <Pressable onPress={() => void keepAccount()} disabled={busy} hitSlop={8}>
        <Text style={styles.action}>{busy ? t('deletion.keeping') : t('deletion.keepIt')}</Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  root: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1 },
  title: { ...font.caption, color: colors.textInverse, fontWeight: '700' },
  body: { ...font.caption, color: colors.textInverse, opacity: 0.9 },
  action: {
    ...font.caption,
    color: colors.textInverse,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
}))
