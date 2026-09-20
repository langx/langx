import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text } from 'react-native'
import { useBadges, useMe, usePublicBadges } from '../../src/api/queries'
import { BadgeGrid } from '../../src/components/BadgeGrid'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { badgeLadderTips } from '../../src/lib/badgeOrder'
import { goBackTo } from '../../src/lib/navigation'
import { ShareCardSheet, type ShareCardRequest } from '../../src/components/ShareCardSheet'
import { badgeShareText } from '../../src/lib/shareText'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Badges, and how far the next one is.
 *
 * The ranking tables used to sit under all this, which is what made the page
 * unusable: `Screen fluid` does not scroll, so a tall badge grid and a
 * milestone card squeezed the list below them to nothing and nothing above it
 * could be reached. The boards have moved to the pages they belong to — tokens
 * to the wallet, streaks to the streak page — and this one scrolls.
 *
 * There is no milestone card any more either: the nearest badge's progress is
 * drawn on its own row, where the reader is already looking for it.
 *
 * **Two rows per kind, not the whole ladder** — the top rung earned and the
 * one after it. See `badgeLadderTips`. The header still counts against the
 * whole catalogue, because "4 of 25" is a fact about what there is to earn
 * and not about how many rows this screen chose to draw.
 *
 * With a `handle` it is somebody else's shelf, the way `follows` takes a
 * `userId` rather than living under `profile/[handle]/`. Two differences, both
 * of them the endpoint's rather than this screen's: the list holds only earned
 * badges, so no row can offer to share a badge that is not yours, and `next`
 * is absent, so no row draws a fraction of somebody else's token balance.
 */
export default function BadgesScreen() {
  useScreenInteractive()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const styles = useStyles()
  const t = useT()

  const { handle: of, from } = useLocalSearchParams<{ handle?: string; from?: string }>()
  const me = useMe()
  // Your own handle arriving in the param is still your own page: the share
  // sheet belongs to whoever the badges are, not to which door was used.
  const mine = !of || of === me.data?.handle

  const own = useBadges(mine)
  const theirs = usePublicBadges(mine ? '' : (of ?? ''))

  const data = mine ? own.data : theirs.data
  // Their page sends the catalogue's size, because the list it sends is only
  // the earned half of it.
  const total = mine ? (own.data?.badges.length ?? 0) : (theirs.data?.total ?? 0)
  const next = mine ? own.data?.next : null

  // Filtered here rather than in `BadgeGrid`: `total` and the empty state
  // above are readings of the whole shelf, and both would be wrong if the
  // short list were the only one this screen had.
  const rows = useMemo(() => badgeLadderTips(data?.badges ?? []), [data])

  const pull = usePullToRefresh(() => (mine ? own.refetch() : theirs.refetch()))
  const handle = me.data?.handle

  return (
    // The fix: this was `fluid`, a plain non-scrolling column.
    <Screen scroll {...pull}>
      <ScreenHeader
        title={t('leaderboard.badges')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
        trailing={
          data ? (
            <Text style={styles.count}>
              {t('badges.earnedOf', { earned: data.earnedCount, total })}
            </Text>
          ) : null
        }
      />

      {data && data.badges.length === 0 ? (
        // Reachable on their page only — yours is the whole catalogue, locked
        // rows included, and never empty.
        <EmptyState
          icon="award"
          title={t('badges.emptyTitle')}
          body={t('badges.emptyBody', { handle: of ?? '' })}
        />
      ) : data ? (
        <BadgeGrid
          badges={rows}
          {...(next ? { next } : {})}
          {...(mine && handle
            ? {
                onShare: (label: string) =>
                  setCard({
                    kind: 'badge',
                    headline: label,
                    caption: t('share.cardBadgeCaption'),
                    fallback: badgeShareText(t, { label, handle }),
                  }),
              }
            : {})}
        />
      ) : null}

      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  count: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
}))
