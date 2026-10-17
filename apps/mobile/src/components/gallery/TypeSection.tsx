import type { TextStyle } from 'react-native'
import { Text, View } from 'react-native'
import { ADMIN } from '../../lib/adminStrings'
import { makeStyles, v3Type, type V3TypeStep } from '../../lib/theme'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'
import { TypeSample } from './GallerySamples'

const STEPS = Object.keys(v3Type) as V3TypeStep[]

/** "Display · 44/46 · Nunito 900", read off the token rather than restated. */
function spec(step: V3TypeStep): string {
  const style: TextStyle = v3Type[step]
  const faces: Record<string, string> = ADMIN.gallery.type.faces
  const face = faces[style.fontFamily ?? 'system'] ?? style.fontFamily ?? ''
  return [
    ADMIN.gallery.type.steps[step],
    ADMIN.gallery.type.metrics(style.fontSize ?? 0, style.lineHeight ?? 0),
    face,
  ].join(' · ')
}

function TypeBody() {
  const styles = useStyles()
  return (
    <V3Plate>
      {STEPS.map((step) => (
        <View key={step} style={styles.row}>
          <TypeSample step={step} />
          <Text style={styles.spec}>{spec(step)}</Text>
        </View>
      ))}
    </V3Plate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { gap: v3.space[2] },
  spec: { ...v3.type.caption, color: v3.colors.muted },
}))

export const typeSection: GallerySectionEntry = {
  key: 'type',
  title: ADMIN.gallery.type.title,
  hint: ADMIN.gallery.type.hint,
  Body: TypeBody,
}
