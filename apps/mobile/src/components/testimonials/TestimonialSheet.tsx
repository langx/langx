import { ERROR_CODES, TESTIMONIAL_MAX_LENGTH, TESTIMONIAL_MIN_LENGTH } from '@langx/shared'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiRequestError } from '../../api/client'
import { useDeleteTestimonial, useUpsertTestimonial } from '../../api/queries'
import { useT, type MessageKey } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { isOfflineFailure } from '../../lib/reportActionError'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import { KeyboardResizeHost } from '../KeyboardResizeHost'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

/** From here the counter turns the warning colour: twenty characters left. */
const COUNTER_WARN_AT = TESTIMONIAL_MAX_LENGTH - 20

export interface TestimonialSubject {
  _id: string
  displayName: string
  avatarUrl?: string | null | undefined
}

export interface TestimonialSheetProps {
  visible: boolean
  subject: TestimonialSubject
  /** The viewer's review as it stands; present means this is an edit. */
  existing?: string | null | undefined
  /** When opened from a thread, so the thread's own `written` flag follows. */
  conversationId?: string | undefined
  onClose: () => void
  /** `created` is false for an edit. */
  onSaved?: (created: boolean) => void
  onDeleted?: () => void
}

function failureKey(caught: unknown): MessageKey {
  if (isOfflineFailure(caught)) return 'errors.offlineAction'
  if (caught instanceof ApiRequestError && caught.code === ERROR_CODES.TESTIMONIAL_REMOVED) {
    return 'testimonials.removedError'
  }
  return 'testimonials.failed'
}

/**
 * Writing, editing and deleting one review — the same sheet from the thread's
 * card, the thread's menu, the profile and the owner's own list, so the rules
 * it states cannot read differently depending on the door.
 *
 * Publish is never disabled below the minimum. A greyed button says "no"
 * without saying why; pressing it and being told "at least 30 characters" is
 * the explanation arriving exactly when it is wanted.
 */
export function TestimonialSheet(props: TestimonialSheetProps) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
      accessibilityViewIsModal
    >
      {/* Mounted only while open, so every opening starts from what is saved. */}
      {props.visible ? <SheetBody {...props} /> : null}
    </Modal>
  )
}

function SheetBody({
  subject,
  existing,
  conversationId,
  onClose,
  onSaved,
  onDeleted,
}: TestimonialSheetProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const upsert = useUpsertTestimonial()
  const remove = useDeleteTestimonial()
  const editing = !!existing
  const [body, setBody] = useState(existing ?? '')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const busy = upsert.isPending || remove.isPending

  function publish(): void {
    if (busy) return
    const trimmed = body.trim()
    if (trimmed.length < TESTIMONIAL_MIN_LENGTH) {
      setError(t('testimonials.tooShort', { count: TESTIMONIAL_MIN_LENGTH }))
      return
    }
    setError(null)
    upsert.mutate(
      { userId: subject._id, body: trimmed, ...(conversationId ? { conversationId } : {}) },
      {
        onSuccess: (result) => {
          onClose()
          showToast(t(result.created ? 'testimonials.published' : 'testimonials.saved'))
          onSaved?.(result.created)
        },
        onError: (caught) => setError(t(failureKey(caught))),
      },
    )
  }

  async function confirmDelete(): Promise<void> {
    const yes = await confirmAlert({
      title: t('testimonials.deleteConfirmTitle'),
      message: t('testimonials.deleteConfirmBody'),
      confirmLabel: t('testimonials.delete'),
      destructive: true,
    })
    if (!yes) return
    remove.mutate(
      { userId: subject._id, ...(conversationId ? { conversationId } : {}) },
      {
        onSuccess: () => {
          onClose()
          showToast(t('testimonials.deleted'))
          onDeleted?.()
        },
        onError: (caught) => setError(t(failureKey(caught))),
      },
    )
  }

  const used = body.length
  return (
    /*
     * A text field in a Modal: iOS is lifted by the avoiding view, Android by
     * the measured pad — a Modal is its own window, so the one at the root
     * does not reach in here. The same pairing as `GiftCodeEntry`.
     */
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fill}
    >
      <KeyboardResizeHost>
        <Pressable
          style={styles.backdrop}
          accessibilityLabel={t('common.cancel')}
          onPress={onClose}
        >
          {/* Swallows the press so tapping the sheet does not close it. */}
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.head}>
                <Avatar
                  url={subject.avatarUrl ?? undefined}
                  name={subject.displayName}
                  seed={subject._id}
                  size={36}
                />
                <View style={styles.headText}>
                  <Text style={styles.title} numberOfLines={2}>
                    {t('testimonials.sheetTitle', { name: subject.displayName })}
                  </Text>
                  <Text style={styles.subline}>{t('testimonials.sheetBody')}</Text>
                </View>
              </View>

              <View style={styles.field}>
                <TextInput
                  value={body}
                  onChangeText={(next) => {
                    setBody(next)
                    if (error) setError(null)
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={t('testimonials.placeholder')}
                  placeholderTextColor={colors.textFaint}
                  maxLength={TESTIMONIAL_MAX_LENGTH}
                  multiline
                  autoFocus={!editing}
                  accessibilityLabel={t('testimonials.sheetTitle', { name: subject.displayName })}
                  style={[
                    styles.input,
                    focused ? styles.inputFocused : null,
                    error ? styles.inputError : null,
                  ]}
                />
                <View style={styles.meta}>
                  {error ? (
                    <Text style={styles.error} accessibilityLiveRegion="polite">
                      {error}
                    </Text>
                  ) : (
                    <Text style={styles.hint}>
                      {t('testimonials.minHint', { count: TESTIMONIAL_MIN_LENGTH })}
                    </Text>
                  )}
                  <Text style={[styles.hint, used >= COUNTER_WARN_AT ? styles.warn : null]}>
                    {used} / {TESTIMONIAL_MAX_LENGTH}
                  </Text>
                </View>
              </View>

              <Text style={styles.note}>{t('testimonials.guidelines')}</Text>

              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button label={t('common.cancel')} variant="neutral" onPress={onClose} />
                </View>
                <View style={styles.action}>
                  <Button
                    label={editing ? t('common.save') : t('testimonials.publish')}
                    loading={upsert.isPending}
                    onPress={publish}
                  />
                </View>
              </View>
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  hitSlop={8}
                  onPress={() => void confirmDelete()}
                  style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
                >
                  <Text style={styles.deleteLabel}>{t('testimonials.delete')}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardResizeHost>
    </KeyboardAvoidingView>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  fill: { flex: 1 },
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on a wide web window, like the other sheets.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  subline: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  field: { gap: spacing.sm },
  // `FormField`'s multiline box, drawn here because its own counter sits
  // above the field and this one belongs under it, beside the hint.
  input: {
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 140,
    paddingHorizontal: 20,
    paddingVertical: 16,
    textAlignVertical: 'top',
  },
  inputFocused: { backgroundColor: colors.bg, borderColor: colors.accent },
  inputError: { borderColor: colors.danger },
  meta: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  hint: { ...font.caption, color: colors.textFaint },
  warn: { color: colors.warning, fontWeight: '700' },
  error: { ...font.caption, color: colors.danger, flex: 1 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  delete: { alignSelf: 'center', paddingVertical: spacing.sm },
  deleteLabel: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.5 },
}))
