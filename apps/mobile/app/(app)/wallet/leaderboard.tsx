import type { PeriodType } from '@langx/shared'
import { useState } from 'react'
import { useLeaderboard, useMe } from '../../../src/api/queries'
import { LeaderboardSection } from '../../../src/components/LeaderboardSection'
import { ShareCardSheet, type ShareCardRequest } from '../../../src/components/ShareCardSheet'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../../src/lib/navigation'
import { leaderboardShareText } from '../../../src/lib/shareText'
import { periodLabel, useT } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/** The four tabs, in the order the board has always drawn them. */
const PERIOD_TABS: readonly PeriodType[] = ['week', 'month', 'year', 'all']

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

  const me = useMe()
  const [period, setPeriod] = useState<PeriodType>('week')
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const board = useLeaderboard(period)
  const pull = usePullToRefresh(() => board.refetch())

  /*
   * Built here rather than in the section so the button exists only when the
   * sentence does: a rank of null is "not on the board", not "#0".
   */
  const viewerRank = board.data?.viewer.rank
  const handle = me.data?.handle
  const rankShare =
    viewerRank && handle
      ? () =>
          setCard({
            kind: 'rank',
            headline: `#${viewerRank}`,
            caption: t('share.cardRankCaption'),
            fallback: leaderboardShareText(t, { rank: viewerRank, period, handle }),
          })
      : undefined

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('leaderboard.title')} onBack={() => goBackTo('/(app)/wallet')} />
      <LeaderboardSection
        title={t('tokens.title')}
        options={PERIOD_TABS.map((tab) => ({ value: tab, label: periodLabel(t, tab) }))}
        selected={period}
        onSelect={setPeriod}
        pickerLabel={t('leaderboard.periodPicker')}
        entries={board.data?.entries ?? []}
        viewer={board.data?.viewer}
        valueOf={(row) => String((row as { tokens?: number }).tokens ?? 0)}
        viewerValue={String(board.data?.viewer.tokens ?? 0)}
        loading={board.isPending}
        emptyTitle={t('leaderboard.emptyTitle')}
        emptyBody={t('leaderboard.emptyBody')}
        backTo="/(app)/wallet/leaderboard"
        onShare={rankShare}
      />
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}
