import type { ReceivedTestimonial, WrittenTestimonial } from '@langx/shared'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { useDeleteTestimonial, useMyTestimonials, useSetTestimonialHidden } from '../../api/queries'
import { LoadFailed } from '../../components/LoadFailed'
import { ReviewCardV3 } from '../../components/testimonials/ReviewCardV3'
import { TestimonialSheet } from '../../components/testimonials/TestimonialSheet'
import { Button } from '../../components/ui/Button'
import { EmptyArt, type EmptyArtKind } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { dedupeById } from '../../lib/dedupeById'
import { listState } from '../../lib/listState'
import { goBackTo, openProfile, openTestimonialReport } from '../../lib/navigation'
import { reportActionError } from '../../lib/reportActionError'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import { useV3Fonts } from './useV3Fonts'

type Tab = 'received' | 'written'

const HERE = '/(app)/testimonials'

/**
 * Your reviews in the redesign's look (`V-Testimonials`), behind
 * `flags.v3Home`. The two lists, the hide, the report, the edit and the
 * confirmed delete are `testimonials.tsx`'s, call for call; what changes is
 * the drawing — each review a grey block, its actions 44pt pills.
 */
export function TestimonialsScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { v3 } = useTheme()
  const styles = useStyles()
  const black = useV3Fonts()
  const [tab, setTab] = useState<Tab>('received')

  return (
    <Screen fluid ground={v3.colors.bg}>
      <WalletHeader
        title={t('testimonials.title')}
        subtitle={t('testimonials.meRowBody')}
        black={black}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
      />
      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'received', label: t('testimonials.received') },
            { value: 'written', label: t('testimonials.written') },
          ]}
          selected={[tab]}
          onToggle={(value) => setTab(value)}
          accessibilityLabel={`${t('testimonials.received')} / ${t('testimonials.written')}`}
        />
      </View>
      {tab === 'received' ? <ReceivedList /> : <WrittenList />}
    </Screen>
  )
}

function ReceivedList() {
  const styles = useStyles()
  const t = useT()
  const page = useMyTestimonials('received')
  const setHidden = useSetTestimonialHidden()
  const items = useMemo(
    () => dedupeById<ReceivedTestimonial>(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )
  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: items.length,
    isPaused: page.fetchStatus === 'paused',
  })

  function toggle(item: ReceivedTestimonial): void {
    const hidden = !item.hidden
    setHidden.mutate(
      { id: item._id, hidden },
      {
        onSuccess: () =>
          showToast(t(hidden ? 'testimonials.hiddenToast' : 'testimonials.shownToast')),
        onError: reportActionError,
      },
    )
  }

  if (state === 'skeleton') return <Skeletons />
  if (state === 'failed') return <LoadFailed onRetry={() => void page.refetch()} />
  if (state === 'empty') {
    return (
      <Empty
        art="chats"
        title={t('testimonials.receivedEmptyTitle')}
        body={t('testimonials.receivedEmptyBody')}
      />
    )
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
      }}
      ListFooterComponent={
        page.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
      }
      renderItem={({ item }) => (
        <ReviewCardV3
          person={item.author}
          body={item.body}
          createdAt={item.createdAt}
          editedAt={item.editedAt}
          tag={item.hidden ? { text: t('testimonials.hiddenTag'), tone: 'muted' } : undefined}
          faded={item.hidden}
          onPressPerson={() => openProfile(item.author.handle, HERE)}
          footer={
            <>
              <Button
                label={t(item.hidden ? 'testimonials.show' : 'testimonials.hide')}
                icon={item.hidden ? 'eye' : 'eye-off'}
                variant="secondary"
                size="small"
                style={styles.pill}
                disabled={setHidden.isPending}
                onPress={() => toggle(item)}
              />
              <Button
                label={t('common.report')}
                icon="flag"
                variant="danger"
                size="small"
                style={styles.pill}
                onPress={() => openTestimonialReport(item.author._id, item._id)}
              />
            </>
          }
        />
      )}
    />
  )
}

