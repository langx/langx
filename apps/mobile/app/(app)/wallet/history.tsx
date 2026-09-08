import { Pressable, Text, View } from 'react-native'
import { useTokenHistory } from '../../../src/api/queries'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../../src/lib/navigation'
import { buildTokenHistory } from '../../../src/lib/tokenHistory'
import { makeStyles } from '../../../src/lib/theme'
import { useLocale, useT } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * Where the tokens came from: the ledger, a line at a time.
 *
 * One level below the wallet, reached by pressing the balance or the History
 * row. The pool used to share this screen; it has its own page now, because
 * "what did I earn" and "how does the pool work" are different questions and
 * the second one's card pushed the ledger below the fold.
 */
export default function HistoryScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  const history = useTokenHistory()
  const pull = usePullToRefresh(() => history.refetch())

  /*
   * Flattened. The server groups by day and the ledger reads as one line per
   * kind, so a day with a pool share, some corrections and a spend is three
   * rows under the same date rather than one total that has to be opened to
   * mean anything. The day is the second line because the kind is the answer.
   */
  const rows = buildTokenHistory({
    days: history.data?.pages.flatMap((page) => page.days) ?? [],
    t,
    locale,
  }).flatMap((day) =>
    day.entries.map((entry) => ({
      key: `${day.day}:${entry.kind}`,
      label: entry.label,
      day: day.label,
      amount: entry.amount,
    })),
  )

  if (history.isPending) {
    return (
      <Screen>
        <View style={styles.loading}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <View style={styles.text}>
                <Skeleton width={152} height={16} />
                <Skeleton width={78} height={13} />
              </View>
              <Skeleton width={48} height={17} />
            </View>
          ))}
        </View>
      </Screen>
    )
  }

  return (
    <Screen scroll {...pull}>
      <ScreenHeader title={t('tokens.history')} onBack={() => goBackTo('/(app)/wallet')} />

      <Text style={styles.intro}>{t('tokens.intro')}</Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>{t('tokens.historyEmpty')}</Text>
      ) : (
        rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.text}>
              <Text style={styles.kind}>{row.label}</Text>
              <Text style={styles.day}>{row.day}</Text>
            </View>
            <Text style={[styles.amount, row.amount < 0 && styles.amountSpent]}>
              {row.amount < 0
                ? t('tokens.ledgerSpent', { count: -row.amount })
                : t('tokens.shareAmount', { count: row.amount })}
            </Text>
          </View>
        ))
      )}

      {history.hasNextPage ? (
        <Pressable
          accessibilityRole="button"
          disabled={history.isFetchingNextPage}
          onPress={() => void history.fetchNextPage()}
          style={styles.more}
        >
          <Text style={styles.moreText}>{t('tokens.historyMore')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  intro: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    paddingBottom: 10,
    paddingTop: 6,
  },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: 14 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 14,
  },
  text: { flex: 1, gap: 2 },
  kind: { color: colors.text, fontSize: 16, fontWeight: '600' },
  day: { color: colors.textMuted, fontSize: 13 },
  amount: { ...font.heading, color: colors.text, fontSize: 17, fontVariant: ['tabular-nums'] },
  // A spend is the one red thing on the page, the way a negative ledger row is
  // red everywhere else in the app.
  amountSpent: { color: colors.danger },
  more: { height: 44, justifyContent: 'center', marginTop: spacing.sm },
  moreText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))
