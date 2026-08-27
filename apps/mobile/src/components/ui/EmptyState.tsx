import { StyleSheet, Text, View } from 'react-native'
import { colors, font, spacing } from '../../lib/theme'
import { Button } from './Button'

interface EmptyStateProps {
  emoji: string
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ emoji, title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emoji: { fontSize: 40, marginBottom: spacing.md },
  title: { ...font.heading, color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  action: { marginTop: spacing.lg, minWidth: 200 },
})
