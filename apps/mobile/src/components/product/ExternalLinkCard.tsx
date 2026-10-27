import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { openExternal } from '../../lib/openExternal'
import { linkAddress } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { PressableScale } from '../ui/PressableScale'
import { useToneField, type ProductMark, type ProductTone } from './tone'

/**
 * The mark's square: the 40pt a row's leading square takes, so the card
 * reads as one of the page's rows. The mark fills it — it is the product's
 * picture, not a glyph on a ground, and a face or a spark needs the points to
 * be recognised.
 */
const MARK = 40

/**
 * The way out of a product page to the product's own site — copilot.langx.io,
 * token.langx.io in the reader's language, insight.langx.io.
 *
 * The one boxed block below the hero, and boxed in the hero's own field with
 * the product's mark in it, so the page closes on the product it opened on:
 * this is where its own site is, not a link to somewhere else.
 *
 * The address under the name is read off the URL the card opens
 * (`linkAddress`), so what it says is where it goes. It opens through
 * `openExternal`: over the app on a phone, in a new tab on the web, and back
 * into the page when it is closed. The glyph at the end says it leaves the
 * app; a screen reader is told the same in words.
 */
export function ExternalLinkCard({
  tone,
  mark: Mark,
  title,
  url,
}: {
  tone: ProductTone
  mark: ProductMark
  /** What is there: "More about Copilot", "Everything about LangX Token". */
  title: string
  url: string
}) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const field = useToneField(tone)
  const address = linkAddress(url)

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${address}`}
      accessibilityHint={t('productPage.opensInBrowser')}
      onPress={() => void openExternal(url)}
      scaleTo={PRESS_SCALE_CARD}
      style={[styles.card, { backgroundColor: field }]}
    >
      <View
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Mark size={MARK} color={v3.colors.fg} />
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{address}</Text>
      </View>
      {/* Out and onward, so it turns with the reading direction. */}
      <Feather
        name="external-link"
        size={v3.icon.md}
        color={v3.colors.fg}
        style={isRtl ? styles.mirrored : null}
      />
    </PressableScale>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    alignItems: 'center',
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[14],
    minHeight: 72,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[12],
  },
  mark: { alignItems: 'center', height: MARK, justifyContent: 'center', width: MARK },
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  address: { ...v3.type.caption, color: v3.colors.muted },
  mirrored: { transform: [{ scaleX: -1 }] },
}))
