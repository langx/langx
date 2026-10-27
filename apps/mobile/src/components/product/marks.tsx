import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import venusHead from '../../../assets/venus/head.png'
import { TokenIcon } from '../ui/TokenIcon'
import type { ProductArt } from './tone'

/** The four products that have a page of their own. */
export type Product = 'venus' | 'copilot' | 'token' | 'transparency'

/**
 * Each product's mark, exactly as the app already draws it somewhere a person
 * has seen it, so the page is recognised before its name is read:
 *
 * - **LangX Token** — the four-pointed spark beside every amount, the wallet's
 *   balance included (`TokenIcon`). A spark and not a coin
 *   (`docs/token-messaging-brief.md`), and a vector, so it stays sharp at
 *   hero size in both schemes.
 * - **Venus** — her face, the picture Home's streak row wears.
 * - **Copilot** — the `cpu` glyph on its label, its button in the composer
 *   and its switch in Settings.
 * - **Transparency** — `bar-chart-2`, the Kitchen's Insights row it grows
 *   out of.
 *
 * Keyed by product rather than passed in by each page, so no page can fall
 * back to a generic glyph: the first draft's Token page wore Feather `award`
 * in an ink disc, which read as a badge rather than as the token.
 */
export const PRODUCT_MARKS: Readonly<Record<Product, ProductArt>> = {
  token: ({ size, color }) => <TokenIcon size={size} color={color} />,
  venus: ({ size }) => (
    <Image
      source={venusHead}
      style={{ height: size, width: size }}
      contentFit="contain"
      accessible={false}
    />
  ),
  copilot: ({ size, color }) => <Feather name="cpu" size={size} color={color} />,
  transparency: ({ size, color }) => <Feather name="bar-chart-2" size={size} color={color} />,
}
