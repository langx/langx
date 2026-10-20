import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'

/**
 * One saved phrase as the redesign draws it (`V-Phrases`, `V-AllPhrases`):
 * a grey block with the phrase big, its meaning, the example in italics,
 * and — on the list of every conversation's — whose chat it came from, with
 * that person's initial on their hue. Data, never interface copy, apart
 * from the "From Anna" the caller words.
 */
export function PhraseTileV3({
  term,
  meaning,
  example,
  from,
}: {
  term: string
  meaning: string
  example?: string | undefined
  from?: { partnerId: string; name: string; label: string } | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.tile}>
      <Text style={styles.term}>{term}</Text>
      <Text style={styles.meaning}>{meaning}</Text>
      {example ? <Text style={styles.example}>{example}</Text> : null}
      {from ? (
        <View style={styles.from}>
          <View
            style={[styles.disc, { backgroundColor: v3.hues[partnerHueFor(from.partnerId)] }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.discText}>{from.name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.fromText}>{from.label}</Text>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  tile: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[4],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  term: { ...v3.type.button, color: v3.colors.fg, fontSize: 20, lineHeight: 26 },
  meaning: { ...v3.type.callout, color: v3.colors.fg },
  example: { ...v3.type.callout, color: v3.colors.muted, fontStyle: 'italic' },
  from: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8], marginTop: v3.space[4] },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  discText: { ...v3.type.label, color: v3.colors.ink, fontSize: 12 },
  fromText: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
}))
