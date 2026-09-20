import type { PeriodType } from '@langx/shared'
import { useState } from 'react'
import { useEchoLeaderboard, useMe } from '../../../src/api/queries'
import { LeaderboardSection } from '../../../src/components/LeaderboardSection'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useLocale, useT, type MessageKey } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/** The token board's tabs, over the same three periods and the same words. */
const PERIOD_TABS: readonly { value: PeriodType; labelKey: MessageKey }[] = [
  { value: 'week', labelKey: 'leaderboard.week' },
  { value: 'month', labelKey: 'leaderboard.month' },
  { value: 'year', labelKey: 'leaderboard.year' },
]

/**
 * Who has answered the most cards this week, month and year.
 *
 * Its own board rather than a fourth tab on the token one: what it ranks is
 * study, which the token board deliberately does not pay for — Echo is outside
 * the daily pool — so the two tables would be measuring different things under
 * one picker. The periods are the token board's, down to the UTC week, so the
 * two are at least asking about the same seven days.
 */
export default function EchoLeaderboardScreen() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useEchoLeaderboard(period)
  const pull = usePullToRefresh(() => board.refetch())

  return (
    <Screen scroll {...pull}>
      {/* The same word the other two boards use — `leaderboard.title` rather
          than a key of its own, since nothing here needs saying differently. */}
      <ScreenHeader title={t('leaderboard.title')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
      <LeaderboardSection
        options={PERIOD_TABS.map((tab) => ({ value: tab.value, label: t(tab.labelKey) }))}
        selected={period}
        onSelect={setPeriod}
        pickerLabel={t('leaderboard.periodPicker')}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => ((row as { reviews?: number }).reviews ?? 0).toLocaleString(locale)}
        viewerValue={(board.data?.viewer.reviews ?? 0).toLocaleString(locale)}
        viewerAvatar={
          me.data
            ? { url: me.data.avatarUrl, name: me.data.displayName, seed: me.data._id }
            : undefined
        }
        loading={board.isPending}
        emptyTitle={t('leaderboard.echoEmptyTitle')}
        emptyBody={t('leaderboard.echoEmptyBody')}
        backTo="/(app)/echo/leaderboard"
      />
    </Screen>
  )
}
