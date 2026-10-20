import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS, type ReportReason } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useReportUser } from '../../api/queries'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { reportReasonLabel } from '../../i18n/labels'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/**
 * Reporting, in the v3 look (`V-Report`), behind `flags.v3Home`.
 *
 * A report feeds moderation, so nothing here is this page's own: the
 * reasons are `REPORT_REASONS` in their order, the one hint is hate
 * speech's, the details are optional and capped by the shared limit, the
 * notice about the thread is said before sending, and what is sent, where
 * back goes and which toast follows are `report.tsx`'s, character for
 * character — `postsScreensV3.test.ts` compares the two `submit`s as text.
 * Free on every plan, and never an upsell.
 */
export function ReportScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const report = useReportUser()

  const { userId, conversationId, messageId, postId, commentId, testimonialId } =
    useLocalSearchParams<{
      userId: string
      conversationId?: string
      messageId?: string
      postId?: string
      commentId?: string
      testimonialId?: string
    }>()

  const [reason, setReason] = useState<ReportReason | undefined>(undefined)
  const [details, setDetails] = useState('')

  const backTo: Href = postId
    ? `/(app)/post/${postId}`
    : conversationId
      ? `/(app)/chat/${conversationId}`
      : '/(app)/(tabs)/discover'
  const question = testimonialId
    ? t('report.testimonialQuestion')
    : commentId
      ? t('report.commentQuestion')
      : postId
        ? t('report.postQuestion')
        : messageId
          ? t('report.messageQuestion')
          : t('report.profileQuestion')

  function submit(): void {
    if (!reason || report.isPending) return
    const trimmed = details.trim()
    report.mutate(
      {
        userId,
        reason,
        ...(trimmed ? { details: trimmed } : {}),
        ...(conversationId ? { conversationId } : {}),
        ...(messageId ? { messageId } : {}),
        // A comment report names the comment alone: the server finds its post,
        // and a `postId` beside it would offer a moderator "Hide this post" on
        // somebody who was never reported for one.
        ...(postId && !commentId ? { postId } : {}),
        ...(commentId ? { commentId } : {}),
        ...(testimonialId ? { testimonialId } : {}),
      },
      {
        onSuccess: () => {
          // Back first: the toast belongs to the screen they came from, and
          // showing it here would leave them looking at a form they finished.
          // `goBackTo` rather than `router.back()`: opened from a link or a
          // cold start there is no screen behind this one, and `back()` then
          // does nothing — so the fallback is the thing that was reported.
          goBackTo(backTo)
          showToast(
            t((postId ?? messageId ?? testimonialId) ? 'report.messageSent' : 'report.profileSent'),
          )
        },
        onError: () => showToast(t('report.failed')),
      },
    )
  }

  return (
    <SettingsFormScreenV3
      title={t('common.report')}
      onBack={() => goBackTo(backTo)}
      footer={
        <Button
          label={t('report.submit')}
          icon="flag"
          disabled={!reason || report.isPending}
          onPress={submit}
        />
      }
    >
      <Text style={styles.question}>{question}</Text>

      <View style={styles.reasons}>
        {REPORT_REASONS.map((value, index) => {
          const selected = reason === value
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(value)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.divided,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{reportReasonLabel(t, value)}</Text>
                {value === 'hate_speech' ? (
                  <Text style={styles.rowHint}>{t('report.hateSpeechHint')}</Text>
                ) : null}
              </View>
              {/* The choice in the shape as well as the colour: a filled ring with a tick. */}
              <View style={[styles.ring, selected && styles.ringOn]}>
                {selected ? (
                  <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </View>

      <FieldV3
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        placeholder={t('report.detailsPlaceholder')}
        maxLength={REPORT_DETAILS_MAX_LENGTH}
        multiline
      />

      <Text style={styles.notice}>{t('report.threadNotice')}</Text>
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  question: { ...v3.type.callout, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  reasons: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 52,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[6],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  pressed: { backgroundColor: v3.colors.line },
  rowText: { flex: 1, gap: 1, minWidth: 0 },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  rowHint: { ...v3.type.caption, color: v3.colors.muted },
  ring: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ringOn: { backgroundColor: v3.colors.blue, borderColor: v3.colors.blue },
  notice: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
