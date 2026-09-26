import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Button } from './ui/Button'
import { useT } from '../i18n'
import { makeStyles } from '../lib/theme'

/**
 * A message cut into pieces, one tap to choose a piece.
 *
 * Stands in for text selection, which a bubble does not have: the long-press
 * that would start a selection is the one that opens the message menu. The
 * pieces come from `splitSentences` in shared, so each is exactly as written
 * in the message — the server refuses a quote or an original it cannot find
 * there.
 *
 * `parts` null is closed. The caller owns what a pick means.
 */
export function MessagePartsSheet({
  title,
  parts,
  onPick,
  onClose,
}: {
  title: string
  parts: string[] | null
  onPick: (part: string) => void
  onClose: () => void
}) {
  const styles = useStyles()
  const t = useT()

  return (
    <Modal
      visible={parts !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {(parts ?? []).map((part, index) => (
              <Pressable
                // Index as well: the same sentence can be said twice.
                key={`${index}:${part}`}
                accessibilityRole="button"
                onPress={() => onPick(part)}
                style={({ pressed }) => [styles.part, pressed && styles.pressed]}
              >
                <Text style={styles.partText}>{part}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Outside the scroller, like every sheet's way out. */}
          <View style={styles.footer}>
            <Button label={t('common.cancel')} variant="neutral" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on the web, as `EchoAboutSheet` explains.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...font.heading, color: colors.text, fontSize: 18, paddingBottom: spacing.xs },
  /*
   * Chip-shaped rather than the `Chip` itself: that one is a pill sized for a
   * word, and a sentence has to be free to wrap onto a second line.
   */
  part: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.fill },
  partText: { ...font.body, color: colors.text, lineHeight: 22 },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}))
