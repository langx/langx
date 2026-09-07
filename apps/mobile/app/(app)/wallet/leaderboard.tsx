import type { PeriodType } from '@langx/shared'
import { useState } from 'react'
import { useLeaderboard, useMe } from '../../../src/api/queries'
import { LeaderboardSection } from '../../../src/components/LeaderboardSection'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../../src/lib/navigation'
import { useLocale, useT, type MessageKey } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * Three tabs, the ones the wallet's own row promises ("this week, month and
 * year"). The API still answers `all`; nothing here asks it to.
 */
const PERIOD_TABS: readonly { value: PeriodType; labelKey: MessageKey }[] = [
  { value: 'week', labelKey: 'leaderboard.week' },
  { value: 'month', labelKey: 'leaderboard.month' },
  { value: 'year', labelKey: 'leaderboard.year' },
]

/**
 * The token board, on its own page.
 *
 * It has moved twice: off the badges page, where it shared a non-scrolling
 * screen with a badge grid and could not be reached, and now off the wallet,
 * where its four tabs sat between the balance and the shop. A board is a
 * thing you open to look at, not a thing you scroll past.
 */
export default function LeaderboardScreen() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useLeaderboard(period)
  const pull = usePullToRefresh(() => board.refetch())

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('leaderboard.title')} onBack={() => goBackTo('/(app)/wallet')} />
      <LeaderboardSection
        options={PERIOD_TABS.map((tab) => ({ value: tab.value, label: t(tab.labelKey) }))}
        selected={period}
        onSelect={setPeriod}
        pickerLabel={t('leaderboard.periodPicker')}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => ((row as { tokens?: number }).tokens ?? 0).toLocaleString(locale)}
        viewerValue={(board.data?.viewer.tokens ?? 0).toLocaleString(locale)}
        viewerAvatar={
          me.data
            ? { url: me.data.avatarUrl, name: me.data.displayName, seed: me.data._id }
            : undefined
        }
        loading={board.isPending}
        emptyTitle={t('leaderboard.emptyTitle')}
        emptyBody={t('leaderboard.emptyBody')}
        backTo="/(app)/wallet/leaderboard"
      />
    </Screen>
  )
}
