import Feather from '@expo/vector-icons/Feather'
import type { TestimonialPerson } from '@langx/shared'
import { memo, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { relativeTime } from '../../lib/format'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { IconButton } from '../ui/IconButton'

export interface ReviewCardV3Props {
  /** The author on a profile and on "Received"; the subject on "Written". */
  person: TestimonialPerson
  body: string
  createdAt: string
  editedAt: string | null
  /** A small line over the name — "Your review". */
  label?: string | undefined
  /** A tag beside the name — "Hidden", "Removed by moderators". */
  tag?: { text: string; tone: 'muted' | 'danger' } | undefined
  /** A hidden review's words go grey: still yours to read, gone from the profile. */
  faded?: boolean | undefined
  onPressPerson?: (() => void) | undefined
  /** The ⋯ at the row's end; absent means no menu. */
  onMore?: (() => void) | undefined
  /** The pills under the body, on the owner's own lists. */
  footer?: ReactNode
}

/**
 * One review as the redesign draws it (`V-Testimonials`,
 * `V-ProfileTestimonials`): a grey block, the writer's face and name as one
 * 44pt way into their profile, and the words under it. The same fields
 * `TestimonialCard` takes, so the two lists can hand either the same row.
 *
 * Memoised: it is a FlatList row, and the list re-renders on every page that
 * arrives.
 */
export const ReviewCardV3 = memo(function ReviewCardV3({
  person,
  body,
  createdAt,
  editedAt,
  label,
  tag,
  faded = false,
  onPressPerson,
  onMore,
  footer,
}: ReviewCardV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const when = `${relativeTime(createdAt, { t, locale })}${editedAt ? ` · ${t('testimonials.edited')}` : ''}`

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole={onPressPerson ? 'button' : undefined}
          disabled={!onPressPerson}
          onPress={onPressPerson}
          style={({ pressed }) => [styles.who, pressed && styles.pressed]}
        >
          <Avatar
            url={person.avatarUrl ?? undefined}
            name={person.displayName}
            seed={person._id}
            size={44}
          />
          <View style={styles.whoText}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <Text style={styles.name} numberOfLines={1}>
              {person.displayName}
            </Text>
            <Text style={styles.meta}>{when}</Text>
          </View>
          {tag ? (
            <View style={[styles.tag, tag.tone === 'danger' && styles.tagDanger]}>
              {tag.tone === 'muted' ? (
                <Feather name="eye-off" size={13} color={v3.colors.fg} />
              ) : null}
              <Text style={[styles.tagText, tag.tone === 'danger' && styles.tagTextDanger]}>
                {tag.text}
              </Text>
            </View>
          ) : null}
        </Pressable>
        {onMore ? (
          <IconButton
            icon="more-horizontal"
            color={v3.colors.muted}
            accessibilityLabel={t('testimonials.more')}
            onPress={onMore}
          />
        ) : null}
      </View>
      <Text style={[styles.body, faded && styles.bodyFaded]}>{body}</Text>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
})

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[6],
    paddingStart: v3.space[14],
    paddingTop: v3.space[10],
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  who: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 44,
    minWidth: 0,
  },
  pressed: { opacity: 0.7 },
  whoText: { flex: 1, minWidth: 0 },
  label: { ...v3.type.label, color: v3.colors.echoText },
  name: { ...v3.type.headline, color: v3.colors.fg, fontSize: 18, lineHeight: 22 },
  meta: { ...v3.type.caption, color: v3.colors.muted, lineHeight: 18 },
  tag: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    marginEnd: v3.space[8],
    paddingHorizontal: v3.space[10],
    paddingVertical: 3,
  },
  tagDanger: { backgroundColor: v3.colors.surface, borderColor: v3.colors.danger, borderWidth: 1 },
  tagText: { ...v3.type.label, color: v3.colors.fg },
  tagTextDanger: { color: v3.colors.danger },
  body: { ...v3.type.body, color: v3.colors.fg, paddingEnd: v3.space[10] },
  bodyFaded: { color: v3.colors.muted },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[8],
    paddingEnd: v3.space[8],
    paddingTop: v3.space[2],
  },
}))
