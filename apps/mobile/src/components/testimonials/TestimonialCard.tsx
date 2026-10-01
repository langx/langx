import Feather from '@expo/vector-icons/Feather'
import type { TestimonialPerson } from '@langx/shared'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { relativeTime } from '../../lib/format'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'

export interface TestimonialCardProps {
  /** The author on a profile and on "Received"; the subject on "Written". */
  person: TestimonialPerson
  body: string
  createdAt: string
  editedAt: string | null
  /** A small line over the name — "Your review". */
  label?: string | undefined
  /** A tag beside the date — "Hidden", "Removed by moderators". */
  tag?: { text: string; tone: 'muted' | 'danger' } | undefined
  onPressPerson?: (() => void) | undefined
  /** The ⋯ at the row's end; absent means no menu. */
  onMore?: (() => void) | undefined
  /** Row actions under the body, on the owner's own lists. */
  footer?: ReactNode
  last?: boolean
}

/**
 * One review as a row: who, when, and what they said. Drawn the same on the
 * profile, on its full list and on the owner's two lists, so a review reads as
 * one kind of thing wherever it turns up.
 */
export function TestimonialCard({
  person,
  body,
  createdAt,
  editedAt,
  label,
  tag,
  onPressPerson,
  onMore,
  footer,
  last = false,
}: TestimonialCardProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  return (
    <View style={[styles.card, last ? null : styles.divided]}>
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
            size={36}
          />
          <View style={styles.whoText}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <Text style={styles.name} numberOfLines={1}>
              {person.displayName}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {relativeTime(createdAt, { t, locale })}
                {editedAt ? ` · ${t('testimonials.edited')}` : ''}
              </Text>
              {tag ? (
                <View style={[styles.tag, tag.tone === 'danger' ? styles.tagDanger : null]}>
                  <Text
                    style={[styles.tagText, tag.tone === 'danger' ? styles.tagTextDanger : null]}
                  >
                    {tag.text}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
        {onMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('testimonials.more')}
            hitSlop={10}
            onPress={onMore}
            style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          >
            <Feather name="more-horizontal" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.body}>{body}</Text>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  card: { gap: spacing.sm, paddingVertical: 14 },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  head: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  who: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, minWidth: 0 },
  whoText: { flex: 1, gap: 1, minWidth: 0 },
  label: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  meta: { color: colors.textFaint, fontSize: 13 },
  tag: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  tagDanger: { backgroundColor: colors.dangerBg },
  tagText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  tagTextDanger: { color: colors.danger },
  more: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  pressed: { opacity: 0.6 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}))
