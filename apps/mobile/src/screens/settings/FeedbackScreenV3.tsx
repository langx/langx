import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH } from '@langx/shared'
import type { FeedbackKind } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { ApiRequestError } from '../../api/client'
import { uploadFeedbackMedia, useSendFeedback } from '../../api/queries'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../components/AttachmentBar'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3, SettingsNoteV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { usePostAttachments } from '../../hooks/usePostAttachments'
import { useT } from '../../i18n'
import { authClient } from '../../lib/auth-client'
import { goBackTo } from '../../lib/navigation'
import { requireAccount } from '../../lib/requireAccount'
import { makeStyles } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const BACK_TO = '/(app)/settings/about' as const

function isFeedbackKind(value: string | undefined): value is FeedbackKind {
  return FEEDBACK_KINDS.includes(value as FeedbackKind)
}

/**
 * Reporting a bug or asking for a feature, in the redesign's look
 * (`V-SetFeedback`), behind `flags.v3Home`. The upload-then-send order, the
 * refusals told apart and every word are `settings/feedback.tsx`'s — and,
 * as there, no amount appears and none is promised.
 */
export function FeedbackScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { data: session } = authClient.useSession()

  const { kind } = useLocalSearchParams<{ kind?: string }>()
  const section: FeedbackKind = isFeedbackKind(kind) ? kind : 'bug'
  const bug = section === 'bug'

  const sendFeedback = useSendFeedback()
  const { attach, progress } = usePostAttachments(uploadFeedbackMedia)

  const [draft, setDraft] = useState('')
  const [proof, setProof] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)

  const busy = sendFeedback.isPending || uploading
  const ready = draft.trim().length >= FEEDBACK_MIN_LENGTH

  async function submit(): Promise<void> {
    if (!requireAccount(session?.user, { action: 'other' })) return
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

    sendFeedback.mutate(
      { kind: section, body: draft.trim(), ...(attachments ? { attachments } : {}) },
      {
        onSuccess: () => {
          goBackTo(BACK_TO)
          showToast(t('feedback.sent'))
        },
        onError: (caught: unknown) => {
          const code = caught instanceof ApiRequestError ? caught.code : undefined
          showToast(
            code === 'RATE_LIMITED'
              ? t('feedback.tooMany')
              : code === 'EMAIL_NOT_VERIFIED'
                ? t('errors.emailNotVerified')
                : t('feedback.failed'),
          )
        },
      },
    )
  }

  return (
    <SettingsFormScreenV3
      title={t(bug ? 'feedback.bugTitle' : 'feedback.featureTitle')}
      onBack={() => goBackTo(BACK_TO)}
      footer={
        <Button
          label={busy ? t('feedback.sending') : t('feedback.send')}
          icon="send"
          disabled={!ready || busy}
          onPress={() => void submit()}
        />
      }
    >
      <Text style={styles.body}>{t(bug ? 'feedback.bugIntro' : 'feedback.featureIntro')}</Text>
      <SettingsNoteV3 icon="gift" hue="lime">
        {t('feedback.reward')}
      </SettingsNoteV3>

      <FieldV3
        value={draft}
        onChangeText={setDraft}
        placeholder={t(bug ? 'feedback.bugPlaceholder' : 'feedback.featurePlaceholder')}
        multiline
        autoCapitalize="sentences"
        maxLength={FEEDBACK_MAX_LENGTH}
        // Says why the button is off, only once they have started.
        error={
          draft.trim().length > 0 && !ready
            ? t('feedback.tooShort', { count: FEEDBACK_MIN_LENGTH })
            : undefined
        }
        style={styles.field}
      />

      <AttachmentPreviewRow
        pending={proof}
        onRemove={(index) => setProof((items) => items.filter((_, at) => at !== index))}
        progress={progress}
      />
      {/* No microphone: a recording is not proof of anything here. */}
      <AttachmentBar
        pending={proof}
        onPick={(picked) => setProof((items) => [...items, ...picked])}
        disabled={busy}
        voiceNote={false}
      />

      <Text style={styles.hint}>{t('feedback.hint')}</Text>
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { ...v3.type.callout, color: v3.colors.fg },
  // Room for the steps to reproduce, the same five lines today's field gives.
  field: { minHeight: 150 },
  hint: { ...v3.type.caption, color: v3.colors.muted },
}))
