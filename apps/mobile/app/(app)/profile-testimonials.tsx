import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, View } from 'react-native'
import { useProfile, useTestimonials } from '../../src/api/queries'
import { LoadFailed } from '../../src/components/LoadFailed'
import { PersonRowSkeleton } from '../../src/components/skeletons/PersonRowSkeleton'
import { TestimonialCard } from '../../src/components/testimonials/TestimonialCard'
import { TestimonialSheet } from '../../src/components/testimonials/TestimonialSheet'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT } from '../../src/i18n'
import { chooseAlert } from '../../src/lib/alert'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { goBackTo, openProfile, openTestimonialReport } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Every review on somebody's profile, newest first — what "See all" opens.
 *
 * Flat and addressed by handle, the way `badges` is, rather than nested under
 * `profile/[handle]/`. There is no empty state: the profile only links here
 * when there is something to read, and a deep link to a profile with none
 * gets the header and nothing under it, which is the truth.
 */
export default function ProfileTestimonialsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { handle = '', from } = useLocalSearchParams<{ handle: string; from?: string }>()
  const page = useTestimonials(handle)
  const profile = useProfile(handle)
  const [writing, setWriting] = useState(false)

  const items = useMemo(
    () => dedupeById(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )
  const first = page.data?.pages[0]
  const here = `/(app)/profile-testimonials?handle=${handle}`
  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: items.length,
    isPaused: page.fetchStatus === 'paused',
  })

  async function openMenu(authorId: string, id: string): Promise<void> {
    const choice = await chooseAlert(t('testimonials.title'), undefined, [
      { label: t('common.report'), value: 'report', destructive: true },
    ])
    if (choice === 'report') openTestimonialReport(authorId, id)
  }

  const canAct = first?.viewer === 'can_write' || first?.viewer === 'written'
  const subject = profile.data

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('testimonials.title')}
        onBack={() => goBackTo(`/(app)/profile/${handle}`, from)}
      />
      {state === 'skeleton' ? (
        <View>
          {SKELETON_ROWS.map((key) => (
            <PersonRowSkeleton key={key} />
          ))}
        </View>
      ) : state === 'failed' ? (
        <LoadFailed onRetry={() => void page.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
          }}
          ListHeaderComponent={
            canAct && subject ? (
              <Button
                label={
                  first?.viewer === 'written' ? t('testimonials.editMine') : t('testimonials.write')
                }
                variant="secondary"
                onPress={() => setWriting(true)}
                style={styles.write}
              />
            ) : null
          }
          ListFooterComponent={
            page.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item, index }) => (
            <TestimonialCard
              person={item.author}
              body={item.body}
              createdAt={item.createdAt}
              editedAt={item.editedAt}
              label={item.mine ? t('testimonials.yours') : undefined}
              onPressPerson={() => openProfile(item.author.handle, here)}
              onMore={item.mine ? undefined : () => void openMenu(item.author._id, item._id)}
              last={index === items.length - 1}
            />
          )}
        />
      )}
      {subject ? (
        <TestimonialSheet
          visible={writing}
          subject={subject}
          existing={first?.viewer === 'written' ? first.mine?.body : null}
          onClose={() => setWriting(false)}
        />
      ) : null}
    </Screen>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

const useStyles = makeStyles(({ spacing }) => ({
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  write: { marginBottom: spacing.sm, marginTop: spacing.xs },
}))
