import { useState } from 'react'
import { Text } from 'react-native'
import { useBadges, useMe } from '../../src/api/queries'
import { BadgeGrid } from '../../src/components/BadgeGrid'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
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
 */
export default function BadgesScreen() {
  useScreenInteractive()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const styles = useStyles()
  const t = useT()

  const badges = useBadges()
  const me = useMe()
  const handle = me.data?.handle

  const pull = usePullToRefresh(() => badges.refetch())

  return (
    // The fix: this was `fluid`, a plain non-scrolling column.
    <Screen scroll {...pull}>
      <ScreenHeader
        title={t('leaderboard.badges')}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
        trailing={
          badges.data ? (
            <Text style={styles.count}>
              {t('badges.earnedOf', {
                earned: badges.data.earnedCount,
                total: badges.data.badges.length,
              })}
            </Text>
          ) : null
        }
      />

      {badges.data ? (
        <BadgeGrid
          badges={badges.data.badges}
          next={badges.data.next}
          {...(handle
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
