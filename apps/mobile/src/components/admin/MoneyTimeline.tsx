import { Text, View } from 'react-native'
import { ADMIN_MONEY_TIMELINE_ROWS } from '@langx/shared'
import { useAdminMoneyTimeline } from '../../api/queries'
import { moneyItemDetail, moneyItemTitle, utcStamp } from '../../lib/adminMeasure'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles } from '../../lib/theme'
import {
  AdminBlockV3,
  AdminCaptionV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminRowsV3,
  AdminTagV3,
} from './AdminKitV3'

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
      <AdminHeadingV3 title={words.title} hint={words.hint} />
      <AdminCaptionV3>{words.notHere}</AdminCaptionV3>

      {timeline.isPending ? <AdminCaptionV3>{ADMIN.common.loading}</AdminCaptionV3> : null}
      {timeline.isError ? (
        <AdminNoteV3 tone="danger" icon="alert-circle">
          {words.failed}
        </AdminNoteV3>
      ) : null}

      {now ? (
        <AdminBlockV3>
          <View style={styles.nowHead}>
            <Text style={styles.nowTitle}>{words.now.title}</Text>
            <AdminTagV3
              label={now.tier === 'free' ? words.now.free : words.now.pro}
              hue={now.tier === 'free' ? undefined : 'lilac'}
            />
          </View>
          {nowLine ? <Text style={styles.row}>{nowLine}</Text> : null}
        </AdminBlockV3>
      ) : null}

      {timeline.data && timeline.data.items.length === 0 ? (
        <AdminCaptionV3>{words.empty}</AdminCaptionV3>
      ) : null}

      {timeline.data?.items.length ? (
        <AdminRowsV3>
          {timeline.data.items.map((item, index) => (
            <View key={`${item.kind}-${item.at}-${index}`} style={styles.line}>
              <View style={styles.lineBody}>
                <Text style={styles.lineTitle}>{moneyItemTitle(item)}</Text>
                <Text style={styles.muted}>{moneyItemDetail(item)}</Text>
              </View>
              <Text style={styles.stamp}>{utcStamp(item.at)}</Text>
            </View>
          ))}
        </AdminRowsV3>
      ) : null}

      {timeline.data?.truncated ? (
        <AdminCaptionV3>{words.truncated(ADMIN_MONEY_TIMELINE_ROWS)}</AdminCaptionV3>
      ) : null}
    </>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  muted: { ...v3.type.caption, color: v3.colors.muted },
  row: { ...v3.type.callout, color: v3.colors.fg },
  nowHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  nowTitle: { ...v3.type.button, color: v3.colors.fg },
  line: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[10],
  },
  lineBody: { flex: 1, gap: v3.space[2] },
  lineTitle: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  stamp: { ...v3.type.caption, color: v3.colors.muted, fontVariant: ['tabular-nums'] },
}))
