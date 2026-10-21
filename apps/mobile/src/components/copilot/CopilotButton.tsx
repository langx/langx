import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { ICON_BUTTON_TARGET, IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'

/**
 * The blue glyph beside send. It opens the two-row menu rather than asking
 * anything itself: one tap is one question, and which question is the
 * person's choice. Disabled while an answer is on its way, so a second tap
 * cannot spend a second answer on the same draft.
 */
export function CopilotButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  const t = useT()
  return (
    <IconButton
      icon="cpu"
      color={colors.info}
      accessibilityLabel={t('copilot.button')}
      onPress={onPress}
      disabled={loading}
    />
  )
}

/**
 * The menu the button opens, drawn above the composer's row: Check my
 * sentence, and Say it in the language they are learning. A row the draft
 * cannot be asked (over its cap, or no language to say it in) is left out,
 * and the button is not drawn when both are.
 */
export function CopilotMenu({
  onCheck,
  onSayIt,
  targetLanguageName,
}: {
  onCheck?: (() => void) | undefined
  onSayIt?: (() => void) | undefined
  targetLanguageName?: string | undefined
}) {
  const styles = useStyles()
  const t = useT()
  return (
    <View style={styles.menu} accessibilityRole="menu">
      {onCheck ? (
        <MenuRow icon="check-circle" label={t('copilot.menuCheck')} onPress={onCheck} />
      ) : null}
      {onSayIt && targetLanguageName ? (
        <MenuRow
          icon="message-circle"
          label={t('copilot.menuSayIt', { language: targetLanguageName })}
          onPress={onSayIt}
        />
      ) : null}
    </View>
  )
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  onPress: () => void
}) {
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  return (
    <PressableScale
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.row}
    >
      <Feather name={icon} size={v3.icon.md} color={colors.info} />
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  )
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  menu: {
    backgroundColor: colors.infoBg,
    borderRadius: v3.radius.block,
    paddingVertical: v3.space[4],
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: Math.max(ICON_BUTTON_TARGET, 52),
    paddingHorizontal: v3.space[16],
  },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, flex: 1 },
}))
