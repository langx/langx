import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles, useTheme, v3Icon } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

function IconsBody() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <V3Plate>
      <View style={styles.row}>
        {Object.entries(v3Icon).map(([name, size]) => (
          <View key={name} style={styles.cell}>
            <View style={styles.glyph}>
              <Feather name="message-circle" size={size} color={v3.colors.fg} />
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.value}>{size}</Text>
          </View>
        ))}
      </View>
    </V3Plate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[16] },
  cell: { alignItems: 'center', gap: v3.space[4] },
  // A fixed box the size of the largest glyph, so the sizes compare on one baseline.
  glyph: { alignItems: 'center', height: v3Icon.xl, justifyContent: 'center', width: v3Icon.xl },
  name: { ...v3.type.label, color: v3.colors.fg },
  value: { ...v3.type.caption, color: v3.colors.muted },
}))

export const iconsSection: GallerySectionEntry = {
  key: 'icons',
  title: ADMIN.gallery.icons.title,
  hint: ADMIN.gallery.icons.hint,
  Body: IconsBody,
}
