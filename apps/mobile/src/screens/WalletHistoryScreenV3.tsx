import type Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type { TokenKind } from '@langx/shared'
import { useFonts } from 'expo-font'
import { useCallback, useMemo } from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { useTokenHistory } from '../api/queries'
import { LoadFailed } from '../components/LoadFailed'
import { Button } from '../components/ui/Button'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { HistoryEntryRow, HistoryHeading, WalletHeader } from '../components/wallet/WalletBlocks'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useLocale, useT } from '../i18n'
import { listState } from '../lib/listState'
import { goBackTo } from '../lib/navigation'
import { makeStyles, useTheme, type PartnerHue } from '../lib/theme'
import { buildTokenHistory } from '../lib/tokenHistory'
import { historyItems, ledgerDayHeading, type HistoryItem } from '../lib/walletV3'

type Glyph = keyof typeof Feather.glyphMap

/**
 * Each ledger kind's glyph and colour. A record over every `TokenKind`, so a
 * new kind is a compile error here rather than a row with nothing beside it.
 * A spend and the operator's own entries sit on the neutral grey: the hues
 * are for what somebody did.
 */
const KIND_LOOK: Record<TokenKind, { icon: Glyph | 'flame'; hue: PartnerHue | null }> = {
  message: { icon: 'message-circle', hue: 'sky' },
  correction: { icon: 'edit-3', hue: 'mint' },
  pronunciation: { icon: 'mic', hue: 'mint' },
  echo: { icon: 'copy', hue: 'aqua' },
  // v3's streak is a flame everywhere; the bolt was the current look's.
  streak: { icon: 'flame', hue: 'tangerine' },
  dailyPool: { icon: 'moon', hue: 'lilac' },
  gift: { icon: 'gift', hue: 'lime' },
  signupBonus: { icon: 'star', hue: 'lime' },
  welcomeBack: { icon: 'rotate-ccw', hue: 'lime' },
  legacyTokenConversion: { icon: 'archive', hue: null },
  referral: { icon: 'user-plus', hue: 'tangerine' },
  referralSubscription: { icon: 'user-plus', hue: 'tangerine' },
  referralWelcome: { icon: 'user-plus', hue: 'tangerine' },
  bounty: { icon: 'tool', hue: null },
  reportReward: { icon: 'shield', hue: null },
  adjustment: { icon: 'sliders', hue: null },
  spend: { icon: 'shopping-bag', hue: null },
}

const WALLET = '/(app)/wallet'

/**
 * The redesign's token history, behind `flags.v3Home`
 * (`app/(app)/wallet/history.tsx` picks it). Drawn from `V-WalletHistory`.
 *
 * The same ledger, a block per day: the day as a heading, then a row per
 * kind with its glyph and its total — `buildTokenHistory`'s rows, regrouped.
 * A virtualised list with memoised rows, since the ledger only grows; the
 * next page is still a button, as it is today.
 */
export function WalletHistoryScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })

  const history = useTokenHistory()
  const pull = usePullToRefresh(() => history.refetch())

  const days = history.data?.pages
  const items = useMemo(
    () =>
      historyItems(
        buildTokenHistory({ days: days?.flatMap((page) => page.days) ?? [], t, locale }),
      ),
    [days, t, locale],
  )
  const state = listState({
    isPending: history.isPending,
    isError: history.isError,
    itemCount: items.length,
    isPaused: history.fetchStatus === 'paused',
  })

  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) => {
      if (item.kind === 'heading') {
        // The UTC day's date rather than `item.label`: see `ledgerDayHeading`.
        return <HistoryHeading label={ledgerDayHeading(item.day, locale)} />
      }
      const look = KIND_LOOK[item.entry.kind]
      const amount = item.entry.amount
      return (
        <HistoryEntryRow
          icon={look.icon}
          hue={look.hue ? v3.hues[look.hue] : undefined}
          label={item.entry.label}
          amount={
            amount < 0
              ? t('tokens.ledgerSpent', { count: (-amount).toLocaleString(locale) })
              : t('tokens.shareAmount', { count: amount.toLocaleString(locale) })
          }
          spend={amount < 0}
          first={item.first}
          last={item.last}
        />
      )
    },
    [t, locale, v3],
  )

  const header = (
    <WalletHeader
      title={t('tokens.history')}
      subtitle={t('tokens.intro')}
      black={blackLoaded}
      onBack={() => goBackTo(WALLET)}
    />
  )

  if (state === 'skeleton') {
    // The header needs no data, so it is drawn now and stays put.
    return (
      <Screen ground={v3.colors.bg}>
        {header}
        <View style={styles.skeleton}>
          <Skeleton width={120} height={20} />
          <Skeleton height={56 * 4} radius={v3.radius.tile} />
          <Skeleton width={120} height={20} />
          <Skeleton height={56 * 2} radius={v3.radius.tile} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <FlatList
        data={state === 'content' ? items : []}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl {...pull} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          state === 'failed' ? (
            <LoadFailed onRetry={() => void history.refetch()} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('tokens.historyEmpty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          history.hasNextPage ? (
            <View style={styles.more}>
              <Button
                label={t('tokens.historyMore')}
                icon="chevron-down"
                variant="secondary"
                loading={history.isFetchingNextPage}
                onPress={() => void history.fetchNextPage()}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  )
}

/** "Friday 16 October", for a day key, in the reader's language. */
const useStyles = makeStyles(({ v3 }) => ({
  list: { paddingBottom: v3.space[32] },
  skeleton: { gap: v3.space[10], paddingTop: v3.space[14] },
  empty: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    marginTop: v3.space[14],
    padding: v3.space[16],
  },
  emptyText: { ...v3.type.callout, color: v3.colors.muted },
  more: { paddingTop: v3.space[16] },
}))
