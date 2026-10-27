import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useLocale } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { PressableScale } from '../ui/PressableScale'
import { useToneField, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * `children` or `onPress`, never both — a row that is itself one target
 * cannot also hold targets of its own. A union rather than a note, so a page
 * that passes both is refused by the compiler instead of losing its example.
 */
type FeatureCardProps = {
  tone: ProductTone
  /**
   * What the row is about, on the page's field. Left out for a list of plain
   * statements — "What it isn't" — where a glyph per line would only repeat
   * the heading.
   */
  icon?: Glyph
  title: string
  body?: string
} & (
  | {
      /** Drawn under the words: a worked example, a small diagram, a pair of buttons. */
      children?: ReactNode
      onPress?: never
    }
  | {
      /**
       * The row is a way somewhere — a spending item to its place in the
       * store. It becomes one target and gains a chevron.
       */
      onPress: () => void
      children?: never
    }
)

/**
 * One thing a product does, or one thing that is true of it: Copilot's four
 * helps, the ways LangX Token is earned and spent, Transparency's trust
 * points.
 *
 * A row in a list, not a box: a glyph on the page's field, a name and a line,
 * straight on the ground. The field is the only colour, and the same one the
 * hero stands on, so every row is visibly part of the same product.
 */
export function FeatureCard({ tone, icon, title, body, children, onPress }: FeatureCardProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const field = useToneField(tone)

  const face = (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.square, { backgroundColor: field }]}>
          <Feather name={icon} size={v3.icon.lg} color={v3.colors.fg} />
        </View>
      ) : null}
      <View style={[styles.words, !icon && styles.wordsPlain]}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
      {onPress ? (
        // Points onward, so it turns with the reading direction.
        <Feather
          name={isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.muted}
          style={styles.chevron}
        />
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={body ? `${title}. ${body}` : title}
        onPress={onPress}
        scaleTo={PRESS_SCALE_CARD}
      >
        {face}
      </PressableScale>
    )
  }

  return (
    <View style={styles.item}>
      {face}
      {children ? <View style={icon ? styles.under : null}>{children}</View> : null}
    </View>
  )
}

const SQUARE = 40

const useStyles = makeStyles(({ v3 }) => ({
  item: { gap: v3.space[12] },
  // Top-aligned: the line beside the glyph often wraps, and a glyph centred
  // on three lines floats loose of the name it belongs to.
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[14] },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: SQUARE,
    justifyContent: 'center',
    width: SQUARE,
  },
  // The name's first line sits level with the middle of the square.
  words: { flex: 1, gap: v3.space[2], minWidth: 0, paddingTop: v3.space[8] },
  wordsPlain: { paddingTop: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
  // The way onward stays on the row's middle however far the words run.
  chevron: { alignSelf: 'center' },
  // An example under a row starts where its words do, not under the glyph.
  under: { paddingStart: SQUARE + v3.space[14] },
}))
