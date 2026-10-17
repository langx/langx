import type { ComponentType, ReactNode } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

/**
 * One section of the design gallery, as the registry in `sections.ts` lists
 * it. A section is a file that exports one of these and nothing the gallery
 * has to know about, which is what lets a later PR add one without touching
 * the screen.
 */
export interface GallerySectionEntry {
  key: string
  title: string
  hint?: string
  Body: ComponentType
}

/** The heading and note above a section's body. */
export function GallerySection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string | undefined
  children: ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  )
}

/**
 * A v3 ground to draw v3 samples on. The gallery's own chrome is the current
 * look, and in dark the two grounds differ, so a v3 sample on the current
 * ground would be judged against the wrong colour.
 */
export function V3Plate({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <View style={styles.plate}>{children}</View>
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  section: { gap: v3.space[6], paddingTop: v3.space[24] },
  title: { ...v3.type.headline, color: colors.text },
  hint: { ...v3.type.caption, color: colors.textMuted },
  body: { gap: v3.space[12], paddingTop: v3.space[6] },
  plate: {
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderWidth: 1,
    gap: v3.space[12],
    padding: v3.space[16],
  },
}))
