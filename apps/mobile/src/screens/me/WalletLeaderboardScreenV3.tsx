import type { PeriodType } from '@langx/shared'
import { useState } from 'react'
import { useLeaderboard, useMe } from '../../api/queries'
import { LeaderboardV3 } from '../../components/leaderboard/LeaderboardV3'
import { Screen } from '../../components/ui/Screen'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT, type MessageKey } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { useV3Fonts } from './useV3Fonts'

/** The three tabs today's board has; the API still answers `all`, unasked. */
const PERIOD_TABS: readonly { value: PeriodType; labelKey: MessageKey; columnKey: MessageKey }[] = [
  { value: 'week', labelKey: 'leaderboard.week', columnKey: 'leaderboard.columnWeek' },
  { value: 'month', labelKey: 'leaderboard.month', columnKey: 'leaderboard.columnMonth' },
  { value: 'year', labelKey: 'leaderboard.year', columnKey: 'leaderboard.columnYear' },
]

/**
 * The token board in the redesign's look (`V-WalletLeaderboard`), behind
 * `flags.v3Home`. The request, the tabs, the pinned row and the profile a row
 * opens are `wallet/leaderboard.tsx`'s.
 */
export function WalletLeaderboardScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const black = useV3Fonts()

  const me = useMe()
  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useLeaderboard(period)
  const pull = usePullToRefresh(() => board.refetch())
  const tab = PERIOD_TABS.find((each) => each.value === period) ?? PERIOD_TABS[0]!

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      <WalletHeader
        title={t('leaderboard.title')}
        subtitle={t('wallet.leaderboardBody')}
        black={black}
        onBack={() => goBackTo('/(app)/wallet')}
      />
      <LeaderboardV3
        options={PERIOD_TABS.map((each) => ({ value: each.value, label: t(each.labelKey) }))}
        selected={period}
        onSelect={setPeriod}
        pickerLabel={t('leaderboard.periodPicker')}
        columns={{ start: t(tab.columnKey), end: t('leaderboard.columnTokens') }}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => ((row as { tokens?: number }).tokens ?? 0).toLocaleString(locale)}
        countOf={(row) => (row as { tokens?: number }).tokens ?? 0}
        labelOf={({ rank, name, value, count }) =>
          t('leaderboard.rowTokens', { count, rank, name, amount: value })
        }
        viewerValue={(board.data?.viewer.tokens ?? 0).toLocaleString(locale)}
        viewerCount={board.data?.viewer.tokens ?? 0}
        viewerAvatar={
          me.data
            ? { url: me.data.avatarUrl, name: me.data.displayName, seed: me.data._id }
            : undefined
        }
        viewerHue={me.data ? v3.hues[partnerHueFor(me.data._id)] : undefined}
        loading={board.isPending}
        emptyTitle={t('leaderboard.emptyTitle')}
        emptyBody={t('leaderboard.emptyBody')}
        backTo="/(app)/wallet/leaderboard"
      />
    </Screen>
  )
}
