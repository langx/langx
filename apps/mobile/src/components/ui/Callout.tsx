import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Text, View, type ViewStyle } from 'react-native'
import { makeStyles, useTheme, type ThemeColors } from '../../lib/theme'

export type CalloutTone = 'success' | 'info' | 'warning' | 'error'

interface CalloutProps {
  tone: CalloutTone
  title?: string
  icon?: keyof typeof Feather.glyphMap
  children?: ReactNode
  style?: ViewStyle
}

/**
 * The four callout pairs, and they are **semantic, not decorative**.
 *
 * Corrections and Copilot are the two voices in the core loop and a user has to
 * be able to tell them apart at a glance: a correction is another human
 * changing your sentence, a Copilot suggestion is a machine proposing one you
 * have not sent yet. So `success` belongs to corrections and `info` belongs to
 * Copilot, everywhere, and neither may borrow the other's colour to look nice.
 */
export function calloutColours(colors: ThemeColors, tone: CalloutTone) {
  const pairs: Record<CalloutTone, { bg: string; fg: string }> = {
    success: { bg: colors.successBg, fg: colors.success },
    info: { bg: colors.infoBg, fg: colors.info },
    warning: { bg: colors.warningBg, fg: colors.warning },
    error: { bg: colors.dangerBg, fg: colors.danger },
  }
  return pairs[tone]
}

export function Callout({ tone, title, icon, children, style }: CalloutProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const { bg, fg } = calloutColours(colors, tone)

  return (
    <View style={[styles.root, { backgroundColor: bg }, style]}>
      {title ? (
        <View style={styles.header}>
          {icon ? <Feather name={icon} size={14} color={fg} /> : null}
          <Text style={[styles.title, { color: fg }]}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ font, radius, spacing }) => ({
  root: { borderRadius: radius.md, gap: spacing.sm, padding: spacing.md },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...font.label, fontWeight: '700' },
}))
