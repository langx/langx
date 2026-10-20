import Feather from '@expo/vector-icons/Feather'
import {
  PHRASE_EXAMPLE_MAX_LENGTH,
  PHRASE_MEANING_MAX_LENGTH,
  PHRASE_TERM_MAX_LENGTH,
} from '@langx/shared'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { goBackTo } from '../../lib/navigation'
import { emitWithAck, getSocket } from '../../lib/socket'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/**
 * Saving a word the conversation turned up, in the redesign's look
 * (`V-PhraseCard`), behind `flags.v3Home`.
 *
 * `phrase-card.tsx`'s three fields and its one socket event, with the
 * example arriving filled when the card was started from a message. Each
 * field says what it is for under it, and the foot says that the card is a
 * message — the other side sees it too — over the yellow Save.
 */
export function PhraseCardScreenV3({
  conversationId,
  lang,
  quoted,
}: {
  conversationId: string
  lang?: string | undefined
  quoted?: string | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const [term, setTerm] = useState('')
  const [meaning, setMeaning] = useState('')
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
    <SettingsFormScreenV3
      title={t('chat.sendPhrase')}
      onBack={back}
      footer={
        <>
          <View style={styles.note}>
            <Feather name="message-circle" size={v3.icon.md} color={v3.colors.muted} />
            <Text style={styles.noteText}>{t('chat.phraseSendNote')}</Text>
          </View>
          <Button
            label={t('common.save')}
            icon="check"
            onPress={() => void save()}
            loading={saving}
            disabled={!term.trim() || !meaning.trim()}
          />
        </>
      }
    >
      <FieldV3
        label={t('chat.phraseTerm')}
        hint={t('chat.phraseTermHint')}
        value={term}
        onChangeText={setTerm}
        maxLength={PHRASE_TERM_MAX_LENGTH}
        autoFocus
        autoCorrect
      />
      <FieldV3
        label={t('chat.phraseMeaning')}
        hint={t('chat.phraseMeaningHint')}
        value={meaning}
        onChangeText={setMeaning}
        maxLength={PHRASE_MEANING_MAX_LENGTH}
        autoCorrect
      />
      <FieldV3
        label={t('chat.phraseExample')}
        value={example}
        onChangeText={setExample}
        maxLength={PHRASE_EXAMPLE_MAX_LENGTH}
        multiline
        autoCorrect
      />
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  note: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: v3.space[8],
    paddingHorizontal: v3.space[6],
  },
  noteText: { ...v3.type.callout, color: v3.colors.muted, flex: 1 },
}))
