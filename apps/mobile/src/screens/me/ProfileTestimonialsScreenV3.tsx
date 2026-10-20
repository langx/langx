import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { useProfile, useTestimonials } from '../../api/queries'
import { LoadFailed } from '../../components/LoadFailed'
import { ReviewCardV3 } from '../../components/testimonials/ReviewCardV3'
import { TestimonialSheet } from '../../components/testimonials/TestimonialSheet'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { WalletHeader } from '../../components/wallet/WalletBlocks'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { chooseAlert } from '../../lib/alert'
import { dedupeById } from '../../lib/dedupeById'
import { listState } from '../../lib/listState'
import { goBackTo, openProfile, openTestimonialReport } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { useV3Fonts } from './useV3Fonts'

/**
 * Every review on somebody's profile in the redesign's look
 * (`V-ProfileTestimonials`), behind `flags.v3Home`. The list, the paging,
 * the write sheet and the report menu are `profile-testimonials.tsx`'s.
 *
 * New in v3: a chip under the title names whose reviews these are, on that
 * person's colour, with the count the page already carries (`total`).
 */
export function ProfileTestimonialsScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const black = useV3Fonts()
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
  const hue = subject ? v3.hues[partnerHueFor(subject._id)] : undefined

  return (
    <Screen fluid ground={v3.colors.bg}>
      <WalletHeader
        title={t('testimonials.title')}
        black={black}
        onBack={() => goBackTo(`/(app)/profile/${handle}`, from)}
      />
      {subject && hue && first ? (
        <View style={[styles.whose, { backgroundColor: hue }]}>
          <Avatar
            url={subject.avatarUrl ?? undefined}
            name={subject.displayName}
            seed={subject._id}
            size={26}
          />
          <Text style={styles.whoseText} numberOfLines={1}>
            {t('testimonials.onProfile', {
              count: first.total,
              name: subject.displayName,
              amount: first.total.toLocaleString(locale),
            })}
          </Text>
        </View>
      ) : null}
      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <Skeleton key={key} height={132} radius={v3.radius.tile} />
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
                icon="edit-3"
                variant="secondary"
                onPress={() => setWriting(true)}
                style={styles.write}
              />
            ) : null
          }
          ListFooterComponent={
            page.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item }) => (
            <ReviewCardV3
              person={item.author}
              body={item.body}
              createdAt={item.createdAt}
              editedAt={item.editedAt}
              label={item.mine ? t('testimonials.yours') : undefined}
              onPressPerson={() => openProfile(item.author.handle, here)}
              onMore={item.mine ? undefined : () => void openMenu(item.author._id, item._id)}
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

const SKELETON_ROWS = ['a', 'b', 'c', 'd']

const useStyles = makeStyles(({ v3 }) => ({
  whose: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    marginStart: v3.space[10],
    maxWidth: '100%',
    minHeight: 34,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[4],
  },
  whoseText: { ...v3.type.buttonSmall, color: v3.colors.ink, flexShrink: 1 },
  list: { gap: v3.space[10], paddingBottom: v3.space[24], paddingTop: v3.space[10] },
  footer: { paddingVertical: v3.space[16] },
  write: { marginBottom: v3.space[4] },
}))
