import Feather from '@expo/vector-icons/Feather'
import {
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX_LENGTH,
  QUIZ_QUESTION_MAX_LENGTH,
} from '@langx/shared'
import { useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { ICON_BUTTON_TARGET } from '../../components/ui/IconButton'
import { useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { goBackTo } from '../../lib/navigation'
import { emitWithAck, getSocket } from '../../lib/socket'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * Writing a question with one right answer, in the redesign's look
 * (`V-Quiz`), behind `flags.v3Home`.
 *
 * `quiz.tsx`'s form and its one socket event: the question, two to four
 * options each with the radio that marks it right, Add an option until
 * there are four, and Send — the yellow — which refuses with the same
 * sentence until the quiz is whole.
 */
export function QuizScreenV3({ conversationId }: { conversationId: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

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
    <SettingsFormScreenV3
      title={t('chat.sendQuiz')}
      onBack={back}
      footer={
        <Button
          label={t('common.send')}
          icon="send"
          onPress={() => void send()}
          loading={sending}
        />
      }
    >
      <FieldV3
        label={t('chat.quizQuestion')}
        value={question}
        onChangeText={setQuestion}
        maxLength={QUIZ_QUESTION_MAX_LENGTH}
        autoFocus
        autoCorrect
      />
      <Text style={styles.heading}>{t('chat.quizCorrect')}</Text>
      {options.map((option, index) => (
        <View key={index} style={styles.optionRow}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: correct === index }}
            accessibilityLabel={t('chat.quizOption', { number: index + 1 })}
            onPress={() => setCorrect(index)}
            style={styles.radioTarget}
          >
            <View style={[styles.radio, correct === index && styles.radioOn]}>
              {correct === index ? (
                <Feather name="check" size={v3.icon.xs} color={v3.colors.bg} />
              ) : null}
            </View>
          </Pressable>
          <OptionField
            label={t('chat.quizOption', { number: index + 1 })}
            value={option}
            correct={correct === index}
            onChangeText={(value) => setOption(index, value)}
          />
        </View>
      ))}
      {options.length < QUIZ_MAX_OPTIONS ? (
        <Button
          label={t('chat.quizAddOption')}
          icon="plus"
          variant="secondary"
          onPress={() => setOptions((current) => [...current, ''])}
        />
      ) : null}
    </SettingsFormScreenV3>
  )
}

/**
 * One answer as the board draws it: a card with its "Option N" inside, over
 * the text, rather than a label above a pill field. The right one wears the
 * radio's green as its edge, so the mark and the answer read as one; focus
 * takes the ink edge every v3 field takes, and the green comes back on blur.
 */
function OptionField({
  label,
  value,
  correct,
  onChangeText,
}: {
  label: string
  value: string
  correct: boolean
  onChangeText: (value: string) => void
}) {
  const styles = useStyles()
  const input = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  return (
    // The whole card is the field's target, not only the line the text sits on.
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      style={[
        styles.option,
        focused ? styles.optionFocused : correct ? styles.optionCorrect : null,
      ]}
    >
      {/* Seen, not read out: the input below carries the same label. */}
      <Text style={styles.optionLabel} accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </Text>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        maxLength={QUIZ_OPTION_MAX_LENGTH}
        autoCorrect
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.optionInput}
      />
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  heading: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingStart: v3.space[4] },
  optionRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  radioTarget: {
    alignItems: 'center',
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  radio: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  radioOn: { backgroundColor: v3.colors.correction, borderColor: v3.colors.correction },
  option: {
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    borderWidth: 3,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[6],
  },
  optionFocused: { borderColor: v3.colors.fg },
  optionCorrect: { borderColor: v3.colors.correction },
  optionLabel: { ...v3.type.label, color: v3.colors.muted },
  // No padding of its own, so the text lines up under its label on both
  // platforms; and, as in `FieldV3`, no browser focus ring over the card's edge.
  optionInput: {
    ...v3.type.button,
    color: v3.colors.fg,
    outlineStyle: 'solid',
    outlineWidth: 0,
    padding: 0,
  },
}))
