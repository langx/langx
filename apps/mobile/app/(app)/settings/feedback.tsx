import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH } from '@langx/shared'
import type { FeedbackKind } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { uploadFeedbackMedia, useSendFeedback } from '../../../src/api/queries'
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

function isFeedbackKind(value: string | undefined): value is FeedbackKind {
  return FEEDBACK_KINDS.includes(value as FeedbackKind)
}

/**
 * Reporting a bug, or asking for something that is not there — one screen with
 * two sets of words, the way `compose` is, because everything but the words is
 * the same: a paragraph, whatever proves it, and send.
 *
 * The message is emailed and opened as an issue on the repository — see
 * `routes/feedback.ts` — so there is nothing to come back to and no list of
 * what you have sent. The answer arrives in the mail, which is also where a
 * confirmed report is paid for.
 *
 * **No amount appears on this screen, and none is promised.** What a report is
 * worth depends on what it turned out to be worth, and that is decided per
 * report once someone has read it. A number here would be a price list for
 * something nobody can price in advance, and the first report worth less than
 * the number would read as us going back on it.
 */
export default function FeedbackScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { data: session } = authClient.useSession()

  const { kind } = useLocalSearchParams<{ kind?: string }>()
  // A hand-typed or stale `?kind=` falls back rather than sending something
  // the server would refuse.
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

    sendFeedback.mutate(
      { kind: section, body: draft.trim(), ...(attachments ? { attachments } : {}) },
      {
        onSuccess: () => {
          goBackTo(BACK_TO)
          showToast(t('feedback.sent'))
        },
        onError: () => showToast(t('feedback.failed')),
      },
    )
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title={t(bug ? 'feedback.bugTitle' : 'feedback.featureTitle')}
          onBack={() => goBackTo(BACK_TO)}
        />
        <View style={styles.form}>
          <Text style={styles.body}>{t(bug ? 'feedback.bugIntro' : 'feedback.featureIntro')}</Text>
          <Text style={styles.body}>{t('feedback.reward')}</Text>

          <FormField
            value={draft}
            onChangeText={setDraft}
            placeholder={t(bug ? 'feedback.bugPlaceholder' : 'feedback.featurePlaceholder')}
            multiline
            autoCapitalize="sentences"
            maxLength={FEEDBACK_MAX_LENGTH}
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
          <Button
            label={busy ? t('feedback.sending') : t('feedback.send')}
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
