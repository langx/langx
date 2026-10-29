import { useState } from 'react'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { inviteUrl, PRO_GIFT_RULES, TOKEN_RULES } from '@langx/shared'
import * as Clipboard from 'expo-clipboard'
import { useFonts } from 'expo-font'
import { ScrollView, Text, View } from 'react-native'
import { useMe, useReferrals } from '../../api/queries'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyArt } from '../../components/ui/EmptyStateV3'
import { HeroTile } from '../../components/ui/HeroTile'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { useAppConfig } from '../../hooks/useAppConfig'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { track } from '../../lib/analytics'
import { authClient } from '../../lib/auth-client'
import { shouldGateGuest } from '../../lib/guestGate'
import { inviteHeroFor, type InviteHero } from '../../lib/inviteHero'
import { goBackTo } from '../../lib/navigation'
import { requireAccount } from '../../lib/requireAccount'
import { shareLink } from '../../lib/share'
import { ShareCardSheet, type ShareCardRequest } from '../../components/ShareCardSheet'
import { useProfileCard } from '../../hooks/useProfileCard'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const RULES = TOKEN_RULES.referral
const WEEKS = PRO_GIFT_RULES.giveAWeek
const BACK = '/(app)/settings/share'

/**
 * Your invite link in the redesign's look (`V-Invite`), behind
 * `flags.v3Home`. The requests, the events, the give-a-week hero and every
 * sentence are `invite.tsx`'s — every amount still comes from `TOKEN_RULES`,
 * and nothing is promised for a sign-up alone.
 *
 * Not drawn from the board: its "1 of 3 toward a month of Pro" line. It
 * needs this year's activations, which the referral status does not send
 * (its totals are all time), and a count made up on the device would be a
 * promise the server might not keep.
 *
 * Share is the blue at the foot — it sends, it does not commit — and with
 * the hero up, the hero's own button is the share instead.
 */
