import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useLocale } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { PressableScale } from '../ui/PressableScale'
import { useToneColors, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

interface FeatureCardProps {
  tone: ProductTone
  icon: Glyph
  title: string
  body: string
  /**
   * Drawn under the words: a worked example, a small diagram, a pair of
   * buttons. Not with `onPress` — a card that is itself one target cannot
   * also hold targets of its own.
   */
  children?: ReactNode
  /**
   * The card is a way somewhere — a spending item to its place in the store.
   * It becomes one target and gains a chevron.
   */
  onPress?: () => void
}

/**
 * One thing a product does, or one thing that is true of it: Copilot's four
 * helps, the ways LangX Token is earned and spent, Transparency's trust cards.
 *
 * A glyph on the page's colour, a name and a line, on the grey block every v3
 * row group sits on. The colour is the only thing that changes between the
 * four pages; the card does not.
 */
export function FeatureCard({ tone, icon, title, body, children, onPress }: FeatureCardProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const { ground, on } = useToneColors(tone)

  const face = (
    <View style={styles.row}>
      <View style={[styles.square, { backgroundColor: ground }]}>
        <Feather name={icon} size={v3.icon.lg} color={on} />
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {onPress ? (
        // Points onward, so it turns with the reading direction.
        <Feather
          name={isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.muted}
          style={styles.chevron}
        />
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        onPress={onPress}
        scaleTo={PRESS_SCALE_CARD}
        style={styles.card}
      >
        {face}
      </PressableScale>
    )
  }

  return (
    <View style={styles.card}>
      {face}
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[12],
    padding: v3.space[14],
  },
  // Top-aligned: the line beside the glyph often wraps, and a glyph centred
  // on three lines floats loose of the name it belongs to.
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[12] },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
  // The way onward stays on the card's middle however far the words run.
  chevron: { alignSelf: 'center' },
}))
