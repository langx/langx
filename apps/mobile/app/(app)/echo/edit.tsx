import { ECHO_BACK_MAX_LENGTH, ECHO_FRONT_MAX_LENGTH } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useMe, useUpdateEchoCard } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { useDisplayNames, useT } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { postLanguages, resolvePostLanguage } from '../../../src/lib/postLanguage'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/**
 * Fixing what a card says.
 *
 * The two lines arrive in the route's params rather than being fetched: the
 * list that opened this screen is already holding the card, and there is no
 * endpoint for a single one — every read in the module is a page or a queue.
 *
 * Those two and the language. The recording and the picture are what the
 * sentence arrived with, and the source is the link back to where it was
 * said; neither is wording. The back is the half most worth fixing — it is
 * the only part of a card a machine wrote.
 *
 * The language used to be held back with the media, on the argument that it
 * is a fact about the message rather than a choice. Hand-written cards made
 * that untrue for them, and the field is offered on every card rather than
 * only those — see `updateEchoCardSchema` for what that costs on a card that
 * did come from a message.
 */
export default function EchoCardEditScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const params = useLocalSearchParams<{
    id: string
    front?: string
    back?: string
    lang?: string
  }>()

  const [front, setFront] = useState(params.front ?? '')
  const [back, setBack] = useState(params.back ?? '')
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(params.lang ?? null)
  const update = useUpdateEchoCard()

  const me = useMe()
  /*
   * The languages you are learning — the same list the composer and the new
   * card screen offer. A card filed under something else (a pack in a language
   * you have since dropped, say) keeps it: `resolvePostLanguage` falls back to
   * your first learning language, so the picker is only drawn when the card's
   * own language is among them and there is a real choice to make.
   */
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const language = resolvePostLanguage(languages, chosenLanguage)
  const canRelabel = languages.length > 1 && languages.some((code) => code === params.lang)

  const close = (): void => goBackTo('/(app)/echo/cards')

  async function save(): Promise<void> {
    if (!front.trim()) return
    try {
      await update.mutateAsync({
        cardId: params.id,
        front: front.trim(),
        back: back.trim(),
        ...(canRelabel && language ? { lang: language } : {}),
      })
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
        {canRelabel ? (
          <View style={styles.languageBlock}>
            <Text style={styles.label}>{t('echo.cardLanguage')}</Text>
            <SegmentedControl
              options={languages.map((code) => ({ value: code, label: names.language(code) }))}
              selected={language ? [language] : []}
              onToggle={setChosenLanguage}
              accessibilityLabel={t('echo.cardLanguage')}
            />
          </View>
        ) : null}
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

const useStyles = makeStyles(({ colors, spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
  languageBlock: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
}))
