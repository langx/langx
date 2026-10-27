import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import venusHead from '../../../assets/venus/head.png'
import { makeStyles, useTheme } from '../../lib/theme'
import { TokenIcon } from '../ui/TokenIcon'
import { ROW_SQUARE } from './ProductGroup'
import { useToneColors, type ProductTone } from './tone'

/**
 * The share of the tile a drawn mark takes: a glyph about half the square,
 * as an app icon carries its mark, so the four products sit at one weight.
 */
const GLYPH_SHARE = 0.55

/**
 * The spark a size up. A four-pointed star's arms leave most of its box
 * empty, and at the chip's share it read a weight lighter than the chip and
 * the chart beside it.
 */
const SPARK_SHARE = 0.62

type Draw = (size: { tile: number; color: string }) => ReactNode

/**
 * Each product's own mark, as the app already draws it — never a stock glyph
 * standing in for one. A page names its mark rather than passing a picture,
 * so the four pages cannot drift from the marks people know, as `ProductTone`
 * keeps them to the app's colours.
 */
const MARKS = {
  /** The spark the wallet draws beside every balance (`TokenIcon`). */
  token: ({ tile, color }) => <TokenIcon size={Math.round(tile * SPARK_SHARE)} color={color} />,
  /** The chip on the thread's Copilot button and on every Copilot answer. */
  copilot: ({ tile, color }) => (
    <Feather name="cpu" size={Math.round(tile * GLYPH_SHARE)} color={color} />
  ),
  /**
   * Her face (`assets/venus/head.png`, drawn from the 2D rig), filling the
   * tile and stood on its foot: her ears clear the top corners and her neck
   * runs off the bottom edge.
   */
  venus: ({ tile }) => (
    <Image
      source={venusHead}
      style={{ height: tile * 0.92, marginTop: tile * 0.16, width: tile * 0.92 }}
      contentFit="contain"
    />
  ),
  /** The chart on the Kitchen's link to insight.langx.io. */
  transparency: ({ tile, color }) => (
    <Feather name="bar-chart-2" size={Math.round(tile * GLYPH_SHARE)} color={color} />
  ),
} satisfies Record<string, Draw>

export type ProductMarkName = keyof typeof MARKS

/**
 * The product's mark on a rounded square in its colour — the way an app's
 * icon stands beside its name in a store listing. The same tile at any size:
 * the page's header draws it large, and the link out at the page's foot at a
 * row square's size, so the page ends on the mark it opened with.
 *
 * Drawn at the size it is given: the header's keeps its size whatever the
 * reader's text size, and the link row's grows with the words beside it, as
 * every row's square does. Hidden from a screen reader, since the product's
 * name beside it says the same.
 */
export function ProductMark({
  tone,
  mark,
  size,
}: {
  tone: ProductTone
  mark: ProductMarkName
  size: number
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  // The corner grows with the tile, at the ratio of a row's square to its
  // corner, so a large tile and a row's square read as one shape.
  const radius = (size * v3.radius.icon) / ROW_SQUARE
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: ground, borderRadius: radius, height: size, width: size },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {MARKS[mark]({ tile: size, color: on })}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  // A picture that fills the tile is cut to its corners.
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
}))
