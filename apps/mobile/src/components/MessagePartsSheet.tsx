import type { ReactNode } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Button } from './ui/Button'
import { useV3Home } from '../hooks/useV3Home'
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
  const current = useStyles()
  const redesigned = useStylesV3()
  const styles = useV3Home() ? redesigned : current
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

/**
 * v3's look for the same sheet, behind `flags.v3Home` with the rest of the
 * thread. No board draws it; it follows `WhatsProSheet` for the sheet and
 * V-Corrections for the pieces: grey blocks on the ground, no outlines, and
 * the chosen piece as the ink pill v3 draws every chosen chip in. A word is a
 * pill at the 44pt target; a sentence keeps the block's corner so it can wrap.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  backdrop: { backgroundColor: v3.colors.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.block,
    borderTopRightRadius: v3.radius.block,
    maxHeight: '80%',
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: v3.space[8],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[24],
  },
  title: { ...v3.type.headline, color: v3.colors.fg, paddingBottom: v3.space[4] },
  sentences: { gap: v3.space[8] },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  part: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  word: {
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[8],
  },
  pressed: { backgroundColor: v3.colors.tabOn },
  selected: { backgroundColor: v3.colors.pill },
  partText: { ...v3.type.body, color: v3.colors.fg, lineHeight: 23 },
  selectedText: { color: v3.colors.pillText },
  detail: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[12],
  },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: v3.space[32],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[12],
  },
}))
