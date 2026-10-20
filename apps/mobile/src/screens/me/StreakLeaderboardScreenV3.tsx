import { STREAK_METRICS, type StreakMetric } from '@langx/shared'
import { useState } from 'react'
import { useMe, useStreakLeaderboard } from '../../api/queries'
import { LeaderboardV3 } from '../../components/leaderboard/LeaderboardV3'
import { Screen } from '../../components/ui/Screen'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { useV3Fonts } from './useV3Fonts'

const STREAK_TABS: readonly StreakMetric[] = STREAK_METRICS

/**
 * The streak board in the redesign's look (`V-StreakLeaderboard`), behind
 * `flags.v3Home`: the token board's drawing with v3's flame where today's
 * draws a bolt. The request, the two tabs and the pinned row are
 * `streak/leaderboard.tsx`'s.
 */
export function StreakLeaderboardScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const black = useV3Fonts()
  const me = useMe()
  const [metric, setMetric] = useState<StreakMetric>('current')
  const board = useStreakLeaderboard(metric)
  const pull = usePullToRefresh(() => board.refetch())

  const days = (count: number) => count.toLocaleString(locale)

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      <WalletHeader
        title={t('leaderboard.streakTitle')}
        subtitle={t('streak.leaderboardBody')}
        black={black}
        onBack={() => goBackTo('/(app)/streak')}
      />
      <LeaderboardV3
        options={STREAK_TABS.map((tab) => ({
          value: tab,
          label: t(tab === 'current' ? 'leaderboard.metricCurrent' : 'leaderboard.metricLongest'),
        }))}
        selected={metric}
        onSelect={setMetric}
        pickerLabel={t('leaderboard.streakPicker')}
        columns={{
          start: t(metric === 'current' ? 'leaderboard.columnNow' : 'leaderboard.columnEver'),
          end: t('leaderboard.columnDays'),
        }}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => days((row as { streak?: number }).streak ?? 0)}
        countOf={(row) => (row as { streak?: number }).streak ?? 0}
        labelOf={({ rank, name, value, count }) =>
          t('leaderboard.rowDays', { count, rank, name, amount: value })
        }
        viewerValue={days(board.data?.viewer.streak ?? 0)}
        viewerCount={board.data?.viewer.streak ?? 0}
        viewerAvatar={
          me.data
            ? { url: me.data.avatarUrl, name: me.data.displayName, seed: me.data._id }
            : undefined
        }
        viewerHue={me.data ? v3.hues[partnerHueFor(me.data._id)] : undefined}
        flame
        loading={board.isPending}
        emptyTitle={t('leaderboard.streakEmptyTitle')}
        emptyBody={t('leaderboard.streakEmptyBody')}
        backTo="/(app)/streak/leaderboard"
      />
    </Screen>
  )
}
