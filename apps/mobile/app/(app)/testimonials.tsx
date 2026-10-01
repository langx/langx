import type { ReceivedTestimonial, WrittenTestimonial } from '@langx/shared'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import {
  useDeleteTestimonial,
  useMyTestimonials,
  useSetTestimonialHidden,
} from '../../src/api/queries'
import { LoadFailed } from '../../src/components/LoadFailed'
import { PersonRowSkeleton } from '../../src/components/skeletons/PersonRowSkeleton'
import { TestimonialCard } from '../../src/components/testimonials/TestimonialCard'
import { TestimonialSheet } from '../../src/components/testimonials/TestimonialSheet'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useT } from '../../src/i18n'
import { confirmAlert } from '../../src/lib/alert'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { goBackTo, openProfile, openTestimonialReport } from '../../src/lib/navigation'
import { reportActionError } from '../../src/lib/reportActionError'
import { makeStyles } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

type Tab = 'received' | 'written'

const HERE = '/(app)/testimonials'

/**
 * Your reviews: the ones on your profile, and the ones you wrote.
 *
 * Received rows can be hidden rather than deleted. Somebody else wrote them,
 * so they are not yours to destroy — but it is your profile, so what shows on
 * it is yours to choose. The author is never told; their row reads the same
 * to them either way.
 */
export default function MyTestimonialsScreen() {
  useScreenInteractive()
  const t = useT()
  const [tab, setTab] = useState<Tab>('received')

  return (
    <Screen fluid>
      <ScreenHeader title={t('testimonials.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />
      <SegmentedControl
        options={[
          { value: 'received', label: t('testimonials.received') },
          { value: 'written', label: t('testimonials.written') },
        ]}
        selected={[tab]}
        onToggle={(value) => setTab(value)}
        accessibilityLabel={`${t('testimonials.received')} / ${t('testimonials.written')}`}
      />
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
      <EmptyState
        icon="message-circle"
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
      renderItem={({ item, index }) => (
        <TestimonialCard
          person={item.author}
          body={item.body}
          createdAt={item.createdAt}
          editedAt={item.editedAt}
          tag={item.hidden ? { text: t('testimonials.hiddenTag'), tone: 'muted' } : undefined}
          onPressPerson={() => openProfile(item.author.handle, HERE)}
          last={index === items.length - 1}
          footer={
            <>
              <RowAction
                label={t(item.hidden ? 'testimonials.show' : 'testimonials.hide')}
                disabled={setHidden.isPending}
                onPress={() => toggle(item)}
              />
              <RowAction
                label={t('common.report')}
                destructive
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
      <EmptyState
        icon="edit-3"
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
        renderItem={({ item, index }) => (
          <TestimonialCard
            person={item.subject}
            body={item.body}
            createdAt={item.createdAt}
            editedAt={item.editedAt}
            tag={item.removed ? { text: t('testimonials.removedTag'), tone: 'danger' } : undefined}
            onPressPerson={() => openProfile(item.subject.handle, HERE)}
            last={index === items.length - 1}
            footer={
              <>
                {/* A removed review cannot be edited back: the decision was
                    about the words, and an edit is how they would return. */}
                {item.removed ? null : (
                  <RowAction label={t('common.edit')} onPress={() => setEditing(item)} />
                )}
                <RowAction
                  label={t('testimonials.delete')}
                  destructive
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

function RowAction({
  label,
  onPress,
  destructive = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  destructive?: boolean
  disabled?: boolean
}) {
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text style={[styles.actionLabel, destructive ? styles.actionDanger : null]}>{label}</Text>
    </Pressable>
  )
}

function Skeletons() {
  return (
    <View>
      {SKELETON_ROWS.map((key) => (
        <PersonRowSkeleton key={key} />
      ))}
    </View>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  action: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  pressed: { opacity: 0.6 },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actionDanger: { color: colors.danger },
}))
