import {
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX_LENGTH,
  QUIZ_QUESTION_MAX_LENGTH,
} from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { emitWithAck, getSocket } from '../../src/lib/socket'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'

/**
 * Writing a question with one right answer.
 *
 * A quiz, not a poll: two people are in a conversation, so a tally says
 * nothing, and marking the answer is what makes it worth sending. The mark is
 * a radio on each option rather than a separate control — "which of these is
 * right" is the same question as "which one am I marking", and asking it twice
 * is how the two end up disagreeing.
 */
export default function QuizScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [correct, setCorrect] = useState(0)
  const [sending, setSending] = useState(false)

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)
  const filled = options.map((option) => option.trim())
  const ready =
    question.trim().length > 0 &&
    filled.filter(Boolean).length >= QUIZ_MIN_OPTIONS &&
    filled.every(Boolean) &&
    filled[correct] !== undefined &&
    filled[correct].length > 0

  function setOption(index: number, value: string): void {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)))
  }

  async function send(): Promise<void> {
    if (!ready) {
      await showAlert(t('chat.quizNeedsOptions'))
      return
    }
    setSending(true)
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:quiz', {
        conversationId,
        question: question.trim(),
        options: filled,
        correctIndex: correct,
      })
      back()
    } catch (caught) {
      void caught
      setSending(false)
      await showAlert(t('chat.couldNotSend'))
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('chat.sendQuiz')} onBack={back} />
      <View style={styles.form}>
        <FormField
          label={t('chat.quizQuestion')}
          value={question}
          onChangeText={setQuestion}
          maxLength={QUIZ_QUESTION_MAX_LENGTH}
          autoFocus
        />
        <Text style={styles.hint}>{t('chat.quizCorrect')}</Text>
        {options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: correct === index }}
              accessibilityLabel={t('chat.quizOption', { number: index + 1 })}
              hitSlop={8}
              onPress={() => setCorrect(index)}
              style={styles.radio}
            >
              <Feather
                name={correct === index ? 'check-circle' : 'circle'}
                size={22}
                color={correct === index ? colors.success : colors.textFaint}
              />
            </Pressable>
            <View style={styles.optionField}>
              <FormField
                label={t('chat.quizOption', { number: index + 1 })}
                value={option}
                onChangeText={(value) => setOption(index, value)}
                maxLength={QUIZ_OPTION_MAX_LENGTH}
              />
            </View>
          </View>
        ))}
        {options.length < QUIZ_MAX_OPTIONS ? (
          <Button
            label={t('chat.quizAddOption')}
            variant="neutral"
            onPress={() => setOptions((current) => [...current, ''])}
          />
        ) : null}
        <Button label={t('common.send')} onPress={() => void send()} loading={sending} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
  hint: { ...font.label, color: colors.textMuted },
  optionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  radio: { paddingTop: 18 },
  optionField: { flex: 1 },
}))
