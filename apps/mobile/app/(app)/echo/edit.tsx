import { ECHO_BACK_MAX_LENGTH, ECHO_FRONT_MAX_LENGTH } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useUpdateEchoCard } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useT } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/**
 * Fixing what a card says.
 *
 * The two lines arrive in the route's params rather than being fetched: the
 * list that opened this screen is already holding the card, and there is no
 * endpoint for a single one — every read in the module is a page or a queue.
 *
 * Only those two. The language, the recording and the picture are what the
 * sentence arrived with, and the source is the link back to where it was
 * said; none of them is wording. The back is the half most worth fixing — it
 * is the only part of a card a machine wrote.
 */
export default function EchoCardEditScreen() {
  const styles = useStyles()
  const t = useT()
  const params = useLocalSearchParams<{ id: string; front?: string; back?: string }>()

  const [front, setFront] = useState(params.front ?? '')
  const [back, setBack] = useState(params.back ?? '')
  const update = useUpdateEchoCard()

  const close = (): void => goBackTo('/(app)/echo/cards')

  async function save(): Promise<void> {
    if (!front.trim()) return
    try {
      await update.mutateAsync({ cardId: params.id, front: front.trim(), back: back.trim() })
      close()
      showToast(t('echo.edited'))
    } catch {
      await showAlert(t('echo.editFailedTitle'), t('common.retry'))
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('echo.editTitle')} onBack={close} />
      <View style={styles.form}>
        <FormField
          label={t('echo.editFront')}
          value={front}
          onChangeText={setFront}
          maxLength={ECHO_FRONT_MAX_LENGTH}
          multiline
          autoFocus
        />
        {/* Emptiable on purpose: a wrong translation is worse than none. */}
        <FormField
          label={t('echo.editBack')}
          value={back}
          onChangeText={setBack}
          maxLength={ECHO_BACK_MAX_LENGTH}
          multiline
        />
        <Button
          label={t('common.save')}
          onPress={() => void save()}
          loading={update.isPending}
          disabled={!front.trim()}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
}))
