import Feather from '@expo/vector-icons/Feather'
import { profileQrUrl, profileUrl } from '@langx/shared'
import * as Clipboard from 'expo-clipboard'
import { Image } from 'expo-image'
import { Text, View } from 'react-native'
import { LoadFailed } from '../../src/components/LoadFailed'
import { queryFailed } from '../../src/lib/listState'
import { useMe } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { API_URL } from '../../src/lib/apiUrl'
import { goBackTo } from '../../src/lib/navigation'
import { shareLink } from '../../src/lib/share'
import { makeStyles, radius, useTheme } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
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
  const { colors } = useTheme()
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
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <View style={styles.loading}>
            {/* The card's own 180 square, so the QR does not resize the column
                when it arrives. */}
            <Skeleton width={180} height={180} radius={radius.lg} />
            <Skeleton width={148} height={18} />
            <Skeleton width={196} height={15} />
          </View>
        )}
      </Screen>
    )
  }

  const handle = me.data.handle
  const url = profileUrl(handle)

  return (
    // Not `scroll`: the buttons sit on the bottom edge, pushed there by the
    // spacer, and a scroll view has no bottom to push against.
    <Screen fluid style={styles.column}>
      <ScreenHeader
        title={t('shareProfile.title')}
        onBack={() => goBackTo('/(app)/settings/share')}
      />

      <View style={styles.code}>
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
        </View>
        <View style={styles.who}>
          <Text style={styles.name}>{me.data.displayName}</Text>
          <Text style={styles.url}>{url.replace('https://', '')}</Text>
        </View>
      </View>

      <Text style={styles.body}>{t('shareProfile.scanBody')}</Text>

      <View style={styles.spacer} />

      <Button
        label={t('invite.share')}
        icon={<Feather name="share" size={20} color={colors.primaryText} />}
        onPress={() => void shareLink({ message: t('me.shareMessage', { url }), url })}
      />
      <Button
        label={t('invite.copy')}
        variant="secondary"
        icon={<Feather name="copy" size={18} color={colors.accent} />}
        onPress={async () => {
          await Clipboard.setStringAsync(url)
          showToast(t('shareProfile.copied'))
        }}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxl },
  // The design's rhythm for this column: 22 between every block, buttons included.
  column: { gap: 22 },
  code: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  /*
   * White in both schemes, and a fixed size.
   *
   * A QR on a dark card is one no camera locks onto, so this is the one
   * surface that does not follow the theme. And the block centres its
   * children, so on the cross axis "100%" has nothing to be a percentage
   * *of* — the image used to resolve to zero width, paint nothing, and never
   * even fetch. A QR wants a known size anyway: too small and a camera cannot
   * resolve the modules, and it does not benefit from being bigger than a
   * phone screen held at arm's length.
   */
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 180,
    justifyContent: 'center',
    padding: 10,
    width: 180,
  },
  qr: { height: 160, width: 160 },
  who: { alignItems: 'center' },
  name: { ...font.heading, color: colors.text },
  url: { color: colors.textMuted, fontSize: 15 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  spacer: { flex: 1 },
}))
