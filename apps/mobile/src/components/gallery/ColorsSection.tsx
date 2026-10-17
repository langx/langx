import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles, useTheme } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

/**
 * Both palettes, every key, in the scheme the app is in now — each on its
 * own ground, since v3's dark surface is only visible against v3's dark bg.
 */
function ColorsBody() {
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  return (
    <>
      <Text style={styles.group}>{ADMIN.gallery.current}</Text>
      <Swatches entries={Object.entries(colors)} />
      <Text style={styles.group}>{ADMIN.gallery.v3}</Text>
      <V3Plate>
        <Swatches entries={Object.entries(v3.colors)} v3 />
      </V3Plate>
    </>
  )
}

function Swatches({ entries, v3 = false }: { entries: [string, string][]; v3?: boolean }) {
  const styles = useStyles()
  return (
    <View style={styles.grid}>
      {entries.map(([name, value]) => (
        <View key={name} style={styles.swatch}>
          <View style={[styles.chip, v3 && styles.chipV3, { backgroundColor: value }]} />
          <View style={styles.words}>
            <Text style={[styles.name, v3 && styles.nameV3]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.value, v3 && styles.valueV3]} numberOfLines={2}>
              {value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  group: { ...v3.type.label, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: v3.space[10] },
  swatch: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8], width: '50%' },
  // A hairline round every chip: a white swatch on a white ground is
  // otherwise a gap in the grid.
  chip: {
    borderColor: colors.border,
    borderRadius: v3.radius.icon,
    borderWidth: 1,
    height: 40,
    width: 40,
  },
  chipV3: { borderColor: v3.colors.line },
  words: { flex: 1, minWidth: 0 },
  name: { ...v3.type.label, color: colors.text },
  nameV3: { color: v3.colors.fg },
  value: { ...v3.type.caption, color: colors.textMuted },
  valueV3: { color: v3.colors.muted },
}))

export const colorsSection: GallerySectionEntry = {
  key: 'colors',
  title: ADMIN.gallery.colors.title,
  hint: ADMIN.gallery.colors.hint,
  Body: ColorsBody,
}
