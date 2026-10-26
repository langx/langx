import { useState } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'
import {
  captionWithHashtags,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialPostAction,
  type SocialPostDto,
} from '@langx/shared'
import { ApiRequestError } from '../../../src/api/client'
import { useAdminSocialPostAction, useAdminSocialPosts } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminActionsV3,
  AdminBlockV3,
  AdminCaptionV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminQuoteV3,
  AdminScreenV3,
  AdminTagV3,
} from '../../../src/components/admin/AdminKitV3'
import { Button } from '../../../src/components/ui/Button'
import { EmptyNoteV3 } from '../../../src/components/ui/EmptyStateV3'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { confirmAlert } from '../../../src/lib/alert'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

type Filter = SocialPlatform | 'all'

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: ADMIN.social.all },
  ...SOCIAL_PLATFORMS.map((platform) => ({
    value: platform,
    label: ADMIN.social.platforms[platform],
  })),
]

/**
 * In the device's own clock: the calendar is written in Toronto time, and an
 * operator reading it there should not convert from UTC to know whether
 * today's post has gone out.
 */
function localTime(iso: string): string {
  const at = new Date(iso)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`
}

/**
 * Venus's social calendar: what is coming, what went out, and the three
 * things an operator does to one row. Importing and approving the calendar
 * whole is the script's job; this page is for the day-to-day.
 */
export default function AdminSocialScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const [filter, setFilter] = useState<Filter>('all')
  const posts = useAdminSocialPosts(filter === 'all' ? null : filter)
  const data = posts.data
  const shown = filter === 'all' ? SOCIAL_PLATFORMS : [filter]
  const missing = data ? shown.filter((platform) => !data.connected[platform]) : []

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.social.title} back="/(app)/admin" scroll={false}>
        <ScrollView contentContainerStyle={styles.body}>
          <AdminCaptionV3>{ADMIN.social.hint}</AdminCaptionV3>
          <SegmentedControl
            options={FILTERS}
            selected={[filter]}
            onToggle={setFilter}
            accessibilityLabel={ADMIN.social.title}
          />
          {posts.isPending ? (
            <Skeleton height={160} />
          ) : !data ? (
            <EmptyNoteV3 icon="alert-circle" title={ADMIN.social.failedToLoad} body="" />
          ) : (
            <>
              <AdminNoteV3 tone={data.enabled ? 'success' : 'info'}>
                {data.enabled ? ADMIN.social.switchOn : ADMIN.social.switchOff}
              </AdminNoteV3>
              {missing.length > 0 ? (
                <AdminNoteV3 tone="warning">
                  {ADMIN.social.notConnected(
                    missing.map((platform) => ADMIN.social.platforms[platform]).join(', '),
                  )}
                </AdminNoteV3>
              ) : null}

              <AdminHeadingV3 title={ADMIN.social.upcoming} hint={ADMIN.social.upcomingHint} />
              {data.upcoming.length === 0 ? (
                <EmptyNoteV3 icon="calendar" title={ADMIN.social.emptyUpcoming} body="" />
              ) : (
                data.upcoming.map((row) => <Post key={row._id} row={row} />)
              )}

              <AdminHeadingV3 title={ADMIN.social.recent} />
              {data.recent.length === 0 ? (
                <EmptyNoteV3 icon="inbox" title={ADMIN.social.emptyRecent} body="" />
              ) : (
                data.recent.map((row) => <Post key={row._id} row={row} />)
              )}
            </>
          )}
        </ScrollView>
      </AdminScreenV3>
    </AdminGate>
  )
}

function Post({ row }: { row: SocialPostDto }) {
  const styles = useStyles()
  const act = useAdminSocialPostAction()
  const words =
    row.platform === 'youtube'
      ? [row.content.title, row.content.description].filter(Boolean).join('\n\n')
      : captionWithHashtags(row.content)
  // A post waiting in the TikTok inbox is finished by hand, with these words:
  // the whole caption, selectable. Everywhere else three lines are enough.
  const toPaste = row.status === 'published' && row.platform === 'tiktok' && !row.platformUrl
  const pending = (action: SocialPostAction) => act.isPending && act.variables?.action === action

  async function run(action: SocialPostAction) {
    if (action !== 'approve') {
      const ok = await confirmAlert({
        title: action === 'skip' ? ADMIN.social.confirmSkip : ADMIN.social.confirmRetry,
        confirmLabel: action === 'skip' ? ADMIN.social.skip : ADMIN.social.retry,
        destructive: action === 'skip',
      })
      if (!ok) return
    }
    try {
      await act.mutateAsync({ id: row._id, action })
      showToast(
        action === 'approve'
          ? ADMIN.social.approved
          : action === 'skip'
            ? ADMIN.social.skipped
            : ADMIN.social.retried,
      )
    } catch (error) {
      showToast(
        error instanceof ApiRequestError && error.status === 404
          ? ADMIN.social.moved
          : ADMIN.common.failed,
      )
    }
  }

  return (
    <AdminBlockV3>
      <View style={styles.head}>
        <AdminTagV3 label={ADMIN.social.platforms[row.platform]} />
        <AdminTagV3
          label={ADMIN.social.statuses[row.status]}
          hue={row.status === 'published' ? 'mint' : row.status === 'approved' ? 'sky' : undefined}
          danger={row.status === 'failed'}
        />
      </View>
      <Text style={styles.title}>
        {ADMIN.social.day(row.dayOffset + 1, row.videoDay)} · {row.lang} ·{' '}
        {localTime(row.publishedAt ?? row.scheduledAt)}
      </Text>
      {row.attempts > 0 ? (
        <Text style={styles.meta}>{ADMIN.social.attempts(row.attempts)}</Text>
      ) : null}
      {row.nativeCheck && row.status === 'draft' ? (
        <AdminNoteV3 tone="warning">{ADMIN.social.nativeCheck(row.nativeCheck)}</AdminNoteV3>
      ) : null}
      {row.lastError ? <AdminNoteV3 tone="danger">{row.lastError}</AdminNoteV3> : null}
      {row.note ? <AdminNoteV3 tone="info">{row.note}</AdminNoteV3> : null}

      <Text style={styles.words} selectable numberOfLines={toPaste ? undefined : 3}>
        {words}
      </Text>
      {row.firstComment ? (
        <AdminQuoteV3 muted>{ADMIN.social.firstComment(row.firstComment)}</AdminQuoteV3>
      ) : null}

      <View style={styles.actions}>
        <AdminActionsV3>
          {row.status === 'draft' || row.status === 'skipped' ? (
            <Button
              label={ADMIN.social.approve}
              variant="ink"
              onPress={() => void run('approve')}
              loading={pending('approve')}
              disabled={act.isPending}
            />
          ) : null}
          {row.status === 'failed' ? (
            <Button
              label={ADMIN.social.retry}
              variant="ink"
              onPress={() => void run('retry')}
              loading={pending('retry')}
              disabled={act.isPending}
            />
          ) : null}
          {row.status === 'draft' || row.status === 'approved' || row.status === 'failed' ? (
            <Button
              label={ADMIN.social.skip}
              variant="danger"
              onPress={() => void run('skip')}
              loading={pending('skip')}
              disabled={act.isPending}
            />
          ) : null}
          {row.platformUrl ? (
            <Button
              label={ADMIN.social.openPost}
              variant="neutral"
              onPress={() => void Linking.openURL(row.platformUrl ?? '')}
            />
          ) : (
            <Button
              label={ADMIN.social.watch}
              variant="neutral"
              onPress={() => void Linking.openURL(row.videoUrl)}
            />
          )}
        </AdminActionsV3>
      </View>
    </AdminBlockV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { gap: v3.space[12], paddingBottom: v3.space[32] },
  head: { flexDirection: 'row', gap: v3.space[8], flexWrap: 'wrap' },
  title: { ...v3.type.button, color: v3.colors.fg },
  meta: { ...v3.type.caption, color: v3.colors.muted },
  words: { ...v3.type.body, color: v3.colors.fg },
  actions: { marginTop: v3.space[4] },
}))
