import { useT } from '../../i18n'
import { openExternal } from '../../lib/openExternal'
import { linkAddress } from '../../lib/productPage'
import { ProductGroup, ProductRow, ROW_SQUARE, useGlyphScale } from './ProductGroup'
import { ProductMark, type ProductMarkName } from './ProductMark'
import type { ProductTone } from './tone'

/**
 * The way out of a product page to the product's own site — copilot.langx.io,
 * token.langx.io in the reader's language, insight.langx.io.
 *
 * One row on its own block, led by the product's own mark at a row square's
 * size, so the page ends on the product it opened with rather than on a stock
 * globe. An arrow on a disc at its end says it leaves the app, and a screen
 * reader is told the same in words. The address under the name is read off
 * the URL the row opens (`linkAddress`), so what it says is where it goes. It
 * opens through `openExternal`: over the app on a phone, in a new tab on the
 * web, and back into the page when it is closed.
 */
export function ExternalLinkCard({
  tone,
  mark,
  title,
  url,
}: {
  tone: ProductTone
  /** The page's own mark, the one its header carries (`ProductMark`). */
  mark: ProductMarkName
  /** What is there, as a reason to go: "Every rule, explained". */
  title: string
  url: string
}) {
  const t = useT()
  const scale = useGlyphScale()
  return (
    <ProductGroup>
      <ProductRow
        leading={<ProductMark tone={tone} mark={mark} size={ROW_SQUARE * scale} />}
        title={title}
        body={linkAddress(url)}
        external
        accessibilityHint={t('productPage.opensInBrowser')}
        onPress={() => void openExternal(url)}
      />
    </ProductGroup>
  )
}
