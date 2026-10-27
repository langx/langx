import Feather from '@expo/vector-icons/Feather'
import { Children, useState, type ReactNode } from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import { useLocale } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { PressableScale } from '../ui/PressableScale'
import { useToneColors, type ProductArt, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * `children` or `onPress`, never both — a card that is itself one target
 * cannot also hold targets of its own. A union rather than a note, so a page
 * that passes both is refused by the compiler instead of losing its example.
 */
type FeatureCardProps = {
  tone: ProductTone
  /**
   * A Feather glyph, or the app's own drawing of the thing where it has one —
   * the streak freeze's six-armed mark (`FreezeGlyph`) — so a tile pictures a
   * thing the way the rest of the app does.
   */
  icon: Glyph | ProductArt
  title: string
  body: string
} & (
  | {
      /** Drawn under the words: a worked example, a small diagram, a pair of buttons. */
      children?: ReactNode
      onPress?: never
    }
  | {
      /**
       * The card is a way somewhere — a spending item to its place in the
       * store. It becomes one target and its picture gains an arrow.
       */
      onPress: () => void
      children?: never
    }
)

/**
 * The picture's height. Not text, so it keeps its size whatever the reader's
 * text size: the words under it grow, the picture does not.
 */
const ART = 88

/** The glyph on the picture: big enough to be the picture, not a bullet. */
const ART_GLYPH = 40

/**
 * One thing a product does, or one thing that is true of it: Copilot's four
 * helps, the ways LangX Token is spent, Transparency's trust cards.
 *
 * An illustrated tile. Its top is a picture — a panel of the page's colour
 * with the thing's own glyph large on it — and its name and a line sit under
 * it on the grey every v3 row group sits on. The colour is the illustration:
 * no drawing of ours, nothing that has to be translated, and the same four
 * colours as the rest of the app. Picture on top rather than beside the words,
 * so a tile keeps its shape at any text size and two can stand side by side
 * (`FeatureGrid`).
 */
export function FeatureCard({ tone, icon, title, body, children, onPress }: FeatureCardProps) {
  const styles = useStyles()
  const { isRtl } = useLocale()
  const { ground, on } = useToneColors(tone)

  const face = (
    <>
      <View
        style={[styles.art, { backgroundColor: ground }]}
        // The title says what it is; the picture alone is decoration.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {typeof icon === 'string' ? (
          <Feather name={icon} size={ART_GLYPH} color={on} />
        ) : (
          icon({ size: ART_GLYPH, color: on })
        )}
        {onPress ? (
          // Points onward, so it turns with the reading direction. In the
          // picture's corner rather than beside the title, so a two-up tile's
          // name keeps its whole width.
          <View style={styles.onward}>
            <Feather name={isRtl ? 'arrow-left' : 'arrow-right'} size={ONWARD} color={on} />
          </View>
        ) : null}
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </>
  )

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        onPress={onPress}
        scaleTo={PRESS_SCALE_CARD}
        style={styles.card}
        touchStyle={styles.touch}
      >
        {face}
      </PressableScale>
    )
  }

  return (
    <View style={styles.card}>
      {face}
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  )
}

/** The arrow in a pressable tile's picture. */
const ONWARD = 18

/**
 * The narrowest a tile may be, in points at the default text size. Below it
 * a tile's name — "Frames and titles", "Ein verpasster Tag" — no longer fits
 * two lines, and two narrow tiles read worse than one wide one.
 */
const TILE_MIN = 148

/**
 * Feature tiles two to a row where two fit, one to a row where they do not.
 *
 * Whether two fit is decided from the room the grid really has and the
 * reader's text size, not from the screen: a tile is as narrow as it may be at
 * `TILE_MIN` at the default size, and that floor grows with the text, so at
 * the larger sizes the tiles stack and keep their words whole. A row of two
 * is as tall as its taller tile, and a last tile on its own keeps a tile's
 * width rather than stretching across.
 */
export function FeatureGrid({ children }: { children: ReactNode }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { fontScale } = useWindowDimensions()
  const [room, setRoom] = useState(0)
  const tiles = Children.toArray(children)
  const twoUp = room > 0 && (room - v3.space[12]) / 2 >= TILE_MIN * Math.max(fontScale, 1)
  const across = twoUp ? 2 : 1

  const rows: ReactNode[][] = []
  for (let i = 0; i < tiles.length; i += across) rows.push(tiles.slice(i, i + across))

  return (
    <View style={styles.grid} onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((tile, cell) => (
            <View key={cell} style={styles.cell}>
              {tile}
            </View>
          ))}
          {row.length < across ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // The picture is inset by the card's own padding, and its corner is the
  // card's less that padding, so the two curves run parallel.
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexGrow: 1,
    gap: v3.space[12],
    padding: v3.space[10],
  },
  // A pressable tile fills its cell too, so the two in a row are one height.
  touch: { flexGrow: 1 },
  art: {
    alignItems: 'center',
    borderRadius: v3.radius.tile - v3.space[10],
    height: ART,
    justifyContent: 'center',
  },
  onward: { end: v3.space[10], position: 'absolute', top: v3.space[10] },
  // Back in by the rest of a tile's inset, so the words start 16 from its
  // edge, as every v3 block's text does.
  words: {
    gap: v3.space[2],
    minWidth: 0,
    paddingBottom: v3.space[6],
    paddingHorizontal: v3.space[6],
  },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
  extra: { paddingBottom: v3.space[6], paddingHorizontal: v3.space[6] },
  grid: { gap: v3.space[12] },
  row: { flexDirection: 'row', gap: v3.space[12] },
  cell: { flex: 1, minWidth: 0 },
}))
