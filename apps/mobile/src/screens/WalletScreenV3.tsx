import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { COSMETICS, TOKEN_RULES } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useMe, useWallet } from '../api/queries'
import { LoadFailed } from '../components/LoadFailed'
import { HomeAccountCard } from '../components/home/HomeBlocks'
import { MeRows, type MeRow } from '../components/me/MeBlocks'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import {
  FreezeGlyph,
  WalletCountTile,
  WalletGiftTile,
  WalletHeader,
  WalletHero,
} from '../components/wallet/WalletBlocks'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { cosmeticLabel, useLocale, useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import { giftState, giftTickDelay } from '../lib/gift'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { goBackTo } from '../lib/navigation'
import { clearFromTray } from '../lib/notifications'
import { requireAccount } from '../lib/requireAccount'
import { makeStyles, useTheme } from '../lib/theme'
import { nextRung } from '../lib/walletV3'

const ME = '/(app)/(tabs)/me'
const STORE = '/(app)/wallet/store'

/**
 * The redesign's wallet, behind `flags.v3Home` (`app/(app)/wallet/index.tsx`
 * picks it). Drawn from `V-Wallet`.
 *
 * The balance on its colour with a bar to the nearest frame or title
 * (`nextRung`, from the catalogue's own ladders), the hourly gift and the
 * freezes as big tiles, then the same four rows today's wallet has. Every
 * number is one today's wallet already reads: `/me` and `/me/wallet`.
 */
export function WalletScreenV3() {
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <GuestWallet /> : <MemberWallet />
}

function MemberWallet() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })

  const me = useMe()
  const wallet = useWallet()
  // As today's wallet: a gift, pool or bounty push is read here, so it goes
  // when the page comes back into view.
  useFocusEffect(
    useCallback(() => {
      void clearFromTray('wallet')
    }, []),
  )
  const pull = usePullToRefresh(() => Promise.all([me.refetch(), wallet.refetch()]))

  // The countdown ticks on the minute, as the gift card's does.
  const [now, setNow] = useState(() => new Date())
  const gift = wallet.data ? giftState(wallet.data.gift.nextAt, now) : null
  const waitMs = gift && !gift.ready ? gift.remainingMs : null
  useEffect(() => {
    if (waitMs === null) return
    const timer = setTimeout(() => setNow(new Date()), giftTickDelay(waitMs))
    return () => clearTimeout(timer)
  }, [waitMs])

  const header = (
    <WalletHeader title={t('wallet.title')} black={blackLoaded} onBack={() => goBackTo(ME)} />
  )

  // `!me.data` rather than `isPending`, for today's wallet's reason: `useMe`
  // does not retry, and a refused request must end in something to press.
  if (!me.data || !wallet.data) {
    const failed = queryFailed(me) || (!wallet.data && queryFailed(wallet))
    return (
      <Screen ground={v3.colors.bg}>
        {header}
        {failed ? (
          <LoadFailed
            onRetry={() => {
              void me.refetch()
              void wallet.refetch()
            }}
          />
        ) : (
          <View style={styles.stack}>
            <Skeleton height={HERO_HEIGHT} radius={v3.radius.block} />
            <Skeleton height={76} radius={v3.radius.badge} />
            <Skeleton height={64} radius={v3.radius.tile} />
            <Skeleton height={248} radius={v3.radius.tile} />
          </View>
        )}
      </Screen>
    )
  }

  const data = wallet.data
  const unit = t('wallet.tokensUnit', { count: data.balance })
  const balance = data.balance.toLocaleString(locale)
  const earnedSpent = t('wallet.earnedSpent', {
    earned: data.earned.toLocaleString(locale),
    spent: data.spent.toLocaleString(locale),
  })
  const rung = nextRung(data.owned, data.balance)
  const rungLine = rung
    ? rung.left > 0
      ? t('wallet.nextRung', {
          count: rung.left,
          amount: rung.left.toLocaleString(locale),
          title: cosmeticLabel(t, rung.cosmetic.id),
        })
      : t('wallet.nextRungReady', { title: cosmeticLabel(t, rung.cosmetic.id) })
    : undefined

  const maxFreezes = TOKEN_RULES.sinks.maxBankedStreakFreezes
  const freezes = t('wallet.countOf', {
    current: data.streakFreezes.toLocaleString(locale),
    total: maxFreezes.toLocaleString(locale),
  })
  const items = t('wallet.countOf', {
    current: data.owned.length.toLocaleString(locale),
    total: COSMETICS.length.toLocaleString(locale),
  })

  const rows: MeRow[] = [
    {
      key: 'history',
      icon: 'clock',
      hue: v3.hues.sky,
      title: t('tokens.history'),
      subtitle: t('wallet.historyBody'),
      onPress: () => router.push('/(app)/wallet/history'),
    },
    {
      key: 'leaderboard',
      icon: 'bar-chart-2',
      hue: v3.hues.tangerine,
      title: t('leaderboard.title'),
      subtitle: t('wallet.leaderboardBody'),
      onPress: () => router.push('/(app)/wallet/leaderboard'),
    },
    {
      key: 'pool',
      icon: 'moon',
      hue: v3.hues.lilac,
      title: t('tokens.poolTitle'),
      subtitle: t('wallet.poolBody'),
      onPress: () => router.push('/(app)/wallet/pool'),
    },
    {
      key: 'store',
      icon: 'shopping-bag',
      hue: v3.hues.mint,
      title: t('wallet.storeTitle'),
      subtitle: t('wallet.storeBody'),
      onPress: () => router.push(STORE),
    },
  ]

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      {header}
      <View style={styles.stack}>
        <WalletHero
          view={{
            ground: v3.hues.lime,
            kicker: t('wallet.balance'),
            value: balance,
            unit,
            earnedSpent,
            rung: rung && rungLine ? { line: rungLine, fraction: rung.fraction } : undefined,
            history: t('tokens.history'),
            a11y: [
              `${t('wallet.balance')}: ${t('wallet.price', { count: data.balance, amount: balance })}`,
              earnedSpent,
              rungLine,
              t('tokens.history'),
            ]
              .filter(Boolean)
              .join('. '),
            onPress: () => router.push('/(app)/wallet/history'),
            black: blackLoaded,
          }}
        />

        <WalletGiftTile
          title={t('gift.title')}
          status={gift?.ready ? t('gift.ready') : t('gift.nextIn', { minutes: gift?.minutes ?? 0 })}
          open={
            gift?.ready
              ? {
                  label: t('wallet.giftOpen'),
                  a11y: t('gift.openAccessibility'),
                  hue: v3.hues.lilac,
                  onPress: () => router.push('/(app)/gift'),
                }
              : undefined
          }
        />

        <View style={styles.tiles}>
          <WalletCountTile
            glyph={<FreezeGlyph size={v3.icon.md} color={v3.colors.ink} />}
            hue={v3.hues.sky}
            value={freezes}
            label={t('wallet.streakFreezes')}
            a11y={`${t('wallet.streakFreezes')}: ${freezes}`}
            onPress={() => router.push(STORE)}
          />
          <WalletCountTile
            glyph={<Feather name="package" size={v3.icon.md} color={v3.colors.ink} />}
            hue={v3.hues.tangerine}
            value={items}
            label={t('wallet.itemsOwned')}
            a11y={`${t('wallet.itemsOwned')}: ${items}`}
            onPress={() => router.push(STORE)}
          />
        </View>

        <MeRows rows={rows} />

        <Text style={styles.note}>{t('wallet.disclaimer')}</Text>
      </View>
    </Screen>
  )
}

/** A guest has no balance to show (rule 9): the account, on the screen's one yellow. */
function GuestWallet() {
  useScreenInteractive()
  const t = useT()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const { data: session } = authClient.useSession()
  return (
    <Screen scroll ground={v3.colors.bg}>
      <WalletHeader title={t('wallet.title')} black={blackLoaded} onBack={() => goBackTo(ME)} />
      <View style={styles.stack}>
        <HomeAccountCard
          title={t('home.guestTitle')}
          body={t('home.guestBody')}
          button={t('welcome.createAccount')}
          onPress={() => void requireAccount(session?.user, { action: 'other' })}
        />
      </View>
    </Screen>
  )
}

/** The hero's height, so nothing under it jumps when it lands. */
const HERO_HEIGHT = 224

const useStyles = makeStyles(({ v3 }) => ({
  stack: { gap: v3.space[8], paddingBottom: v3.space[16], paddingTop: v3.space[6] },
  tiles: { flexDirection: 'row', gap: v3.space[8] },
  note: {
    ...v3.type.caption,
    color: v3.colors.muted,
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[4],
  },
}))