export function InviteScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const me = useMe()
  const profileCard = useProfileCard()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const referrals = useReferrals()
  const { data: session } = authClient.useSession()
  const giveAWeek = useAppConfig().data?.flags.giveAWeek === true
  const [black] = useFonts({ Nunito_900Black })

  const hero =
    me.data &&
    inviteHeroFor({
      giveAWeek,
      guest: shouldGateGuest(session?.user),
      held: me.data.entitlement,
    })

  const header = (
    <WalletHeader
      title={t('invite.title')}
      subtitle={hero ? undefined : t('invite.body')}
      black={black}
      onBack={() => goBackTo(BACK)}
    />
  )

  if (me.isPending || !me.data) {
    return (
      <Screen ground={v3.colors.bg}>
        {header}
        <View style={styles.stack}>
          <Skeleton height={64} radius={v3.radius.pill} />
          <Skeleton height={96} radius={v3.radius.block} />
          <Skeleton height={60} radius={v3.radius.tile} />
          <Skeleton height={60} radius={v3.radius.tile} />
        </View>
      </Screen>
    )
  }

  const handle = me.data.handle
  const url = inviteUrl(handle)
  const totals = referrals.data?.totals
  const invitees = referrals.data?.invitees
  const n = (value: number) => value.toLocaleString(locale)

  const share = () => {
    track({ name: 'invite_shared', properties: { via: 'sheet' } })
    const fallback = { message: t('invite.shareMessage', { url }), url }
    const request = profileCard('invite', fallback)
    if (request) setCard(request)
    else void shareLink(fallback)
  }

  const steps = [
    t('invite.step1'),
    t('invite.step2', { count: RULES.activation, activation: n(RULES.activation) }),
    t('invite.step3', { subscription: n(RULES.subscription), max: n(RULES.maxPerInvitee) }),
    t('invite.step4', { invitee: n(RULES.inviteeActivation), total: n(RULES.inviteeTotal) }),
  ]

  return (
    <Screen fluid ground={v3.colors.bg}>
      <ScrollView style={styles.body}>
        {header}
        <View style={styles.stack}>
          {hero ? (
            <WeekHero
              hero={hero}
              onShare={share}
              onAccount={() => requireAccount(session?.user, { action: 'other' })}
            />
          ) : null}

          {/* A guest has no invite code yet — the hero's button makes the account. */}
          {hero === 'guest' ? null : (
            <View style={styles.codePill}>
              <View style={styles.codeText}>
                <Text style={styles.codeKicker}>{t('invite.code')}</Text>
                <Text style={styles.codeHandle} numberOfLines={1}>
                  {handle}
                </Text>
              </View>
              <Button
                label={t('messageActions.copy')}
                icon="copy"
                variant="ink"
                size="small"
                accessibilityLabel={t('invite.copy')}
                style={styles.auto}
                onPress={async () => {
                  await Clipboard.setStringAsync(url)
                  track({ name: 'invite_shared', properties: { via: 'copy' } })
                  showToast(t('invite.copied'))
                }}
              />
            </View>
          )}

          {totals && hero !== 'guest' ? (
            <View style={[styles.totals, { backgroundColor: v3.hues.lime }]}>
              <Total
                value={n(totals.invited)}
                label={t('invite.totalsInvited', { count: totals.invited })}
              />
              <Total
                value={n(totals.activated)}
                label={t('invite.totalsActivated', { count: totals.activated })}
              />
              <Total
                value={n(totals.tokensEarned)}
                label={t('invite.totalsEarned', { count: totals.tokensEarned })}
              />
            </View>
          ) : null}

          {/* "Share your link" would be the one place a guest is told they have one. */}
          {invitees && invitees.length === 0 && hero !== 'guest' ? (
            <View style={styles.empty}>
              <EmptyArt kind="people" />
              <Text style={styles.emptyTitle} accessibilityRole="header">
                {t('invite.emptyTitle')}
              </Text>
              <Text style={styles.emptyBody}>{t('invite.emptyBody')}</Text>
            </View>
          ) : null}

          {invitees && invitees.length > 0 ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {t('invite.peopleTitle')}
              </Text>
              <View style={styles.group}>
                {invitees.map((invitee, index) => {
                  const pending = invitee.status === 'pending'
                  return (
                    <View key={invitee.handle} style={[styles.row, index > 0 && styles.divided]}>
                      <Avatar
                        url={invitee.avatarUrl}
                        name={invitee.displayName}
                        seed={invitee._id}
                        size={40}
                      />
                      <Text style={styles.name} numberOfLines={1}>
                        {invitee.displayName}
                      </Text>
                      <View
                        style={[styles.status, pending ? styles.statusPending : styles.statusOn]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: pending ? v3.colors.muted : v3.colors.correction },
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
                    </View>
                  )
                })}
              </View>
            </>
          ) : null}

          <View style={styles.how}>
            <Text style={styles.heading} accessibilityRole="header">
              {t('invite.howTitle')}
            </Text>
            {steps.map((step, index) => (
              <View key={index} style={styles.step}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>{n(index + 1)}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
            <Text style={styles.disclaimer}>
              {t('invite.disclaimer')}{' '}
              {t('invite.monthlyLimit', { count: RULES.maxActivationsPerMonth })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* With the hero up, its button is the share. */}
      {hero ? null : (
        <View style={styles.footer}>
          <Button label={t('invite.share')} icon="share" variant="blue" onPress={share} />
        </View>
      )}
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

function Total({ value, label }: { value: string; label: string }) {
  const styles = useStyles()
  return (
    <View style={styles.total} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  )
}

/**
 * Today's give-a-week hero, unchanged in what it says: the deal as a title,
 * the length on a block, and the block's one button. A subscriber or a
 * lifetime (`give`) is offered the friend's week only — never Pro they have.
 */
function WeekHero({
  hero,
  onShare,
  onAccount,
}: {
  hero: InviteHero
  onShare: () => void
  onAccount: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const give = hero === 'give'
  const count = WEEKS.referrerWeeks
  const cap = t('invite.weekCap', { count: WEEKS.maxReferrerWeeksPerYear })

  return (
    <View style={styles.hero}>
      <Text style={styles.heroTitle} accessibilityRole="header">
        {t(give ? 'invite.weekTitleGive' : 'invite.weekTitle', { count })}
      </Text>
      <HeroTile
        tone="lilac"
        value={count.toLocaleString(locale)}
        unit={t(give ? 'invite.weekUnitGive' : 'invite.weekUnit', { count })}
        detail={t('invite.weekWhen')}
        action={
          hero === 'guest'
            ? { label: t('welcome.createAccount'), icon: 'user-plus', onPress: onAccount }
            : { label: t('invite.share'), icon: 'share', onPress: onShare }
        }
      />
      {give ? null : (
        <Text style={styles.heroNote}>
          {hero === 'earnOnGift' ? `${cap} ${t('invite.weekAddsOn')}` : cap}
        </Text>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { flex: 1 },
  stack: { gap: v3.space[10], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  auto: { width: 'auto' },
  codePill: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 64,
    paddingEnd: v3.space[10],
    paddingStart: 22,
  },
  codeText: { flex: 1, minWidth: 0 },
  codeKicker: { ...v3.type.label, color: v3.colors.muted },
  codeHandle: { ...v3.type.headline, color: v3.colors.fg },
  totals: {
    borderRadius: v3.radius.block,
    flexDirection: 'row',
    gap: v3.space[6],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[14],
  },
  total: { flex: 1, minWidth: 0 },
  totalValue: { ...v3.type.title, color: v3.colors.ink },
  totalLabel: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700', lineHeight: 18 },
  heading: { ...v3.type.headline, color: v3.colors.fg, marginHorizontal: v3.space[6] },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 60,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  name: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  status: {
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: v3.space[12],
  },
  statusOn: { backgroundColor: v3.colors.correctionTint },
  statusPending: { backgroundColor: v3.colors.line },
  statusText: { ...v3.type.caption, fontWeight: '700', lineHeight: 18 },
  how: { gap: v3.space[10], paddingHorizontal: v3.space[4], paddingTop: v3.space[6] },
  step: { flexDirection: 'row', gap: v3.space[12] },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  stepNumber: { ...v3.type.buttonSmall, color: v3.colors.echoText },
  stepText: { ...v3.type.callout, color: v3.colors.fg, flex: 1 },
  disclaimer: { ...v3.type.caption, color: v3.colors.muted, marginTop: v3.space[2] },
  empty: {
    alignItems: 'center',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[24],
  },
  emptyTitle: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  emptyBody: { ...v3.type.body, color: v3.colors.muted, textAlign: 'center' },
  hero: { gap: v3.space[12] },
  heroTitle: { ...v3.type.title, color: v3.colors.fg },
  heroNote: { ...v3.type.caption, color: v3.colors.muted },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: v3.space[20],
    paddingTop: v3.space[10],
  },
}))
