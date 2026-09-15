import Feather from '@expo/vector-icons/Feather'
import * as Updates from 'expo-updates'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSignalAppReady } from '../hooks/useAppReady'
import { makeStyles, useTheme } from '../lib/theme'
import { useLocale, useT } from '../i18n'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { STORE_URL } from '../lib/storeListing'

function Blocked({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.icon}>
          <Feather name={icon} size={48} color={colors.textMuted} />
        </View>
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
  const [applying, setApplying] = useState(false)

  /*
   * An over-the-air update is installed the moment it is found, and nobody
   * is asked. Once per launch: the check runs as the app comes up, so a new
   * bundle lands behind the opening animation and not under somebody
   * mid-conversation — which is the case the old "restart now" toast was
   * protecting, and the reason this still never polls. The toast itself is
   * gone: an update left for later was a fix people were not getting, and
   * the ceremony of choosing to take it bought nothing. While the bundle
   * downloads the screen below stands in for the app; a failed download
   * simply lets the app through on the bundle it already has, as before.
   *
   * `isEmbeddedLaunch` is false once a downloaded update is running, so this
   * only ever acts on a genuinely new one, and never in development where
   * updates are disabled.
   */
  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web') return
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync()
        if (!check.isAvailable) return
        setApplying(true)
        const fetched = await Updates.fetchUpdateAsync()
        if (fetched.isNew) {
          await Updates.reloadAsync()
          return
        }
      } catch {
        // An update check failing is not a reason to keep anyone out.
      }
      setApplying(false)
    })()
  }, [])

  const data = config.data

  /*
   * A blocked app never mounts a route, so nothing downstream would ever say
   * the opening is over — the animation would sit on top of the maintenance
   * notice for its full timeout before revealing it.
   */
  useSignalAppReady(Boolean(data?.maintenance.enabled || data?.updateRequired || applying))

  // Full screen, after the opening: the app is about to restart into the
  // new bundle, and a spinner in a corner would leave the old one usable
  // for exactly the seconds in which it is being replaced.
  if (applying) {
    return (
      <Blocked
        icon="download-cloud"
        title={t('update.applyingTitle')}
        body={t('update.applyingBody')}
      />
    )
  }

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
        icon="tool"
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
        icon="arrow-up-circle"
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
  icon: { marginBottom: spacing.lg },
  title: { ...font.title, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  action: { marginTop: spacing.xl, minWidth: 200 },
}))
