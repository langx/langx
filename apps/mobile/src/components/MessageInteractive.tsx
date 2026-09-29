import Feather from '@expo/vector-icons/Feather'
import type { MessageInteractive as Interactive } from '@langx/shared'
import { Platform, Pressable, Text, View } from 'react-native'
import { useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * The chips or the button under a broadcast's text.
 *
 * Under the bubble rather than inside it, like an `ask`: the body already
 * says everything, and this is the way to answer it. A poll's options are
 * chips; once one is picked it is ticked and the rest go quiet, because the
 * server keeps the first answer and a second tap would only look like it
 * changed something.
 */
export function MessageInteractive({
  interactive,
  mine,
  onAnswerPoll,
  onCardAction,
}: {
  interactive: Interactive
  /** Your own message: nothing to answer. */
  mine: boolean
  onAnswerPoll: (optionId: string) => void
  onCardAction: () => void
}) {
  const t = useT()
  const { colors } = useTheme()
  const styles = useStyles()

  if (interactive.kind === 'poll') {
    const answered = interactive.answer !== undefined
    return (
      <View style={styles.block}>
        <View style={styles.chips}>
          {interactive.options.map((option) => {
            const chosen = interactive.answer === option.id
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen, disabled: mine || answered }}
                disabled={mine || answered}
                onPress={() => onAnswerPoll(option.id)}
                style={({ pressed }) => [
                  styles.chip,
                  chosen && styles.chipChosen,
                  answered && !chosen && styles.chipQuiet,
                  pressed && styles.pressed,
                ]}
              >
                {chosen ? <Feather name="check" size={14} color={colors.accent} /> : null}
                <Text style={[styles.chipText, chosen && styles.chipTextChosen]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {answered ? <Text style={styles.thanks}>{t('chat.pollThanks')}</Text> : null}
      </View>
    )
  }

  // There is no store on the web, so a button that says "rate us there" is
  // one that cannot do what it says. The title still reads.
  const hideButton = interactive.button.action.type === 'storeReview' && Platform.OS === 'web'
  return (
    <View style={[styles.block, styles.card]}>
      <Text style={styles.cardTitle}>{interactive.title}</Text>
      {hideButton ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={onCardAction}
          style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}
        >
          <Text style={styles.cardButtonText}>{interactive.button.label}</Text>
        </Pressable>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius }) => ({
  block: { gap: 6, marginTop: 6, maxWidth: 320 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipChosen: { borderColor: colors.accent },
  chipQuiet: { opacity: 0.5 },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextChosen: { color: colors.accent, fontWeight: '700' },
  thanks: { color: colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 9,
  },
  cardButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
}))
