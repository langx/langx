import { BUG_REPORT_MAX_LENGTH, BUG_REPORT_MIN_LENGTH } from '@langx/shared'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { useReportBug, uploadBugReportMedia } from '../../../src/api/queries'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../../src/components/AttachmentBar'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { usePostAttachments } from '../../../src/hooks/usePostAttachments'
import { useT } from '../../../src/i18n'
import { authClient } from '../../../src/lib/auth-client'
import { goBackTo } from '../../../src/lib/navigation'
import { requireAccount } from '../../../src/lib/requireAccount'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const BACK_TO = '/(app)/settings/about' as const

/**
 * Reporting a bug, with a screenshot or a screen recording as proof.
 *
 * The report is emailed rather than stored — see `routes/bugReports.ts` — so
 * there is nothing to come back to and no list of your reports. The reply
 * arrives in the mail, which is also where a confirmed bug is paid for.
 *
 * **No amount appears on this screen, and none is promised.** What a bug is
 * worth depends on how bad it turned out to be, and that is decided per report
 * once someone has reproduced it. A number here would be a price list for
 * something nobody can price in advance, and the first report worth less than
 * the number would read as us going back on it.
 */
export default function ReportBugScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { data: session } = authClient.useSession()

  const reportBug = useReportBug()
  const { attach, progress } = usePostAttachments(uploadBugReportMedia)

  const [draft, setDraft] = useState('')
  const [proof, setProof] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)

  const busy = reportBug.isPending || uploading
  const ready = draft.trim().length >= BUG_REPORT_MIN_LENGTH

  async function submit(): Promise<void> {
    if (!requireAccount(session?.user)) return
    if (!ready || busy) return

    // The files go up first and only then the report, so a report that is sent
    // never points at bytes that failed to land.
    setUploading(true)
    let attachments
    try {
      attachments = await attach(proof)
    } catch {
      setUploading(false)
      showToast(t('feed.attachmentFailed'))
      return
    }
    setUploading(false)

    reportBug.mutate(
      { body: draft.trim(), ...(attachments ? { attachments } : {}) },
      {
        onSuccess: () => {
          goBackTo(BACK_TO)
          showToast(t('bugReport.sent'))
        },
        onError: () => showToast(t('bugReport.failed')),
      },
    )
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title={t('bugReport.title')} onBack={() => goBackTo(BACK_TO)} />
        <View style={styles.form}>
          <Text style={styles.body}>{t('bugReport.intro')}</Text>
          <Text style={styles.body}>{t('bugReport.reward')}</Text>

          <FormField
            value={draft}
            onChangeText={setDraft}
            placeholder={t('bugReport.placeholder')}
            multiline
            autoCapitalize="sentences"
            maxLength={BUG_REPORT_MAX_LENGTH}
            style={styles.field}
          />

          <AttachmentPreviewRow
            pending={proof}
            onRemove={(index) => setProof((items) => items.filter((_, at) => at !== index))}
            progress={progress}
          />
          {/* No microphone: a recording is not proof of a bug. */}
          <AttachmentBar
            pending={proof}
            onPick={(picked) => setProof((items) => [...items, ...picked])}
            disabled={busy}
            voiceNote={false}
          />

          <Text style={styles.hint}>{t('bugReport.hint')}</Text>
          <Button
            label={busy ? t('bugReport.sending') : t('bugReport.send')}
            disabled={!ready || busy}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  screen: { flex: 1 },
  form: { gap: spacing.md, paddingTop: spacing.sm },
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  // Room for the steps to reproduce, the same five lines the composer gives.
  field: { fontSize: 16, lineHeight: 24, minHeight: 150 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
}))
