import { inviteQrUrl, inviteUrl, TOKEN_RULES } from '@langx/shared'
import * as Clipboard from 'expo-clipboard'
import { Image } from 'expo-image'
import { ActivityIndicator, Text, View } from 'react-native'
import { useMe, useReferrals } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatTile } from '../../src/components/ui/StatTile'
import { useLocale, useT } from '../../src/i18n'
import { API_URL } from '../../src/lib/apiUrl'
import { showAlert } from '../../src/lib/alert'
import { goBackTo } from '../../src/lib/navigation'
import { shareLink } from '../../src/lib/share'
import { makeStyles } from '../../src/lib/theme'

const RULES = TOKEN_RULES.referral

/**
 * Your invite link, what it has earned, and who took it.
 *
 * Built on `share-profile.tsx` rather than beside it, because the QR, the box
 * it sits in and the two buttons are the same problem solved once — including
 * `contentFit: contain` on a square, which is what stops a reader failing to
 * lock onto a QR some parent has stretched.
 *
 * The amounts come from `TOKEN_RULES` directly rather than from the response.
 * They are config in a package this app already imports, and the token screen
 * reads the pool numbers the same way; shipping them over the wire would be a
 * second copy to keep in step for no gain.
 */
export default function InviteScreen() {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const me = useMe()
  const referrals = useReferrals()

  if (me.isPending || !me.data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  const handle = me.data.handle
  const url = inviteUrl(handle)
  const totals = referrals.data?.totals
  const n = (value: number) => value.toLocaleString(locale)

  return (
    <Screen scroll>
      <ScreenHeader title={t('invite.title')} onBack={() => goBackTo('/(app)/me')} />

      <View style={styles.card}>
        <Image
          source={{ uri: inviteQrUrl(API_URL, handle) }}
          style={styles.qr}
          contentFit="contain"
          accessibilityLabel={t('invite.qrAccessibility')}
        />
        <Text style={styles.code}>@{handle}</Text>
        <Text style={styles.url}>{url.replace('https://', '')}</Text>
      </View>

      <Text style={styles.body}>{t('invite.body')}</Text>

      <View style={styles.actions}>
        <Button
          label={t('invite.share')}
          onPress={() => void shareLink({ message: t('invite.shareMessage', { url }), url })}
        />
        <Button
          label={t('invite.copy')}
          variant="secondary"
          onPress={async () => {
            await Clipboard.setStringAsync(url)
            await showAlert(t('invite.copied'))
          }}
        />
      </View>

      <Text style={styles.section}>{t('invite.howTitle')}</Text>
      <Text style={styles.step}>{t('invite.step1')}</Text>
      <Text style={styles.step}>{t('invite.step2', { activation: n(RULES.activation) })}</Text>
      <Text style={styles.step}>
        {t('invite.step3', {
          subscription: n(RULES.subscription),
          max: n(RULES.maxPerInvitee),
        })}
      </Text>

      {totals ? (
        <View style={styles.tiles}>
          <StatTile
            label={t('invite.totalsInvited', { count: totals.invited })}
            value={n(totals.invited)}
          />
          <StatTile
            label={t('invite.totalsActivated', { count: totals.activated })}
            value={n(totals.activated)}
          />
          <StatTile
            label={t('invite.totalsEarned', { count: totals.tokensEarned })}
            value={n(totals.tokensEarned)}
          />
        </View>
      ) : null}

      {referrals.data?.referredBy ? (
        <Text style={styles.referredBy}>
          {t('invite.referredBy', { name: referrals.data.referredBy.displayName })}
        </Text>
      ) : null}

      {referrals.data && referrals.data.invitees.length === 0 ? (
        <EmptyState icon="user-plus" title={t('invite.emptyTitle')} body={t('invite.emptyBody')} />
      ) : null}

      {referrals.data?.invitees.map((invitee, index) => (
        <View
          key={invitee.handle}
          style={[styles.row, index < referrals.data.invitees.length - 1 && styles.divided]}
        >
          <Avatar url={invitee.avatarUrl} name={invitee.displayName} seed={invitee._id} size={40} />
          <View style={styles.rowText}>
            <Text style={styles.name}>{invitee.displayName}</Text>
            <Text style={styles.status}>
              {t(
                invitee.status === 'subscribed'
                  ? 'invite.statusSubscribed'
                  : invitee.status === 'activated'
                    ? 'invite.statusActivated'
                    : 'invite.statusPending',
              )}
            </Text>
          </View>
          {invitee.earned > 0 ? <Text style={styles.earned}>+{n(invitee.earned)}</Text> : null}
        </View>
      ))}

      <Text style={styles.disclaimer}>{t('invite.disclaimer')}</Text>
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
    padding: spacing.lg,
  },
  // A fixed square. A percentage has nothing to be a percentage of inside a
  // scroll view, and a stretched QR is one no camera locks onto.
  qr: { height: 220, width: 220 },
  code: { ...font.heading, color: colors.text, fontSize: 20 },
  url: { ...font.label, color: colors.textMuted },
  body: { ...font.body, color: colors.textMuted, marginTop: spacing.lg },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  section: { ...font.heading, color: colors.text, fontSize: 17, marginTop: spacing.xl },
  step: { ...font.body, color: colors.textMuted, marginTop: spacing.xs },
  tiles: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  referredBy: { ...font.label, color: colors.textMuted, marginTop: spacing.lg },
  row: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 14 },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  status: { ...font.label, color: colors.textMuted, fontWeight: '400' },
  earned: { ...font.heading, color: colors.success, fontSize: 16 },
  disclaimer: { ...font.caption, color: colors.textFaint, marginTop: spacing.xl },
}))
