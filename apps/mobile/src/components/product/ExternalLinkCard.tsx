import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { openExternal } from '../../lib/openExternal'
import { linkAddress } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { PressableScale } from '../ui/PressableScale'
import { PRODUCT_MARKS, type Product } from './marks'
import { useToneColors, type ProductTone } from './tone'

/** The mark at the card's start: the hero's, small. */
const MARK = 40

/** The way-out disc at the card's end. */
const DISC = 44

/**
 * The title stops at 2×, 44pt, the hero name's own size: past it one word —
 * "explained" — is wider than the card on a 375pt phone.
 */
const TITLE_MAX_SCALE = 2

/**
 * The address stops at 1.6×. It is one unbroken string — "token.langx.io/pt-br"
 * has no space to wrap at — and past that it is wider than the card.
 */
const ADDRESS_MAX_SCALE = 1.6

/**
 * The way out of a product page to the product's own site — copilot.langx.io,
 * token.langx.io in the reader's language, insight.langx.io.
 *
 * The foot of the page in the page's colour, with the product's mark again,
 * small: the page opens on its colour and closes on it, so the last thing on
 * it is the product rather than a grey row. The address under the name is
 * read off the URL the card opens (`linkAddress`), so what it says is where
 * it goes. It opens through `openExternal`: over the app on a phone, in a new
 * tab on the web, and back into the page when it is closed. The arrow in its
 * corner says it leaves the app; a screen reader is told the same in words.
 */
export function ExternalLinkCard({
  product,
  tone,
  title,
  url,
}: {
  /** Whose page this is; the card carries that product's mark (`PRODUCT_MARKS`). */
  product: Product
  tone: ProductTone
  /** What is there: "More about Copilot", "Every rule, explained". */
  title: string
  url: string
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const { ground, on } = useToneColors(tone)
  const address = linkAddress(url)

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${address}`}
      accessibilityHint={t('productPage.opensInBrowser')}
      onPress={() => void openExternal(url)}
      scaleTo={PRESS_SCALE_CARD}
      style={[styles.card, { backgroundColor: ground }]}
    >
      {/* The mark and the way out share the top row; the words take the
          card's whole width under them, so a title and an address never
          wrap round a disc at the larger text sizes. */}
      <View style={styles.top}>
        <View style={styles.mark}>{PRODUCT_MARKS[product]({ size: MARK, color: on })}</View>
        {/* A disc in the card's text colour with the arrow cut out of it in
            the tone: ink on a hue, white on the blue. The arrow leans out of
            the page, so it turns with the reading direction. */}
        <View style={[styles.disc, { backgroundColor: on }]}>
          <Feather
            name={isRtl ? 'arrow-up-left' : 'arrow-up-right'}
            size={v3.icon.lg}
            color={ground}
          />
        </View>
      </View>
      <View style={styles.words}>
        <Text style={[styles.title, { color: on }]} maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          {title}
        </Text>
        <Text style={[styles.address, { color: on }]} maxFontSizeMultiplier={ADDRESS_MAX_SCALE}>
          {address}
        </Text>
      </View>
    </PressableScale>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    padding: v3.space[20],
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  mark: { alignItems: 'center', height: MARK, justifyContent: 'center', width: MARK },
  words: { gap: v3.space[2], minWidth: 0 },
  title: v3.type.headline,
  address: { ...v3.type.caption, fontWeight: '600' },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
}))
