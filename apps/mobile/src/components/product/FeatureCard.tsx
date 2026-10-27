import type Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { ProductRow, RowSquare } from './ProductGroup'
import type { ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * `children` or `onPress`, never both — a row that is itself one target
 * cannot also hold targets of its own. A union rather than a note, so a page
 * that passes both is refused by the compiler instead of losing its example.
 */
type FeatureCardProps = {
  tone: ProductTone
  icon: Glyph
  title: string
  body: string
  /** A short readout at the row's end: "1,240 ✦" (`TOKEN_MARK`), "Beta". */
  value?: string
  /** What a screen reader says for `value` when it holds the token's mark. */
  valueLabel?: string
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
 * helps, the ways LangX Token is earned and spent, Transparency's trust cards.
 *
 * A row in a `ProductGroup`: a glyph on the page's colour, a name and a line,
 * as a Settings row is drawn. The colour is the only thing that changes
 * between the four pages; the row does not.
 */
export function FeatureCard({
  tone,
  icon,
  title,
  body,
  value,
  valueLabel,
  children,
  onPress,
}: FeatureCardProps) {
  const leading = <RowSquare tone={tone} icon={icon} />
  if (onPress) {
    return (
      <ProductRow
        leading={leading}
        title={title}
        body={body}
        value={value}
        valueLabel={valueLabel}
        onPress={onPress}
      />
    )
  }
  return (
    <ProductRow leading={leading} title={title} body={body} value={value} valueLabel={valueLabel}>
      {children}
    </ProductRow>
  )
}
