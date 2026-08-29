import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from './Button'

interface EmptyStateProps {
  /** A Feather glyph, matching the tab bar. See the note in `(app)/_layout`. */
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Feather name={icon} size={26} color={colors.textFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  root: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 64,
  },
  title: { ...font.heading, color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  action: { marginTop: spacing.lg, minWidth: 200 },
}))
