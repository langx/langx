import type { ReactNode } from 'react'
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
 *
 * `words` lays the pieces out as a wrapping row of chips — a word per line
 * would make a paragraph a screen-long list — and marks the `selected` one.
 * `detail` sits under them, outside the scroller, so what a pick opened stays
 * in view however long the message is.
 */
export function MessagePartsSheet({
  title,
  parts,
  onPick,
  onClose,
  layout = 'sentences',
  selected,
  detail,
}: {
  title: string
  parts: string[] | null
  onPick: (part: string) => void
  onClose: () => void
  layout?: 'sentences' | 'words'
  selected?: string | null
  detail?: ReactNode
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
            <View style={layout === 'words' ? styles.words : styles.sentences}>
              {(parts ?? []).map((part, index) => (
                <Pressable
                  // Index as well: the same sentence can be said twice.
                  key={`${index}:${part}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: part === selected }}
                  onPress={() => onPick(part)}
                  style={({ pressed }) => [
                    styles.part,
                    layout === 'words' && styles.word,
                    pressed && styles.pressed,
                    part === selected && styles.selected,
                  ]}
                >
                  <Text style={[styles.partText, part === selected && styles.selectedText]}>
                    {part}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {detail ? <View style={styles.detail}>{detail}</View> : null}

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
  sentences: { gap: spacing.sm },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  /** A word never wraps, so it can be as tight as a chip. */
  word: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.fill },
  selected: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  partText: { ...font.body, color: colors.text, lineHeight: 22 },
  selectedText: { color: colors.accent },
  detail: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}))
