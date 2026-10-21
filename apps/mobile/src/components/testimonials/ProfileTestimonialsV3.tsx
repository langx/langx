import { useState } from 'react'
import { Text, View } from 'react-native'
import { useTestimonials } from '../../api/queries'
import { useLocale, useT } from '../../i18n'
import { chooseAlert } from '../../lib/alert'
import { openProfile, openProfileTestimonials, openTestimonialReport } from '../../lib/navigation'
import { makeStyles } from '../../lib/theme'
import { Button } from '../ui/Button'
import { ReviewCardV3 } from './ReviewCardV3'
import { TestimonialSheet, type TestimonialSubject } from './TestimonialSheet'

/** How many reviews the profile shows before "See all" — `ProfileTestimonials`' number. */
const PREVIEW = 3

/**
 * The reviews block on a profile in the redesign (`V-Profile`): a big heading
 * with the count, "See all" as a pill beside it, the first three as
 * `ReviewCardV3`s and the outline "Write a review" under them.
 *
 * **Only the drawing is new.** The rules are `ProfileTestimonials`' own and
 * `profileScreenV3.test.ts` holds the two together: nothing at all when there
 * is nothing to read and nothing the viewer may do, the write button only
 * while the pair can write one, "Edit your review" once it is written.
 */
export function ProfileTestimonialsV3({
  handle,
  subject,
  here,
}: {
  handle: string
  subject: TestimonialSubject
  /** This profile's route, for the screens opened from here to come back to. */
  here: string
}) {
  const styles = useStyles()
  const t = useT()
  const { isRtl } = useLocale()
  const page = useTestimonials(handle)
  const [writing, setWriting] = useState(false)

  const first = page.data?.pages[0]
  if (!first) return null
  const items = first.items.slice(0, PREVIEW)
  const { viewer, mine, total } = first
  if (items.length === 0 && viewer !== 'can_write') return null

  async function openMenu(authorId: string, id: string): Promise<void> {
    const choice = await chooseAlert(t('testimonials.title'), undefined, [
      { label: t('common.report'), value: 'report', destructive: true },
    ])
    if (choice === 'report') openTestimonialReport(authorId, id)
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {total > 0 ? t('testimonials.sectionTitle', { count: total }) : t('testimonials.title')}
        </Text>
        {total > items.length ? (
          // The plain "See all": the current block's words end in a "›" this
          // pill draws as its own chevron.
          <Button
            label={t('home.seeAll')}
            variant="secondary"
            size="small"
            icon={isRtl ? 'chevron-left' : 'chevron-right'}
            iconPosition="end"
            onPress={() => openProfileTestimonials(handle, here)}
            style={styles.seeAll}
          />
        ) : null}
      </View>

      {items.map((item) => (
        <ReviewCardV3
          key={item._id}
          person={item.author}
          body={item.body}
          createdAt={item.createdAt}
          editedAt={item.editedAt}
          label={item.mine ? t('testimonials.yours') : undefined}
          onPressPerson={() => openProfile(item.author.handle, here)}
          onMore={item.mine ? undefined : () => void openMenu(item.author._id, item._id)}
        />
      ))}

      {viewer === 'can_write' || viewer === 'written' ? (
        <Button
          label={viewer === 'written' ? t('testimonials.editMine') : t('testimonials.write')}
          variant="secondary"
          icon="edit-3"
          onPress={() => setWriting(true)}
        />
      ) : null}

      <TestimonialSheet
        visible={writing}
        subject={subject}
        existing={viewer === 'written' ? mine?.body : null}
        onClose={() => setWriting(false)}
      />
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  section: { gap: v3.space[8] },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
    paddingStart: v3.space[4],
  },
  title: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  seeAll: { width: 'auto' },
}))
