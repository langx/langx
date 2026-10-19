import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * "AI · may be wrong", on every Copilot answer.
 *
 * Blue, always: a person's correction is the green pair, and the two voices
 * in a chat must never be mistaken for each other (`tokens.ts` → the callout
 * pairs). The words are part of the label rather than a footnote, because an
 * answer read without them is an answer read as fact.
 */
export function CopilotLabel() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  return (
    <View style={styles.badge}>
      <Feather name="cpu" size={14} color={colors.info} />
      <Text style={styles.text}>{t('copilot.label')}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.infoBg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: { ...font.label, color: colors.info },
}))
