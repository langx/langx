import { STREAK_METRICS, type StreakMetric } from '@langx/shared'
import { useState } from 'react'
import { useStreakLeaderboard } from '../../../src/api/queries'
import { LeaderboardSection } from '../../../src/components/LeaderboardSection'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

const STREAK_TABS: readonly StreakMetric[] = STREAK_METRICS

/**
 * The streak board, on its own page.
 *
 * It sat under sixty days of history, which is why nobody reached it: the
 * history is what the streak page gets opened for, and the board is the
 * second question. A page of its own is how a second question gets asked.
 */
export default function StreakLeaderboardScreen() {
  useScreenInteractive()
  const t = useT()
  const [metric, setMetric] = useState<StreakMetric>('current')
  const board = useStreakLeaderboard(metric)
  const pull = usePullToRefresh(() => board.refetch())

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('leaderboard.streakTitle')} onBack={() => goBackTo('/(app)/streak')} />
      <LeaderboardSection
        title={t('streak.title')}
        options={STREAK_TABS.map((tab) => ({
          value: tab,
          label: t(tab === 'current' ? 'leaderboard.metricCurrent' : 'leaderboard.metricLongest'),
        }))}
        selected={metric}
        onSelect={setMetric}
        pickerLabel={t('leaderboard.streakPicker')}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => String((row as { streak?: number }).streak ?? 0)}
        viewerValue={String(board.data?.viewer.streak ?? 0)}
        loading={board.isPending}
        emptyTitle={t('leaderboard.streakEmptyTitle')}
        emptyBody={t('leaderboard.streakEmptyBody')}
        backTo="/(app)/streak/leaderboard"
      />
    </Screen>
  )
}
