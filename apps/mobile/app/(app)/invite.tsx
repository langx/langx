import { inviteUrl, TOKEN_RULES } from '@langx/shared'
import * as Clipboard from 'expo-clipboard'
import { ActivityIndicator, Text, View } from 'react-native'
import { useMe, useReferrals } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatTile } from '../../src/components/ui/StatTile'
import { useLocale, useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { shareLink } from '../../src/lib/share'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

const RULES = TOKEN_RULES.referral

/**
 * Your invite link, what it has earned, and who took it.
 *
 * No QR here — `share-profile.tsx` keeps the one worth pointing a camera at.
 * An invite is something you *send*, so the code is shown as the handle it is,
 * next to the button that copies the link it stands for.
 *
 * The amounts come from `TOKEN_RULES` directly rather than from the response.
 * They are config in a package this app already imports, and the token screen
 * reads the pool numbers the same way; shipping them over the wire would be a
 * second copy to keep in step for no gain.
 */
export default function InviteScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
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
  const invitees = referrals.data?.invitees
  const n = (value: number) => value.toLocaleString(locale)

  const steps = [
    t('invite.step1'),
    t('invite.step2', { activation: n(RULES.activation) }),
    t('invite.step3', { subscription: n(RULES.subscription), max: n(RULES.maxPerInvitee) }),
    t('invite.step4', { invitee: n(RULES.inviteeActivation), total: n(RULES.inviteeTotal) }),
  ]

  return (
    <Screen scroll>
      <ScreenHeader title={t('invite.title')} onBack={() => goBackTo('/(app)/settings/share')} />
      <Text style={styles.body}>{t('invite.body')}</Text>

      <View style={styles.codePill}>
        <View style={styles.codeText}>
          <Text style={styles.codeKicker}>{t('invite.code')}</Text>
          <Text style={styles.codeHandle} numberOfLines={1}>
            {handle}
          </Text>
        </View>
        {/*
          The message menu's "Copy" is the same word in every language; a key
          of this screen's own would be a second string to translate for nothing.
        */}
        <Button
          label={t('messageActions.copy')}
          variant="ink"
          size="small"
          style={styles.copy}
          onPress={async () => {
            await Clipboard.setStringAsync(url)
            showToast(t('invite.copied'))
          }}
        />
      </View>

      {totals ? (
        <View style={styles.tiles}>
          <StatTile
            valueSize={26}
            label={t('invite.totalsInvited', { count: totals.invited })}
            value={n(totals.invited)}
          />
          <StatTile
            valueSize={26}
            tone="success"
            label={t('invite.totalsActivated', { count: totals.activated })}
            value={n(totals.activated)}
          />
          <StatTile
            valueSize={26}
            label={t('invite.totalsEarned', { count: totals.tokensEarned })}
            value={n(totals.tokensEarned)}
          />
        </View>
      ) : null}

      {invitees && invitees.length === 0 ? (
        <EmptyState icon="user-plus" title={t('invite.emptyTitle')} body={t('invite.emptyBody')} />
      ) : null}

      {invitees && invitees.length > 0 ? (
        <View>
          {invitees.map((invitee) => (
            <View key={invitee.handle} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {invitee.displayName}
              </Text>
              <Text
                style={[
                  styles.status,
                  { color: invitee.status === 'pending' ? colors.textFaint : colors.success },
                ]}
              >
                {t(
                  invitee.status === 'subscribed'
                    ? 'invite.statusSubscribed'
                    : invitee.status === 'activated'
                      ? 'invite.statusActivated'
                      : 'invite.statusPending',
                )}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.how}>
        <Text style={styles.howTitle}>{t('invite.howTitle')}</Text>
        {steps.map((step, index) => (
          <View key={index} style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>{n(index + 1)}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>{t('invite.disclaimer')}</Text>

      <Button
        label={t('invite.share')}
        style={styles.share}
        onPress={() => void shareLink({ message: t('invite.shareMessage', { url }), url })}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
  codePill: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.md,
    height: 56,
    marginTop: 20,
    paddingEnd: spacing.sm,
    paddingStart: 20,
  },
  codeText: { flex: 1, minWidth: 0 },
  codeKicker: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  codeHandle: { ...font.heading, color: colors.text, fontSize: 17 },
  copy: { width: 'auto' },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingBottom: 20,
    paddingTop: spacing.sm,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  name: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '600' },
  how: { gap: 14, marginTop: 20, paddingTop: 6 },
  howTitle: { ...font.heading, color: colors.text, fontSize: 18 },
  step: { flexDirection: 'row', gap: 14 },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepNumber: { ...font.heading, color: colors.accent, fontSize: 14 },
  stepText: { color: colors.textMuted, flex: 1, fontSize: 15, lineHeight: 22 },
  disclaimer: { color: colors.textFaint, fontSize: 13, lineHeight: 20, marginTop: 20 },
  share: { marginTop: 20 },
}))
