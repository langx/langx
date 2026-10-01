import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTestimonials } from '../../api/queries'
import { useT } from '../../i18n'
import { chooseAlert } from '../../lib/alert'
import { openProfile, openProfileTestimonials, openTestimonialReport } from '../../lib/navigation'
import { makeStyles } from '../../lib/theme'
import { Button } from '../ui/Button'
import { TestimonialCard } from './TestimonialCard'
import { TestimonialSheet, type TestimonialSubject } from './TestimonialSheet'

/** How many reviews the profile shows before "See all". */
const PREVIEW = 3

/**
 * The reviews block on a profile.
 *
 * Draws nothing at all when there is nothing to read and nothing the viewer
 * can do: a "0 reviews" heading is a verdict on somebody who has done nothing
 * wrong, and a locked "write one" teases a gate whose terms the app never
 * states. So the block exists only once there is a review, or once this
 * viewer may write one.
 */
export function ProfileTestimonials({
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
        <Text style={styles.kicker}>
          {total > 0 ? t('testimonials.sectionTitle', { count: total }) : t('testimonials.title')}
        </Text>
        {total > items.length ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => openProfileTestimonials(handle, here)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.link}>{t('testimonials.seeAll')}</Text>
          </Pressable>
        ) : null}
      </View>

      {items.map((item, index) => (
        <TestimonialCard
          key={item._id}
          person={item.author}
          body={item.body}
          createdAt={item.createdAt}
          editedAt={item.editedAt}
          label={item.mine ? t('testimonials.yours') : undefined}
          onPressPerson={() => openProfile(item.author.handle, here)}
          onMore={item.mine ? undefined : () => void openMenu(item.author._id, item._id)}
          last={index === items.length - 1}
        />
      ))}

      {viewer === 'can_write' ? (
        <Button
          label={t('testimonials.write')}
          variant="secondary"
          onPress={() => setWriting(true)}
          style={styles.write}
        />
      ) : viewer === 'written' ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setWriting(true)}
          style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}
        >
          <Text style={styles.link}>{t('testimonials.editMine')}</Text>
        </Pressable>
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

const useStyles = makeStyles(({ colors, spacing }) => ({
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
    paddingTop: 22,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // The profile's own kicker, so this heading sits with "Interests".
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.5 },
  write: { marginTop: spacing.md },
  editLink: { alignSelf: 'flex-start', paddingTop: spacing.md },
}))
