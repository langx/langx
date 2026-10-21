import { TESTIMONIAL_MAX_LENGTH, TESTIMONIAL_MIN_LENGTH } from '@langx/shared'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { FieldV3 } from '../onboarding/WizardV3'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import type { TestimonialSubject } from './TestimonialSheet'

/**
 * v3's drawing of the review sheet, behind `flags.v3Home`: the kit's sheet
 * with its handle, the partner's face beside the headline, the redesign's
 * text field, and the two pills — Cancel outlined, Publish the one yellow.
 * "Delete review" is the red outline v3 gives an action that cannot be
 * undone, under them, only while editing.
 *
 * Drawing only. What is saved, what the rules say and what a failure reads
 * as are `TestimonialSheet`'s, so the sheet tells the same thing from every
 * door in both looks.
 */
export function TestimonialFormV3({
  subject,
  body,
  error,
  editing,
  busy,
  publishing,
  counterWarn,
  onChangeText,
  onPublish,
  onDelete,
  onClose,
}: {
  subject: TestimonialSubject
  body: string
  error: string | null
  editing: boolean
  busy: boolean
  publishing: boolean
  counterWarn: boolean
  onChangeText: (next: string) => void
  onPublish: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const insets = useSafeAreaInsets()

  return (
    <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
      {/* Swallows the press so tapping the sheet does not close it. */}
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + v3.space[16] }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <Avatar
              url={subject.avatarUrl ?? undefined}
              name={subject.displayName}
              seed={subject._id}
              size={44}
            />
            <View style={styles.headText}>
              <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>
                {t('testimonials.sheetTitle', { name: subject.displayName })}
              </Text>
              <Text style={styles.subline}>{t('testimonials.sheetBody')}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <FieldV3
              value={body}
              onChangeText={onChangeText}
              placeholder={t('testimonials.placeholder')}
              maxLength={TESTIMONIAL_MAX_LENGTH}
              multiline
              autoCorrect
              autoFocus={!editing}
              accessibilityLabel={t('testimonials.sheetTitle', { name: subject.displayName })}
              error={error ?? undefined}
              hint={t('testimonials.minHint', { count: TESTIMONIAL_MIN_LENGTH })}
            />
            {/* Its own line at the end, under the hint: the hint wraps in German. */}
            <Text style={[styles.counter, counterWarn ? styles.warn : null]}>
              {body.length} / {TESTIMONIAL_MAX_LENGTH}
            </Text>
          </View>

          <Text style={styles.note}>{t('testimonials.guidelines')}</Text>

          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
            </View>
            <View style={styles.action}>
              <Button
                label={editing ? t('common.save') : t('testimonials.publish')}
                loading={publishing}
                onPress={onPublish}
              />
            </View>
          </View>
          {editing ? (
            <Button
              variant="danger"
              size="small"
              label={t('testimonials.delete')}
              disabled={busy}
              onPress={onDelete}
              style={styles.delete}
            />
          ) : null}
        </ScrollView>
      </Pressable>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  backdrop: { ...v3.elevation.overlay, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on a wide window, like the kit's other sheets.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    maxHeight: '92%',
    maxWidth: 560,
    width: '100%',
  },
  content: { gap: v3.space[14], paddingHorizontal: v3.space[16], paddingTop: v3.space[8] },
  handle: {
    alignSelf: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 5,
    marginBottom: v3.space[2],
    width: 40,
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  headText: { flex: 1, gap: v3.space[2] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  subline: { ...v3.type.caption, color: v3.colors.muted },
  field: { gap: v3.space[2] },
  counter: {
    ...v3.type.caption,
    alignSelf: 'flex-end',
    color: v3.colors.muted,
    paddingHorizontal: v3.space[4],
  },
  warn: { color: v3.colors.danger, fontWeight: '700' },
  note: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  actions: { flexDirection: 'row', gap: v3.space[10] },
  action: { flex: 1 },
  delete: { alignSelf: 'center', width: 'auto' },
}))
