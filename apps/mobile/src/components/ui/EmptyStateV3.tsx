import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { Button } from './Button'

/** What the empty list would hold: conversations, Echo cards, people. */
export type EmptyArtKind = 'chats' | 'cards' | 'people'

/**
 * The picture over an empty list, drawn from the same flat blocks as the
 * rest of v3 — two bubbles, two cards, three faces — in the partner hues,
 * ink on top. Shapes rather than an illustration file: they take the scheme
 * with them (the dark hues are a step deeper), cost no asset, and cannot
 * drift from the blocks the screen around them is made of.
 *
 * Decoration: hidden from screen readers, since the line under it says
 * everything the picture does.
 */
export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  const styles = useStyles()
  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {kind === 'chats' ? (
        <>
          <View style={[styles.bubble, styles.bubbleMine]}>
            <View style={[styles.bar, styles.barLong]} />
            <View style={[styles.bar, styles.barShort]} />
          </View>
          <View style={[styles.bubble, styles.bubbleTheirs]}>
            <View style={[styles.bar, styles.barShort]} />
          </View>
        </>
      ) : kind === 'cards' ? (
        <>
          <View style={[styles.card, styles.cardBack]} />
          <View style={[styles.card, styles.cardFront]}>
            <View style={[styles.bar, styles.barShort]} />
            <View style={[styles.bar, styles.barTiny]} />
          </View>
        </>
      ) : (
        <>
          <Face style={styles.faceOne} />
          <Face style={styles.faceTwo} />
          <Face style={styles.faceThree} />
        </>
      )}
    </View>
  )
}

function Face({ style }: { style: StyleProp<ViewStyle> }) {
  const styles = useStyles()
  return (
    <View style={[styles.face, style]}>
      <View style={styles.head} />
      <View style={styles.shoulders} />
    </View>
  )
}

interface EmptyStateV3Props {
  art: EmptyArtKind
  /** One sentence: what is missing, and what would fill it. */
  line: string
  actionLabel: string
  onAction: () => void
  /** The yellow by default; `secondary` where the action is an offer rather than the screen's job. */
  actionVariant?: 'primary' | 'secondary'
}

/**
 * v3's empty list: a drawn picture, one line, one button.
 *
 * Beside `EmptyState`, which keeps the current look's glyph, title and body
 * until each screen migrates; when the last one has, this takes its name.
 * One line rather than a title and a body, because the drawings never need
 * two — the picture already says which list this is.
 */
export function EmptyStateV3({
  art,
  line,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}: EmptyStateV3Props) {
  const styles = useStyles()
  return (
    <View style={styles.root}>
      <EmptyArt kind={art} />
      <Text style={styles.line}>{line}</Text>
      <Button
        label={actionLabel}
        onPress={onAction}
        variant={actionVariant}
        style={styles.action}
      />
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // Tall on purpose, like `EmptyState`: an empty list has nothing to push
  // against, and a line hugging the header reads as an error.
  root: {
    alignItems: 'center',
    gap: v3.space[16],
    paddingHorizontal: v3.space[24],
    paddingVertical: v3.space[32] + v3.space[16],
  },
  line: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  action: { minWidth: 200, width: 'auto' },

  art: { height: 104, width: 136 },
  bar: { backgroundColor: v3.colors.ink, borderRadius: v3.radius.pill, height: 6 },
  barLong: { width: 44 },
  barShort: { width: 30 },
  barTiny: { width: 20 },

  bubble: { gap: v3.space[6], justifyContent: 'center', paddingHorizontal: v3.space[14] },
  bubbleMine: {
    backgroundColor: v3.hues.lilac,
    borderBottomEndRadius: v3.radius.badge,
    borderBottomStartRadius: v3.space[8],
    borderTopEndRadius: v3.radius.badge,
    borderTopStartRadius: v3.radius.badge,
    height: 56,
    position: 'absolute',
    start: 4,
    top: 6,
    width: 92,
  },
  // Ringed in the ground's colour where it overlaps, so the two read as two.
  bubbleTheirs: {
    alignItems: 'flex-end',
    backgroundColor: v3.hues.sky,
    borderBottomEndRadius: v3.space[8],
    borderBottomStartRadius: v3.radius.badge,
    borderColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.badge,
    borderTopStartRadius: v3.radius.badge,
    borderWidth: 4,
    bottom: 4,
    end: 4,
    height: 52,
    position: 'absolute',
    width: 80,
  },

  card: { borderRadius: v3.radius.row, height: 68, position: 'absolute', width: 68 },
  cardBack: {
    backgroundColor: v3.hues.sky,
    start: 18,
    top: 6,
    transform: [{ rotate: '-10deg' }],
  },
  cardFront: {
    backgroundColor: v3.hues.lilac,
    borderColor: v3.colors.bg,
    borderWidth: 4,
    bottom: 4,
    end: 18,
    gap: v3.space[6],
    justifyContent: 'center',
    paddingHorizontal: v3.space[12],
    transform: [{ rotate: '8deg' }],
  },

  face: {
    alignItems: 'center',
    borderColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    borderWidth: 4,
    height: 60,
    overflow: 'hidden',
    position: 'absolute',
    top: 22,
    width: 60,
  },
  faceOne: { backgroundColor: v3.hues.tangerine, start: 0 },
  faceTwo: { backgroundColor: v3.hues.mint, start: 38 },
  faceThree: { backgroundColor: v3.hues.lilac, start: 76 },
  head: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 16,
    marginTop: v3.space[10],
    width: 16,
  },
  shoulders: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 24,
    marginTop: v3.space[4],
    width: 34,
  },
}))
