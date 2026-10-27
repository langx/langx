import type Feather from '@expo/vector-icons/Feather'
import { useT } from '../../i18n'
import { openExternal } from '../../lib/openExternal'
import { linkAddress } from '../../lib/productPage'
import { ProductGroup, ProductRow, RowSquare } from './ProductGroup'
import type { ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The way out of a product page to the product's own site — copilot.langx.io,
 * token.langx.io in the reader's language, insight.langx.io.
 *
 * One row on its own block, drawn as Settings draws a row that leaves the
 * app: the glyph at its end says so, and a screen reader is told the same in
 * words. The address under the name is read off the URL the row opens
 * (`linkAddress`), so what it says is where it goes. It opens through
 * `openExternal`: over the app on a phone, in a new tab on the web, and back
 * into the page when it is closed.
 */
export function ExternalLinkCard({
  tone,
  icon,
  title,
  url,
}: {
  tone: ProductTone
  icon: Glyph
  /** What is there: "More about Copilot", "Every question, answered". */
  title: string
  url: string
}) {
  const t = useT()
  return (
    <ProductGroup>
      <ProductRow
        leading={<RowSquare tone={tone} icon={icon} />}
        title={title}
        body={linkAddress(url)}
        external
        accessibilityHint={t('productPage.opensInBrowser')}
        onPress={() => void openExternal(url)}
      />
    </ProductGroup>
  )
}
