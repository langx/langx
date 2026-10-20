import { profileQrUrl, profileUrl } from '@langx/shared'
import * as Clipboard from 'expo-clipboard'
import { Image } from 'expo-image'
import { Text, View } from 'react-native'
import { useMe } from '../../api/queries'
import { LoadFailed } from '../../components/LoadFailed'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { track } from '../../lib/analytics'
import { API_URL } from '../../lib/apiUrl'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { shareLink } from '../../lib/share'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { showToast } from '../../lib/toast'
import { useV3Fonts } from './useV3Fonts'

const BACK = '/(app)/settings/share'

/**
 * The link, big enough to point a camera at — the redesign's drawing of it
 * (`V-ShareProfile`), behind `flags.v3Home`. Same code, same two actions and
 * the same events as `share-profile.tsx`.
 *
 * The code sits on your own colour, inside a white card that stays white
 * after dark: a QR on a dark card is one no camera reads. No yellow — nothing
 * here commits anything — so Share is the blue and Copy the outline.
 */
export function ShareProfileScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const black = useV3Fonts()
  const me = useMe()

  const header = (
    <WalletHeader title={t('shareProfile.title')} black={black} onBack={() => goBackTo(BACK)} />
  )

  // As today: `!me.data`, with a failure that ends in something to press.
  if (!me.data) {
    return (
      <Screen ground={v3.colors.bg}>
        {header}
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <View style={styles.loading}>
            <Skeleton height={CODE_BLOCK} radius={v3.radius.hero} />
            <Skeleton width={196} height={15} />
          </View>
        )}
      </Screen>
    )
  }

  const handle = me.data.handle
  const url = profileUrl(handle)
  const hue = v3.hues[partnerHueFor(me.data._id)]

  return (
    // Not `scroll`, as today: the buttons are pushed to the foot by the spacer.
    <Screen fluid ground={v3.colors.bg} style={styles.column}>
      {header}

      <View style={[styles.code, { backgroundColor: hue }]}>
        <View style={styles.card}>
          {/* `contain` in a square box: a stretched QR is one no reader locks onto. */}
          <Image
            source={{ uri: profileQrUrl(API_URL, handle) }}
            style={styles.qr}
            contentFit="contain"
            accessibilityLabel={t('shareProfile.qrAccessibility', { handle })}
          />
        </View>
        <View style={styles.who}>
          <Avatar url={me.data.avatarUrl} name={me.data.displayName} seed={me.data._id} size={48} />
          <View style={styles.whoText}>
            <Text style={[styles.name, !black && styles.nameFallback]} numberOfLines={1}>
              {me.data.displayName}
            </Text>
            <Text style={styles.url} numberOfLines={1}>
              {url.replace('https://', '')}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.body}>{t('shareProfile.scanBody')}</Text>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={t('invite.share')}
          icon="share"
          variant="blue"
          onPress={() => {
            track({ name: 'profile_shared', properties: { own: true, via: 'sheet' } })
            void shareLink({ message: t('me.shareMessage', { url }), url })
          }}
        />
        <Button
          label={t('invite.copy')}
          variant="secondary"
          icon="copy"
          onPress={async () => {
            await Clipboard.setStringAsync(url)
            track({ name: 'profile_shared', properties: { own: true, via: 'copy' } })
            showToast(t('shareProfile.copied'))
          }}
        />
      </View>
    </Screen>
  )
}

/** The hue block's height with its card and name, so the skeleton holds its place. */
const CODE_BLOCK = 364

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[16], paddingTop: v3.space[10] },
  column: { gap: v3.space[16] },
  code: {
    alignItems: 'center',
    borderRadius: v3.radius.hero,
    gap: v3.space[16],
    marginTop: v3.space[10],
    paddingBottom: 22,
    paddingHorizontal: v3.space[20],
    paddingTop: 26,
  },
  // White in both schemes and a fixed size — see the note on the screen.
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: v3.radius.badge,
    height: 236,
    justifyContent: 'center',
    padding: 18,
    width: 236,
  },
  qr: { height: 200, width: 200 },
  who: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12], maxWidth: '100%' },
  whoText: { flexShrink: 1 },
  name: { ...v3.type.title, color: v3.colors.ink, fontSize: 26, lineHeight: 30 },
  nameFallback: { fontFamily: v3.type.headline.fontFamily },
  url: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '700' },
  body: { ...v3.type.body, color: v3.colors.muted, marginHorizontal: v3.space[6] },
  spacer: { flex: 1 },
  actions: { gap: v3.space[10], paddingBottom: v3.space[16] },
}))
