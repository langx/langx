import {
  MOD_APPLICATION_ANSWER_MAX,
  MOD_APPLICATION_ANSWER_MIN,
  MOD_APPLICATION_QUESTIONS,
  type ModApplicationInput,
  type ModApplicationQuestion,
} from '@langx/shared'
import { useState } from 'react'
import { Text } from 'react-native'
import { ApiRequestError } from '../api/client'
import { useApplyToModerate } from '../api/queries'
import { FieldV3 } from '../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../components/settings/v3/SettingsFormV3'
import { Button } from '../components/ui/Button'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useT } from '../i18n'
import { goBackTo } from '../lib/navigation'
import { makeStyles } from '../lib/theme'
import { showToast } from '../lib/toast'

const BACK_TO = '/(app)/(tabs)/me' as const

const EMPTY: ModApplicationInput['answers'] = { why: '', experience: '', situation: '', time: '' }

/**
 * Asking to moderate: the questions, one field each, and send.
 *
 * Reached from the MOD badge's sheet, which only opens it once the streak is
 * there; the server checks the streak again, so a deep link here without one
 * ends in a refusal, not a row. Feedback's form in shape (`FeedbackScreenV3`):
 * the button says why it is off only once somebody has started typing.
 */
export function ModApplicationScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const apply = useApplyToModerate()
  const [answers, setAnswers] = useState(EMPTY)

  const short = (key: ModApplicationQuestion) =>
    answers[key].trim().length < MOD_APPLICATION_ANSWER_MIN
  const ready = MOD_APPLICATION_QUESTIONS.every((key) => !short(key))

  function submit(): void {
    if (!ready || apply.isPending) return
    const trimmed = Object.fromEntries(
      MOD_APPLICATION_QUESTIONS.map((key) => [key, answers[key].trim()]),
    ) as ModApplicationInput['answers']
    apply.mutate(
      { answers: trimmed },
      {
        onSuccess: () => {
          goBackTo(BACK_TO)
          showToast(t('modApplication.sent'))
        },
        onError: (caught: unknown) => {
          const code = caught instanceof ApiRequestError ? caught.code : undefined
          showToast(
            code === 'FORBIDDEN'
              ? t('modApplication.notEligible')
              : code === 'EMAIL_NOT_VERIFIED'
                ? t('errors.emailNotVerified')
                : t('modApplication.failed'),
          )
        },
      },
    )
  }

  return (
    <SettingsFormScreenV3
      title={t('modApplication.title')}
      onBack={() => goBackTo(BACK_TO)}
      footer={
        <Button
          label={apply.isPending ? t('modApplication.sending') : t('modApplication.send')}
          icon="send"
          disabled={!ready || apply.isPending}
          onPress={submit}
        />
      }
    >
      <Text style={styles.body}>{t('modApplication.intro')}</Text>
      {MOD_APPLICATION_QUESTIONS.map((key) => (
        <FieldV3
          key={key}
          label={t(`modApplication.questions.${key}`)}
          value={answers[key]}
          onChangeText={(text) => setAnswers((current) => ({ ...current, [key]: text }))}
          multiline
          autoCapitalize="sentences"
          maxLength={MOD_APPLICATION_ANSWER_MAX}
          error={
            answers[key].trim().length > 0 && short(key)
              ? t('modApplication.tooShort', { count: MOD_APPLICATION_ANSWER_MIN })
              : undefined
          }
          style={styles.field}
        />
      ))}
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { ...v3.type.callout, color: v3.colors.fg },
  field: { minHeight: 110 },
}))
