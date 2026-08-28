import { StyleSheet, Text, View } from 'react-native'
import type { StoreOffer } from '../../lib/storeOffers'
import { colors, font, spacing } from '../../lib/theme'
import { Button } from '../ui/Button'

/**
 * One buyable thing. Owned items keep their row rather than disappearing, so
 * the catalogue stays the same shape whoever is looking at it.
 */
export function StoreRow({
  offer,
  pending,
  onBuy,
}: {
  offer: StoreOffer
  pending: boolean
  onBuy: (id: string) => void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.name}>{offer.title}</Text>
        <Text style={styles.meta}>{offer.subtitle}</Text>
      </View>
      <Button
        label={offer.owned ? 'Owned' : `${offer.price} tokens`}
        variant="secondary"
        style={styles.action}
        disabled={offer.owned || !offer.affordable || pending}
        onPress={() => onBuy(offer.id)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * Undoes `Button`'s full-width default, which is right in a form column and
   * wrong here: claiming 100% of a row leaves nothing for the name beside it,
   * and the name column — being `flex: 1`, so shrinkable — collapses to a
   * single character per line rather than pushing back.
   */
  action: { flexShrink: 0, width: 'auto' },
  flex: { flex: 1 },
  meta: { ...font.caption, color: colors.textMuted },
  name: { ...font.body, color: colors.text, fontWeight: '600' },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
})
