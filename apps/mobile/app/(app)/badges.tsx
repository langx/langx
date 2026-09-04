import { useState } from 'react'
import { useBadges, useMe, useTokens } from '../../src/api/queries'
import { BadgeGrid } from '../../src/components/BadgeGrid'
import { ProgressBar } from '../../src/components/ui/ProgressBar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Text, View } from 'react-native'
import { goBackTo } from '../../src/lib/navigation'
import { ShareCardSheet, type ShareCardRequest } from '../../src/components/ShareCardSheet'
import { badgeShareText } from '../../src/lib/shareText'
import { makeStyles } from '../../src/lib/theme'
import { badgeLabel, useLocale, useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Badges, and what the next one takes.
 *
 * The ranking tables used to sit under all this, which is what made the page
 * unusable: `Screen fluid` does not scroll, so a tall badge grid and a
 * milestone card squeezed the list below them to nothing and nothing above it
 * could be reached. The boards have moved to the pages they belong to — tokens
 * to the wallet, streaks to the streak page — and this one scrolls.
 */
export default function BadgesScreen() {
  useScreenInteractive()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const xp = useTokens()
  const badges = useBadges()
  const me = useMe()
  const handle = me.data?.handle

  const pull = usePullToRefresh(() => Promise.all([badges.refetch(), xp.refetch()]))

  const streak = xp.data?.streak
  const next = badges.data?.next

  return (
    // The fix: this was `fluid`, a plain non-scrolling column.
    <Screen scroll {...pull}>
      <ScreenHeader
        title={t('leaderboard.badges')}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
        trailing={
          badges.data ? (
            <Text style={styles.count}>
              {badges.data.earnedCount} / {badges.data.badges.length}
            </Text>
          ) : null
        }
      />

      {/*
        The next badge rather than the current streak. The streak card said what
        the number is; this says what it is *for*, which is the only reason a
        streak is worth keeping — and it reads `reward` from the milestone that
        actually pays, so the promise cannot drift from the economy.
      */}
      {next ? (
        <View style={styles.next}>
          <Text style={styles.kicker}>{t('leaderboard.nextMilestone')}</Text>
          <Text style={styles.nextName}>
            {badgeLabel({ t, locale }, next.kind, next.threshold)}
          </Text>
          <View style={styles.nextBar}>
            <ProgressBar
              accessibilityLabel={t('leaderboard.towards', {
                current: next.current,
                threshold: next.threshold,
                label: badgeLabel({ t, locale }, next.kind, next.threshold),
              })}
              value={next.current / next.threshold}
            />
          </View>
          <Text style={styles.nextMeta}>
            {/* `veteran` counts days too, so it takes the same wording as the
                streak; the rest are plain counts of things done. */}
            {next.kind === 'streak' || next.kind === 'veteran'
              ? t('leaderboard.toGo', {
                  amount: t('format.days', { count: next.threshold - next.current }),
                })
              : t('leaderboard.toGoPlain', { count: next.threshold - next.current })}
            {next.reward > 0
              ? ` · ${t('leaderboard.pays', {
                  count: next.reward,
                  amount: next.reward.toLocaleString(locale),
                })}`
              : ''}
          </Text>
        </View>
      ) : null}

      {badges.data ? (
        <BadgeGrid
          badges={badges.data.badges}
          {...(handle
            ? {
                onShare: (label: string) =>
                  setCard({
                    kind: 'badge',
                    headline: label,
                    caption: t('share.cardBadgeCaption'),
                    fallback: badgeShareText(t, { label, handle }),
                  }),
              }
            : {})}
        />
      ) : null}

      {streak ? (
        <Text style={styles.streakHint}>
          {t(streak.qualifiedToday ? 'leaderboard.doneToday' : 'leaderboard.keepGoing')}
        </Text>
      ) : null}
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  count: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  kicker: { ...font.label, color: colors.textFaint },
  next: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg - 4,
    paddingTop: spacing.sm + 2,
  },
  nextName: { ...font.heading, color: colors.text, fontSize: 24, marginTop: 4 },
  nextBar: { marginTop: 14 },
  nextMeta: { color: colors.textMuted, fontSize: 13, marginTop: 10 },
  streakHint: { ...font.caption, color: colors.textMuted, marginTop: spacing.sm },
}))
