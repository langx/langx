import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useV3Home } from '../../hooks/useV3Home'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from './Button'
import { EmptyNoteV3 } from './EmptyStateV3'

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
  const v3Look = useV3Home()

  /*
   * Under `flags.v3Home`, `EmptyNoteV3`: the same glyph, title, body and
   * action in v3's faces. That is the note written for exactly this case —
   * a page whose copy is a title and a body, not `EmptyStateV3`'s one line
   * under a drawing — so nothing a caller says is lost in the move.
   */
  if (v3Look) {
    return (
      <EmptyNoteV3
        icon={icon}
        title={title}
        body={body}
        actionLabel={actionLabel}
        onAction={onAction}
        actionVariant={actionVariant}
      />
    )
  }

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
