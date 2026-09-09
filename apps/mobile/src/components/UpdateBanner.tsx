import Feather from '@expo/vector-icons/Feather'
import { versionForPlatform } from '@langx/shared'
import { useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../api/queries'
import { appPlatform, useAppConfig } from '../hooks/useAppConfig'
import { FLAG_KEYS, readFlag, writeFlag } from '../lib/localFlags'
import { openStoreListing } from '../lib/storeListing'
import { makeStyles, spacing, useTheme } from '../lib/theme'
import { shouldShowUpdateNotice } from '../lib/updateNotice'
import { useT } from '../i18n'

/**
 * Says that a newer build than this one has been published, and offers to go
 * and get it.
 *
 * The soft half of the version story. `AppGate` has the hard half: once
 * `minVersion` passes this build the app stops dead, and the first anyone
 * hears of it is a screen they cannot leave. This banner is what makes that
 * not be the first thing they hear — it appears while the old build still
 * works, so the forced screen only ever reaches someone who chose to wait.
 *
 * Dismissible, and per version: someone who does not want to update today
 * should not be asked again until there is something else to ask about. See
 * `lib/updateNotice.ts`.
 *
 * Deliberately not about over-the-air updates. Those do not change the version
 * an installed binary reports, so they can neither raise this banner nor clear
 * it; `AppGate` tells people about a downloaded OTA update itself, with a
 * toast, because there is nowhere to send them for it.
 */
export function UpdateBanner() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const config = useAppConfig()
  const me = useMe()
  const insets = useSafeAreaInsets()

  /*
   * Three states, not two: `undefined` is "the flag has not been read yet".
   * Starting at `null` would mean "never dismissed", and the banner would
   * appear for a frame on every launch before the read came back and took it
   * away again.
   */
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    void readFlag(FLAG_KEYS.updateNoticeDismissed).then(setDismissed)
  }, [])

  const data = config.data
  /*
   * Both fields are read defensively, because `AppConfigResponse` is a cast
   * and not a guarantee: `api.get` parses the body and trusts the type. An API
   * older than this build answers without either of them — which is not a
   * hypothetical but the normal state for as long as it takes to deploy the
   * API after the web build and the OTA update have gone out on merge.
   *
   * Reading `.web` off an absent `latestVersion` would throw, and this renders
   * above the navigator: the throw would take `(app)/_layout.tsx` down with it
   * and every signed-in screen with that, which is the same failure
   * `docs/decisions.md` records for the `expo-notifications` import. A banner
   * nobody sees is the correct behaviour against a server that has not heard
   * of it yet.
   */
  const latest = data?.latestVersion ? versionForPlatform(data.latestVersion, appPlatform()) : ''

  if (!data || dismissed === undefined) return null
  // One bar at the top at a time, and a pending deletion is the more urgent of
  // the two by a distance. `DeletionBanner` takes the status-bar inset when it
  // renders, so this one can take it unconditionally.
  if (me.data?.deletedAt) return null
  if (
    !shouldShowUpdateNotice({ updateAvailable: Boolean(data.updateAvailable), latest, dismissed })
  ) {
    return null
  }

  async function update(): Promise<void> {
    // No store to send anyone to on the web, and none needed: the new build is
    // already being served, and what they are running is a tab that has been
    // open since before it went out.
    if (Platform.OS === 'web') {
      globalThis.location?.reload()
      return
    }
    await openStoreListing()
  }

  return (
    // Its own top inset, for the reason `DeletionBanner` carries one: it sits
    // above the navigator, outside every `Screen`, and the layout does not
    // inset for it.
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.text}>
        <Text style={styles.title}>{t('update.bannerTitle')}</Text>
        <Text style={styles.body}>{t('update.bannerBody')}</Text>
      </View>
      <Pressable onPress={() => void update()} hitSlop={8}>
        <Text style={styles.action}>{t('common.update')}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t('update.dismiss')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          setDismissed(latest)
          void writeFlag(FLAG_KEYS.updateNoticeDismissed, latest)
        }}
      >
        <Feather name="x" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  /*
   * The soft blue tint rather than `DeletionBanner`'s red. Nothing here is
   * wrong yet — the app works, and will keep working until `minVersion` says
   * otherwise — so it reads as information, not as an alarm.
   */
  root: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1 },
  title: { ...font.caption, color: colors.text, fontWeight: '700' },
  body: { ...font.caption, color: colors.textMuted },
  action: { ...font.caption, color: colors.accent, fontWeight: '700' },
}))
