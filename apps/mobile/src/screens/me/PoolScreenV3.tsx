import Feather from '@expo/vector-icons/Feather'
import { TOKEN_RULES, firstPayoutAt } from '@langx/shared'
import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { useMe, useTokens } from '../../api/queries'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { TokenIcon, useTokenIconMetrics } from '../../components/ui/TokenIcon'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { dayLabel } from '../../lib/messageGroups'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { tokenAmountLabel } from '../../lib/tokenAmount'
import { useV3Fonts } from './useV3Fonts'

/**
 * The daily pool in the redesign's look (`V-WalletPool`), behind
 * `flags.v3Home`.
 *
 * The rule `wallet/pool.tsx` is written around holds here unchanged: the big
 * number is a share already paid, never a projection of tonight's, and the
 * block about today carries facts only — the counts, the cap, how many are
 * active. Today's three counts become three tiles; a screen reader still
 * hears them as today's one sentence.
 */
export function PoolScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const unitIcon = useTokenIconMetrics(v3.type.numeral.fontSize)
  const t = useT()
  const { locale } = useLocale()
  const black = useV3Fonts()

  const xp = useTokens()
  const me = useMe()
  const pull = usePullToRefresh(() => xp.refetch())

  const pool = xp.data?.pool
  const shareCap = TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool
  const lastPayout = pool?.lastPayout ?? null
  const today = xp.data?.today

  const shareOfPool =
    lastPayout &&
    (lastPayout.amount / TOKEN_RULES.pool.total).toLocaleString(locale, {
      style: 'percent',
      maximumFractionDigits: 1,
    })

  // A time, not an amount — the reason is on today's page.
  const createdAt = me.data?.createdAt
  const nextPayoutAt = createdAt ? firstPayoutAt(new Date(createdAt), new Date()) : null

  const header = (
    <WalletHeader
      title={t('tokens.poolTitle')}
      subtitle={t('wallet.poolBody')}
      black={black}
      onBack={() => goBackTo('/(app)/wallet')}
    />
  )

  if (xp.isPending) {
    return (
      <Screen ground={v3.colors.bg}>
        {header}
        <View style={styles.stack}>
          <Skeleton height={176} radius={v3.radius.block} />
          <Skeleton height={196} radius={v3.radius.badge} />
          <Skeleton height={124} radius={v3.radius.tile} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      {header}
      <View style={styles.stack}>
        {pool ? (
          <View style={[styles.share, { backgroundColor: v3.hues.lilac }]}>
            {lastPayout ? (
              <>
                <View style={styles.kickerRow}>
                  <Feather name="moon" size={v3.icon.sm} color={v3.colors.ink} />
                  <Text style={styles.kicker}>
                    {t('tokens.shareForDay', { day: dayLabel(lastPayout.day, { t, locale }) })}
                  </Text>
                </View>
                <View
                  style={styles.amountRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={tokenAmountLabel(t, lastPayout.amount, locale, '+')}
                >
                  <Text
                    style={[styles.amount, !black && styles.amountFallback]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('tokens.shareAmount', { count: lastPayout.amount })}
                  </Text>
                  <View style={{ transform: [{ translateY: unitIcon.drop }] }}>
                    <TokenIcon size={unitIcon.size} color={v3.colors.ink} />
                  </View>
                </View>
                <View style={styles.chips}>
                  {shareOfPool ? (
                    <View style={[styles.chip, styles.chipInk]}>
                      <Text style={[styles.chipText, { color: v3.hues.lilac }]}>
                        {t('tokens.poolShareOfPool', { percent: shareOfPool })}
                      </Text>
                    </View>
                  ) : null}
                  {lastPayout.participants !== undefined ? (
                    <View style={[styles.chip, styles.chipVeil]}>
                      <Text style={styles.chipText}>
                        {t('tokens.poolParticipants', {
                          count: lastPayout.participants,
                          n: lastPayout.participants.toLocaleString(locale),
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : (
              <Text style={styles.onHueBody}>
                {nextPayoutAt
                  ? t('tokens.firstShareAt', {
                      when: nextPayoutAt.toLocaleString(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })
                  : t('tokens.noShareYet')}
              </Text>
            )}
          </View>
        ) : null}

        {today ? (
          <View style={styles.today}>
            <View style={styles.todayHead}>
              <Text style={styles.blockTitle} accessibilityRole="header">
                {t('tokens.todaySoFar')}
              </Text>
              <Text style={styles.score}>
                {t('tokens.activityScore', { count: Math.round(today.activityScore) })}
              </Text>
            </View>
            <View
              style={styles.tiles}
              accessible
              accessibilityLabel={t('tokens.todayBreakdown', {
                messages: today.messages,
                corrections: today.corrections,
                partners: today.distinctPartners,
              })}
            >
              <Tile
                value={today.messages}
                label={t('tokens.todayMessages', { count: today.messages })}
              />
              <Tile
                value={today.corrections}
                label={t('tokens.todayCorrections', { count: today.corrections })}
                tone={v3.colors.correction}
              />
              <Tile
                value={today.distinctPartners}
                label={t('tokens.todayPeople', { count: today.distinctPartners })}
              />
            </View>
            <Text style={styles.muted}>{t('tokens.poolCap', { cap: shareCap })}</Text>
            {pool ? (
              <View style={styles.activeRow}>
                <Feather name="users" size={v3.icon.sm} color={v3.colors.fg} />
                <Text style={styles.active}>
                  {t('tokens.poolActiveToday', {
                    count: pool.activeToday,
                    n: pool.activeToday.toLocaleString(locale),
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.blockTitle, styles.howTitle]} accessibilityRole="header">
          {t('invite.howTitle')}
        </Text>
        <View style={styles.group}>
          <HowRow icon="clock" tint={v3.hues.lilac}>
            {t('tokens.poolPaidAt', { hour: TOKEN_RULES.pool.payoutHourUtc })}
          </HowRow>
          <HowRow icon="message-circle" tint={v3.hues.mint} divided>
            {t('tokens.intro')}
          </HowRow>
        </View>

        <Button
          label={t('tokens.seeHistory')}
          icon="clock"
          variant="secondary"
          onPress={() => router.push('/(app)/wallet/history')}
        />
      </View>
    </Screen>
  )
}

function Tile({ value, label, tone }: { value: number; label: string; tone?: string }) {
  const styles = useStyles()
  const { locale } = useLocale()
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, tone ? { color: tone } : null]}>
        {value.toLocaleString(locale)}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  )
}

function HowRow({
  icon,
  tint,
  divided = false,
  children,
}: {
  icon: 'clock' | 'message-circle'
  tint: string
  divided?: boolean
  children: string
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={[styles.howRow, divided && styles.divided]}>
      <View style={[styles.square, { backgroundColor: tint }]}>
        <Feather name={icon} size={v3.icon.md} color={v3.colors.ink} />
      </View>
      <Text style={styles.howText}>{children}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  stack: { gap: v3.space[10], paddingBottom: v3.space[20], paddingTop: v3.space[8] },
  share: {
    borderRadius: v3.radius.block,
    gap: v3.space[8],
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: v3.space[16],
  },
  kickerRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  kicker: { ...v3.type.callout, color: v3.colors.ink, flexShrink: 1, fontWeight: '700' },
  amountRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  // Not set solid: Nunito's digits stand taller than the em box.
  amount: {
    ...v3.type.numeral,
    color: v3.colors.ink,
    fontVariant: ['tabular-nums'],
    lineHeight: 84,
  },
  amountFallback: { fontFamily: v3.type.headline.fontFamily },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  chip: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: v3.space[12],
  },
  chipInk: { backgroundColor: v3.colors.ink },
  chipVeil: { backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  chipText: { ...v3.type.buttonSmall, color: v3.colors.ink },
  onHueBody: { ...v3.type.body, color: v3.colors.ink, fontWeight: '600' },
  today: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[10],
    padding: v3.space[14],
  },
  todayHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[2],
  },
  blockTitle: { ...v3.type.headline, color: v3.colors.fg },
  howTitle: { marginHorizontal: v3.space[6], marginTop: v3.space[4] },
  score: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: v3.space[6] },
  tile: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    flex: 1,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  tileValue: { ...v3.type.title, color: v3.colors.fg },
  tileLabel: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600', lineHeight: 18 },
  muted: { ...v3.type.callout, color: v3.colors.muted, marginHorizontal: v3.space[2] },
  activeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    marginHorizontal: v3.space[2],
  },
  active: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  howRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  howText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, lineHeight: 22 },
}))
