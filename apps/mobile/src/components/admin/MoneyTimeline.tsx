import { Text, View } from 'react-native'
import { ADMIN_MONEY_TIMELINE_ROWS } from '@langx/shared'
import { useAdminMoneyTimeline } from '../../api/queries'
import { moneyItemDetail, moneyItemTitle, utcStamp } from '../../lib/adminMeasure'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles } from '../../lib/theme'
import { Callout } from '../ui/Callout'
import { Chip } from '../ui/Chip'

/**
 * One person's money, in order — the account screen's answer to "what has
 * this person been given and what have they paid for".
 *
 * Gifts of Pro, what the store told us, and the fall back to free; nothing
 * else, because nothing else is on the server. The caveat is printed above the
 * list and not in a footnote: a stretch with nothing in it reads as "never saw
 * the paywall" to anyone who has not been told the paywall is not measured
 * here.
 */
export function MoneyTimeline({ userId }: { userId: string }) {
  const styles = useStyles()
  const timeline = useAdminMoneyTimeline(userId)
  const words = ADMIN.money

  const now = timeline.data?.now
  // Nothing to say about a free account with no plan on record, and a dash
  // under "Free" would read as a value that failed to load.
  const nowLine = now
    ? [
        now.periodType === 'trial' ? words.now.trial : null,
        now.periodType === 'intro' ? words.now.intro : null,
        now.store ? words.now.store(now.store) : null,
        now.expiresAt ? words.now.until(utcStamp(now.expiresAt)) : null,
        now.tier !== 'free' && now.willRenew !== null
          ? now.willRenew
            ? words.now.renews
            : words.now.wontRenew
          : null,
      ]
        .filter((part): part is string => part !== null)
        .join(' · ')
    : ''

  return (
    <>
      <Text style={styles.heading}>{words.title}</Text>
      <Text style={styles.hint}>{words.hint}</Text>
      <Text style={styles.hint}>{words.notHere}</Text>

      {timeline.isPending ? <Text style={styles.muted}>{ADMIN.common.loading}</Text> : null}
      {timeline.isError ? (
        <Callout tone="error">
          <Text style={styles.calloutBody}>{words.failed}</Text>
        </Callout>
      ) : null}

      {now ? (
        <View style={styles.now}>
          <View style={styles.nowHead}>
            <Text style={styles.nowTitle}>{words.now.title}</Text>
            <Chip
              label={now.tier === 'free' ? words.now.free : words.now.pro}
              tone={now.tier === 'free' ? 'secondary' : 'pro'}
            />
          </View>
          {nowLine ? <Text style={styles.row}>{nowLine}</Text> : null}
        </View>
      ) : null}

      {timeline.data && timeline.data.items.length === 0 ? (
        <Text style={styles.muted}>{words.empty}</Text>
      ) : null}

      {timeline.data?.items.map((item, index) => (
        <View key={`${item.kind}-${item.at}-${index}`} style={styles.line}>
          <Text style={styles.stamp}>{utcStamp(item.at)}</Text>
          <View style={styles.lineBody}>
            <Text style={styles.row}>{moneyItemTitle(item)}</Text>
            <Text style={styles.muted}>{moneyItemDetail(item)}</Text>
          </View>
        </View>
      ))}

      {timeline.data?.truncated ? (
        <Text style={styles.muted}>{words.truncated(ADMIN_MONEY_TIMELINE_ROWS)}</Text>
      ) : null}
    </>
  )
}

const useStyles = makeStyles((theme) => ({
  heading: {
    marginTop: 24,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  hint: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18, marginBottom: 8 },
  muted: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  row: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  now: { gap: 4, marginBottom: 8 },
  nowHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  nowTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  line: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stamp: {
    width: 84,
    fontSize: 12,
    color: theme.colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
  lineBody: { flex: 1, gap: 2 },
}))
