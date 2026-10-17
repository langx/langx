import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles, v3Radius } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

function RadiiBody() {
  const styles = useStyles()
  return (
    <V3Plate>
      <View style={styles.row}>
        {Object.entries(v3Radius).map(([name, value]) => (
          <View key={name} style={styles.cell}>
            <View style={[styles.shape, { borderRadius: value }]} />
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    </V3Plate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[12] },
  cell: { alignItems: 'center', gap: v3.space[4] },
  // Big enough that `hero` and `pill` differ: at 64pt both would be a circle.
  shape: { backgroundColor: v3.colors.surface, height: 96, width: 96 },
  name: { ...v3.type.label, color: v3.colors.fg },
  value: { ...v3.type.caption, color: v3.colors.muted },
}))

export const radiiSection: GallerySectionEntry = {
  key: 'radii',
  title: ADMIN.gallery.radii.title,
  Body: RadiiBody,
}