function WrittenList() {
  const styles = useStyles()
  const t = useT()
  const page = useMyTestimonials('written')
  const remove = useDeleteTestimonial()
  const [editing, setEditing] = useState<WrittenTestimonial | null>(null)
  const items = useMemo(
    () => dedupeById<WrittenTestimonial>(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )
  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: items.length,
    isPaused: page.fetchStatus === 'paused',
  })

  async function confirmDelete(item: WrittenTestimonial): Promise<void> {
    const yes = await confirmAlert({
      title: t('testimonials.deleteConfirmTitle'),
      message: t('testimonials.deleteConfirmBody'),
      confirmLabel: t('testimonials.delete'),
      destructive: true,
    })
    if (!yes) return
    remove.mutate(
      { userId: item.subject._id },
      {
        onSuccess: () => showToast(t('testimonials.deleted')),
        onError: reportActionError,
      },
    )
  }

  if (state === 'skeleton') return <Skeletons />
  if (state === 'failed') return <LoadFailed onRetry={() => void page.refetch()} />
  if (state === 'empty') {
    return (
      <Empty
        art="cards"
        title={t('testimonials.writtenEmptyTitle')}
        body={t('testimonials.writtenEmptyBody')}
      />
    )
  }
  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
        }}
        ListFooterComponent={
          page.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
        }
        renderItem={({ item }) => (
          <ReviewCardV3
            person={item.subject}
            body={item.body}
            createdAt={item.createdAt}
            editedAt={item.editedAt}
            tag={item.removed ? { text: t('testimonials.removedTag'), tone: 'danger' } : undefined}
            onPressPerson={() => openProfile(item.subject.handle, HERE)}
            footer={
              <>
                {/* As today: a removed review cannot be edited back. */}
                {item.removed ? null : (
                  <Button
                    label={t('common.edit')}
                    icon="edit-3"
                    variant="secondary"
                    size="small"
                    style={styles.pill}
                    onPress={() => setEditing(item)}
                  />
                )}
                <Button
                  label={t('testimonials.delete')}
                  icon="trash-2"
                  variant="danger"
                  size="small"
                  style={styles.pill}
                  disabled={remove.isPending}
                  onPress={() => void confirmDelete(item)}
                />
              </>
            }
          />
        )}
      />
      {editing ? (
        <TestimonialSheet
          visible
          subject={editing.subject}
          existing={editing.body}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

/** The drawing, the two lines today's empty state says, and the way to the people who could write one. */
function Empty({ art, title, body }: { art: EmptyArtKind; title: string; body: string }) {
  const styles = useStyles()
  const t = useT()
  return (
    <View style={styles.empty}>
      <EmptyArt kind={art} />
      <Text style={styles.emptyTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <Button
        label={t('testimonials.emptyAction')}
        variant="blue"
        style={styles.emptyAction}
        onPress={() => router.navigate('/(app)/(tabs)/chats')}
      />
    </View>
  )
}

function Skeletons() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.list}>
      {SKELETON_ROWS.map((key) => (
        <Skeleton key={key} height={168} radius={v3.radius.tile} />
      ))}
    </View>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c']

const useStyles = makeStyles(({ v3 }) => ({
  segments: { paddingBottom: v3.space[8], paddingTop: v3.space[8] },
  list: { gap: v3.space[10], paddingBottom: v3.space[24], paddingTop: v3.space[6] },
  footer: { paddingVertical: v3.space[16] },
  pill: { width: 'auto' },
  empty: {
    alignItems: 'center',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[32],
  },
  emptyTitle: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  emptyBody: { ...v3.type.body, color: v3.colors.muted, textAlign: 'center' },
  emptyAction: { marginTop: v3.space[8], minWidth: 200, width: 'auto' },
}))
