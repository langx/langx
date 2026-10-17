import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles, v3Space } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

/** Each step as a square of its own size, so the half steps read as half steps. */
function SpacingBody() {
  const styles = useStyles()
  return (
    <V3Plate>
      {Object.values(v3Space).map((value) => (
        <View key={value} style={styles.row}>
          <Text style={styles.value}>{value}</Text>
          <View style={[styles.square, { height: value, width: value }]} />
        </View>
      ))}
    </V3Plate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  value: { ...v3.type.label, color: v3.colors.fg, minWidth: 28 },
  square: { backgroundColor: v3.colors.blue },
}))

export const spacingSection: GallerySectionEntry = {
  key: 'spacing',
  title: ADMIN.gallery.spacing.title,
  hint: ADMIN.gallery.spacing.hint,
  Body: SpacingBody,
}
