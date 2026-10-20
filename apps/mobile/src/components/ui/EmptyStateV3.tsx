import Feather from '@expo/vector-icons/Feather'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from './Button'

/**
 * What the empty list would hold: conversations, Echo cards, people; starred
 * messages, corrections, posts.
 */
export type EmptyArtKind = 'chats' | 'cards' | 'people' | 'starred' | 'corrections' | 'posts'

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
  const { v3 } = useTheme()
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
      ) : kind === 'starred' ? (
        // An outline star over a speech bubble: a kept message.
        <>
          <View style={[styles.bubble, styles.bubbleWide]}>
            <View style={[styles.bar, styles.barLong]} />
            <View style={[styles.bar, styles.barShort]} />
          </View>
          <View style={[styles.disc, styles.discStar]}>
            <Feather name="star" size={v3.icon.xxl} color={v3.colors.ink} />
          </View>
        </>
      ) : kind === 'corrections' ? (
        // A pencil over a sentence line.
        <>
          <View style={styles.sentence}>
            <View style={[styles.bar, styles.barLong]} />
            <View style={[styles.bar, styles.barShort]} />
          </View>
          <View style={[styles.disc, styles.discPencil]}>
            <Feather name="edit-2" size={v3.icon.xxl} color={v3.colors.ink} />
          </View>
        </>
      ) : kind === 'posts' ? (
        // A photo and a speech bubble: the two things a post is made of.
        <>
          <View style={[styles.card, styles.photo]}>
            <View style={styles.sun} />
            <View style={styles.hill} />
          </View>
          <View style={[styles.bubble, styles.bubbleTheirs]}>
            <View style={[styles.bar, styles.barShort]} />
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
  /**
   * A second, quieter sentence under the line, for the boards that draw one:
   * how to fill the list, where the line only says that it is empty.
   */
  body?: string | undefined
  /** Absent where the board draws no way out — the list fills by itself. */
  actionLabel?: string | undefined
  onAction?: (() => void) | undefined
  /**
   * The yellow by default; `blue` where the action leads somewhere else
   * rather than committing; `secondary` where it is an offer rather than the
   * screen's job.
   */
  actionVariant?: 'primary' | 'blue' | 'secondary'
}

/**
 * v3's empty list: a drawn picture, one line, one button.
 *
 * Beside `EmptyState`, which keeps the current look's glyph, title and body
 * until each screen migrates; when the last one has, this takes its name.
 * One line is the rule, because the picture already says which list this
 * is; a quieter `body` under it and the button are there only where a board
 * draws them — how to fill the list, and a way to go and do it.
 */
export function EmptyStateV3({
  art,
  line,
  body,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}: EmptyStateV3Props) {
  const styles = useStyles()
  return (
    <View style={styles.root}>
      <EmptyArt kind={art} />
      <Text style={styles.line}>{line}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
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

/**
 * The empty list on a page whose current look says it in a title and a body
 * under a glyph — likes, followers, notifications — moved to v3's faces
 * with the same words. `EmptyStateV3`'s one line and one button need copy and
 * an action those pages do not have yet; this keeps what they say today.
 */
export function EmptyNoteV3({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
  actionLabel?: string | undefined
  onAction?: (() => void) | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.root}>
      <View style={styles.glyph}>
        <Feather name={icon} size={v3.icon.xxl} color={v3.colors.fg} />
      </View>
      <View style={styles.words}>
        <Text style={styles.line}>{title}</Text>
        <Text style={styles.noteBody}>{body}</Text>
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  glyph: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  words: { alignItems: 'center', gap: v3.space[6] },
  body: {
    ...v3.type.callout,
    color: v3.colors.muted,
    marginTop: -v3.space[8],
    textAlign: 'center',
  },
  // Tall on purpose, like `EmptyState`: an empty list has nothing to push
  // against, and a line hugging the header reads as an error.
  root: {
    alignItems: 'center',
    gap: v3.space[16],
    paddingHorizontal: v3.space[24],
    paddingVertical: v3.space[32] + v3.space[16],
  },
  line: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  noteBody: { ...v3.type.callout, color: v3.colors.muted, textAlign: 'center' },
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

  bubbleWide: {
    backgroundColor: v3.hues.sky,
    borderBottomEndRadius: v3.radius.badge,
    borderBottomStartRadius: v3.space[8],
    borderTopEndRadius: v3.radius.badge,
    borderTopStartRadius: v3.radius.badge,
    bottom: 6,
    height: 60,
    position: 'absolute',
    start: 4,
    width: 104,
  },
  sentence: {
    backgroundColor: v3.hues.mint,
    borderRadius: v3.radius.row,
    bottom: 10,
    gap: v3.space[6],
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: v3.space[14],
    position: 'absolute',
    start: 4,
    width: 112,
  },
  // A glyph on its own hue, ringed in the ground so it reads over the block.
  disc: {
    alignItems: 'center',
    borderColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    borderWidth: 4,
    end: 4,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 60,
  },
  discStar: { backgroundColor: v3.hues.lilac },
  discPencil: { backgroundColor: v3.hues.tangerine },
  photo: { backgroundColor: v3.hues.sky, overflow: 'hidden', start: 8, top: 6 },
  sun: {
    backgroundColor: v3.hues.lime,
    borderRadius: v3.radius.pill,
    end: 10,
    height: 16,
    position: 'absolute',
    top: 10,
    width: 16,
  },
  hill: {
    backgroundColor: v3.hues.mint,
    borderTopEndRadius: v3.radius.badge,
    borderTopStartRadius: v3.radius.badge,
    bottom: 0,
    height: 26,
    position: 'absolute',
    start: -6,
    width: 60,
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
