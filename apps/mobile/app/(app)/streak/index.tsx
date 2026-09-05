import { STREAK_FREEZE_SKU } from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { useMe, usePurchase, useTokens, useWallet } from '../../../src/api/queries'
import { ActivityMap } from '../../../src/components/ActivityMap'
import { ShareCardSheet, type ShareCardRequest } from '../../../src/components/ShareCardSheet'
import { StoreRow } from '../../../src/components/store/StoreRow'
import { Button } from '../../../src/components/ui/Button'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { StatTile } from '../../../src/components/ui/StatTile'
import { useT, type MessageKey } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { streakShareText } from '../../../src/lib/shareText'
import { buildStoreOffers, type StoreOffer } from '../../../src/lib/storeOffers'
import { showToast } from '../../../src/lib/toast'
import { makeStyles } from '../../../src/lib/theme'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * The streak, as categories.
 *
 * It was one scroll: two tiles, a share button, sixty days of history and a
 * two-tab leaderboard under it that nobody scrolled to. This is the shape the
 * wallet has now: the numbers at the top, the map under them, the one action,
 * then a row per thing you might want to look at — each its own page.
 *
 * The activity map lives here rather than on the Me tab, where it sat under
 * the week chart and above four rows: the map *is* the streak, six months of
 * it, and a square you can still buy back belongs next to the number it
 * would restore. The freeze is sold here for the same reason. It used to be
 * a row that opened the store, which answered "how do I protect this" with
 * a shop header — the question is asked on this page, so it is answered on
 * this page, with the same row and the same purchase the store uses.
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
  ]

export default function StreakScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const tokens = useTokens()
  const me = useMe()
  const wallet = useWallet()
  const purchase = usePurchase()
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
  const balance = wallet.data?.balance ?? 0
  // The same offer the store prices, so the two can never disagree about the
  // cap or the price; only the freeze row is drawn here.
  const freeze = buildStoreOffers({
    t,
    balance,
    longestStreak: streak?.longest ?? 0,
    lifetimeCorrections: tokens.data?.lifetime.corrections ?? 0,
    owned: wallet.data?.owned ?? [],
    streakFreezes: wallet.data?.streakFreezes ?? 0,
  }).find((offer) => offer.id === STREAK_FREEZE_SKU)

  function buy(offer: StoreOffer): void {
    purchase.mutate(offer.id, {
      onSuccess: () => showToast(t('store.bought', { title: offer.title })),
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('streak.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      <View style={styles.tiles}>
        <StatTile icon="zap" label={t('me.dayStreak')} value={String(streak?.current ?? 0)} />
        <StatTile label={t('streak.longest')} value={String(streak?.longest ?? 0)} />
      </View>

      <ActivityMap />

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

      {freeze && wallet.data ? (
        <View style={styles.protect}>
          <Text style={styles.protectTitle}>{t('streak.protectTitle')}</Text>
          <Text style={styles.protectBody}>{t('streak.protectBody')}</Text>
          <StoreRow offer={freeze} pending={purchase.isPending} last onBuy={buy} />
        </View>
      ) : null}

      <View style={styles.categories}>
        {SECTIONS.map((section, index) => (
          <ListRow
            key={section.id}
            title={t(section.titleKey)}
            subtitle={t(section.bodyKey)}
            last={index === SECTIONS.length - 1}
            onPress={() => router.push(section.route)}
          />
        ))}
      </View>

      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  share: { marginTop: spacing.md },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 18,
    paddingTop: spacing.sm,
  },
  protect: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
  },
  protectTitle: { ...font.heading, color: colors.text, fontSize: 16 },
  protectBody: { ...font.caption, color: colors.textMuted, lineHeight: 19 },
  categories: { marginTop: spacing.md },
}))
