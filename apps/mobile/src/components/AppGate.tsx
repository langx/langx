import * as Updates from 'expo-updates'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSignalAppReady } from '../hooks/useAppReady'
import { makeStyles } from '../lib/theme'
import { useLocale, useT } from '../i18n'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { STORE_URL } from '../lib/storeListing'

function Blocked({
  emoji,
  title,
  body,
  actionLabel,
  onAction,
}: {
  emoji: string
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  const styles = useStyles()

  return (
    <Screen>
      <View style={styles.root}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {actionLabel && onAction ? (
          <Button label={actionLabel} onPress={onAction} style={styles.action} />
        ) : null}
      </View>
    </Screen>
  )
}

/**
 * Stands between the app and everything below it, for the two situations where
 * carrying on would be worse than stopping: the service is deliberately down,
 * or this build is too old for the current API.
 *
 * Deliberately fails **open**. If `/app-config` cannot be reached the children
 * render — a config endpoint that is unreachable must never be the reason a
 * working app refuses to start. The server's own 503s are still the real
 * enforcement; this screen only makes them legible.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const config = useAppConfig()
  const t = useT()
  const { locale } = useLocale()
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  // Pick up an OTA update in the background. `isEmbeddedLaunch` is false once
  // a downloaded update is running, so this only ever acts on a genuinely new
  // one, and never in development where updates are disabled.
  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web') return
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync()
        if (!check.isAvailable) return
        await Updates.fetchUpdateAsync()
        // Applied on the next launch rather than immediately: reloading under
        // someone mid-conversation is a worse experience than shipping the fix
        // a few minutes later.
      } catch {
        // An update check failing is not a reason to interrupt anyone.
      }
    })()
  }, [])

  const data = config.data

  /*
   * A blocked app never mounts a route, so nothing downstream would ever say
   * the opening is over — the animation would sit on top of the maintenance
   * notice for its full timeout before revealing it.
   */
  useSignalAppReady(Boolean(data?.maintenance.enabled || data?.updateRequired))

  if (data?.maintenance.enabled) {
    // Rendered in the viewer's own locale — an expected return time is the one
    // thing that turns "something is broken" into "someone is working on it".
    const until = data.maintenance.until
      ? new Date(data.maintenance.until).toLocaleString(locale)
      : null
    // The server's own message wins when there is one — it is written per
    // incident and says more than any fixed sentence can — and ours is the
    // fallback for the ordinary case where nobody typed anything.
    const message = data.maintenance.message || t('gate.maintenanceBody')
    return (
      <Blocked
        emoji="🔧"
        title={t('gate.maintenanceTitle')}
        body={until ? t('gate.maintenanceUntil', { message, until }) : message}
        actionLabel={t('common.tryAgain')}
        onAction={() => void config.refetch()}
      />
    )
  }

  if (data?.updateRequired) {
    return (
      <Blocked
        emoji="⬆️"
        title={t('gate.updateTitle')}
        body={t('gate.updateBody')}
        actionLabel={checkingUpdate ? t('common.checking') : t('common.update')}
        onAction={() => {
          void (async () => {
            setCheckingUpdate(true)
            try {
              // An over-the-air update can fix this without a store trip; only
              // fall back to the store when there is nothing to download.
              if (!__DEV__ && Platform.OS !== 'web') {
                const check = await Updates.checkForUpdateAsync()
                if (check.isAvailable) {
                  await Updates.fetchUpdateAsync()
                  await Updates.reloadAsync()
                  return
                }
              }
              await Linking.openURL(STORE_URL)
            } catch {
              await Linking.openURL(STORE_URL)
            } finally {
              setCheckingUpdate(false)
            }
          })()
        }}
      />
    )
  }

  return <>{children}</>
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  root: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emoji: { fontSize: 48, marginBottom: spacing.lg },
  title: { ...font.title, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  action: { marginTop: spacing.xl, minWidth: 200 },
}))
