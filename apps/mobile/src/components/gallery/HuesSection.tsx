import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { PARTNER_HUES, makeStyles, useTheme } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

/** The six hues in `partnerHueFor`'s order, each as a tile and as a chip. */
function HuesBody() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <V3Plate>
      <View style={styles.grid}>
        {PARTNER_HUES.map((hue) => (
          <View key={hue} style={styles.cell}>
            <View style={[styles.tile, { backgroundColor: v3.hues[hue] }]}>
              <Text style={styles.onHue}>{ADMIN.gallery.hues.sample}</Text>
              <View style={styles.chip}>
                <Text style={[styles.onInk, { color: v3.hues[hue] }]}>
                  {ADMIN.gallery.hues.sample}
                </Text>
              </View>
            </View>
            <Text style={styles.name}>{hue}</Text>
            <Text style={styles.value}>{v3.hues[hue]}</Text>
          </View>
        ))}
      </View>
    </V3Plate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: v3.space[12] },
  cell: { gap: v3.space[2], paddingEnd: v3.space[8], width: '33.33%' },
  tile: {
    alignItems: 'flex-start',
    borderRadius: v3.radius.tile,
    gap: v3.space[6],
    height: 84,
    justifyContent: 'space-between',
    padding: v3.space[12],
  },
  onHue: { ...v3.type.headline, color: v3.colors.ink },
  chip: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[2],
  },
  onInk: v3.type.label,
  name: { ...v3.type.label, color: v3.colors.fg },
  value: { ...v3.type.caption, color: v3.colors.muted },
}))

export const huesSection: GallerySectionEntry = {
  key: 'hues',
  title: ADMIN.gallery.hues.title,
  hint: ADMIN.gallery.hues.hint,
  Body: HuesBody,
}
