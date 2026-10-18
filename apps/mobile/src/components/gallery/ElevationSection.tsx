import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

/** A block as it sits on the ground, and the same block behind the scrim. */
function ElevationBody() {
  const styles = useStyles()
  return (
    <V3Plate>
      <View style={styles.row}>
        <View style={styles.cell}>
          <View style={[styles.block, styles.none]} />
          <Text style={styles.name}>{ADMIN.gallery.elevation.none}</Text>
        </View>
        <View style={styles.cell}>
          <View style={styles.block}>
            <View style={[styles.fill, styles.overlay]} />
          </View>
          <Text style={styles.name}>{ADMIN.gallery.elevation.overlay}</Text>
        </View>
      </View>
    </V3Plate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { flexDirection: 'row', gap: v3.space[16] },
  cell: { flex: 1, gap: v3.space[6] },
  block: {
    backgroundColor: v3.hues.sky,
    borderRadius: v3.radius.tile,
    height: 84,
    overflow: 'hidden',
  },
  none: v3.elevation.none,
  fill: { flex: 1 },
  overlay: v3.elevation.overlay,
  name: { ...v3.type.label, color: v3.colors.fg },
}))

export const elevationSection: GallerySectionEntry = {
  key: 'elevation',
  title: ADMIN.gallery.elevation.title,
  hint: ADMIN.gallery.elevation.hint,
  Body: ElevationBody,
}
