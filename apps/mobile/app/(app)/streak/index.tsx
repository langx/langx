import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { useMe, useTokens, useWallet } from '../../../src/api/queries'
import { ShareCardSheet, type ShareCardRequest } from '../../../src/components/ShareCardSheet'
import { Button } from '../../../src/components/ui/Button'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { StatTile } from '../../../src/components/ui/StatTile'
import { useT, type MessageKey } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { streakShareText } from '../../../src/lib/shareText'
import { makeStyles } from '../../../src/lib/theme'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * The streak, as categories.
 *
 * It was one scroll: two tiles, a share button, sixty days of history and a
 * two-tab leaderboard under it that nobody scrolled to. This is the shape the
 * wallet has now: the numbers at the top, the one action under them, and a
 * row per thing you might want to look at — each its own page. The freezes
 * row is the way to the store, because "how do I protect this" is asked here
 * and answered there.
 */
const SECTIONS: readonly { id: string; titleKey: MessageKey; bodyKey: MessageKey; route: Href }[] =
  [
    {
      id: 'history',
      titleKey: 'tokens.history',
      bodyKey: 'streak.historyBody',
      route: '/(app)/streak/history',
    },
    {
      id: 'leaderboard',
      titleKey: 'leaderboard.streakTitle',
      bodyKey: 'streak.leaderboardBody',
      route: '/(app)/streak/leaderboard',
    },
    {
      id: 'freezes',
      titleKey: 'wallet.streakFreezes',
      bodyKey: 'streak.freezesBody',
      route: '/(app)/wallet/store',
    },
  ]

export default function StreakScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const tokens = useTokens()
  const me = useMe()
  const wallet = useWallet()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const pull = usePullToRefresh(() => Promise.all([tokens.refetch(), wallet.refetch()]))

  if (tokens.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  const streak = tokens.data?.streak
  const freezes = wallet.data?.streakFreezes

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('streak.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      <View style={styles.tiles}>
        <StatTile label={t('me.dayStreak')} value={`🔥 ${streak?.current ?? 0}`} />
        <StatTile label={t('streak.longest')} value={String(streak?.longest ?? 0)} />
      </View>

      {/*
        Only once there is a number worth saying. A zero-day streak shared is
        an invitation to laugh, not to join — and the sentence carries the
        invite link, so it is that too.
      */}
      {streak && streak.current > 0 && me.data ? (
        <View style={styles.share}>
          <Button
            label={t('share.streak')}
            variant="secondary"
            onPress={() =>
              setCard({
                kind: 'streak',
                headline: String(streak.current),
                caption: t('share.cardStreakCaption'),
                fallback: streakShareText(t, {
                  count: streak.current,
                  handle: me.data.handle,
                }),
              })
            }
          />
        </View>
      ) : null}

      <View style={styles.categories}>
        {SECTIONS.map((section, index) => (
          <ListRow
            key={section.id}
            title={t(section.titleKey)}
            subtitle={t(section.bodyKey)}
            // The freezes row carries its number: it is the one fact this
            // page can state that the store then acts on.
            value={section.id === 'freezes' && freezes !== undefined ? String(freezes) : undefined}
            last={index === SECTIONS.length - 1}
            onPress={() => router.push(section.route)}
          />
        ))}
      </View>

      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  share: { marginTop: spacing.md },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 18,
    paddingTop: spacing.sm,
  },
  categories: { marginTop: spacing.md },
}))
