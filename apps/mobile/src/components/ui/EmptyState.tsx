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
  /** The yellow is the default; pass `secondary` where the action is an offer. */
  actionVariant?: 'primary' | 'secondary'
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}: EmptyStateProps) {
  const { colors } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Feather name={icon} size={24} color={colors.textFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={actionVariant}
          style={styles.action}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // Tall margins on purpose: an empty list is the one screen with nothing to
  // push against, and a message hugging the header reads as an error.
  root: { alignItems: 'center', gap: 10, paddingHorizontal: spacing.xl, paddingVertical: 64 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: { ...font.heading, color: colors.text, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },
  action: { marginTop: spacing.sm, minWidth: 200, width: 'auto' },
}))
