import { Pressable, Text, View } from 'react-native'
import type { StoreOffer } from '../../lib/storeOffers'
import { useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'

/**
 * One buyable thing. Owned items keep their row rather than disappearing, so
 * the catalogue stays the same shape whoever is looking at it.
 *
 * The price *is* the button. A separate "Buy" beside a number would be two
 * controls for one decision, and the design's row has room for one.
 */
export function StoreRow({
  offer,
  pending,
  last = false,
  onBuy,
}: {
  offer: StoreOffer
  pending: boolean
  last?: boolean
  onBuy: (id: string) => void
}) {
  const t = useT()
  const styles = useStyles()
  const buyable = !offer.owned && offer.affordable && !pending

  return (
    <View style={[styles.row, !last && styles.divided]}>
      <View style={styles.text}>
        <Text style={styles.name}>{offer.title}</Text>
        <Text style={styles.meta}>{offer.subtitle}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          offer.owned
            ? t('store.ownedAccessibility', { title: offer.title })
            : t('store.buy', { title: offer.title, price: offer.price })
        }
        accessibilityState={{ disabled: !buyable }}
        disabled={!buyable}
        onPress={() => onBuy(offer.id)}
        style={({ pressed }) => [
          styles.price,
          // Yellow only when the tap does something. An affordable, unowned
          // offer is a committing action and takes `primary`; everything else
          // is a label that happens to be shaped like a button.
          buyable ? styles.buyable : styles.inert,
          pressed && buyable && styles.pressed,
        ]}
      >
        <Text style={[styles.priceLabel, buyable && styles.buyableLabel]}>
          {offer.owned ? t('store.owned') : String(offer.price)}
        </Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  // v3 rows run edge to edge of the screen's own padding, divided by
  // hairlines; the price is a bold Nunito numeral, filled only when tappable.
  row: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 16 },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  text: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { ...font.label, color: colors.textMuted, fontWeight: '400' },
  price: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 15,
  },
  buyable: { backgroundColor: colors.primary },
  inert: {},
  pressed: { backgroundColor: colors.primaryShade },
  priceLabel: { ...font.heading, color: colors.textMuted, fontSize: 16 },
  buyableLabel: { color: colors.primaryText },
}))
