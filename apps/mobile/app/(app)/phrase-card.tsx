import {
  PHRASE_TERM_MAX_LENGTH,
  PHRASE_MEANING_MAX_LENGTH,
  PHRASE_EXAMPLE_MAX_LENGTH,
} from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { emitWithAck, getSocket } from '../../src/lib/socket'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

/**
 * Saving a word the conversation turned up.
 *
 * Its own screen rather than a sheet over the thread: three fields is a form,
 * and the one thing being written here — what a phrase *means* — is not
 * something anybody types while glancing at something else.
 *
 * The card is a message, so it lands in the thread as well as in the deck.
 * That is the point of it being a message at all: a vocabulary list nobody
 * sees being written is a list nobody writes.
 */
export default function PhraseCardScreen() {
  const styles = useStyles()
  const t = useT()
  const {
    id: conversationId,
    lang,
    example: quoted,
  } = useLocalSearchParams<{ id: string; lang?: string; example?: string }>()

  const [term, setTerm] = useState('')
  const [meaning, setMeaning] = useState('')
  /*
   * Arrives filled when the card was started from a message — the sentence it
   * was met in, already the example. `term` and `meaning` stay empty on
   * purpose: the reader picks the word out of the sentence and says what it
   * means, which is the part that makes it worth keeping.
   */
  const [example, setExample] = useState(quoted ?? '')
  const [saving, setSaving] = useState(false)

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)

  async function save(): Promise<void> {
    if (!term.trim() || !meaning.trim()) return
    setSaving(true)
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:phrase', {
        conversationId,
        term: term.trim(),
        meaning: meaning.trim(),
        lang: lang ?? 'en',
        ...(example.trim() ? { example: example.trim() } : {}),
      })
      back()
      showToast(t('chat.phraseSaved'))
    } catch (caught) {
      void caught
      setSaving(false)
      await showAlert(t('chat.couldNotSend'))
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('chat.sendPhrase')} onBack={back} />
      <View style={styles.form}>
        <FormField
          label={t('chat.phraseTerm')}
          value={term}
          onChangeText={setTerm}
          maxLength={PHRASE_TERM_MAX_LENGTH}
          autoFocus
        />
        <FormField
          label={t('chat.phraseMeaning')}
          value={meaning}
          onChangeText={setMeaning}
          maxLength={PHRASE_MEANING_MAX_LENGTH}
        />
        <FormField
          label={t('chat.phraseExample')}
          value={example}
          onChangeText={setExample}
          maxLength={PHRASE_EXAMPLE_MAX_LENGTH}
          multiline
        />
        <Button
          label={t('common.save')}
          onPress={() => void save()}
          loading={saving}
          disabled={!term.trim() || !meaning.trim()}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
}))
