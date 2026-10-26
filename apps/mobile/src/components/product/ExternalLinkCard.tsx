import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { openExternal } from '../../lib/openExternal'
import { linkAddress } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { PressableScale } from '../ui/PressableScale'
import { useToneColors, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The way out of a product page to the product's own site — copilot.langx.io,
 * token.langx.io in the reader's language, insight.langx.io.
 *
 * The address under the name is read off the URL the card opens
 * (`linkAddress`), so what it says is where it goes. It opens through
 * `openExternal`: over the app on a phone, in a new tab on the web, and back
 * into the page when it is closed. The glyph at the end says it leaves the
 * app; a screen reader is told the same in words.
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
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  const address = linkAddress(url)

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${address}`}
      accessibilityHint={t('productPage.opensInBrowser')}
      onPress={() => void openExternal(url)}
      scaleTo={PRESS_SCALE_CARD}
      style={styles.card}
    >
      <View style={[styles.square, { backgroundColor: ground }]}>
        <Feather name={icon} size={v3.icon.lg} color={on} />
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{address}</Text>
      </View>
      <Feather name="external-link" size={v3.icon.md} color={v3.colors.fg} />
    </PressableScale>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 64,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  address: { ...v3.type.caption, color: v3.colors.muted },
}))
