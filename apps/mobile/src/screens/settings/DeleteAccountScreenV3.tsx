import Feather from '@expo/vector-icons/Feather'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_NOTE_MAX,
  ACCOUNT_DELETION_REASONS,
  handlesMatch,
  type AccountDeletionReason,
} from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../../api/client'
import { useMe } from '../../api/queries'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import {
  SettingsFormScreenV3,
  SettingsLeadV3,
  SettingsNoteV3,
} from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { deletionReasonLabel } from '../../i18n/labels'
import { showAlert } from '../../lib/alert'
import { authClient } from '../../lib/auth-client'
import { authLandingHref } from '../../lib/authLanding'
import { deletionFeedbackPayload } from '../../lib/deletionFeedback'
import { syncIconBadge } from '../../lib/iconBadge'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/**
 * Deleting the account in the redesign's look (`V-SetDeleteAccount`), behind
 * `flags.v3Home`. The two steps, both requests, the handle check and every
 * word are `settings/delete-account.tsx`'s — see it for why the emailed link
 * starts the 30-day grace period rather than deleting anything, and why the
 * question before it can always be skipped.
 *
 * The red stays an outline, never yellow, and "Keep it" is the ink pill
 * beside it: the way out is the louder of the two.
 */
export function DeleteAccountScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const me = useMe()
  const session = authClient.useSession().data

  const handle = me.data?.handle ?? ''
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [step, setStep] = useState<'why' | 'confirm'>('why')
  const [reason, setReason] = useState<AccountDeletionReason | null>(null)
  const [note, setNote] = useState('')
  const matches = handlesMatch(typed, handle)
  const back = () => goBackTo('/(app)/settings')

  /** The direct path, for a deployment that cannot send mail at all. */
  async function deleteWithoutEmail(): Promise<void> {
    await api.post('/me/delete', { confirm: 'DELETE', ...deletionFeedbackPayload(reason, note) })
    await syncIconBadge(0)
    await authClient.signOut()
    router.replace(authLandingHref())
    showToast(t('settings.deleted', { count: ACCOUNT_DELETION_GRACE_DAYS }))
  }

  async function submit(): Promise<void> {
    setBusy(true)
    try {
      const result = await api.post<{ sent: boolean; deliverable: boolean }>('/me/delete/request', {
        handle: typed,
        ...deletionFeedbackPayload(reason, note),
      })
      if (result.sent) {
        setSentTo(session?.user.email ?? '')
        return
      }
      await deleteWithoutEmail()
    } catch (error) {
      // The API's message is English and written for a developer.
      void error
      await showAlert(t('settings.deleteFailed'), t('common.retry'))
    } finally {
      setBusy(false)
    }
  }

  function skip(): void {
    setReason(null)
    setNote('')
    setStep('confirm')
  }

  if (step === 'why') {
    return (
      <SettingsFormScreenV3
        title={t('settings.deleteConfirmTitle')}
        onBack={back}
        footer={
          <>
            <Button
              label={t('common.continue')}
              variant="blue"
              onPress={() => setStep('confirm')}
            />
            <Button label={t('deletion.whySkip')} variant="secondary" onPress={skip} />
          </>
        }
      >
        <Text accessibilityRole="header" style={styles.whyTitle}>
          {t('deletion.whyTitle')}
        </Text>
        <SettingsLeadV3>{t('deletion.whyBody')}</SettingsLeadV3>

        <View style={styles.reasons}>
          {ACCOUNT_DELETION_REASONS.map((value, index) => {
            const selected = reason === value
            const label = deletionReasonLabel(t, value)
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => setReason(value)}
                style={({ pressed }) => [
                  styles.reason,
                  index > 0 && styles.reasonDivided,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reasonText}>{label}</Text>
                <View style={[styles.ring, selected && styles.ringOn]}>
                  {selected ? (
                    <Feather name="check" size={v3.icon.xs} color={v3.colors.pillText} />
                  ) : null}
                </View>
              </Pressable>
            )
          })}
        </View>

        <FieldV3
          label={t('deletion.whyNote')}
          accessibilityLabel={t('deletion.whyNote')}
          value={note}
          onChangeText={setNote}
          placeholder={t('deletion.whyNotePlaceholder')}
          maxLength={ACCOUNT_DELETION_NOTE_MAX}
          multiline
        />
      </SettingsFormScreenV3>
    )
  }

  if (sentTo !== null) {
    // Nothing has happened to the account yet, and the page says so: the
    // link in the mail is what schedules it.
    return (
      <SettingsFormScreenV3 title={t('settings.deleteConfirmTitle')} onBack={back}>
        <SettingsLeadV3>{t('settings.deleteCheckEmail', { email: sentTo })}</SettingsLeadV3>
        <SettingsNoteV3 icon="info" tone="danger">
          {t('settings.deleteNothingYet')}
        </SettingsNoteV3>
      </SettingsFormScreenV3>
    )
  }

  return (
    <SettingsFormScreenV3
      title={t('settings.deleteConfirmTitle')}
      onBack={back}
      footer={
        <>
          <Button
            label={t('settings.deleteAccount')}
            variant="danger"
            icon="trash-2"
            loading={busy}
            disabled={busy || !matches}
            onPress={() => void submit()}
          />
          <Button label={t('deletion.keepIt')} variant="ink" onPress={back} />
        </>
      }
    >
      <Text style={styles.explain}>
        {t('settings.deleteExplain', { count: ACCOUNT_DELETION_GRACE_DAYS })}
      </Text>
      {/* Said before anything is typed: the box is what says none has happened. */}
      <SettingsNoteV3 icon="info" tone="danger">
        {t('settings.deleteNothingYet')}
      </SettingsNoteV3>
      <FieldV3
        ltr
        label={t('settings.deleteTypeHandle', { handle })}
        accessibilityLabel={t('settings.deleteTypeHandle', { handle })}
        value={typed}
        onChangeText={setTyped}
        placeholder={handle}
        autoCapitalize="none"
        autoComplete="off"
        maxLength={64}
        suffix={
          matches ? (
            <Feather name="check-circle" size={v3.icon.lg} color={v3.colors.correction} />
          ) : null
        }
      />
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  whyTitle: { ...v3.type.headline, color: v3.colors.fg },
  explain: { ...v3.type.body, color: v3.colors.fg },
  reasons: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  reason: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 56,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[8],
  },
  reasonDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  reasonText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  ring: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ringOn: { backgroundColor: v3.colors.fg, borderColor: v3.colors.fg },
  pressed: { opacity: 0.7 },
}))
