import { profileQrUrl, profileUrl } from '@langx/shared'
import * as Clipboard from 'expo-clipboard'
import { Image } from 'expo-image'
import { ActivityIndicator, Text, View } from 'react-native'
import { LoadFailed } from '../../src/components/LoadFailed'
import { useMe } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { API_URL } from '../../src/lib/apiUrl'
import { showAlert } from '../../src/lib/alert'
import { goBackTo } from '../../src/lib/navigation'
import { shareLink } from '../../src/lib/share'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * The link, big enough to point a camera at.
 *
 * A screen rather than a row that opens the share sheet, because the two ways
 * of handing somebody your profile want opposite things. Sending it needs the
 * platform sheet; showing it across a table needs a code on screen and nothing
 * else on top of it — and a sheet cannot be photographed.
 *
 * The code is generated server-side and drawn with `expo-image`, which is
 * already a dependency. Drawing it here would mean `react-native-qrcode-svg`
 * and therefore `react-native-svg`: a native module, so a new binary and no
 * OTA update, for a picture.
 */
export default function ShareProfileScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const me = useMe()

  /*
   * `!me.data` rather than `isPending`, and an error branch beside it.
   * `useMe` does not retry, so a refused request settles at once with nothing
   * — and `isPending || !me.data` stayed true forever, leaving this screen on
   * a spinner with no end and nothing to press. Data already in hand still
   * wins over a failed refetch, which is what checking it first says.
   */
  if (!me.data) {
    return (
      <Screen>
        {me.isError ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <ActivityIndicator style={styles.loading} />
        )}
      </Screen>
    )
  }

  const handle = me.data.handle
  const url = profileUrl(handle)

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('shareProfile.title')}
        onBack={() => goBackTo('/(app)/settings/share')}
      />

      <View style={styles.card}>
        {/*
          `contentFit: contain` and a square box: a QR that has been stretched
          on one axis is one no reader will lock onto, and a parent deciding
          the aspect ratio is how that happens.
        */}
        <Image
          source={{ uri: profileQrUrl(API_URL, handle) }}
          style={styles.qr}
          contentFit="contain"
          accessibilityLabel={t('shareProfile.qrAccessibility', { handle })}
        />
        <Text style={styles.handle}>@{handle}</Text>
        <Text style={styles.url}>{url.replace('https://', '')}</Text>
      </View>

      <Text style={styles.body}>{t('shareProfile.body')}</Text>

      <View style={styles.actions}>
        <Button
          label={t('shareProfile.share')}
          onPress={() => void shareLink({ message: t('me.shareMessage', { url }), url })}
        />
        <Button
          label={t('shareProfile.copy')}
          variant="secondary"
          onPress={async () => {
            await Clipboard.setStringAsync(url)
            await showAlert(t('shareProfile.copied'))
          }}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  /*
   * A fixed size, not `width: '100%'`.
   *
   * The card centres its children, so on the cross axis "100%" has nothing to
   * be a percentage *of* — the image resolved to zero width, painted nothing,
   * and never even fetched. A QR wants a known size anyway: too small and a
   * camera cannot resolve the modules, and it does not benefit from being
   * bigger than a phone screen held at arm's length.
   */
  qr: {
    backgroundColor: '#ffffff',
    borderRadius: radius.sm,
    height: 220,
    width: 220,
  },
  handle: { ...font.heading, color: colors.text, fontSize: 20, marginTop: spacing.md },
  url: { ...font.caption, color: colors.textMuted },
  body: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
}))
