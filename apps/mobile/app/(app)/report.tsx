import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS, type ReportReason } from '@langx/shared'
import { useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useReportUser } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Radio } from '../../src/components/ui/Radio'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT } from '../../src/i18n'
import { reportReasonLabel } from '../../src/i18n/labels'
import { goBackTo } from '../../src/lib/navigation'
import { showToast } from '../../src/lib/toast'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Reporting, as a screen.
 *
 * It used to be a `chooseAlert` in three places, listing three of the six
 * reasons the API accepts and sending none of the `details` the schema has
 * always had. Both limits came from the shape: a native action sheet cannot
 * take free text, and seven options in one is not a list anybody reads.
 *
 * The reasons live here once rather than in each caller, which is also what
 * makes `REPORT_REASONS` the only place to add one — the previous copies had
 * already drifted from it by three entries.
 *
 * What is being reported comes in as params: `userId` is always the account the
 * report is filed against, and the optional ids say where it happened. A report
 * from a profile has neither.
 */
export default function ReportScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const report = useReportUser()

  const { userId, conversationId, messageId, postId } = useLocalSearchParams<{
    userId: string
    conversationId?: string
    messageId?: string
    postId?: string
  }>()

  const [reason, setReason] = useState<ReportReason | undefined>(undefined)
  const [details, setDetails] = useState('')

  // Where "back" lands when there is no screen behind this one — opened from
  // a link, or after a cold start: the thing that was reported.
  const backTo: Href = postId
    ? `/(app)/post/${postId}`
    : conversationId
      ? `/(app)/chat/${conversationId}`
      : '/(app)/(tabs)/discover'
  const question = postId
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
        ...(postId ? { postId } : {}),
      },
      {
        onSuccess: () => {
          // Back first: the toast belongs to the screen they came from, and
          // showing it here would leave them looking at a form they finished.
          // `goBackTo` rather than `router.back()`: opened from a link or a
          // cold start there is no screen behind this one, and `back()` then
          // does nothing — so the fallback is the thing that was reported.
          goBackTo(backTo)
          showToast(t((postId ?? messageId) ? 'report.messageSent' : 'report.profileSent'))
        },
        onError: () => showToast(t('report.failed')),
      },
    )
  }

  return (
    <Screen fluid>
      <ScreenHeader title={t('common.report')} onBack={() => goBackTo(backTo)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>{question}</Text>

        <View style={styles.reasons}>
          {REPORT_REASONS.map((value) => {
            const selected = reason === value
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setReason(value)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{reportReasonLabel(t, value)}</Text>
                  {/* Only one reason carries a hint, and it is the one whose
                      name does not say what it covers. */}
                  {value === 'hate_speech' ? (
                    <Text style={styles.rowHint}>{t('report.hateSpeechHint')}</Text>
                  ) : null}
                </View>
                <Radio selected={selected} />
              </Pressable>
            )
          })}
        </View>

        <FormField
          label={t('report.details')}
          value={details}
          onChangeText={setDetails}
          placeholder={t('report.detailsPlaceholder')}
          maxLength={REPORT_DETAILS_MAX_LENGTH}
          multiline
          style={styles.details}
        />

        <Button
          label={t('report.submit')}
          disabled={!reason || report.isPending}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  question: { color: colors.textFaint, fontSize: 14 },
  reasons: { gap: 0 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  rowHint: { color: colors.textFaint, fontSize: 13 },
  details: { height: 110, textAlignVertical: 'top' },
}))
